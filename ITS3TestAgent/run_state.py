"""Run state model for the ITS3 TestAgent.

Shared by the runner core (``its3_test_agent.py``) and the Kafka service layer
(``service/``).  Deliberately plain stdlib — no Kafka, no Pydantic — so the
runner keeps working standalone from the CLI with no transport dependencies.

The runner thread writes; the Kafka listener thread reads.  Every access goes
through the lock, and readers get an immutable ``RunStatusSnapshot`` copy.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, replace
from enum import Enum


class RunState(str, Enum):
    IDLE         = "IDLE"          # nothing has run yet
    INITIALIZING = "INITIALIZING"  # WPAgent link + mosaix init commands
    RUNNING      = "RUNNING"       # stepping through the chips
    STOPPING     = "STOPPING"      # stop requested, unwinding + parking prober
    DONE         = "DONE"
    FAILED       = "FAILED"


class ChipState(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    PASS    = "PASS"
    FAIL    = "FAIL"
    SKIP    = "SKIP"


#: States in which no run is in flight, so a new StartRun is allowed.
TERMINAL_STATES = frozenset({RunState.IDLE, RunState.DONE, RunState.FAILED})


@dataclass
class ChipResult:
    die: str
    chip_name: str
    wp: str
    state: ChipState = ChipState.PENDING
    error: str | None = None
    started_at: float | None = None
    finished_at: float | None = None


@dataclass(frozen=True)
class RunStatusSnapshot:
    """Immutable point-in-time copy of a RunStatus, safe to read off-thread."""
    run_id: str | None
    wafer: str | None
    config: str | None
    dry_run: bool
    state: RunState
    current_chip: str | None
    done: int
    total: int
    chips: tuple[ChipResult, ...]
    started_at: float | None
    finished_at: float | None
    error: str | None


class RunStatus:
    """Mutable status of the active (or most recent) run."""

    def __init__(self) -> None:
        self._lock       = threading.RLock()
        self.run_id: str | None       = None
        self.wafer: str | None        = None
        self.config: str | None       = None
        self.dry_run                  = False
        self.state                    = RunState.IDLE
        self.current_chip: str | None = None
        self.chips: list[ChipResult]  = []
        self.started_at: float | None  = None
        self.finished_at: float | None = None
        self.error: str | None         = None

    # ------------------------------------------------------------------

    @property
    def is_active(self) -> bool:
        with self._lock:
            return self.state not in TERMINAL_STATES

    def begin(self, run_id: str, wafer: str, config: str, dry_run: bool) -> None:
        with self._lock:
            self.run_id       = run_id
            self.wafer        = wafer
            self.config       = config
            self.dry_run      = dry_run
            self.state        = RunState.INITIALIZING
            self.current_chip = None
            self.chips        = []
            self.started_at   = time.time()
            self.finished_at  = None
            self.error        = None

    def set_state(self, state: RunState, error: str | None = None) -> None:
        with self._lock:
            self.state = state
            if error is not None:
                self.error = error
            if state in (RunState.DONE, RunState.FAILED):
                self.finished_at  = time.time()
                self.current_chip = None

    def set_chips(self, chips: list[ChipResult]) -> None:
        with self._lock:
            self.chips = chips

    def start_chip(self, chip_name: str) -> None:
        with self._lock:
            self.current_chip = chip_name
            for c in self.chips:
                if c.chip_name == chip_name:
                    c.state      = ChipState.RUNNING
                    c.started_at = time.time()
                    break

    def finish_chip(self, chip_name: str, state: ChipState, error: str | None = None) -> None:
        with self._lock:
            for c in self.chips:
                if c.chip_name == chip_name:
                    c.state       = state
                    c.error       = error
                    c.finished_at = time.time()
                    break
            self.current_chip = None

    # ------------------------------------------------------------------

    def snapshot(self) -> RunStatusSnapshot:
        with self._lock:
            return RunStatusSnapshot(
                run_id       = self.run_id,
                wafer        = self.wafer,
                config       = self.config,
                dry_run      = self.dry_run,
                state        = self.state,
                current_chip = self.current_chip,
                done         = sum(1 for c in self.chips
                                   if c.state in (ChipState.PASS, ChipState.FAIL)),
                total        = sum(1 for c in self.chips if c.state is not ChipState.SKIP),
                chips        = tuple(replace(c) for c in self.chips),
                started_at   = self.started_at,
                finished_at  = self.finished_at,
                error        = self.error,
            )
