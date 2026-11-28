"""The commands of the connection (#408): Initialize, Disconnect, LocalMode.

None of them calls `local_mode()` itself: the engine gives the machine back after every request that touched it
(D16), and `Connection.close()` gives it back before it closes.
"""

from __future__ import annotations

from wptool.connection import resolve_machine, where
from wptool.facts import finish
from wptool.registry import CommandContext, Kind, Level, Param, command


@command(
    name="Initialize",
    summary="Connect to the machine: the parameters, else the config machine (with --mock: the simulator)",
    kind=Kind.MACHINE,
    level=Level.USER,
    needs_connection=False,
    params={
        "address": Param("string", description="where SENTIO listens; default: machine.address of the config"),
        "port": Param("integer", minimum=1, maximum=65535, description="default: machine.port of the config"),
        "force": Param("boolean", default=False, description="connect again also when connected (a restarted machine)"),
    },
)
def initialize(ctx: CommandContext, address: str | None, port: int | None, force: bool) -> dict:
    target = resolve_machine(ctx.config, address, port)
    connection = ctx.connection
    machine_data = {"address": target.address, "port": target.port}
    if not force and connection.target == target and ctx.machine.is_alive():
        # As WPAgent (WPProjectActions.py lines 303-307): nothing changes.
        message = f"Already connected to {where(target)}. Use force=true to connect again."
        return finish(ctx, {"message": message, "machine": machine_data})
    # Not connected, another machine, a connection that is no longer alive, or force: the new connection is opened
    # first, the old one closed after it.
    connection.open(target)
    return finish(ctx, {"message": f"Initialized {where(target)}", "machine": machine_data})


@command(
    name="Disconnect",
    summary="Give the machine back and close the connection (the tool keeps running)",
    kind=Kind.MACHINE,
    level=Level.USER,
    needs_connection=False,
)
def disconnect(ctx: CommandContext) -> dict:
    connection = ctx.connection
    if not connection.is_open:
        return {"message": "Not connected"}
    text = connection.where
    # local_mode(), then the close; the machine stays known in the state, proberConnected becomes false.
    connection.close()
    return {"message": f"Disconnected from {text}"}


@command(
    name="LocalMode",
    summary="Give the machine back to SENTIO's own screen (local mode), and read the machine facts",
    kind=Kind.MACHINE,
    level=Level.DEVELOPER,
)
def local_mode(ctx: CommandContext) -> dict:
    # WPTestingActions.py lines 1493-1516: the facts, then local_mode(). Here the engine's local_mode() after the
    # request is the one call, so the machine gets it once.
    return finish(ctx, {"message": "Local mode"})
