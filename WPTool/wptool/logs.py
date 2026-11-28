"""Logging to the error output and to a file, and UTF-8 on the standard streams.

On Windows, output to a pipe uses the code page, and WPAgent's code prints emoji, which then raise
`UnicodeEncodeError` (inventory part B3, section E.7; behaviour change 8). The shared SENTIO driver is WPAgent's code
and prints. So `main()` sets UTF-8 on the standard input, output and error output first.
"""

from __future__ import annotations

import logging
import sys
from dataclasses import dataclass, field

LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")
FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"


def use_utf8() -> None:
    """UTF-8 on stdin, stdout and stderr. A byte that is not UTF-8 is replaced, it never ends the tool."""
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is None:
            continue
        try:
            reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):
            # A stream that was already read from cannot change its encoding (for example under a test runner).
            pass


@dataclass
class LogSetup:
    """The handlers that `setup_logging` added to the root logger; `close()` removes them and closes the file."""

    handlers: list[logging.Handler] = field(default_factory=list)
    level: int = logging.NOTSET

    def close(self) -> None:
        root = logging.getLogger()
        for handler in self.handlers:
            root.removeHandler(handler)
            handler.close()
        self.handlers.clear()
        root.setLevel(self.level)


def setup_logging(level: str, log_file: str) -> LogSetup:
    """A handler on the error output at `level`, and one on `log_file` at DEBUG, on the root logger.

    The root logger, so that the logs of the libraries (the SENTIO library, #408) reach the file too.
    Raises `OSError` when the file cannot be opened.
    """
    root = logging.getLogger()
    setup = LogSetup(level=root.level)
    formatter = logging.Formatter(FORMAT)
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    # sys.stderr as it is now; serve and call point sys.stdout to it later.
    error_handler = logging.StreamHandler(sys.stderr)
    error_handler.setLevel(level)
    error_handler.setFormatter(formatter)
    for handler in (file_handler, error_handler):
        root.addHandler(handler)
        setup.handlers.append(handler)
    root.setLevel(logging.DEBUG)
    return setup
