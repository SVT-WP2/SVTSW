"""The command line of the tool:

    wptool describe
    wptool shell  [--config FILE] [--mock] [--log-level LEVEL]
    wptool run    FILE [--config FILE] [--mock] [--log-level LEVEL]
    wptool serve  [--config FILE] [--mock] [--log-level LEVEL]
    wptool call   [--config FILE] [--mock] [--log-level LEVEL] <Command> [key=value ...]

Exit codes: 0 a normal end (call: a Success reply); 2 a wrong command line, config or script file; 1 a failed step of
run, an Error reply of call, or any other failure; 130 Ctrl+C while a command runs; 128 plus the signal number after
SIGTERM, SIGHUP or SIGBREAK (#408).
"""

from __future__ import annotations

import argparse
import contextlib
import logging
import sys

from wptool import CONTRACT_VERSION, TOOL_NAME, __version__
from wptool.config import Config, ConfigError, load_config
from wptool.logs import LEVELS, setup_logging, use_utf8
from wptool.modes.call import call
from wptool.modes.describe import write_describe
from wptool.modes.run import run_mode
from wptool.modes.serve import serve
from wptool.modes.shell import run_shell

log = logging.getLogger("wptool")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="wptool",
        description="The WP tool: runs the commands of the wafer prober, one independent request at a time.",
    )
    parser.add_argument("--version", action="version", version=f"{TOOL_NAME} {__version__} (tool contract {CONTRACT_VERSION})")
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--config", metavar="FILE", help="the config file (YAML or JSON): machine and log")
    common.add_argument("--mock", action="store_true", help="the machine is a simulator (#408)")
    common.add_argument(
        "--log-level", metavar="LEVEL", type=str.upper, choices=LEVELS, default="INFO",
        help="the level of the log on the error output (the log file always gets DEBUG); default INFO",
    )
    modes = parser.add_subparsers(dest="mode", required=True, metavar="MODE")
    modes.add_parser("describe", help="print the command list as JSON and end")
    modes.add_parser("shell", parents=[common], help="read a command line, print the reply, repeat")
    run = modes.add_parser("run", parents=[common], help="run the steps of a script file and stop at the first error")
    run.add_argument("file", metavar="FILE", help="the script file (YAML or JSON): a list of steps")
    modes.add_parser("serve", parents=[common], help="the JSON mode: one JSON line in, one JSON line out")
    call_mode = modes.add_parser("call", parents=[common], help="run one command, print its reply as one JSON line, end")
    call_mode.add_argument("command", metavar="Command", help="the command; every word after it is a parameter")
    call_mode.add_argument("words", metavar="key=value", nargs=argparse.REMAINDER, help="the parameters, or one JSON object")
    return parser


def main(argv: list[str] | None = None) -> int:
    use_utf8()
    args = build_parser().parse_args(argv)
    if args.mode == "describe":
        sys.stdout.flush()
        return write_describe(sys.stdout.buffer)
    try:
        config = load_config(args.config, args.mock)
    except ConfigError as e:
        print(e, file=sys.stderr, flush=True)
        return 2
    try:
        logs = setup_logging(args.log_level, config.log)
    except OSError as e:
        print(f"config: log: cannot open {config.log}: {e.strerror or e}", file=sys.stderr, flush=True)
        return 2
    try:
        log.debug("%s %s: mode %s, config %s, mock %s", TOOL_NAME, __version__, args.mode, config.path, config.mock)
        return _run_mode(args, config)
    except KeyboardInterrupt:
        # Ctrl+C outside a command (the modes catch it inside): the modes ran the Shutdown path in their finally.
        return 130
    except Exception:
        log.exception("%s failed", TOOL_NAME)
        return 1
    finally:
        logs.close()


def _run_mode(args: argparse.Namespace, config: Config) -> int:
    if args.mode == "shell":
        return run_shell(config)
    if args.mode == "run":
        return run_mode(args.file, config)
    # serve and call: the real standard output carries only the protocol lines (contract rule 4). Everything else
    # that prints (WPAgent's code prints) goes to the error output while the tool runs.
    sys.stdout.flush()
    protocol = sys.stdout.buffer
    with contextlib.redirect_stdout(sys.stderr):
        if args.mode == "serve":
            return serve(config, sys.stdin.buffer, protocol)
        return call(config, args.command, args.words, protocol)
