"""
SVT Test Agent test system backend emulator.

This backend simulates execution of tests by emitting progress updates
and final result payloads without talking to real hardware. It
implements the ITestBackend interface and is intended for development,
testing, and demonstration runs.

Location: svt_test_agent/test_system_backend/emulator.py
"""

import logging
import os
import random
import threading
import time
from typing import Any, Dict, Iterable, Tuple

from .interface import ITestBackend

logger = logging.getLogger("EmulatorBackend")
# Inherit root level by default; allow explicit DEBUG via env
if os.getenv("SVT_EMU_DEBUG"):
    logger.setLevel(logging.DEBUG)
else:
    logger.setLevel(logging.NOTSET)

JsonDict = Dict[str, Any]
# NOTE: The backend yields (values_or_err, meta: Dict[str, Any])
GenTriple = Iterable[Tuple[Any, Dict[str, Any]]]


class EmulatorBackend(ITestBackend):
    """
    Test emulator:
      - Common progress loop
      - Per-test functions (<TestName>_emulator) return fixed dicts
    """

    # Defaults (overridable by env)
    LONG_LOOP = True
    DURATION_S = 5.0
    STEPS = 5

    def __init__(self) -> None:
        # Allow env to tweak timing without code edits
        try:
            self.LONG_LOOP = bool(int(os.getenv("SVT_EMU_LONG_LOOP", "1")))
        except Exception:
            pass
        try:
            self.DURATION_S = float(os.getenv("SVT_EMU_DURATION", str(self.DURATION_S)))
        except Exception:
            pass
        logger.debug(
            "EmulatorBackend.__init__: LONG_LOOP=%s DURATION_S=%.3f STEPS=%d",
            self.LONG_LOOP,
            self.DURATION_S,
            self.STEPS,
        )

    def initialize(
        self,
        chip_type: str,
        test_name: str,
        params: JsonDict,
        abort: threading.Event,
    ) -> None:
        logger.info("Emulator: initialize chip=%s test=%s", chip_type, test_name)
        logger.debug(
            "initialize details: params_keys=%s abort.is_set=%s",
            list((params or {}).keys()),
            abort.is_set(),
        )
        time.sleep(0.05)

    def run(
        self,
        chip_type: str,
        test_name: str,
        params: JsonDict,
        abort: threading.Event,
    ) -> GenTriple:
        logger.debug(
            "run enter: chip=%s test=%s params_keys=%s abort=%s",
            chip_type,
            test_name,
            list((params or {}).keys()),
            abort.is_set(),
        )

        inputs: JsonDict = (params.get("inputs") or {})
        fn_name = f"{test_name}_emulator"
        fn = getattr(self, fn_name, self._default_emulator)

        steps = int(self.STEPS)
        sleep_per_step = (self.DURATION_S / steps) if self.LONG_LOOP else 0.2
        logger.debug(
            "run config: fn=%s exists=%s steps=%d sleep_per_step=%.3f LONG_LOOP=%s",
            fn_name,
            fn is not None,
            steps,
            sleep_per_step,
            self.LONG_LOOP,
        )

        # ---- Randomly simulate system-level failure/hang (deterministic seed not set) ----
        rnd = 0.5
        logger.debug("run random gate value=%.3f (fail<0.1, hang<0.2)", rnd)

        if rnd < 0.1:  # 10% chance: immediate fail
            msg = f"System failure during {chip_type} {test_name} (emulated hard fail)"
            logger.error(msg)
            yield {"inputs": inputs, "outputs": "systemFail"}, {
                "status": "Fail",
                "chipName": chip_type,
                "testName": test_name,
                "message": msg,
            }
            logger.debug("run exit (hard fail path)")
            return

        if rnd < 0.2:  # next 10% chance: system hang until abort
            msg = f"System hang: {chip_type} {test_name} (emulated no response)"
            logger.error(msg)
            logger.debug("enter hang loop until abort.is_set()")
            while not abort.is_set():
                time.sleep(1.0)  # stuck forever (until AbortTest)
            logger.debug("abort detected during hang; emitting Fail")
            yield {"inputs": inputs, "outputs": "systemHang"}, {
                "status": "Fail",
                "chipName": chip_type,
                "testName": test_name,
                "message": f"{chip_type} {test_name} aborted after hang",
            }
            logger.debug("run exit (hang->abort path)")
            return
        # ----------------------------------------------------------------------

        for i in range(1, steps + 1):
            if abort.is_set():
                percent = i * (100 // steps)
                values = {"inputs": inputs, "outputs": "testAborted"}
                meta = {
                    "status": "Fail",
                    "chipName": chip_type,
                    "testName": test_name,
                    "percentageCompleted": percent,
                    "message": f"TestFail: {chip_type} {test_name} aborted at {percent}%.",
                }
                logger.info(meta["message"])
                logger.debug(
                    "abort path: i=%d/%d percent=%d values=%r",
                    i,
                    steps,
                    percent,
                    values,
                )
                yield values, meta
                logger.debug("run exit (abort during loop)")
                return

            time.sleep(sleep_per_step)
            percent = i * (100 // steps)

            if percent < 100:
                meta = {
                    "status": "Running",
                    "chipName": chip_type,
                    "testName": test_name,
                    "percentageCompleted": percent,
                    "message": f"{chip_type} {test_name} {percent}%",
                }
                logger.info("TestRunning: %s %s %d%%", chip_type, test_name, percent)
                logger.debug(
                    "progress tick: i=%d/%d percent=%d inputs_keys=%s",
                    i,
                    steps,
                    percent,
                    list(inputs.keys()),
                )
                # For streaming, the handler expects a 'values_or_err' alongside meta
                yield "Running", meta
            else:
                outputs = fn(inputs)
                values = {"inputs": inputs, "outputs": outputs}
                meta = {
                    "status": "Success",
                    "chipName": chip_type,
                    "testName": test_name,
                    "percentageCompleted": percent,
                    "message": f"{chip_type} {test_name} completed.",
                }
                logger.info(meta["message"])
                logger.debug(
                    "final tick: outputs_keys=%s values_keys=%s",
                    list(outputs.keys()),
                    list(values.keys()),
                )
                yield values, meta
                logger.debug("run exit (success)")
                return

    # --- Per-test stubs (just pass values) ---

    def PowerRampUp_emulator(self, inputs: JsonDict) -> JsonDict:
        logger.debug("PowerRampUp_emulator inputs_keys=%s", list(inputs.keys()))
        return {"vOut": 1.23}

    def PSRR_emulator(self, inputs: JsonDict) -> JsonDict:
        logger.debug("PSRR_emulator inputs_keys=%s", list(inputs.keys()))
        # PSRR requires psrr + vOut
        return {"vOut": 1.30, "psrr": 65.0}

    def PowerRampRate_emulator(self, inputs: JsonDict) -> JsonDict:
        logger.debug("PowerRampRate_emulator inputs_keys=%s", list(inputs.keys()))
        return {"vOut": 1.20}

    def DACScan_emulator(self, inputs: JsonDict) -> JsonDict:
        """
        Accepts:
          - dacCode: int        -> single float in [1.1, 1.5] (skewed to 1.5)
          - dacCode: [int,...]  -> list of floats in [1.1, 1.5], one per code
          - None                -> full 31-point sweep
        """
        logger.debug("DACScan_emulator inputs=%r", inputs)

        def code_to_v(code: int) -> float:
            # Beta(5,1) gives distribution skewed towards 1.0
            r = random.betavariate(5, 1)  # [0,1]
            return round(1.1 + (1.5 - 1.1) * r, 4)

        val = inputs.get("dacCode", None)

        if val is None:
            v = {"vOut": [code_to_v(i) for i in range(31)]}
            logger.debug("DACScan_emulator -> full sweep len=%d", len(v["vOut"]))
            return v

        if isinstance(val, int):
            v = {"vOut": code_to_v(val)}
            logger.debug(
                "DACScan_emulator -> single code=%d v=%s",
                val,
                v["vOut"],
            )
            return v

        if isinstance(val, list):
            vals = [code_to_v(int(c)) for c in val]
            logger.debug(
                "DACScan_emulator -> list codes=%s len=%d",
                val,
                len(vals),
            )
            return {"vOut": vals}

        v = {"vOut": [code_to_v(i) for i in range(31)]}
        logger.debug("DACScan_emulator -> fallback sweep len=%d", len(v["vOut"]))
        return v

    def OverCurrent_emulator(self, inputs: JsonDict) -> JsonDict:
        logger.debug("OverCurrent_emulator inputs_keys=%s", list(inputs.keys()))
        # Include vOut plus currents
        return {"vOut": 1.10, "iOut": 0.50, "iIn": 0.55}

    def Irradiation_emulator(self, inputs: JsonDict) -> JsonDict:
        logger.debug("Irradiation_emulator inputs_keys=%s", list(inputs.keys()))
        # Include vOut plus currents
        return {"vOut": 1.08, "iOut": 0.40, "iIn": 0.42}

    def _default_emulator(self, inputs: JsonDict) -> JsonDict:
        logger.debug("_default_emulator inputs_keys=%s", list(inputs.keys()))
        # Fallback: at least return vOut so schema validators pass
        return {"vOut": 1.30}