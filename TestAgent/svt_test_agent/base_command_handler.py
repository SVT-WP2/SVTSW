from __future__ import annotations

"""
Command handling for the SVT Test Agent.

This module implements the main command handler logic:
  - Validation of incoming RunTest-style commands.
  - Optional inflation of test parameters from the DB when only IDs are
    provided (chipId, testId, configId).
  - Normalisation of test and agent status codes.
  - Streaming RunTest replies and a collector helper.
  - Abort and TestStatus commands.
  - MetaHelper, a lightweight wrapper for carrying meta-information
    alongside events.

Location: svt_test_agent/command_handler.py
"""

import copy
import logging
import threading
import os
from typing import Any, Dict, Generator, Iterable, List, Optional, Tuple, TYPE_CHECKING, Union

from svt_test_agent.db_client import fetch_from_db, save_test_to_db
from svt_test_agent.test_system_client import TestSystemClient
from svt_test_agent.registries.validate_tests import validate, validate_test_values
from svt_test_agent.utilities import errors as err

if TYPE_CHECKING:
    from svt_test_agent.test_agent import HandlerContext
else:
    class HandlerContext:  # type: ignore
        pass

# ------------------------------------------------------------------------------
# Logger / basic types
# ------------------------------------------------------------------------------
logger = logging.getLogger("CommandHandler")
logger.setLevel(logging.NOTSET)

JsonDict  = Dict[str, Any]
GenTriple = Generator[Tuple[Any, str, str], None, None]  # (values_or_error, testStatus, statusMsg)

TEST_RUNNING = "TestRunning"
TEST_SUCCESS = "TestSuccess" or "Success"
TEST_FAIL    = "TestFail"


class BaseCmdHandler:
    """
    Base command handler.

    Provides:
      - Normalisation of status values.
      - DB inflation of chip/test/config from IDs.
      - Core RunTest streaming logic.
      - Result collection helper.
      - Abort and TestStatus operations.
    """

    def __init__(self, client: Optional[TestSystemClient] = None) -> None:
        logger.debug("BaseCmdHandler.__init__(client=%s)", type(client).__name__ if client else None)
        self._client = client or TestSystemClient()
        self._abort_event = threading.Event()
        logger.debug("Abort event created; client=%s", type(self._client).__name__)

    # ------------------------------------------------------------------ Status
    @staticmethod
    def _norm_status(s: Optional[str]) -> str:
        m = (s or "").strip().lower()
        out = TEST_FAIL
        if m in ("running",):
            out = TEST_RUNNING
        elif m in ("success",):
            out = TEST_SUCCESS
        elif m in ("fail", "error"):
            out = TEST_FAIL
        logger.debug("_norm_status(%r) -> %s", s, out)
        return out

    @staticmethod
    def _ensure_period(s: str) -> str:
        s0 = (s or "").rstrip()
        res = s0 if s0.endswith((".", "!", "?")) else (s0 + ".")
        logger.debug("_ensure_period(%r) -> %r", s, res)
        return res

    # --------------------------------------------------------------- Meta utils
    @staticmethod
    def _ensure_meta(meta: Any) -> "MetaHelper":
        mh = MetaHelper.ensure(meta)
        logger.debug("_ensure_meta(...) -> %s", mh)
        return mh

    @staticmethod
    def _emit(envelope: Dict[str, Any], meta: "MetaHelper" | Dict[str, Any]) -> Dict[str, Any]:
        m = meta.as_dict() if isinstance(meta, MetaHelper) else dict(meta or {})
        logger.debug("_emit(envelope_keys=%s, meta_keys=%s)", list(envelope.keys()), list(m.keys()))
        return {"out": envelope, "_meta": m}

    # ------------------------------------------------------------ Error helpers
    @staticmethod
    def _extract_error_text(maybe_err: Any, *, default: str = "Operation failed") -> str:
        try:
            if isinstance(maybe_err, dict):
                data = maybe_err.get("statusDetails") or {}
                msg = data.get("error") or maybe_err.get("statusMsg") or maybe_err.get("message")
                out = str(msg) if msg else default
                logger.debug("_extract_error_text(dict) -> %r", out)
                return out
            out = str(maybe_err) if maybe_err is not None else default
            logger.debug("_extract_error_text(%r) -> %r", maybe_err, out)
            return out
        except Exception:
            logger.exception("_extract_error_text failed; returning default")
            return default

    # --------------------------------------------------------- Message helpers
    @staticmethod
    def _progress_message(full_meta: Optional[Dict[str, Any]]) -> str:
        full_meta = MetaHelper.ensure(full_meta)
        msg = str(full_meta.message or "").strip()
        if msg:
            logger.debug("_progress_message: using explicit message=%r", msg)
            return msg

        chip = str(full_meta.chipName or "").strip()
        test = str(full_meta.testName or "").strip()
        pct = full_meta.percentageCompleted
        if pct is None:
            pct = full_meta.percentageCompeted
        pct_s = f"{int(pct)}%" if isinstance(pct, (int, float)) else ""
        out = " ".join(x for x in (chip, test, pct_s) if x)
        logger.debug("_progress_message -> %r", out)
        return out

    @staticmethod
    def _strip_status_prefix(msg: Optional[str]) -> str:
        if not msg:
            return ""
        s = str(msg)
        for prefix in ("TestRunning: ", "Running: ", "TestSuccess: ", "TestFail: "):
            if s.startswith(prefix):
                res = s[len(prefix):]
                logger.debug("_strip_status_prefix(%r) -> %r", msg, res)
                return res
        logger.debug("_strip_status_prefix(%r) -> %r", msg, s)
        return s

    @staticmethod
    def _loop_prefix(iteration: Optional[int], total: Optional[int]) -> str:
        if iteration is None:
            out = "TestLoopRunning"
        elif isinstance(total, int) and total > 0:
            out = f"TestLoopRunning-Iteration {iteration}/{total}"
        else:
            out = f"TestLoopRunning-Iteration {iteration}"
        logger.debug("_loop_prefix(iteration=%s,total=%s) -> %s", iteration, total, out)
        return out

    @staticmethod
    def _with_sequence_prefix(step: Optional[int], chip: str, test: str, base: str) -> str:
        step_s = (str(step) if step is not None else "?")
        chip = chip or ""
        test = test or ""
        out = f"SequenceStep {step_s} ({chip} {test}) : {base}"
        logger.debug("_with_sequence_prefix -> %r", out)
        return out

    # ---------------------------------------------------------- DB save helper
    def _save_final_result(
        self,
        *,
        chip_name: str,
        test_name: str,
        test_values: Dict[str, Any] | Any,
        params: Dict[str, Any] | None,
        request_id: str | None,
    ) -> None:
        logger.debug(
            "_save_final_result(chip=%r, test=%r, keys=%s, req_id=%r)",
            chip_name,
            test_name,
            list(test_values.keys()) if isinstance(test_values, dict) else ["<non-dict>"],
            request_id,
        )
        try:
            p = params or {}

            def _coerce_int(x, default=0):
                try:
                    if isinstance(x, (list, tuple)) and x:
                        x = x[0]
                    return int(x)
                except Exception:
                    return default

            test_id       = _coerce_int(p.get("testId") or p.get("test_id") or 0)
            asic_id       = _coerce_int(p.get("asicId") or p.get("asic_id") or 0)
            test_setup_id = _coerce_int(p.get("testSetupId") or p.get("test_setup_id") or 0)
            config_id     = _coerce_int(p.get("configId") or p.get("config_id") or 0)

            values = test_values if isinstance(test_values, dict) else {"outputs": test_values}
            logger.debug(
                "Saving to DB: test_id=%s asic_id=%s test_setup_id=%s config_id=%s",
                test_id,
                asic_id,
                test_setup_id,
                config_id,
            )

            rep = save_test_to_db(
                chip_name=str(chip_name or "").strip(),
                test_name=str(test_name or "").strip(),
                test_id=test_id,
                test_values=values,
                asic_id=asic_id,
                test_setup_id=test_setup_id,
                config_id=config_id,
                request_id=str(request_id) if request_id is not None else "unknown",
            )
            ok, maybe_err = err.from_db_payload("SaveTestToDB", request_id, rep)
            if not ok:
                logger.warning("DB save returned non-success (ignored): %s", maybe_err)
            else:
                logger.debug("DB save success")
        except Exception:
            logger.exception("DB save failed (ignored)")

    # --------------------------------------------------------------- System API
    @staticmethod
    def is_system_busy() -> bool:
        try:
            busy = bool(getattr(TestSystemClient(), "is_busy", lambda: False)())
            logger.debug("is_system_busy -> %s", busy)
            return busy
        except Exception:
            logger.exception("is_system_busy check failed")
            return False

    @staticmethod
    def _pack_event(out_envelope: Dict[str, Any], meta: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        logger.debug("_pack_event(keys=%s, meta_keys=%s)", list((out_envelope or {}).keys()), list((meta or {}).keys()))
        return {"out": out_envelope, "_meta": meta or {}}

    @staticmethod
    def _unpack_event(ev: Any) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        if isinstance(ev, dict) and "out" in ev:
            out = ev.get("out") or {}
            meta = ev.get("_meta") or {}
            logger.debug(
                "_unpack_event(dict-with-out) -> out_keys=%s meta_keys=%s",
                list(out.keys()),
                list(meta.keys()),
            )
            return out, meta
        out = ev if isinstance(ev, dict) else {}
        logger.debug("_unpack_event(other) -> keys=%s", list(out.keys()))
        return out, {}

    # --------------------------------------------------------------- Reply core
    @staticmethod
    def _reply(
        stream: bool,
        cmd_type: str,
        *,
        status: str,
        values: Any = None,
        status_msg: Optional[str] = None,
        status_details: Optional[Dict[str, Any]] = None,
        error: Any = None,
        payload_key: str = "testValues",
        request_id: Optional[str] = None,
        meta: Optional["MetaHelper" | Dict[str, Any]] = None,
    ) -> JsonDict:
        logger.debug(
            "_reply(stream=%s, cmd=%s, status=%s, has_values=%s, has_details=%s, err=%s, req=%s)",
            stream,
            cmd_type,
            status,
            values is not None,
            status_details is not None,
            error is not None,
            request_id,
        )
        meta = MetaHelper.ensure(meta)
        out: JsonDict = {
            "type": f"{cmd_type}{'StreamReply' if stream else 'Reply'}",
            "testStatus": status,
            "agentStatus": "TestAgentSuccess",
        }
        if request_id is not None:
            out["requestId"] = str(request_id)

        if stream:
            if status_details is not None:
                out["statusDetails"] = status_details
            elif status_msg:
                out["statusDetails"] = {"message": status_msg}
        else:
            out[payload_key] = values
            if status_details is not None:
                out["statusDetails"] = status_details
            elif status_msg:
                out["statusDetails"] = {"message": status_msg}

        if status == TEST_FAIL and error is not None:
            out["testError"] = error

        # Local/offline mode emits a simplified shape for direct consumption.
        if meta.localMode or meta.offlineMode:
            local_out: JsonDict = {}
            test_cfg = meta.testConfiguration
            if status == TEST_SUCCESS:
                local_out = {
                    "command": cmd_type,
                    "testStatus": TEST_SUCCESS,
                    "chipName": meta.chipName,
                }
                if test_cfg not in ({}, None):
                    local_out["testConfigurations"] = test_cfg
                local_out[payload_key] = values or (status_details or {}).get("outputs")
                logger.debug("_reply(local/offline success) -> keys=%s", list(local_out.keys()))
                return BaseCmdHandler._emit(local_out, meta)

            if status == TEST_FAIL and error is not None:
                local_out = {
                    "command": cmd_type,
                    "testStatus": TEST_FAIL,
                    "chipName": meta.chipName,
                }
                if "Sequence" not in cmd_type:
                    local_out["testName"] = meta.testName
                if test_cfg not in ({}, None):
                    local_out["testConfigurations"] = test_cfg
                local_out["testError"] = error
                logger.debug("_reply(local/offline fail) -> keys=%s", list(local_out.keys()))
                return BaseCmdHandler._emit(local_out, meta)

        logger.debug("_reply(standard) -> keys=%s", list(out.keys()))
        return BaseCmdHandler._emit(out, meta)

    # -------------------------------------------------------------- Iterations
    @staticmethod
    def _extract_and_strip_iterations(
        data: Optional[JsonDict],
        default: int = 1,
    ) -> tuple[int, JsonDict]:
        logger.debug(
            "_extract_and_strip_iterations(default=%s) IN keys=%s",
            default,
            list((data or {}).keys()),
        )
        if not isinstance(data, dict):
            return max(1, int(default)), {}

        d = copy.deepcopy(data)
        meta = MetaHelper.ensure(d.get("_meta"))
        d["_meta"] = meta.as_dict()
        found = None

        for container_key in (None, "params"):
            container = d if container_key is None else d.get("params", {})
            if not isinstance(container, dict):
                continue
            for key in ("iterations", "iteration", "ïterations"):
                if key in container:
                    found = container.pop(key, None)
                    logger.debug("Found %r in %s -> %r", key, container_key or "<top>", found)
                    break
            if found is not None:
                break

        try:
            it = int(found) if found is not None else int(default)
        except Exception:
            it = int(default)

        it = max(1, it)
        logger.debug("_extract_and_strip_iterations -> iterations=%d", it)
        return it, d

    # -------------------------------------------------------------- Validation
    @staticmethod
    def _validate_like_run_test(data: JsonDict) -> Tuple[bool, Optional[str], JsonDict]:
        logger.debug("_validate_like_run_test(keys=%s)", list((data or {}).keys()))
        res = validate(
            {
                "command": "RunTest",
                "data": data,
                "requestId": (data or {}).get("requestId", "unknown"),
            }
        )
        logger.debug(
            "_validate_like_run_test -> is_valid=%s, err=%r, corr_keys=%s",
            res[0],
            res[1],
            list((res[2] or {}).keys()),
        )
        return res

    @staticmethod
    def _extract_target_test_id(data: JsonDict, ctx: "HandlerContext") -> str:
        logger.debug("_extract_target_test_id")
        if ctx and getattr(ctx, "envelope", None):
            env_tid = ctx.envelope.get("requestId")
            if env_tid is not None:
                logger.debug("found in envelope: %s", env_tid)
                return str(env_tid)

        if isinstance(data, dict):
            params = data.get("params") or {}
            rid = params.get("_request_id") or data.get("_request_id")
            if rid:
                logger.debug("found in data/params: %s", rid)
                return str(rid)

        if ctx and getattr(ctx, "request_id", None):
            logger.debug("fallback to ctx.request_id: %s", ctx.request_id)
            return str(ctx.request_id)

        logger.debug("no target id -> 'unknown'")
        return "unknown"

    # --------------------------------------------------------- DB-based inflate
    def _extract_data_from_db_if_needed(self, data: JsonDict, req_id: Optional[str]) -> JsonDict:
        logger.debug(
            "_extract_data_from_db_if_needed(req_id=%r) IN keys=%s",
            req_id,
            list((data or {}).keys()),
        )
        d = copy.deepcopy(data) if isinstance(data, dict) else {}
        meta = MetaHelper.ensure(d.get("_meta"))
        d["_meta"] = meta.as_dict()

        params = d.get("params") if isinstance(d.get("params"), dict) else {}
        have_chip   = bool(params.get("chipName"))
        have_test   = bool(params.get("testName"))
        have_config = isinstance(params.get("testConfiguration"), dict) and params["testConfiguration"]
        logger.debug("present? chip=%s test=%s config=%s", have_chip, have_test, bool(have_config))

        if have_chip and have_test and have_config:
            meta.update({"testConfiguration": params["testConfiguration"]})
            d["_meta"] = meta.as_dict()
            logger.debug("All present; returning as-is")
            return d

        # Offline: do not call DB, but enforce required fields.
        if meta.get("offlineMode", False):
            missing: list[str] = []
            steps = params.get("steps")
            if isinstance(steps, list) and steps:
                if not have_chip:
                    missing.append("params.chipName")
                for i, step in enumerate(steps):
                    if not isinstance(step, dict):
                        missing.append(f"params.steps[{i}] (not an object)")
                        continue
                    if not step.get("testName"):
                        missing.append(f"params.steps[{i}].testName")
                    cfg = step.get("testConfiguration")
                    if not isinstance(cfg, dict) or not cfg:
                        missing.append(f"params.steps[{i}].testConfiguration")
            else:
                if not have_chip:
                    missing.append("params.chipName")
                if not have_test:
                    missing.append("params.testName")
                if not have_config:
                    missing.append("params.testConfiguration")

            if missing:
                msg = (
                    "OFFLINE mode does not support DB Agent. "
                    f"(requestId={req_id}) Missing required fields: {', '.join(missing)}"
                )
                logger.error(msg)
                meta.update({"offlineMissing": missing})
                d["_meta"] = meta.as_dict()
                raise RuntimeError(msg)

            logger.debug("Offline mode: inputs sufficient; return as-is")
            return d

        def _first_not_none(*vals):
            for v in vals:
                if v is not None:
                    return v
            return None

        def _first_int(x: Any) -> Optional[int]:
            try:
                if isinstance(x, (list, tuple)) and x:
                    x = x[0]
                return int(x) if x is not None else None
            except Exception:
                return None

        test_id   = _first_int(_first_not_none(d.get("testId"), params.get("testId")))
        config_id = _first_int(_first_not_none(d.get("configId"), params.get("configId")))
        chip_id   = _first_int(_first_not_none(d.get("chipId"), params.get("chipId")))
        logger.debug("IDs detected: test_id=%s, config_id=%s, chip_id=%s", test_id, config_id, chip_id)

        if test_id is None and config_id is None and chip_id is None:
            logger.debug("No IDs to inflate; returning input data")
            return d

        req = str(req_id) if req_id else "unknown"

        # Resolve chipName
        resolved_chip_name: Optional[str] = None
        if not have_chip and chip_id is not None:
            logger.debug("Fetching chip name from DB for chip_id=%s", chip_id)
            rep_chip = fetch_from_db(
                req,
                "GetChipName",
                chip_id,
                6.0,
                True,
                data={"filter": {"chipId": [chip_id]}},
            )
            ok, maybe_err = err.from_db_payload("GetChipName", req_id, rep_chip)
            if not ok:
                raise RuntimeError(self._extract_error_text(maybe_err, default="GetChipName failed"))
            items = ((rep_chip.get("data") or {}).get("items") or [])
            if items and isinstance(items[0], dict):
                resolved_chip_name = items[0].get("chipname") or items[0].get("chipName")
            logger.debug("Resolved chipName=%r", resolved_chip_name)

        chip_name = (params.get("chipName") or resolved_chip_name or "").strip()

        # Resolve testName and testSetup/config from chip-level test list.
        resolved_test_name: Optional[str] = None
        resolved_cfg_id: Optional[int] = None
        resolved_ts_id: Optional[int] = None
        if not have_test and test_id is not None and chip_name:
            msg_type_tests = f"GetAll{chip_name}Tests"
            logger.debug("Fetching test name via %s for test_id=%s", msg_type_tests, test_id)
            rep_tests = fetch_from_db(
                req,
                msg_type_tests,
                None,
                6.0,
                True,
                data={"filter": {"ids": [test_id]}},
            )
            ok, maybe_err = err.from_db_payload(msg_type_tests, req_id, rep_tests)
            if not ok:
                raise RuntimeError(self._extract_error_text(maybe_err, default=f"{msg_type_tests} failed"))
            titems = (rep_tests.get("data") or {}).get("items") or []
            if titems and isinstance(titems[0], dict):
                resolved_test_name = titems[0].get("name") or titems[0].get("testName")
                resolved_cfg_id = titems[0].get("configId")
                resolved_ts_id  = titems[0].get("testSetupId")
            logger.debug(
                "Resolved testName=%r cfg_id=%r ts_id=%r",
                resolved_test_name,
                resolved_cfg_id,
                resolved_ts_id,
            )

        # Resolve testConfiguration
        cfg_id = config_id if (config_id is not None) else resolved_cfg_id
        resolved_cfg: Optional[Dict[str, Any]] = None
        if (not have_config) and (cfg_id is not None) and chip_name:
            msg_type_cfg = f"GetAll{chip_name}TestConfigurations"
            logger.debug("Fetching config via %s for cfg_id=%s", msg_type_cfg, cfg_id)
            rep_cfg = fetch_from_db(
                req,
                msg_type_cfg,
                None,
                6.0,
                True,
                data={"filter": {"ids": [cfg_id]}},
            )
            ok, maybe_err = err.from_db_payload(msg_type_cfg, req_id, rep_cfg)
            if not ok:
                raise RuntimeError(self._extract_error_text(maybe_err, default=f"{msg_type_cfg} failed"))
            cfg_items = (rep_cfg.get("data") or {}).get("items") or []
            if cfg_items and isinstance(cfg_items[0], dict):
                c0 = cfg_items[0]
                resolved_cfg = {
                    "mode":                c0.get("mode"),
                    "loadCapacitance(nF)": c0.get("loadCapacitance(nF)"),
                    "loadCurrent(mA)":     c0.get("loadCurrent(mA)"),
                    "temperature(C)":      c0.get("temperature(C)"),
                }
            logger.debug("Resolved testConfiguration keys=%s", list((resolved_cfg or {}).keys()))

        out_params = dict(params or {})
        if cfg_id is not None and "configId" not in out_params:
            out_params["configId"] = cfg_id
        if resolved_ts_id is not None and "testSetupId" not in out_params:
            out_params["testSetupId"] = resolved_ts_id
        if not have_chip and resolved_chip_name:
            out_params["chipName"] = resolved_chip_name
        if not have_test and resolved_test_name:
            out_params["testName"] = resolved_test_name
        if not have_config and resolved_cfg:
            out_params["testConfiguration"] = resolved_cfg
            meta.update({"testConfiguration": resolved_cfg})

        if "inputs" not in out_params and isinstance(params.get("inputs"), dict):
            out_params["inputs"] = params["inputs"]

        d["params"] = out_params
        d["_meta"] = meta.as_dict()
        logger.debug("Inflated params keys=%s", list(out_params.keys()))
        return d

    # ------------------------------------------------------------- GetAllTests
    def GetAllTests(self, data: Optional[JsonDict] = None, ctx: Optional[HandlerContext] = None) -> JsonDict:
        logger.debug(
            "GetAllTests(data_keys=%s, ctx=%s)",
            list((data or {}).keys()),
            type(ctx).__name__ if ctx else None,
        )
        data = data or {}
        req_id = getattr(ctx, "request_id", None) or (getattr(ctx, "envelope", {}) or {}).get(
            "requestId",
            "unknown",
        )

        raw_id   = (data.get("filter", {}) or {}).get("chipId", [])
        chip_ids = raw_id if isinstance(raw_id, (list, tuple)) else [raw_id]

        from svt_test_agent.db_client import _normalize_ids as _norm

        ids_norm = _norm(chip_ids)
        logger.debug("Normalized chip ids -> %s", ids_norm)

        if not ids_norm:
            from svt_test_agent.registries.test_registry import CHIP_TEST_DEFINITIONS

            all_tests = [
                {"chipName": chip, "tests": list((spec.get("tests") or {}).keys())}
                for chip, spec in (CHIP_TEST_DEFINITIONS or {}).items()
            ]
            logger.debug("Returning static chip tests for %d chips", len(all_tests))
            return self._reply(
                False,
                "GetAllTests",
                status=TEST_SUCCESS,
                values={"allChips": all_tests},
                payload_key="data",
                request_id=str(req_id),
            )

        chip_id = ids_norm
        try:
            db_reply = fetch_from_db(req_id, "GetAllTests", [chip_id], 6.0, True)
            ok, maybe_err = err.from_db_payload("GetAllTests", req_id, db_reply)
            if not ok:
                logger.debug("DB returned non-success for GetAllTests: %s", maybe_err)
                return maybe_err
        except Exception as ex:
            logger.exception("GetAllTests: DB call failed")
            return err.from_exception("GetAllTests", str(req_id), ex)

        items = ((db_reply.get("data") or {}).get("items") or [])
        if not items:
            logger.debug("No items for chip_id=%s", chip_id)
            return err.db_fail("GetAllTests", str(req_id), f"Chip id {chip_id} not found in DB")

        chip_name = items[0].get("chipname") or items[0].get("chipName") or ""
        if not chip_name:
            logger.debug("Missing chipname in DB reply")
            return err.db_fail("GetAllTests", str(req_id), "DB reply missing 'chipname'")

        tests_info = self._client.get_all_tests(chip_name)
        tests_info.setdefault("chipId", chip_id)
        logger.debug("Returning tests_info keys=%s", list(tests_info.keys()))

        return self._reply(
            False,
            "GetAllTests",
            status=TEST_SUCCESS,
            values=tests_info,
            payload_key="data",
            request_id=str(req_id),
        )

    # ------------------------------------------------------------------ RunTest
    def RunTest(self, data: JsonDict, ctx: HandlerContext) -> Generator[JsonDict, None, None] | JsonDict:
        logger.debug("RunTest(data_keys=%s, ctx.req_id=%s)", list((data or {}).keys()), getattr(ctx, "request_id", None))
        req_id = getattr(ctx, "request_id", None)
        if isinstance(data, dict):
            p0 = data.get("params", {})
            if isinstance(p0, dict):
                req_id = p0.get("_request_id") or data.get("_request_id") or req_id

        try:
            data = self._extract_data_from_db_if_needed(data or {}, str(req_id) if req_id is not None else None)
        except Exception as e:
            logger.error("DB inflate error: %s", e, exc_info=False)
            return err.db_fail("RunTest", str(req_id) if req_id is not None else None, f"DB inflate error: {e}")

        is_valid, error_msg, corrected_cmd = self._validate_like_run_test(data)
        logger.debug("RunTest validation -> valid=%s err=%r", is_valid, error_msg)
        if not is_valid:
            return err.test_fail("RunTest", str(req_id) if req_id is not None else None, error_msg or "Validation failed")

        params: JsonDict = {}
        if isinstance(corrected_cmd.get("data"), dict):
            params = corrected_cmd["data"].get("params", {}) or {}
        chip_type = params.get("chipName", "")
        test_name = params.get("testName", "")

        if req_id is not None and isinstance(params, dict):
            params = dict(params)
            params["_request_id"] = req_id

        def _first_not_none(*vals):
            for v in vals:
                if v is not None:
                    return v
            return None

        params["testId"]      = _first_not_none((data.get("params") or {}).get("testId"), data.get("testId"), params.get("testId"))
        params["configId"]    = _first_not_none((data.get("params") or {}).get("configId"), data.get("configId"), params.get("configId"))
        params["testSetupId"] = _first_not_none((data.get("params") or {}).get("testSetupId"), data.get("testSetupId"), params.get("testSetupId"))

        logger.info("RunTest: chip=%s test=%s", chip_type, test_name)
        logger.debug("RunTest params keys=%s", list(params.keys()))

        meta_info = self._ensure_meta(data.get("_meta"))
        cmd_type = str(meta_info.get("command_type") or "RunTest")
        logger.debug("RunTest cmd_type=%s meta=%s", cmd_type, meta_info)

        def _stream(cmd_type: str, parent_meta: "MetaHelper"):
            logger.debug("RunTest._stream enter: cmd_type=%s", cmd_type)
            try:
                gen = self._client.run_test(chip_type, test_name, params)
                logger.debug("Client.run_test started")
            except Exception as e:
                logger.exception("run_test() failed before streaming")
                yield err.from_exception("RunTest", str(req_id) if req_id is not None else None, e)
                return

            for values_or_err, child_meta in gen:
                child_meta = MetaHelper.ensure(child_meta)
                full_meta = parent_meta.merge_from(child_meta)
                status = self._norm_status(full_meta.get("status"))
                logger.debug("Stream tick: status=%s child_meta=%s", status, child_meta)

                if status == TEST_RUNNING:
                    base = self._progress_message(full_meta.as_dict())
                    msg = self._ensure_period(f"TestRunning: {base or (chip_type + ' ' + test_name)}")
                    yield self._reply(
                        True,
                        cmd_type,
                        status=TEST_RUNNING,
                        values="Running...",
                        status_details={"message": msg},
                        request_id=req_id,
                        meta=full_meta,
                    )
                    continue

                if status == TEST_FAIL:
                    msg = full_meta.get("message") or (
                        str(values_or_err) if values_or_err is not None else "Test failed"
                    )
                    logger.debug("Stream fail: %s", msg)
                    yield err.test_fail(cmd_type, str(req_id) if req_id is not None else None, msg)
                    return

                if status == TEST_SUCCESS:
                    _, __, corrected_vals = validate_test_values(corrected_cmd, values_or_err)
                    final_values = corrected_vals or {}
                    logger.debug("Stream success; final_values keys=%s", list(final_values.keys()))
                    try:
                        if (
                            isinstance(final_values, dict)
                            and cmd_type not in ("RunLoopTest", "RunTestSequence-Loop")
                            and not full_meta.get("offlineMode")
                        ):
                            self._save_final_result(
                                chip_name=chip_type,
                                test_name=test_name,
                                test_values=final_values,
                                params=params if isinstance(params, dict) else {},
                                request_id=str(req_id) if req_id is not None else None,
                            )
                    except Exception:
                        logger.exception("DB save failed")

                    msg = self._ensure_period(f"TestSuccess: {chip_type} {test_name} completed")
                    yield self._reply(
                        False,
                        cmd_type,
                        status=TEST_SUCCESS,
                        values=final_values,
                        status_details={"message": msg},
                        request_id=req_id,
                        meta=full_meta,
                    )
                    return

                msg = full_meta.get("message") or f"Unknown status '{full_meta.get('status')}'"
                logger.debug("Stream unknown status -> %s", msg)
                yield err.test_fail(cmd_type, str(req_id) if req_id is not None else None, msg)
                return

        return _stream(cmd_type, meta_info)

    # ----------------------------------------------------------- Collector API
    def run_test_collect(
        self,
        data: JsonDict,
        ctx: HandlerContext,
    ) -> Tuple[bool, Optional[Dict[str, Any]], str, List[JsonDict]]:
        logger.debug("run_test_collect enter")
        result = self.RunTest(data, ctx)
        events: List[JsonDict] = []
        last_msg = ""

        if isinstance(result, dict):
            logger.debug("run_test_collect: immediate dict result keys=%s", list(result.keys()))
            if "Status" in result:
                return False, None, result.get("data", {}).get("error", ""), events
            return True, result.get("testValues") or result.get("data") or {}, "", events

        final_values: Optional[Dict[str, Any]] = None
        ok = True

        for item in result:
            logger.debug("run_test_collect tick: keys=%s", list(item.keys()))
            if isinstance(item, dict) and "Status" in item:
                ok = False
                last_msg = item.get("data", {}).get("error", "")
                break

            if item.get("testStatus") == TEST_RUNNING:
                events.append(item)
                last_msg = (item.get("statusDetails") or {}).get("message") or item.get("statusMsg", last_msg)
                continue

            if item.get("testStatus") == TEST_SUCCESS:
                final_values = (item.get("testValues") or {}) if isinstance(item.get("testValues"), dict) else {}
                last_msg = (item.get("statusDetails") or {}).get("message") or item.get("statusMsg", last_msg)
                ok = True
                break

            ok = False
            last_msg = (item.get("statusDetails") or {}).get("message") or item.get("statusMsg", "Unknown failure")
            break

        logger.debug(
            "run_test_collect exit: ok=%s, final_keys=%s, last_msg=%r, n_events=%d",
            ok,
            list((final_values or {}).keys()),
            last_msg,
            len(events),
        )
        return ok, final_values, last_msg, events

    # --------------------------------------------------------- Abort primitives
    def _mark_abort(self) -> None:
        logger.debug("_mark_abort()")
        self._abort_event.set()

    def _clear_abort(self) -> None:
        logger.debug("_clear_abort()")
        self._abort_event.clear()

    def _aborting(self) -> bool:
        state = self._abort_event.is_set()
        logger.debug("_aborting() -> %s", state)
        return state

    # --------------------------------------------------------- Abort / Status
    def AbortTest(self, data: JsonDict | Any, ctx: HandlerContext) -> JsonDict:
        logger.debug("AbortTest enter")
        meta_info = (data or {}).get("_meta") or {}
        corr_id = getattr(ctx, "request_id", None)
        corr_id_str = str(corr_id) if corr_id is not None else "unknown"
        try:
            self._mark_abort()
            result = self._client.abort_test(None)
            logger.debug("Abort issued to client; result=%s", result)
        except Exception as e:
            logger.exception("AbortTest exception")
            return err.from_exception("AbortTest", corr_id_str, e)

        ok = bool(result.get("ok")) if isinstance(result, dict) else False
        aborted_id = (result or {}).get("abortedRequestId") if isinstance(result, dict) else None
        status_msg = (result or {}).get("statusMsg") or (result or {}).get("reason") or ""

        if ok:
            payload = {
                "outputs": "testAborted",
                "abortedRequestId": str(aborted_id or ""),
                "message": status_msg or "Abort requested.",
            }
            resp = self._reply(
                False,
                "AbortTest",
                status="TestAbort",
                values=payload,
                request_id=corr_id_str,
                payload_key="data",
                meta=meta_info,
            )
            logger.debug("AbortTest success -> reply keys=%s", list(resp.get("out", {}).keys()))
            self._clear_abort()
            return resp

        fail_msg = status_msg or "No active test to abort"
        logger.debug("AbortTest failed: %s", fail_msg)
        return err.test_fail("AbortTest", corr_id_str, f"Abort failed: {fail_msg}")

    def TestStatus(self, data: JsonDict | Any, ctx: HandlerContext) -> JsonDict:
        data_dict = data if isinstance(data, dict) else {}
        req_id = getattr(ctx, "request_id", None)
        test_id = self._extract_target_test_id(data_dict, ctx)
        logger.info("TestStatus: target=%s", test_id)
        try:
            reply = self._client.test_status(test_id)
            logger.debug(
                "Client.test_status reply keys=%s",
                list((reply or {}).keys()) if isinstance(reply, dict) else None,
            )
        except Exception as ex:
            logger.exception("TestStatus exception")
            return err.from_exception("TestStatus", str(req_id) if req_id is not None else "unknown", ex)

        tid = str(req_id) if req_id is not None else test_id
        if isinstance(reply, dict):
            reply["requestId"] = tid
            reply.setdefault("requestId", tid)
        logger.debug("TestStatus exit")
        return reply


# ---------------------------------------------------------------- Meta helper

class MetaHelper:
    """
    Lightweight attribute/dict wrapper for meta-information.

    - Use MetaHelper.ensure(x) at boundaries (accepts dict/MetaHelper/None).
    - Always serialize with .as_dict() when emitting on the wire.
    """
    __slots__ = ("_d",)

    def __init__(self, meta=None):
        self._d = dict(meta or {})

    @staticmethod
    def ensure(meta: Any) -> "MetaHelper":
        if isinstance(meta, MetaHelper):
            return meta
        if isinstance(meta, dict):
            return MetaHelper(meta)
        return MetaHelper({})

    def copy(self) -> "MetaHelper":
        return MetaHelper(self._d)

    def __getattr__(self, key):
        return self._d.get(key, None)

    def __setattr__(self, key, value):
        if key == "_d":
            object.__setattr__(self, key, value)
        else:
            self._d[key] = value

    def get(self, key, default=None):
        return self._d.get(key, default)

    def update(self, new=None, **kwargs) -> "MetaHelper":
        if isinstance(new, MetaHelper):
            self._d.update(new._d)
        elif isinstance(new, dict):
            self._d.update(new)
        if kwargs:
            self._d.update(kwargs)
        return self

    def merge_from(self, other: Any) -> "MetaHelper":
        if isinstance(other, MetaHelper):
            m = other._d
        elif isinstance(other, dict):
            m = other
        else:
            m = {}
        out = self.copy()
        out._d.update(m)
        return out

    def as_dict(self) -> Dict[str, Any]:
        return dict(self._d)

    def __repr__(self) -> str:
        return f"MetaHelper({self._d})"