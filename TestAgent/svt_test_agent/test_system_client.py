"""
TestSystemClient – facade for test system backends.

Responsibilities
----------------
- Wraps a concrete backend implementing `ITestBackend`.
- Tracks the currently active request/test for proper AbortTest(id) validation.
- (Optionally) enforces that only one test runs at a time.
- Exposes simple methods for:
    - Listing tests from the registry (no DB/Kafka needed).
    - Running a test (`run_test` – streaming interface).
    - Aborting a test (`abort_test`).
    - Polling status (`test_status`).

Threading model
---------------
- `run_test()` is called on a background thread (agent spawns it for streaming).
- `abort_test()` & `test_status()` are called on the main consumer thread.
- We guard shared state (`_active_request_id`, `_active_test_name`, `_active_chip_name`)
  with `_state_lock`.

Location: svt_test_agent/test_system_client.py
"""

import logging
import threading
import importlib
from typing import Any, Dict, Iterable, Optional, Tuple

from svt_test_agent.registries.test_registry import CHIP_TEST_DEFINITIONS
from svt_test_agent.test_system_backend.interface import ITestBackend
from svt_test_agent.test_system_backend.emulator import EmulatorBackend  # Default fallback

logger = logging.getLogger("TestSystemClient")
logger.setLevel(logging.NOTSET)

JsonDict = Dict[str, Any]
# (values_or_err, meta_dict)
GenTriple = Iterable[Tuple[Any, Dict[str, Any]]]


def load_backend_from_path(class_path: str, **kwargs) -> ITestBackend:
    """
    Dynamically import and instantiate a backend class.

    class_path examples:
        "svt_test_agent.testSystemBackend.emulator.EmulatorBackend"
        "svt_test_agent.testSystemBackend.real_backend.RealBackend"
    """
    logger.debug(
        "load_backend_from_path(class_path=%r, kwargs_keys=%s)",
        class_path,
        list(kwargs.keys()),
    )
    module_path, cls_name = class_path.rsplit(".", 1)
    mod = importlib.import_module(module_path)
    cls = getattr(mod, cls_name)
    be = cls(**kwargs)
    logger.debug("Loaded backend class=%s from %s", cls_name, module_path)
    return be


class TestSystemClient:
    """
    Facade for test system backends.

    Features:
      - Tracks currently running request_id to validate AbortTest(id).
      - Optional single-run enforcement (one test at a time).
      - Swappable backend (Emulator by default; real backends later).
    """

    def __init__(
        self,
        backend: Optional[ITestBackend] = None,
        *,
        enforce_single_run: bool = True,
    ):
        logger.debug(
            "TestSystemClient.__init__(backend=%s, enforce_single_run=%s)",
            type(backend).__name__ if backend else None,
            enforce_single_run,
        )
        self._backend: ITestBackend = backend or EmulatorBackend()
        self._abort = threading.Event()

        # Single-run enforcement & active-state tracking
        self._run_lock = threading.Lock()  # gate for "only one test at a time"
        self.enforce_single_run = enforce_single_run

        # Active state + guard
        self._state_lock = threading.Lock()
        self._active_request_id: Optional[str] = None
        self._active_test_name: Optional[str] = None
        self._active_chip_name: Optional[str] = None

        logger.info("TestSystemClient using backend: %s", type(self._backend).__name__)

    # --------------- Public abort helpers (for handlers) ----------------
    def is_abort_requested(self) -> bool:
        """True if an abort was requested (the shared Event is set)."""
        state = self._abort.is_set()
        logger.debug("is_abort_requested -> %s", state)
        return state

    def request_abort(self, test_id: Any = None) -> Dict[str, Any]:
        """
        Convenience alias so callers don't need to know `abort_test`'s signature.
        """
        logger.debug("request_abort(test_id=%r)", test_id)
        return self.abort_test(test_id)

    # ---------------- Backend management ----------------
    def set_backend(self, backend: ITestBackend) -> None:
        """Swap to a different backend (e.g. real hardware)."""
        logger.debug("set_backend(%s)", type(backend).__name__)
        self._backend = backend
        logger.info("Backend switched to: %s", type(self._backend).__name__)

    def use_backend_from_config(self, backend_spec: Dict[str, Any]) -> None:
        """
        backend_spec example:
            {
              "class": "TestAgent.testSystemBackend.emulator.EmulatorBackend",
              "kwargs": {}
            }
        or:
            {
              "class": "TestAgent.testSystemBackend.real_backend.RealBackend",
              "kwargs": {"host": "10.0.0.5"}
            }
        """
        logger.debug(
            "use_backend_from_config(spec_keys=%s)",
            list((backend_spec or {}).keys()),
        )
        cls_path = backend_spec.get("class")
        kwargs = backend_spec.get("kwargs", {})
        if cls_path:
            be = load_backend_from_path(cls_path, **kwargs)
            self.set_backend(be)
        else:
            logger.warning("use_backend_from_config called without 'class' key")

    def set_single_run(self, enforce: bool) -> None:
        """Enable/disable single-run enforcement at runtime."""
        self.enforce_single_run = bool(enforce)
        logger.debug("set_single_run(enforce=%s)", self.enforce_single_run)

    # ---------------- Registry queries ----------------
    def get_all_tests(self, chip_name: str) -> JsonDict:
        logger.debug("get_all_tests(chip_name=%r)", chip_name)
        chip_def = CHIP_TEST_DEFINITIONS.get(chip_name, {}) or {}
        out = {
            "chipName": chip_name,
            "tests": list((chip_def.get("tests") or {}).keys()),
        }
        logger.debug("get_all_tests -> %d tests", len(out["tests"]))
        return out

    def get_all_tests_all(self) -> Dict[str, Any]:
        """
        Return all tests for all known chip types from the local registry.
        No DB or Kafka required.
        """
        logger.debug("get_all_tests_all()")
        out = []
        for chip_name, defn in (CHIP_TEST_DEFINITIONS or {}).items():
            tests = list((defn.get("tests") or {}).keys())
            out.append({"chipName": chip_name, "tests": tests})
        logger.debug("get_all_tests_all -> %d chips", len(out))
        return {"chips": out}

    # ---------------- Introspection helpers ----------------
    def is_busy(self) -> bool:
        """
        True if a test is currently marked active.
        Handlers can call this to short-circuit before starting a streaming run.
        """
        with self._state_lock:
            busy = self._active_request_id is not None
        logger.debug(
            "is_busy -> %s (active_request_id=%r)",
            busy,
            self._active_request_id,
        )
        return busy

    def current_active(
        self,
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """Return (active_request_id, active_test_name, active_chip_name) under lock."""
        with self._state_lock:
            vals = (
                self._active_request_id,
                self._active_test_name,
                self._active_chip_name,
            )
        logger.debug("current_active -> id=%r test=%r chip=%r", *vals)
        return vals

    # ---------------- Control plane ----------------
    def abort_test(self, test_id: Any) -> JsonDict:
        """
        Abort the currently running test.

        Behaviour:
        - If test_id is falsy/unknown -> abort the *active* test (single-run system).
        - If test_id is provided -> only abort if it matches the active id.

        Returns a dict:
            {
              "type": "AbortTestReply",
              "testStatus": "TestFail",   # as a terminal (non-success) end state
              "statusMsg": "...",
              "ok": True|False,
              "abortedRequestId": <active_id>|None,
              "running": <active_id_if_mismatch>  # optional
            }
        """
        logger.debug("abort_test(test_id=%r) enter", test_id)
        # Snapshot current active state
        with self._state_lock:
            active = self._active_request_id
            active_test = self._active_test_name
            active_chip = self._active_chip_name
        logger.debug(
            "abort_test active_state: id=%r test=%r chip=%r",
            active,
            active_test,
            active_chip,
        )

        # Normalize requested id
        requested = (str(test_id) if test_id is not None else "").strip().lower()
        is_unknown = requested in {"", "none", "unknown"}

        # Decide target: explicit match, else active (for no-id cases)
        if is_unknown:
            req_id = active  # may be None
        else:
            req_id = str(test_id)

        # No active test to abort
        if active is None:
            msg = "No active test to abort."
            logger.warning(msg)
            return {
                "type": "AbortTestReply",
                "testStatus": "TestFail",
                "statusMsg": msg,
                "ok": False,
            }

        # If explicit id was provided, ensure it matches the active one
        if not is_unknown and active != req_id:
            msg = (
                f"Active test id mismatch: running={active}, "
                f"requested_abort={req_id}"
            )
            logger.warning(msg)
            return {
                "type": "AbortTestReply",
                "testStatus": "TestFail",
                "statusMsg": msg,
                "ok": False,
                "running": active,
            }

        # OK → abort the active test
        self._abort.set()
        msg = (
            f"Abort signaled for test request id={active}, "
            f"{active_chip} {active_test or 'unknown'}"
        )
        logger.warning(msg)
        return {
            "type": "AbortTestReply",
            "testStatus": "TestFail",      # terminal, non-success end state
            "statusMsg": msg,
            "ok": True,                    # clearer handler logic
            "abortedRequestId": active,    # explicitly report which id was aborted
        }

    def test_status(self, test_id: Any) -> JsonDict:
        """
        Lightweight status probe (NO backend call yet).

        Reports 'Running' if the id matches the active id; else 'Idle'.
        NOTE: `testStatus` is always "TestRunning" here to match existing enums;
        consumers should read the human-readable `statusMsg`.
        """
        req_id = str(test_id)
        with self._state_lock:
            active = self._active_request_id
        is_active = active == req_id
        status_str = "Running" if is_active else "Idle"
        out = {
            "type": "TestStatusReply",
            "testStatus": "TestRunning",
            "statusMsg": f"Test {test_id}: {status_str}",
        }
        logger.debug(
            "test_status(%r) -> active=%s out=%s",
            test_id,
            is_active,
            out,
        )
        return out

    # ---------------- Execution ----------------
    def run_test(
        self,
        chip_type: str,
        test_name: str,
        params: JsonDict,
    ) -> GenTriple:
        """
        Run a single test using the current backend.

        Requires TestAgent/cmd_handler to inject '_request_id' into params, e.g.:
            params["_request_id"] = request_id

        Enforces optional single-run with a non-blocking lock
        (returns a single Fail tuple if busy).
        """
        logger.debug(
            "run_test enter: chip=%s test=%s param_keys=%s",
            chip_type,
            test_name,
            list((params or {}).keys()),
        )
        req_id = str(params.get("_request_id", ""))  # injected by handler before calling client
        if not req_id:
            logger.warning(
                "No _request_id provided for run_test; "
                "abort-id validation will be limited.",
            )

        # Single-run enforcement (optional)
        acquired = True
        if self.enforce_single_run:
            acquired = self._run_lock.acquire(blocking=False)
            logger.debug("run_test acquire lock -> %s", acquired)
            if not acquired:
                err_msg = (
                    "Another test is already running. "
                    "If you want to run a sequence of tests use 'RunTest: Sequence'."
                )
                logger.error(err_msg)
                # Stream a single failure tuple; handler will turn this into a dict reply.
                yield err_msg, {"status": "Fail", "message": err_msg}
                return

        # Mark active
        with self._state_lock:
            self._active_request_id = req_id or self._active_request_id
            self._active_test_name = test_name
            self._active_chip_name = chip_type
        logger.debug(
            "run_test set active: id=%r test=%r chip=%r",
            self._active_request_id,
            self._active_test_name,
            self._active_chip_name,
        )

        self._abort.clear()
        try:
            # 1) Initialize backend
            try:
                logger.debug("backend.initialize(...)")
                self._backend.initialize(chip_type, test_name, params, self._abort)
                logger.debug("backend.initialize OK")
            except Exception as e:
                msg = f"Initialization failed: {e}"
                logger.exception(msg)
                yield msg, {"status": "Fail", "message": msg}
                return

            # 2) Stream execution results
            logger.debug("backend.run(...) begin streaming")
            for values_or_err, meta in self._backend.run(
                chip_type,
                test_name,
                params,
                self._abort,
            ):
                meta = dict(meta or {})
                status = meta.get("status")
                logger.debug(
                    "backend.run tick: status=%r keys(values)=%s meta_keys=%s",
                    status,
                    list((values_or_err or {}).keys())
                    if isinstance(values_or_err, dict)
                    else "<non-dict>",
                    list(meta.keys()),
                )

                # Directly forward (values_or_err, meta).
                # If status not terminal, normalise to "Running".
                if status not in ("Success", "Fail"):
                    if not status:
                        meta["status"] = "Running"
                    yield values_or_err, meta
                else:
                    yield values_or_err, meta
                    logger.debug(
                        "backend.run terminal status=%s -> break",
                        status,
                    )
                    break

        finally:
            # Clear active state and release lock
            logger.debug(
                "run_test finally: clearing active state and locks",
            )
            with self._state_lock:
                self._active_request_id = None
                self._active_test_name = None
                self._active_chip_name = None
            self._abort.clear()
            if acquired and self.enforce_single_run:
                try:
                    self._run_lock.release()
                    logger.debug("run_test lock released")
                except Exception:
                    logger.exception(
                        "run_test lock release failed (ignored)",
                    )