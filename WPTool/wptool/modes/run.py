"""run FILE: runs a script file, a plain list of commands, one request each (D6).

Every step is checked before the first one runs, so that a typo in step 30 does not stop a flow in the middle, at
contact. Then each step runs through the engine as a request of its own. The first step that fails ends the run.
No loops, no conditions, no variables: that is the sequencer of step 2.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

from wptool.config import Config, DataFileError, load_data_file
from wptool.engine import Engine, Request, validate
from wptool.events import EventSink, TextSink
from wptool.lines import parse_line
from wptool.modes import CTRL_C_TEXT, log, print_error, print_line, reply_lines
from wptool.replies import Reply, ToolError, bad_request

STEP_KEYS = ("command", "params")


class ScriptError(Exception):
    """A script file that cannot run: it cannot be read, or a step does not pass the check. Exit code 2."""


def load_steps(path: str | Path) -> list[Request]:
    """The requests of a script file, each checked as the engine checks it (steps 1 to 3). Raises `ScriptError`."""
    try:
        raw = load_data_file(path)
    except DataFileError as e:
        raise ScriptError(f"run: {e}") from None
    if not isinstance(raw, list):
        raise ScriptError(f"run: {path} must be a list of steps")
    requests = []
    for number, step in enumerate(raw, start=1):
        try:
            request = step_request(step)
            validate(request)
        except ToolError as e:
            raise ScriptError(f"run: step {number} ({_show_step(step)}): {e.message}") from None
        requests.append(request)
    return requests


def step_request(step: Any) -> Request:
    """A step is a line (`OpenProject projectName=...`) or a map {command: <name>, params: {...}}."""
    if isinstance(step, str):
        command, params = parse_line(step)
        return Request(command=command, params=params)
    if isinstance(step, dict):
        for key in step:
            if key not in STEP_KEYS:
                raise bad_request(f"Unknown key '{key}' in the step (the keys are command and params)")
        command = step.get("command")
        if not isinstance(command, str) or not command.strip():
            raise bad_request("The step has no command (a text)")
        params = step.get("params")
        if params is None:
            params = {}
        if not isinstance(params, dict):
            raise bad_request("The params of the step must be a map")
        return Request(command=command.strip(), params=params)
    raise bad_request("A step is a command line (a text) or a map with command and params")


def run_file(
    path: str | Path,
    config: Config,
    on_reply: Callable[[int, Request, Reply], None] | None = None,
    *,
    events: EventSink | None = None,
    on_step: Callable[[int, int, Request], None] | None = None,
) -> int:
    """Run the script file `path` and return the exit code.

    0: every step ran, or a step Shutdown ended the run; 1: a step failed (no step after it runs);
    2: the file cannot be read or a step does not pass the check (no step runs); 130: Ctrl+C.
    `on_reply(step_number, request, reply)` gets every reply; `on_step(step_number, total, request)` comes before
    each step runs. The step numbers start at 1.
    """
    try:
        requests = load_steps(path)
    except ScriptError as e:
        print_error(str(e))
        return 2
    engine = Engine(config, events=events)
    total = len(requests)
    try:
        for number, request in enumerate(requests, start=1):
            if on_step is not None:
                on_step(number, total, request)
            reply = engine.execute(request, on_reply=_deliver(on_reply, number, request))
            if not reply.ok:
                log.error("Step %d of %d failed: the run stops", number, total)
                return 1
            if engine.stopped:
                # A step Shutdown ends the run.
                return 0
        return 0
    except KeyboardInterrupt:
        log.warning(CTRL_C_TEXT)
        return 130
    finally:
        engine.shutdown()


def run_mode(path: str | Path, config: Config, write: Callable[[str], None] = print_line) -> int:
    """The mode run: the output of the shell, with one line `[<n>/<total>] <command>` before each step."""

    def on_step(number: int, total: int, request: Request) -> None:
        write(f"[{number}/{total}] {request.command}")

    def on_reply(number: int, request: Request, reply: Reply) -> None:
        for line in reply_lines(reply):
            write(line)

    return run_file(path, config, on_reply, events=TextSink(write), on_step=on_step)


def _deliver(on_reply: Callable[[int, Request, Reply], None] | None, number: int, request: Request) -> Callable[[Reply], None] | None:
    if on_reply is None:
        return None
    return lambda reply: on_reply(number, request, reply)


def _show_step(step: Any) -> str:
    if isinstance(step, str):
        return step.strip()
    return json.dumps(step, ensure_ascii=False, default=str)
