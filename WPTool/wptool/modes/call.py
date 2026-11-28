"""call: runs one command, prints its reply as one JSON line, and ends. For a script in any language.

    wptool call [options] <Command> [key=value ...]

The options come before <Command>; every word after it is the command's. The shell of the system has already split
the words and removed the quotes, so each word is one `key=value` pair, split at its first `=`. A single word that
starts with `{` is the JSON form of the parameters.

#408 adds the machine part: for a machine command, call first connects as Initialize does with the config `machine`
(or --mock), runs the command, and closes the connection, which gives the machine back.
"""

from __future__ import annotations

from typing import BinaryIO

from wptool.config import Config
from wptool.engine import Engine, Request, resolve
from wptool.events import ErrorOutputSink
from wptool.lines import parse_words
from wptool.modes import CTRL_C_TEXT, ProtocolWriter, log, print_error
from wptool.replies import ToolError

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
        resolve(command)
        params = parse_words(words)
    except ToolError as e:
        print_error(e.message)
        return 2
    writer = ProtocolWriter(stdout)
    engine = Engine(config, events=ErrorOutputSink())
    try:
        reply = engine.execute(Request(command=command, params=params), on_reply=writer.write_reply)
        return 0 if reply.ok else 1
    except KeyboardInterrupt:
        log.warning(CTRL_C_TEXT)
        return 130
    finally:
        engine.shutdown()
