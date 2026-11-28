"""The commands of the frame (#407): ShowStatus and Shutdown."""

from __future__ import annotations

from wptool import TOOL_NAME, __version__
from wptool.registry import CommandContext, Kind, Level, command
from wptool.state import connection_text


@command(
    name="ShowStatus",
    summary="Show the tool and its connection to the machine",
    kind=Kind.OFFLINE,
    level=Level.USER,
)
def show_status(ctx: CommandContext) -> dict:
    # #408 adds the machine facts, read live from the machine when connected.
    snapshot = ctx.state.snapshot()
    message = f"Tool: {TOOL_NAME} {__version__} | Machine: {connection_text(snapshot)}"
    return {"message": message, **snapshot}


@command(
    name="Shutdown",
    summary="Give the machine back, close the connection and end the tool",
    kind=Kind.OFFLINE,
    level=Level.USER,
)
def shutdown(ctx: CommandContext) -> dict:
    # The Shutdown path runs before the reply (the hook on_shutdown; #408 gives the machine back in it).
    # The mode ends after the reply.
    ctx.shutdown()
    return {"message": "Shutting down"}
