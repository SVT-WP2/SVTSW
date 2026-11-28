"""The engine: every command of every mode goes through `Engine.execute(request) -> Reply`.

Every request is independent (D10): the engine keeps nothing between requests except the connection (#408).
It is not thread-safe and does not need to be: one request at a time (tool contract rule 3).

The path of a request:
1. not a command of the tool: 404 (dropped, step 2, unknown; `wptool.notintool`);
2. the keys `user` and `waferAgentName` are removed (D13);
3. the parameters are checked and converted (`wptool.params.check_params`): 400;
4. the checks before the command, in this fixed order, each a hook that raises `ToolError` to refuse:
   the connection (503), then the checks that ask the machine, always last (#408: the separation check, D11);
5. the command runs; a `ToolError` keeps its code, any other `Exception` is 500 with the traceback in the log;
6. the hook `on_finish` (#408: `local_mode()` is the last call of a request that touched the machine, D16);
7. the reply; 8. a `status` event after the reply when the connection changed; 9. one log line.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Callable

import wptool.commands  # noqa: F401  (registers every command)
from wptool.config import Config
from wptool.events import EventSink, RequestEvents
from wptool.notintool import refusal
from wptool.params import check_params, drop_ignored
from wptool.registry import REGISTRY, CommandContext, CommandSpec
from wptool.replies import FAILED, Reply, ToolError
from wptool.state import ToolState

log = logging.getLogger("wptool.engine")


@dataclass(frozen=True, kw_only=True)
class Request:
    id: str | None = None  # made by the caller; copied into the reply and the progress events
    command: str
    params: dict = field(default_factory=dict)
    context: dict | None = None  # accepted and ignored (D10)


def resolve(command: str) -> CommandSpec:
    """The spec of a command of the tool. Raises `ToolError` 404 for a dropped, a step-2 or an unknown name."""
    spec = REGISTRY.get(command)
    if spec is None:
        raise refusal(command)
    return spec


def validate(request: Request) -> tuple[CommandSpec, dict]:
    """Steps 1 to 3 of the engine, without running anything: the spec and the converted parameters."""
    spec = resolve(request.command)
    return spec, check_params(spec, drop_ignored(request.params))


class Engine:
    def __init__(self, config: Config, events: EventSink | None = None, state: ToolState | None = None):
        self.config = config
        self.events = events if events is not None else EventSink()
        self.state = state if state is not None else ToolState()
        # True once the Shutdown path ran: the mode ends.
        self.stopped = False

    def execute(self, request: Request, on_reply: Callable[[Reply], None] | None = None) -> Reply:
        """Run one request and return its reply.

        `on_reply` gets the reply as soon as it is known, so that the mode writes it before the `status` event.
        `KeyboardInterrupt` and `SystemExit` are not caught: they go up to the mode, which runs the Shutdown path.
        """
        started = time.perf_counter()
        before = self.state.snapshot()
        if request.context is not None:
            log.debug("Request %s has a context; it is ignored (D10): %s", request.command, _json(request.context))
        reply = self._finish(request, self._run(request))
        log.info(
            "id=%s command=%s params=%s status=%s code=%s duration_ms=%d",
            request.id,
            request.command,
            _json(drop_ignored(request.params) if isinstance(request.params, dict) else request.params),
            reply.status,
            reply.error["code"] if reply.error else "-",
            round((time.perf_counter() - started) * 1000),
        )
        if on_reply is not None:
            on_reply(reply)
        after = self.state.snapshot()
        if after != before:
            # Rule 3 of the tool contract: a status event comes only on a change (a connect or a disconnect).
            self.events.status(after)
        return reply

    def _run(self, request: Request) -> Reply:
        try:
            spec, params = validate(request)
            ctx = CommandContext(
                state=self.state,
                config=self.config,
                events=RequestEvents(self.events, request.id),
                log=logging.getLogger(f"wptool.commands.{spec.name}"),
                shutdown=self.shutdown,
            )
            self._check_connection(spec, ctx)
            self._check_machine(spec, ctx)
            data = spec.func(ctx, **params)
            _check_data(data)
            return Reply.success(request.id, data)
        except ToolError as e:
            return Reply.failure(request.id, e.code, e.message)
        except Exception as e:
            log.exception("%s failed", request.command)
            return Reply.failure(request.id, FAILED, f"{request.command} failed: {_text(e)}")

    def _finish(self, request: Request, reply: Reply) -> Reply:
        try:
            self.on_finish(request, reply)
        except Exception as e:
            log.exception("%s: the finish of the request failed", request.command)
            if reply.ok:
                return Reply.failure(request.id, FAILED, f"{request.command} failed: {_text(e)}")
        return reply

    # The hooks. They are empty in #407; #408 fills them.

    def _check_connection(self, spec: CommandSpec, ctx: CommandContext) -> None:
        """Check 1: a command of kind MACHINE with `needs_connection` gets 503 without a connection (#408)."""

    def _check_machine(self, spec: CommandSpec, ctx: CommandContext) -> None:
        """Check 2, always last: the checks that ask the machine (#408: the separation check, D11)."""

    def on_finish(self, request: Request, reply: Reply) -> None:
        """After every request, whatever its result (#408: `local_mode()` when it touched the machine, D16)."""

    def on_shutdown(self) -> None:
        """The Shutdown path (#408: gives the machine back and closes the connection)."""

    def shutdown(self) -> None:
        """The Shutdown path: the command Shutdown, the end of a mode, the end of the input, Ctrl+C. Runs once."""
        if self.stopped:
            return
        self.stopped = True
        self.on_shutdown()


def _check_data(data: object) -> None:
    """The data of a reply is a JSON object, so that every mode can write it (strict JSON: no NaN)."""
    if not isinstance(data, dict):
        raise TypeError(f"the command returned {type(data).__name__}, not a dict")
    try:
        json.dumps(data, allow_nan=False)
    except (TypeError, ValueError) as e:
        raise TypeError(f"the data of the reply is not JSON: {e}") from None


def _text(error: Exception) -> str:
    return str(error) or type(error).__name__


def _json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)
