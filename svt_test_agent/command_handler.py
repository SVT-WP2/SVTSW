from __future__ import annotations

"""
High-level test flow orchestration for the SVT Test Agent.

This module composes higher-level flows on top of the core RunTest
implementation provided by BaseCmdHandler:

  - RunLoopTest:
      Repeat a single RunTest for N iterations, forwarding child stream
      events and aggregating a compact loop summary.

  - RunTestPlan:
      Execute a logical test plan defined as a list of steps (chipName,
      testName, configuration, inputs, iterations), with per-step runs
      and a plan-level summary optionally saved to the DB.

  - RunSequenceTest:
      Execute a DB-backed sequence where steps may reference testId /
      configId / chipId, inflating them through the DB agent before
      dispatching RunTest or RunLoopTest.

The child flows do not buffer intermediate events; they forward child
RunTest / RunLoopTest stream replies directly into parent stream replies
and only emit a non-stream summary at the end.

Location: svt_test_agent/command_handler.py
"""

import logging
from typing import Any, Dict, Generator, List, Optional, TYPE_CHECKING, Tuple

from svt_test_agent.base_command_handler import (
    BaseCmdHandler,
    MetaHelper,
    TEST_RUNNING,
    TEST_SUCCESS,
    TEST_FAIL,
    JsonDict,
)
from svt_test_agent.utilities import errors as err  # centralized error helpers

if TYPE_CHECKING:
    from svt_test_agent.test_agent import HandlerContext
else:
    class HandlerContext:  # type: ignore[override]
        pass

logger = logging.getLogger("CommandHandler")
logger.setLevel(logging.NOTSET)


class CmdHandler(BaseCmdHandler):
    """
    Compose higher-level flows (Loop/Plan/Sequence) by calling the base RunTest.

    - Child streams (RunTest / RunLoopTest) are forwarded immediately into
      the parent stream by the agent thread (no buffering).
    - RunTest and RunLoopTest do their own ID inflation / DB saves.
    - Only the final non-stream summary for Sequence/Plan is emitted by the parent.
    """

    # ----------------------------- RunLoopTest --------------------------------
    def RunLoopTest(self, data: JsonDict, ctx: HandlerContext) -> Generator[JsonDict, None, None]:
        logger.debug(
            "RunLoopTest enter: data_keys=%s req_id=%s",
            list((data or {}).keys()),
            getattr(ctx, "request_id", None),
        )
        looping = True
        test_id = data.get("testId", "")
        req_id = getattr(ctx, "request_id", None)
        iterations, data_no_iter = self._extract_and_strip_iterations(data, default=1)
        logger.debug(
            "RunLoopTest iterations=%s stripped_keys=%s",
            iterations,
            list((data_no_iter or {}).keys()),
        )

        base_payload = data_no_iter if isinstance(data_no_iter, dict) else {}
        try:
            base_payload = self._extract_data_from_db_if_needed(
                base_payload or {},
                str(req_id) if req_id is not None else None,
            )
            logger.debug(
                "RunLoopTest inflated params_keys=%s",
                list((base_payload.get("params") or {}).keys()),
            )
        except Exception as e:
            logger.error("RunLoopTest: DB inflate error (req=%s): %s", req_id, e)
            yield err.db_fail(
                "RunLoopTest",
                str(req_id) if req_id is not None else None,
                f"DB inflate error: {e}",
            )
            return

        p = (base_payload.get("params") or {}) if isinstance(base_payload, dict) else {}
        chip_type = p.get("chipName", "")
        test_name = p.get("testName", "")
        logger.info(
            "RunLoopTest: chip=%s test=%s iterations=%s",
            chip_type,
            test_name,
            iterations,
        )

        parent_meta = MetaHelper.ensure((base_payload or {}).get("_meta"))
        parent_meta.update({"looping": looping})
        yield self._reply(
            True,
            "RunLoopTest",
            status=TEST_RUNNING,
            values="Starting...",
            status_details={
                "phase": "start",
                "iterations": int(iterations),
                "message": "Loop starting.",
            },
            payload_key="testValues",
            request_id=req_id,
            meta=parent_meta,
        )

        aggregated: List[Dict[str, Any]] = []
        parent_meta.update({"totalIterations": iterations})
        for i in range(int(iterations)):
            iteration = i + 1
            parent_meta.update({"iteration": iteration})
            logger.debug(
                "RunLoopTest tick: iteration=%d/%d",
                iteration,
                iterations,
            )

            if self._aborting():
                logger.debug("RunLoopTest abort detected before child")
                yield err.test_fail(
                    "RunLoopTest",
                    str(req_id) if req_id is not None else None,
                    "Aborted",
                )
                self._clear_abort()
                return

            ok, final_vals, last_msg, pipe_meta = yield from self.pipe_runtest(
                parent_cmd="RunLoopTest",
                ctx_fields={"iteration": iteration, "totalIterations": int(iterations)},
                payload_key="testValues",
                request_id=str(req_id) if req_id is not None else None,
                data=base_payload,
                ctx=ctx,
                meta=parent_meta,
            )
            logger.debug(
                "RunLoopTest child returned: ok=%s final_keys=%s last_msg=%r",
                ok,
                list((final_vals or {}).keys()),
                last_msg,
            )

            pipe_meta = MetaHelper.ensure(pipe_meta)
            meta_info = parent_meta.merge_from(pipe_meta)

            if self._aborting():
                logger.debug("RunLoopTest abort detected after child")
                yield err.test_fail(
                    "RunLoopTest",
                    str(req_id) if req_id is not None else None,
                    "Aborted",
                )
                return

            if not ok:
                logger.debug(
                    "RunLoopTest iteration %d failed: %s",
                    iteration,
                    last_msg,
                )
                yield err.test_fail(
                    "RunLoopTest",
                    str(req_id) if req_id is not None else None,
                    last_msg or f"Iteration {iteration} failed",
                )
                return

            aggregated.append(
                {
                    "Iteration": iteration,
                    "inputs": (final_vals or {}).get("inputs", {}),
                    "outputs": (final_vals or {}).get("outputs", final_vals or {}),
                }
            )

            yield self._reply(
                True,
                "RunLoopTest",
                status=TEST_RUNNING,
                status_details={
                    "iteration": iteration,
                    "completed": True,
                    "outputs": (final_vals or {}),
                },
                request_id=req_id,
                meta=meta_info,
            )

        final_values = {"iterations": aggregated}
        looping = False
        meta_info.looping = looping
        logger.debug(
            "RunLoopTest final aggregation: %d iterations",
            len(aggregated),
        )
        try:
            if test_id not in (None, ""):
                p["testId"] = test_id
            if not meta_info.offlineMode:
                self._save_final_result(
                    chip_name=chip_type,
                    test_name=f"{test_name}_LoopSummary",
                    test_values=final_values,
                    params=p if isinstance(p, dict) else {},
                    request_id=str(req_id) if req_id is not None else None,
                )
        except Exception:
            logger.exception("DB save (loop summary) failed")

        yield self._reply(
            False,
            "RunLoopTest",
            status=TEST_SUCCESS,
            values=final_values,
            payload_key="testValues",
            request_id=req_id,
            meta=meta_info,
        )
        logger.debug("RunLoopTest exit")

    # ----------------------------- RunTestPlan --------------------------------
    def RunTestPlan(self, data: JsonDict, ctx: HandlerContext) -> Generator[JsonDict, None, None]:
        logger.debug(
            "RunTestPlan enter: data_keys=%s req_id=%s",
            list((data or {}).keys()),
            getattr(ctx, "request_id", None),
        )
        req_id = getattr(ctx, "request_id", None)
        params = data.get("params", {}) if isinstance(data, dict) else {}
        plan_name = params.get("planName", "") or "plan"
        steps = params.get("steps") or params.get("sequence") or []
        logger.info(
            "RunTestPlan: plan=%s steps=%d",
            plan_name,
            len(steps) if isinstance(steps, list) else 0,
        )

        if not isinstance(steps, list) or not steps:
            yield err.test_fail(
                "RunTestPlan",
                str(req_id) if req_id is not None else None,
                "No steps provided in plan",
            )
            return

        plan_request_id = str(
            params.get("_request_id")
            or params.get("requestId")
            or (getattr(ctx, "envelope", {}) or {}).get("requestId")
            or (req_id if req_id is not None else "unknown")
        )

        plan_chip_default = params.get("chipName")
        plan_cfg_defaults = dict(params.get("testConfiguration") or {})
        plan_in_defaults = dict(params.get("inputs") or {})

        results: List[Dict[str, Any]] = []
        overall_ok = True

        yield self._reply(
            True,
            "RunTestPlan",
            status=TEST_RUNNING,
            values={
                "planName": plan_name,
                "phase": "start",
                "totalSteps": len(steps),
            },
            payload_key="plan",
            request_id=plan_request_id,
        )

        for idx, step in enumerate(steps, start=1):
            logger.debug("RunTestPlan step %d/%d start", idx, len(steps))
            try:
                if not isinstance(step, dict):
                    msg = "Invalid step"
                    results.append({"index": idx, "status": TEST_FAIL, "lastMsg": msg})
                    overall_ok = False
                    yield self._reply(
                        True,
                        "RunTestPlan",
                        status=TEST_RUNNING,
                        values={"step": idx, "phase": "invalid", "message": msg},
                        payload_key="plan",
                        request_id=plan_request_id,
                    )
                    continue

                chip = step.get("chipName") or plan_chip_default
                test = step.get("testName")
                iterations = int(step.get("iterations") or step.get("iteration") or 1)
                logger.debug(
                    "RunTestPlan step %d: chip=%s test=%s iterations=%d",
                    idx,
                    chip,
                    test,
                    iterations,
                )

                if not chip or not test:
                    msg = "Missing 'chipName' or 'testName'"
                    results.append(
                        {
                            "index": idx,
                            "chipName": chip,
                            "testName": test,
                            "status": TEST_FAIL,
                            "lastMsg": msg,
                        }
                    )
                    overall_ok = False
                    yield self._reply(
                        True,
                        "RunTestPlan",
                        status=TEST_RUNNING,
                        values={
                            "step": idx,
                            "chipName": chip,
                            "testName": test,
                            "phase": "invalid",
                            "message": msg,
                        },
                        payload_key="plan",
                        request_id=plan_request_id,
                    )
                    continue

                merged_cfg = {**plan_cfg_defaults, **(step.get("testConfiguration") or {})}
                merged_in = {**plan_in_defaults, **(step.get("inputs") or {})}
                base_payload = {
                    "params": {
                        "chipName": chip,
                        "testName": test,
                        "testConfiguration": merged_cfg,
                        "inputs": merged_in,
                        "_request_id": plan_request_id,
                    }
                }

                yield self._reply(
                    True,
                    "RunTestPlan",
                    status=TEST_RUNNING,
                    values={
                        "step": idx,
                        "chipName": chip,
                        "testName": test,
                        "iterations": iterations,
                        "phase": "start",
                    },
                    payload_key="plan",
                    request_id=plan_request_id,
                )

                step_runs: List[Dict[str, Any]] = []
                last_child_status = TEST_FAIL
                last_child_msg = ""

                for it in range(iterations):
                    logger.debug("RunTestPlan step %d iter %d/%d", idx, it + 1, iterations)
                    ok, final_vals, last_msg = yield from self.pipe_runtest(
                        parent_cmd="RunTestPlan",
                        ctx_fields={"step": idx, "chipName": chip, "testName": test},
                        payload_key="plan",
                        request_id=plan_request_id,
                        data=base_payload,
                        ctx=ctx,
                        meta=MetaHelper.ensure({"command_type": "RunTestPlan"}),
                    )

                    if not ok:
                        last_child_status = TEST_FAIL
                        last_child_msg = last_msg or f"Iteration {it + 1} failed"
                        overall_ok = False
                        logger.debug(
                            "RunTestPlan step %d iter %d failed: %s",
                            idx,
                            it + 1,
                            last_child_msg,
                        )
                        break

                    step_runs.append(final_vals or {})
                    last_child_status = TEST_SUCCESS
                    last_child_msg = "OK"

                results.append(
                    {
                        "index": idx,
                        "chipName": chip,
                        "testName": test,
                        "iterations": iterations,
                        "status": last_child_status,
                        "lastMsg": last_child_msg,
                        "final": {"runs": step_runs} if step_runs else None,
                    }
                )

                yield self._reply(
                    True,
                    "RunTestPlan",
                    status=TEST_RUNNING,
                    values={
                        "step": idx,
                        "chipName": chip,
                        "testName": test,
                        "phase": "end",
                        "status": last_child_status,
                        "lastMsg": last_child_msg,
                    },
                    payload_key="plan",
                    request_id=plan_request_id,
                )

            except Exception as e:
                logger.exception("RunTestPlan: step %d raised", idx)
                results.append(
                    {
                        "index": idx,
                        "chipName": step.get("chipName") if isinstance(step, dict) else None,
                        "testName": step.get("testName") if isinstance(step, dict) else None,
                        "iterations": (
                            step.get("iterations") or step.get("iteration") or 1
                        )
                        if isinstance(step, dict)
                        else 1,
                        "status": TEST_FAIL,
                        "lastMsg": f"Exception: {e}",
                        "final": None,
                    }
                )
                overall_ok = False
                yield err.agent_fail(
                    "RunTestPlan",
                    plan_request_id,
                    f"Exception in plan step {idx}: {e}",
                )

        finish_msg = f"Plan '{plan_name}' {'completed' if overall_ok else 'finished with errors'}."
        yield self._reply(
            True,
            "RunTestPlan",
            status=TEST_RUNNING,
            values={
                "planName": plan_name,
                "phase": "finish",
                "overall": "ok" if overall_ok else "error",
            },
            status_details={"message": finish_msg},
            payload_key="plan",
            request_id=plan_request_id,
        )

        if overall_ok and results:
            try:
                chip_for_plan = (params.get("chipName") or "SLDO").strip()
                from svt_test_agent.db_client import save_test_to_db

                rep = save_test_to_db(
                    chip_name=chip_for_plan,
                    test_name=f"{plan_name}_PlanSummary",
                    test_values={"planResults": results},
                    asic_id=0,
                    test_setup_id=0,
                    config_id=int((params.get("configId") or 0)),
                    request_id=plan_request_id,
                )
                ok, _ = err.from_db_payload("SaveTestToDB", plan_request_id, rep)
                if not ok:
                    logger.warning("DB save (plan summary) returned non-success: %s", rep)
                else:
                    logger.debug("DB save (plan summary) success")
            except Exception:
                logger.exception("DB save (plan summary) failed")

        yield {
            "type": "RunTestPlanReply",
            "planName": plan_name,
            "testStatus": TEST_SUCCESS if overall_ok else TEST_FAIL,
            "statusMsg": f"Plan '{plan_name}' {'completed' if overall_ok else 'finished with errors'}",
            "results": results,
            "requestId": plan_request_id,
            "agentStatus": "TestAgentSuccess",
        }
        logger.debug("RunTestPlan exit")

    # --------------------------- RunSequenceTest ------------------------------
    def RunSequenceTest(self, data: JsonDict, ctx: HandlerContext) -> Generator[JsonDict, None, None]:
        logger.debug(
            "RunSequenceTest enter: data_keys=%s req_id=%s",
            list((data or {}).keys()),
            getattr(ctx, "request_id", None),
        )
        req_id = getattr(ctx, "request_id", None)
        params = data.get("params", {}) if isinstance(data, dict) else {}
        plan_name = (params.get("planName") or "sequence").strip()
        steps = params.get("steps") or []
        logger.info(
            "RunSequenceTest: plan=%s steps=%d",
            plan_name,
            len(steps) if isinstance(steps, list) else 0,
        )

        if not isinstance(steps, list) or not steps:
            yield err.test_fail(
                "RunTestSequence",
                str(req_id) if req_id is not None else None,
                "No steps provided",
            )
            return

        try:
            top_inflated = self._extract_data_from_db_if_needed(
                data,
                str(req_id) if req_id is not None else None,
            )
            logger.debug(
                "RunSequenceTest top inflated keys=%s",
                list((top_inflated.get("params") or {}).keys()),
            )
        except Exception as e:
            logger.error(
                "RunTestSequence: DB inflate error (top-level, req=%s): %s",
                req_id,
                e,
            )
            yield err.db_fail(
                "RunTestSequence",
                str(req_id) if req_id is not None else None,
                f"DB inflate error (top-level): {e}",
            )
            return

        meta_info = MetaHelper.ensure((data or {}).get("_meta"))
        base_params = top_inflated.get("params", {})
        chip_name = (base_params.get("chipName") or "").strip()
        if not chip_name:
            yield err.db_fail(
                "RunTestSequence",
                str(req_id) if req_id is not None else None,
                "Unable to resolve chipName from chipId",
            )
            return

        plan_cfg_defaults = dict(base_params.get("testConfiguration") or {})
        plan_in_defaults = dict(base_params.get("inputs") or {})

        yield self._reply(
            True,
            "RunTestSequence",
            status=TEST_RUNNING,
            status_details={
                "planName": plan_name,
                "phase": "start",
                "totalSteps": len(steps),
            },
            payload_key="testValues",
            request_id=req_id,
            meta=meta_info,
        )

        Totalresults: List[Dict[str, Any]] = []
        overall_ok = True

        for idx, step in enumerate(steps, start=1):
            logger.debug("RunSequenceTest step %d/%d", idx, len(steps))
            results: List[Dict[str, Any]] = []
            if self._aborting():
                logger.debug("RunSequenceTest abort detected before step")
                yield err.test_fail(
                    "RunTestSequence",
                    str(req_id) if req_id is not None else None,
                    "Aborted",
                )
                self._clear_abort()
                return
            try:
                if not isinstance(step, dict):
                    msg = "Invalid step"
                    results.append({"index": idx, "status": TEST_FAIL, "lastMsg": msg})
                    overall_ok = False
                    yield self._reply(
                        True,
                        "RunTestSequence",
                        status=TEST_RUNNING,
                        values={"step": idx, "phase": "invalid", "message": msg},
                        payload_key="testValues",
                        request_id=req_id,
                        meta=meta_info,
                    )
                    continue

                iterations = int(step.get("iterations") or step.get("iteration") or 1)

                merged_cfg = {**plan_cfg_defaults, **(step.get("testConfiguration") or {})}
                merged_in = {**plan_in_defaults, **(step.get("inputs") or {})}

                step_params = {
                    "chipName": chip_name,
                    "testId": step.get("testId"),
                    "configId": step.get("configId"),
                    "testName": step.get("testName"),
                    "testConfiguration": merged_cfg,
                    "inputs": merged_in,
                    "_request_id": str(req_id) if req_id is not None else None,
                }

                try:
                    inflated_step = self._extract_data_from_db_if_needed(
                        {"params": step_params},
                        str(req_id) if req_id is not None else None,
                    )
                    logger.debug(
                        "RunSequenceTest step %d inflated params_keys=%s",
                        idx,
                        list((inflated_step.get("params") or {}).keys()),
                    )
                except Exception as e:
                    logger.error(
                        "RunTestSequence: inflate error at step %d (req=%s): %s",
                        idx,
                        req_id,
                        e,
                    )
                    results.append(
                        {
                            "index": idx,
                            "status": TEST_FAIL,
                            "lastMsg": f"DB inflate error: {e}",
                        }
                    )
                    overall_ok = False
                    yield err.db_fail(
                        "RunTestSequence",
                        str(req_id) if req_id is not None else None,
                        f"DB inflate error: {e}",
                    )
                    continue

                inflated_params = inflated_step.get("params", {})
                tname = inflated_params.get("testName")
                chip = inflated_params.get("chipName") or chip_name

                if not tname:
                    msg = "Unable to resolve 'testName' from testId"
                    results.append(
                        {
                            "index": idx,
                            "chipName": chip,
                            "status": TEST_FAIL,
                            "lastMsg": msg,
                        }
                    )
                    overall_ok = False
                    yield err.db_fail(
                        "RunTestSequence",
                        str(req_id) if req_id is not None else None,
                        msg,
                    )
                    continue

                yield self._reply(
                    True,
                    "RunTestSequence",
                    status=TEST_RUNNING,
                    status_details={
                        "step": idx,
                        "chipName": chip,
                        "testName": tname,
                        "iterations": iterations,
                        "phase": "start",
                    },
                    payload_key="testValues",
                    request_id=req_id,
                    meta=meta_info,
                )

                if iterations > 1:
                    meta_info.command_type = "RunTestSequence-Loop"
                    loop_payload = {
                        "_meta": meta_info.as_dict(),
                        "iterations": iterations,
                        "params": inflated_params,
                    }
                    ok, final_vals, last_msg, pipe_meta = yield from self.pipe_child(
                        parent_cmd="RunTestSequence",
                        ctx_fields={"step": idx, "chipName": chip, "testName": tname},
                        payload_key="testValues",
                        request_id=str(req_id) if req_id is not None else None,
                        child_result=self.RunLoopTest(loop_payload, ctx),
                        final_type="RunLoopTestReply",
                        meta=meta_info,
                    )
                    meta_info = meta_info.merge_from(pipe_meta)
                else:
                    meta_info.command_type = "RunTestSequence-Single"
                    single_payload = {"_meta": meta_info.as_dict(), "params": inflated_params}
                    ok, final_vals, last_msg, pipe_meta = yield from self.pipe_runtest(
                        parent_cmd="RunTestSequence",
                        ctx_fields={"step": idx, "chipName": chip, "testName": tname},
                        payload_key="testValues",
                        request_id=str(req_id) if req_id is not None else None,
                        data=single_payload,
                        ctx=ctx,
                        meta=meta_info,
                    )
                    meta_info = meta_info.merge_from(pipe_meta)

                test_cfg = inflated_params.get("testConfiguration")
                if self._aborting():
                    logger.debug("RunSequenceTest abort detected mid-step")
                    last_child_status = TEST_FAIL
                    last_child_msg = "Aborted"
                    last_child_payload = None
                    results.append(
                        {
                            "index": idx,
                            "chipName": chip,
                            "testName": tname,
                            "testConfigurations": test_cfg,
                            "iterations": iterations,
                            "status": last_child_status,
                            "lastMsg": last_child_msg,
                            "final": last_child_payload,
                        }
                    )
                    overall_ok = False
                    yield err.test_fail(
                        "RunTestSequence",
                        str(req_id) if req_id is not None else None,
                        "Aborted",
                    )
                    self._clear_abort()
                    return

                last_child_status = TEST_SUCCESS if ok else TEST_FAIL
                last_child_msg = last_msg if not ok else "OK"
                last_child_payload = final_vals if ok else None
                if last_child_status == TEST_FAIL:
                    results.append(
                        {
                            "step": idx,
                            "chipName": chip,
                            "testName": tname,
                            "testConfigurations": test_cfg,
                            "iterations": iterations,
                            "status": last_child_status,
                            "statusDetails": last_child_msg,
                        }
                    )
                else:
                    results.append(
                        {
                            "step": idx,
                            "chipName": chip,
                            "testName": tname,
                            "testConfigurations": test_cfg,
                            "iterations": iterations,
                            "status": last_child_status,
                            "testValue": last_child_payload,
                        }
                    )
                Totalresults.append(results)
                if not ok:
                    overall_ok = False

                yield self._reply(
                    True,
                    "RunTestSequence",
                    status=TEST_RUNNING,
                    status_details={
                        "step": idx,
                        "chipName": chip,
                        "testName": tname,
                        "phase": "end",
                        "status": last_child_status,
                        "lastMsg": last_child_msg,
                        "testValues": results,
                    },
                    values=results,
                    payload_key="testValues",
                    request_id=req_id,
                    meta=meta_info,
                )

            except Exception as e:
                logger.error(
                    "RunTestSequence: step %d raised (req=%s): %s",
                    idx,
                    req_id,
                    e,
                )
                results.append(
                    {
                        "index": idx,
                        "status": TEST_FAIL,
                        "lastMsg": f"Exception: {e}",
                        "final": None,
                    }
                )
                overall_ok = False
                yield err.agent_fail(
                    "RunTestSequence",
                    str(req_id) if req_id is not None else None,
                    f"Exception in sequence step {idx}: {e}",
                )

        finish_msg = (
            f"Sequence '{plan_name}' "
            f"{'completed' if overall_ok else 'finished with errors'}."
        )
        yield self._reply(
            True,
            "RunTestSequence",
            status=TEST_RUNNING,
            status_details={
                "planName": plan_name,
                "phase": "finish",
                "overall": "ok" if overall_ok else "error",
                "message": finish_msg,
            },
            values=Totalresults,
            payload_key="testValues",
            request_id=req_id,
            meta=meta_info,
        )

        finalStatus = TEST_SUCCESS if overall_ok else TEST_FAIL
        yield self._reply(
            False,
            "RunTestSequence",
            status=finalStatus,
            values=Totalresults,
            payload_key="testValues",
            request_id=req_id,
            meta=meta_info,
        )
        logger.debug("RunSequenceTest exit: status=%s", finalStatus)

    # --------------------- Child/pipe helpers (loop/plan/sequence) ------------
    def pipe_child(
        self,
        *,
        parent_cmd: str,
        ctx_fields: Dict[str, Any],
        payload_key: str,
        request_id: Optional[str],
        child_result,   # generator or dict
        final_type: str,  # e.g., "RunLoopTestReply"
        meta: Optional[MetaHelper | Dict[str, Any]],
    ) -> Generator[
        JsonDict,
        None,
        Tuple[bool, Dict[str, Any] | None, str | None, Dict[str, Any]],
    ]:
        logger.debug(
            "pipe_child enter: parent=%s ctx_fields=%s final_type=%s",
            parent_cmd,
            ctx_fields,
            final_type,
        )

        ok = False
        final_vals: Dict[str, Any] | None = None
        last_msg: str | None = None
        ev_meta_out: Dict[str, Any] = {}

        # Immediate (non-stream) child result path.
        if isinstance(child_result, dict):
            st = child_result.get("testStatus")
            logger.debug("pipe_child immediate dict result: status=%s", st)
            if st == TEST_SUCCESS:
                ok = True
                final_vals = child_result.get("testValues") or child_result.get("data")
            else:
                ok = False
                last_msg = (
                    (child_result.get("statusDetails") or {}).get("message")
                    or child_result.get("statusMsg")
                    or child_result.get("testError")
                    or "Child failed"
                )

            inner_sd = child_result.get("statusDetails") or {}
            inner_msg = str(inner_sd.get("message") or "").strip()

            if parent_cmd == "RunTestSequence" and inner_msg:
                step = ctx_fields.get("step")
                chip = ctx_fields.get("chipName", "")
                test = ctx_fields.get("testName", "")
                inner_msg = self._with_sequence_prefix(
                    step,
                    chip,
                    test,
                    self._strip_status_prefix(inner_msg),
                )
                inner_msg = self._ensure_period(inner_msg)

            if inner_msg:
                yield self._reply(
                    True,
                    parent_cmd,
                    status=TEST_RUNNING,
                    values="Running...",
                    status_details={
                        **ctx_fields,
                        "phase": "Sequence step",
                        "message": inner_msg,
                    },
                    payload_key=payload_key,
                    request_id=request_id,
                    meta=meta,
                )
            return ok, final_vals, last_msg, ev_meta_out

        # Streaming child result path.
        for ev in child_result:
            ev_meta = MetaHelper.ensure(ev.get("_meta"))
            ev_body = ev.get("out") or {}
            ev_meta_out = ev_meta.as_dict()
            logger.debug("pipe_child tick: ev_keys=%s", list(ev_body.keys()))

            if self._aborting():
                logger.debug("pipe_child abort detected")
                yield self._reply(
                    True,
                    parent_cmd,
                    status=TEST_RUNNING,
                    values="Running...",
                    status_details={
                        **ctx_fields,
                        "phase": "Sequence step",
                        "message": "Aborting.",
                    },
                    payload_key=payload_key,
                    request_id=request_id,
                    meta=meta,
                )
                self._clear_abort()
                return False, None, "Aborted", ev_meta_out

            inner_sd = ev_body.get("statusDetails") or {}
            inner_msg = str(
                inner_sd.get("message")
                or ev_body.get("statusMsg")
                or ev_meta.get("message")
                or ""
            ).strip()

            if parent_cmd == "RunTestSequence" and inner_msg:
                step = ctx_fields.get("step")
                chip = ctx_fields.get("chipName", "")
                test = ctx_fields.get("testName", "")
                inner_msg = self._with_sequence_prefix(
                    step,
                    chip,
                    test,
                    self._strip_status_prefix(inner_msg),
                )

            sd_out = {**ctx_fields, "phase": "Sequence step"}
            if "iteration" in inner_sd:
                sd_out["iteration"] = inner_sd["iteration"]
            if "totalIterations" in inner_sd:
                sd_out["totalIterations"] = inner_sd["totalIterations"]
            if inner_msg:
                sd_out["message"] = self._ensure_period(inner_msg)
                yield self._reply(
                    True,
                    parent_cmd,
                    status=TEST_RUNNING,
                    values="Running...",
                    status_details=sd_out,
                    payload_key=payload_key,
                    request_id=request_id,
                    meta=meta,
                )

            st = ev_body.get("testStatus")
            type_hint = (
                meta.get("command_type") if isinstance(meta, MetaHelper)
                else (meta or {}).get("command_type")
            ) or ""
            if st == TEST_SUCCESS:
                ok = True
                final_vals = ev_body.get("testValues") or ev_body.get("data")
            elif "Loop" in str(type_hint) and st == TEST_RUNNING:
                ok = True
                final_vals = ev_body.get("testValues") or ev_body.get("data")
                last_msg = (
                    (ev_body.get("statusDetails") or {}).get("message")
                    or ev_body.get("statusMsg")
                    or ev_body.get("testError")
                    or "Child progressing"
                )
            else:
                ok = False
                last_msg = (
                    (ev_body.get("statusDetails") or {}).get("message")
                    or ev_body.get("statusMsg")
                    or ev_body.get("testError")
                    or "Child failed"
                )

        logger.debug(
            "pipe_child exit: ok=%s final_keys=%s last_msg=%r",
            ok,
            list((final_vals or {}).keys()),
            last_msg,
        )
        return ok, final_vals, last_msg, ev_meta_out

    # ------------------ RunTest stream -> wrap for loop/sequence --------------
    def pipe_runtest(
        self,
        *,
        parent_cmd: str,
        ctx_fields: Dict[str, Any],
        payload_key: str,
        request_id: Optional[str],
        data: Dict[str, Any],
        ctx: HandlerContext,
        meta: MetaHelper | Dict[str, Any],
    ) -> Generator[Dict[str, Any], None, Tuple[bool, Dict[str, Any] | None, str | None, Dict[str, Any]]]:
        logger.debug(
            "pipe_runtest enter: parent=%s ctx_fields=%s data_keys=%s",
            parent_cmd,
            ctx_fields,
            list((data or {}).keys()),
        )
        ok = False
        final_vals: Dict[str, Any] | None = None
        last_msg: str | None = None
        last_meta: Dict[str, Any] = {}

        params = (data.get("params") or {}) if isinstance(data, dict) else {}
        chip = params.get("chipName", "")
        test = params.get("testName", "")
        logger.debug("pipe_runtest child target: chip=%s test=%s", chip, test)

        if parent_cmd == "RunLoopTest":
            it = getattr(meta, "iteration", None)
            tot = getattr(meta, "totalIterations", None)
            if isinstance(tot, int) and isinstance(it, int):
                logger.info("RunLoopTest %s %s loop %d of %d", chip, test, it, tot)
            else:
                logger.info("RunLoopTest %s %s loop %s", chip, test, it)

        data = dict(data or {})
        data["_meta"] = MetaHelper.ensure(meta).as_dict()

        child = self.RunTest(data, ctx)

        for ev in child:
            if "Sequence" in parent_cmd:
                phaseV = "Sequence step"
            elif "Loop" in parent_cmd:
                phaseV = "Looping"
            else:
                phaseV = "Running"

            ev_meta = dict(ev.get("_meta") or {})
            last_meta = ev_meta
            ev_body = ev.get("out") or {}
            logger.debug("pipe_runtest tick: ev_keys=%s", list(ev_body.keys()))

            if self._aborting():
                logger.debug("pipe_runtest abort detected")
                yield self._reply(
                    True,
                    parent_cmd,
                    status=TEST_RUNNING,
                    values="Running...",
                    status_details={
                        **ctx_fields,
                        "phase": phaseV,
                        "message": "Aborting.",
                    },
                    payload_key=payload_key,
                    request_id=request_id,
                    meta=meta,
                )
                self._clear_abort()
                return False, None, "Aborted", last_meta

            sd = ev_body.get("statusDetails")
            if isinstance(sd, dict):
                inner_msg = str(sd.get("message") or sd.get("error") or "")
            elif ev_body.get("statusMsg"):
                inner_msg = str(ev_body.get("statusMsg"))
            else:
                inner_msg = str(ev_meta.get("message") or "")
            base_message = inner_msg or "Running..."

            if "iteration" in ctx_fields:
                it = ctx_fields.get("iteration")
                tot = ctx_fields.get("totalIterations")
                loop_prefix = self._loop_prefix(it, tot)
                base_message = f"{loop_prefix}: {self._strip_status_prefix(base_message)}"

            if parent_cmd == "RunTestSequence":
                step = ctx_fields.get("step")
                base_message = self._with_sequence_prefix(step, chip, test, base_message)

            outer_message = self._ensure_period(base_message)

            yield self._reply(
                True,
                parent_cmd,
                status=TEST_RUNNING,
                status_details={
                    **ctx_fields,
                    "phase": phaseV,
                    "message": outer_message,
                },
                payload_key=payload_key,
                request_id=request_id,
                meta=meta,
            )

            st = ev_body.get("testStatus")
            if st == TEST_SUCCESS:
                ok = True
                final_vals = ev_body.get("testValues") or ev_meta.get("testValues")
            else:
                testValue = ev_body.get("testValues") or ev_meta.get("testValues")
                if testValue != "Running...":
                    final_vals = testValue
                ok = False
                last_msg = (
                    (ev_body.get("statusDetails") or {}).get("message")
                    or (ev_body.get("statusDetails") or {}).get("error")
                    or ev_body.get("statusMsg")
                    or ev_body.get("message")
                    or ev_body.get("testError")
                    or "Test failed"
                )

        logger.debug(
            "pipe_runtest exit: ok=%s final_keys=%s last_msg=%r",
            ok,
            list((final_vals or {}).keys()),
            last_msg,
        )
        return ok, final_vals, last_msg, last_meta