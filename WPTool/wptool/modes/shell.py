"""shell: reads a command line, prints the reply, waits for the next one. For a person at the bench.

The words of the shell itself: `help`, `help <Command>`, `status` (ShowStatus), `exit` and `quit` (Shutdown).
The end of the input (Ctrl+D, or Ctrl+Z then Enter on Windows) and Ctrl+C at the prompt run Shutdown.
Ctrl+C while a command runs: the Shutdown path, and exit code 130 (it stops the tool, not only the command).
No readline (Windows has none): `input()` is enough.
"""

from __future__ import annotations

from typing import Callable

from wptool import TOOL_NAME, __version__
from wptool.config import Config
from wptool.engine import Engine, Request, resolve
from wptool.events import TextSink
from wptool.lines import parse_line
from wptool.modes import CTRL_C_TEXT, log, print_line, reply_lines
from wptool.params import IGNORED_KEYS
from wptool.registry import REGISTRY, CommandSpec, Kind
from wptool.replies import ToolError

PROMPT = "wptool> "
KIND_TITLES = {Kind.OFFLINE: "Commands without the machine", Kind.MACHINE: "Commands of the machine"}


def run_shell(config: Config, read_line: Callable[[str], str] = input, write: Callable[[str], None] = print_line) -> int:
    """Run the shell until exit, quit, Shutdown, the end of the input or Ctrl+C. Returns the exit code.

    `read_line(prompt)` gives one line and raises EOFError at the end of the input; `write(line)` prints one line.
    """
    engine = Engine(config, events=TextSink(write))
    write(f"{TOOL_NAME} {__version__}: type help for the commands, exit to end.")
    try:
        while not engine.stopped:
            try:
                line = read_line(PROMPT)
            except (EOFError, KeyboardInterrupt):
                # The end of the input, or Ctrl+C at the prompt: Shutdown, as exit does.
                write("")
                _execute(engine, Request(command="Shutdown"), write)
                break
            handle_line(engine, line, write)
        return 0
    except KeyboardInterrupt:
        write("")
        log.warning(CTRL_C_TEXT)
        return 130
    finally:
        engine.shutdown()


def handle_line(engine: Engine, line: str, write: Callable[[str], None]) -> None:
    """One line of the shell: a word of the shell, or a command line."""
    text = line.strip()
    if not text:
        return
    words = text.split()
    if words[0] == "help":
        if len(words) == 1:
            for out in help_lines():
                write(out)
        elif len(words) == 2:
            for out in help_command_lines(words[1]):
                write(out)
        else:
            write("ERROR 400: help takes one command name at most")
        return
    if words[0] in ("status", "exit", "quit"):
        if len(words) > 1:
            write(f"ERROR 400: {words[0]} takes no parameters")
            return
        _execute(engine, Request(command="ShowStatus" if words[0] == "status" else "Shutdown"), write)
        return
    try:
        command, params = parse_line(text)
    except ToolError as e:
        write(f"ERROR {e.code}: {e.message}")
        return
    _execute(engine, Request(command=command, params=params), write)


def _execute(engine: Engine, request: Request, write: Callable[[str], None]) -> None:
    def on_reply(reply):
        for out in reply_lines(reply):
            write(out)

    engine.execute(request, on_reply=on_reply)


def help_lines() -> list[str]:
    """The commands, grouped by kind, with their summary; then the words of the shell."""
    lines = []
    for kind, title in KIND_TITLES.items():
        specs = sorted((spec for spec in REGISTRY.values() if spec.kind is kind), key=lambda spec: spec.name)
        lines.append(f"{title}:")
        if not specs:
            lines.append("  (none yet)")
        width = max((len(spec.name) for spec in specs), default=0)
        for spec in specs:
            lines.append(f"  {spec.name.ljust(width)}  {spec.summary}")
    lines.append("Words of the shell: help, help <Command>, status, exit, quit.")
    lines.append("A line: <Command> key=value ... or <Command> {JSON object}. Quote a value with spaces: name=\"a b\".")
    return lines


def help_command_lines(name: str) -> list[str]:
    """One command: summary, kind, level, and the parameters with type and default."""
    try:
        spec = resolve(name)
    except ToolError as e:
        return [f"ERROR {e.code}: {e.message}"]
    lines = [f"{spec.name}: {spec.summary}", f"  kind: {spec.kind.value}, level: {spec.level.value}"]
    flags = _flags(spec)
    if flags:
        lines.append(f"  {flags}")
    if not spec.params:
        lines.append("  parameters: none")
    else:
        lines.append("  parameters:")
        for param_name, param in spec.params.items():
            parts = [param.type, "required" if param.required else "optional"]
            if param.default is not None:
                parts.append(f"default {param.default}")
            if param.choices is not None:
                case = " (any case)" if param.ignore_case else ""
                parts.append("one of " + ", ".join(str(choice) for choice in param.choices) + case)
            if param.minimum is not None:
                parts.append(f"minimum {param.minimum}")
            if param.maximum is not None:
                parts.append(f"maximum {param.maximum}")
            text = f"    {param_name}: {', '.join(parts)}"
            if param.description:
                text += f": {param.description}"
            lines.append(text)
    lines.append(f"  The keys {' and '.join(IGNORED_KEYS)} are accepted and ignored.")
    return lines


def _flags(spec: CommandSpec) -> str:
    flags = []
    if spec.changes_machine:
        flags.append("changes the machine")
    if spec.moves_chuck:
        flags.append("moves the chuck")
    if spec.long:
        flags.append("can take more than 30 s")
    return ", ".join(flags)
