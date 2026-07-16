"""Background run job for the ITS3 TestAgent.

Turns the blocking ``ITS3Runner.run()`` into something a UI can drive:
start returns immediately, status is pollable, stop is cooperative.
"""

from __future__ import annotations

import json
import logging
import threading
import uuid
from pathlib import Path

from its3_test_agent import ITS3Runner
from run_state import RunState, RunStatus
from service.errors import CommandError
from service.models import (
    GetStatusReply,
    GetStatusRequest,
    ReplyStatus,
    StartRunReply,
    StartRunRequest,
    StopRunReply,
    StopRunRequest,
)

log = logging.getLogger("its3.service")


class RunManager:
    """Owns the one active run.

    The prober and DAQ are exclusive hardware, so a second StartRun is
    rejected rather than queued.
    """

    def __init__(self, agent_dir: Path,
                 default_config: str = "its3_test_agent_config.json") -> None:
        self.agent_dir      = agent_dir
        self.default_config = default_config

        self._lock   = threading.Lock()
        self._status = RunStatus()
        self._cancel = threading.Event()
        self._thread: threading.Thread | None = None

    # ------------------------------------------------------------------
    # Commands
    # ------------------------------------------------------------------

    def start_run(self, req: StartRunRequest) -> StartRunReply:
        with self._lock:
            if self._status.is_active:
                raise CommandError(
                    f"A run is already active (runId={self._status.run_id}, "
                    f"state={self._status.state.value}). Stop it first."
                )

            config_name = req.config or self.default_config
            config_path = self._resolve_config(config_name)
            try:
                config = json.loads(config_path.read_text())
            except json.JSONDecodeError as exc:
                raise CommandError(f"Config {config_path} is not valid JSON: {exc}") from exc

            run_id = str(uuid.uuid4())

            # Fresh status + cancel per run: a stale cancel from a previous run
            # must never leak into this one.
            self._cancel = threading.Event()
            self._status = RunStatus()
            self._status.begin(run_id, req.wafer, config_name, req.dryRun)

            runner = ITS3Runner(
                config, config_dir=config_path.parent, wafer=req.wafer,
                dry_run=req.dryRun, status=self._status, cancel=self._cancel,
                progress_bar=False,   # no tqdm bar when driven over Kafka
            )
            self._thread = threading.Thread(
                target=self._run, args=(runner,),
                name=f"its3-run-{run_id[:8]}", daemon=True,
            )
            self._thread.start()

            log.info("StartRun  runId=%s wafer=%s config=%s dryRun=%s",
                     run_id, req.wafer, config_name, req.dryRun)
            return StartRunReply(runId=run_id, state=self._status.state, wafer=req.wafer)

    def stop_run(self, req: StopRunRequest) -> StopRunReply:
        with self._lock:
            snap = self._status.snapshot()
            if not self._status.is_active:
                log.info("StopRun ignored — no active run (state=%s)", snap.state.value)
                return StopRunReply(runId=snap.run_id, state=snap.state,
                                    stopRequested=False)

            log.warning("StopRun requested for runId=%s", snap.run_id)
            self._cancel.set()
            self._status.set_state(RunState.STOPPING)
            return StopRunReply(runId=snap.run_id, state=RunState.STOPPING,
                                stopRequested=True)

    def get_status(self, req: GetStatusRequest) -> GetStatusReply:
        return GetStatusReply.from_snapshot(self._status.snapshot())

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _run(self, runner: ITS3Runner) -> None:
        try:
            runner.run()
        except BaseException as exc:  # safety net: never leave the state stuck
            log.exception("Run crashed: %s", exc)                # noqa: TRY401
            self._status.set_state(RunState.FAILED, str(exc))

    def _resolve_config(self, name: str) -> Path:
        path = Path(name).expanduser()
        if not path.is_absolute():
            path = self.agent_dir / path
        if not path.is_file():
            raise CommandError(f"Config not found: {path}", ReplyStatus.NotFound)
        return path
