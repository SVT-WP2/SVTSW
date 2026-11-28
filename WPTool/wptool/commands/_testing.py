"""Test-only commands, to test the engine, the events and the modes, also from a separate process.

Registered only when the environment variable WPTOOL_TESTING is 1 (`wptool.commands`), so they never appear in
describe otherwise. Their names start with `_`.
"""

from __future__ import annotations

import os
import time

from wptool.facts import finish
from wptool.registry import CommandContext, Kind, Level, Param, command
from wptool.replies import ToolError


@command(
    name="_Echo",
    summary="Test: return the parameters that were given, converted",
    kind=Kind.OFFLINE,
    level=Level.DEVELOPER,
    params={
        "text": Param("string"),
        "name": Param("string"),
        "projectName": Param("string"),
        "file": Param("string"),
        "number": Param("number", description="any number"),
        "count": Param("integer"),
        "flag": Param("boolean"),
        "options": Param("object"),
        "orientation": Param("string", choices=["West", "East", "North", "South"], ignore_case=True),
        "level": Param("integer", minimum=0, maximum=10),
        "mode": Param("string", default="normal", choices=["normal", "fast"]),
    },
)
def echo(ctx: CommandContext, **params) -> dict:
    given = {key: value for key, value in params.items() if value is not None}
    return {"message": "Echo", "params": given}


@command(
    name="_Fail",
    summary="Test: raise an exception, or a ToolError with the given code",
    kind=Kind.OFFLINE,
    level=Level.DEVELOPER,
    params={"code": Param("integer", choices=[400, 404, 409, 500, 503])},
)
def fail(ctx: CommandContext, code: int | None) -> dict:
    if code is not None:
        raise ToolError(code, f"Refused on purpose with {code}")
    raise RuntimeError("failed on purpose")


@command(
    name="_Print",
    summary="Test: print a text to the standard output, as WPAgent's code does",
    kind=Kind.OFFLINE,
    level=Level.DEVELOPER,
    params={"text": Param("string", default="printed by _Print ✅")},
)
def print_text(ctx: CommandContext, text: str) -> dict:
    print(text)
    return {"message": "Printed"}


@command(
    name="_Progress",
    summary="Test: send two progress events, then reply",
    kind=Kind.OFFLINE,
    level=Level.DEVELOPER,
)
def progress(ctx: CommandContext) -> dict:
    ctx.events.progress({"step": 1, "of": 2})
    ctx.events.progress({"step": 2, "of": 2})
    return {"message": "Sent 2 progress events"}


@command(
    name="_Wait",
    summary="Test: wait a number of seconds",
    kind=Kind.OFFLINE,
    level=Level.DEVELOPER,
    long=True,
    params={"seconds": Param("number", required=True, minimum=0, maximum=3600)},
)
def wait(ctx: CommandContext, seconds: float) -> dict:
    time.sleep(seconds)
    return {"message": f"Waited {seconds} s"}


@command(
    name="_Interrupt",
    summary="Test: raise KeyboardInterrupt, as Ctrl+C while a command runs",
    kind=Kind.OFFLINE,
    level=Level.DEVELOPER,
)
def interrupt(ctx: CommandContext) -> dict:
    raise KeyboardInterrupt


@command(
    name="_Move",
    summary="Test: a chuck move through the driver layer (moves_chuck: the separation check runs first)",
    kind=Kind.MACHINE,
    level=Level.DEVELOPER,
    moves_chuck=True,
    params={
        "x": Param("number", default=0),
        "y": Param("number", default=0),
        "position": Param("string", default="Relative", choices=["Zero", "Relative", "Center"]),
    },
)
def move(ctx: CommandContext, x: float, y: float, position: str) -> dict:
    ctx.machine.move_chuck_xy(x, y, position)
    return finish(ctx, {"message": f"Moved the chuck: x={x}, y={y}, {position}"})


@command(
    name="_Pid",
    summary="Test: the process id of the tool (on Windows the process of a venv's python.exe is a launcher)",
    kind=Kind.OFFLINE,
    level=Level.DEVELOPER,
)
def pid(ctx: CommandContext) -> dict:
    return {"message": "Process id", "pid": os.getpid()}


@command(
    name="_Query",
    summary="Test: a machine command that only reads the machine facts (no separation check)",
    kind=Kind.MACHINE,
    level=Level.DEVELOPER,
    changes_machine=False,
)
def query(ctx: CommandContext) -> dict:
    return finish(ctx, {"message": "Read the machine facts"})
