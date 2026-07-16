"""Pydantic wire models for the ITS3 TestAgent Kafka command surface.

These models are the single source of truth for both:

  * runtime validation of incoming Kafka messages (``service/listener.py``), and
  * the generated OpenAPI contract (``contract/generate_contract.py``).

Field names are camelCase and the envelope mirrors the WPAgent dialect, per
``Documentation/Kafka/SvtKafkaConventions.md``.

To add a command: add its request/reply models here, register it in
``service/commands.py``, then re-run the generator.  The YAML is never
hand-edited.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from run_state import ChipResult, ChipState, RunState, RunStatusSnapshot


def _iso(ts: float | None) -> str | None:
    """Epoch seconds -> ISO-8601 UTC, the form the UI renders directly."""
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Envelope  (documented in the contract; mirrors svt.wp-agent)
# ---------------------------------------------------------------------------

class ReplyStatus(str, Enum):
    Success         = "Success"
    BadRequest      = "BadRequest"
    NotFound        = "NotFound"
    UnexpectedError = "UnexpectedError"


class ReplyError(BaseModel):
    message: str = Field(..., description="Human-readable failure reason.")


class RequestMessage(BaseModel):
    """Body published to ``svt.its3-test-agent.request``."""
    type: str = Field(..., description="Command name, e.g. `StartRun`.")
    data: dict = Field(default_factory=dict, description="Command payload.")


class ReplyMessage(BaseModel):
    """Body emitted on ``svt.its3-test-agent.request.reply``."""
    type: str = Field(..., description="`<Command>Reply`, e.g. `StartRunReply`.")
    status: ReplyStatus = Field(..., description="Outcome of the command.")
    data: dict | None = Field(None, description="Reply payload (on success).")
    error: ReplyError | None = Field(None, description="Present when status != Success.")


class ReplyData(BaseModel):
    """Base for every reply payload."""
    executionTimeMs: int | None = Field(
        None, description="Server-side handling time, stamped by the listener "
                          "on each successful reply (as WPAgent does).")


# ---------------------------------------------------------------------------
# StartRun
# ---------------------------------------------------------------------------

class StartRunRequest(BaseModel):
    """Start a test run for one wafer.

    Rejected with `BadRequest` if a run is already active — the prober and DAQ
    are exclusive, so only one run exists at a time.
    """
    model_config = ConfigDict(json_schema_extra={
        "example": {"wafer": "L1W04_S4", "dryRun": False},
    })

    wafer: str = Field(
        ...,
        min_length=1,
        description="Wafer name; combined with each CSV `DIE` to form the chip "
                    "name, e.g. `L1W04_S4` -> `BAM16_L1W04_S4`.",
        examples=["L1W04_S4"],
    )
    config: str | None = Field(
        None,
        description="Config file to run with, relative to the agent directory. "
                    "Defaults to the agent's configured file.",
        examples=["its3_test_agent_config.json"],
    )
    dryRun: bool = Field(
        False,
        description="Print/step through commands without executing the mosaix "
                    "sequences or moving the prober.",
    )


class StartRunReply(ReplyData):
    model_config = ConfigDict(json_schema_extra={
        "example": {"runId": "6b1f3c22-6c1e-4f0a-9a7a-1c2f3d4e5f60",
                    "state": "INITIALIZING", "wafer": "L1W04_S4",
                    "executionTimeMs": 8},
    })

    runId: str = Field(..., description="Identifier of the started run.")
    state: RunState = Field(..., description="Run state right after starting.")
    wafer: str = Field(..., description="Wafer this run is testing.")


# ---------------------------------------------------------------------------
# StopRun
# ---------------------------------------------------------------------------

class StopRunRequest(BaseModel):
    """Request a graceful stop of the active run.

    Returns as soon as the stop is *requested*.  The agent terminates the
    running command, then still parks the prober and logs out before the run
    reaches a terminal state — poll `GetStatus` to observe that.
    """
    model_config = ConfigDict(json_schema_extra={"example": {}})


class StopRunReply(ReplyData):
    model_config = ConfigDict(json_schema_extra={
        "example": {"runId": "6b1f3c22-6c1e-4f0a-9a7a-1c2f3d4e5f60",
                    "state": "STOPPING", "stopRequested": True,
                    "executionTimeMs": 3},
    })

    runId: str | None = Field(None, description="Run that was asked to stop.")
    state: RunState = Field(..., description="State at the moment of the request.")
    stopRequested: bool = Field(
        ..., description="False if there was no active run to stop.")


# ---------------------------------------------------------------------------
# GetStatus
# ---------------------------------------------------------------------------

class ChipStatus(BaseModel):
    die: str            = Field(..., description="CSV `DIE` column, e.g. `BAM16`.")
    chipName: str       = Field(..., description="`<DIE>_<wafer>`.")
    wp: str             = Field(..., description="Prober die coordinate `[col,row]`.")
    state: ChipState    = Field(..., description="Per-chip outcome.")
    error: str | None   = Field(None, description="Failure reason when state=FAIL.")
    startedAt: str | None  = Field(None, description="ISO-8601 UTC.")
    finishedAt: str | None = Field(None, description="ISO-8601 UTC.")

    @classmethod
    def from_chip(cls, c: ChipResult) -> "ChipStatus":
        return cls(
            die=c.die, chipName=c.chip_name, wp=c.wp, state=c.state, error=c.error,
            startedAt=_iso(c.started_at), finishedAt=_iso(c.finished_at),
        )


class GetStatusRequest(BaseModel):
    """Poll the state of the active (or most recent) run."""
    model_config = ConfigDict(json_schema_extra={"example": {}})


class GetStatusReply(ReplyData):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "runId": "6b1f3c22-6c1e-4f0a-9a7a-1c2f3d4e5f60",
            "wafer": "L1W04_S4",
            "config": "its3_test_agent_config.json",
            "dryRun": False,
            "state": "RUNNING",
            "currentChip": "BAM01_L1W04_S4",
            "done": 1,
            "total": 3,
            "chips": [
                {"die": "BAM00", "chipName": "BAM00_L1W04_S4", "wp": "[0,-1]",
                 "state": "PASS", "error": None,
                 "startedAt": "2026-07-16T09:00:00+00:00",
                 "finishedAt": "2026-07-16T09:04:10+00:00"},
                {"die": "BAM01", "chipName": "BAM01_L1W04_S4", "wp": "[1,-1]",
                 "state": "RUNNING", "error": None,
                 "startedAt": "2026-07-16T09:04:12+00:00", "finishedAt": None},
                {"die": "SEG2", "chipName": "SEG2_L1W04_S4", "wp": "[2,3]",
                 "state": "PENDING", "error": None,
                 "startedAt": None, "finishedAt": None},
            ],
            "startedAt": "2026-07-16T08:59:31+00:00",
            "finishedAt": None,
            "error": None,
            "executionTimeMs": 1,
        },
    })

    runId: str | None    = Field(None, description="None if nothing has run yet.")
    wafer: str | None    = Field(None, description="Wafer under test.")
    config: str | None   = Field(None, description="Config file this run used.")
    dryRun: bool         = Field(..., description="Whether this run is a dry run.")
    state: RunState      = Field(..., description="Current run state.")
    currentChip: str | None = Field(None, description="Chip being tested right now.")
    done: int            = Field(..., description="Chips finished (PASS + FAIL).")
    total: int           = Field(..., description="Chips to test (excludes SKIP).")
    chips: list[ChipStatus] = Field(default_factory=list,
                                    description="Full run list with per-chip state.")
    startedAt: str | None  = Field(None, description="ISO-8601 UTC.")
    finishedAt: str | None = Field(None, description="ISO-8601 UTC; set in DONE/FAILED.")
    error: str | None      = Field(None, description="Failure reason when state=FAILED.")

    @classmethod
    def from_snapshot(cls, s: RunStatusSnapshot) -> "GetStatusReply":
        return cls(
            runId=s.run_id, wafer=s.wafer, config=s.config, dryRun=s.dry_run,
            state=s.state, currentChip=s.current_chip, done=s.done, total=s.total,
            chips=[ChipStatus.from_chip(c) for c in s.chips],
            startedAt=_iso(s.started_at), finishedAt=_iso(s.finished_at),
            error=s.error,
        )
