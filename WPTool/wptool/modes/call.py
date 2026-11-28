"""call: runs one command, prints its reply as one JSON line, and ends. For a script in any language.

    wptool call [options] <Command> [key=value ...]

The options come before <Command>; every word after it is the command's. The shell of the system has already split
the words and removed the quotes, so each word is one `key=value` pair, split at its first `=`. A single word that
starts with `{` is the JSON form of the parameters.

The machine part: for a command of kind MACHINE, call first connects as Initialize does, with the config `machine`
(or --mock), without a reply of its own; then the command; then `connection.close()`, which gives the machine back.
A failed connect (400 without a machine, 409 locked, 503 not reachable, 500) is the reply of the call, and the
command does not run. A request that does not pass the parameter check does not connect. ShowStatus and the other
offline commands get no connection. With --mock, every call starts a new simulator, in its start state.
"""

from __future__ import annotations

from typing import BinaryIO

from wptool.config import Config
from wptool.connection import MOCK_MACHINE
from wptool.engine import Engine, Request, resolve, validate
from wptool.events import ErrorOutputSink
from wptool.lines import parse_words
from wptool.modes import CTRL_C_TEXT, ProtocolWriter, log, print_error
from wptool.registry import Kind
from wptool.replies import Reply, ToolError, bad_request

NO_MACHINE = "No machine to connect to: give machine.address and machine.port in the config, or start the tool with --mock"

# They make no sense alone: call connects and disconnects by itself.
CONNECTION_COMMANDS = ("Initialize", "Disconnect", "Shutdown")


def call(config: Config, command: str, words: list[str], stdout: BinaryIO) -> int:
    """Run one command. 0: a Success reply; 1: an Error reply; 2: not a command of the tool, or bad words; 130: Ctrl+C.

    Nothing runs for exit code 2: the reason goes to the error output, and there is no reply line.
    """
    if command in CONNECTION_COMMANDS:
        print_error(f"{command}: call connects and disconnects by itself")
        return 2
    try:
        spec = resolve(command)
        params = parse_words(words)
    except ToolError as e:
        print_error(e.message)
        return 2
    writer = ProtocolWriter(stdout)
    engine = Engine(config, events=ErrorOutputSink())
    request = Request(command=command, params=params)
    try:
        if spec.kind is Kind.MACHINE and _valid(request):
            try:
                _connect(engine, config)
            except ToolError as e:
                log.warning("call %s: the connect failed: %s", command, e.message)
                writer.write_reply(Reply.failure(None, e.code, e.message))
                return 1
        reply = engine.execute(request, on_reply=writer.write_reply)
        return 0 if reply.ok else 1
    except KeyboardInterrupt:
        log.warning(CTRL_C_TEXT)
        return 130
    finally:
        engine.shutdown()


def _valid(request: Request) -> bool:
    """The engine's checks without the machine: a request that fails them gets its 400 without a connect."""
    try:
        validate(request)
        return True
    except ToolError:
        return False


def _connect(engine: Engine, config: Config) -> None:
    """Connect as Initialize does: the config machine, or the simulator with --mock. Raises `ToolError`."""
    if config.mock:
        engine.connection.open(MOCK_MACHINE)
    elif config.machine is None:
        raise bad_request(NO_MACHINE)
    else:
        engine.connection.open(config.machine)
