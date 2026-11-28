"""The commands of the frame (#407): ShowStatus and Shutdown."""

from __future__ import annotations

from wptool import TOOL_NAME, __version__
from wptool.facts import read_machine_facts
from wptool.registry import CommandContext, Kind, Level, command
from wptool.state import connection_text


@command(
    name="ShowStatus",
    summary="Show the tool and its connection to the machine",
    kind=Kind.OFFLINE,
    level=Level.USER,
)
def show_status(ctx: CommandContext) -> dict:
    snapshot = ctx.state.snapshot()
    message = f"Tool: {TOOL_NAME} {__version__} | Machine: {connection_text(snapshot)}"
    data = {"message": message, **snapshot}
    machine = ctx.connection.machine
    if machine is not None:
        # Connected: the machine facts, read live (about six queries; a host does not poll ShowStatus). A failed read
        # is not an error of ShowStatus. The engine gives the machine back after it.
        facts = read_machine_facts(machine)
        data["facts"] = facts
        chuck = facts["chuckZPositionState"] or "unknown"
        area = facts["cameraMountPoint"] or "unknown"
        data["message"] = f"{message} | Chuck: {chuck} | Area: {area}"
    return data


@command(
    name="Shutdown",
    summary="Give the machine back, close the connection and end the tool",
    kind=Kind.OFFLINE,
    level=Level.USER,
)
def shutdown(ctx: CommandContext) -> dict:
    # The Shutdown path runs before the reply: the engine's on_shutdown gives the machine back and closes the
    # connection. The mode ends after the reply.
    ctx.shutdown()
    return {"message": "Shutting down"}
