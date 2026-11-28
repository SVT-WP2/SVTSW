"""The signals that end the tool (D16): SIGTERM, and SIGHUP on Linux or SIGBREAK on Windows.

The handler raises `SystemExit(128 + the signal number)` in the main thread, so that the `finally` blocks of the
modes (the Shutdown path: `local_mode()`, then the close of the connection) and `atexit` run, and the tool ends with
that exit code (SIGTERM 143, SIGHUP 129, SIGBREAK 149). A command that the signal cuts off ends there; the machine is
given back after it. A second signal while the tool ends is logged and ignored, so that the close can finish.

On Windows a signal reaches Python only between two steps of Python code in the main thread: a command that waits
for an answer of SENTIO ends first. Ctrl+C is not handled here: it is `KeyboardInterrupt` (the modes, exit code 130).
"""

from __future__ import annotations

import contextlib
import logging
import signal
import threading
from typing import Iterator

log = logging.getLogger("wptool.signals")

NAMES = ("SIGTERM", "SIGHUP", "SIGBREAK")


def signals_to_handle() -> list[signal.Signals]:
    """The signals of this system: SIGTERM everywhere, SIGHUP on Linux, SIGBREAK on Windows."""
    return [getattr(signal, name) for name in NAMES if hasattr(signal, name)]


class _Handler:
    def __init__(self):
        self.ending = False

    def __call__(self, signum: int, frame) -> None:
        name = signal.Signals(signum).name
        if self.ending:
            log.warning("%s again: the tool is already ending", name)
            return
        self.ending = True
        log.warning("%s: the tool gives the machine back and ends (exit code %d)", name, 128 + signum)
        raise SystemExit(128 + signum)


@contextlib.contextmanager
def handle_signals() -> Iterator[None]:
    """Install the handlers while the tool runs (in the main thread only), and put the old ones back after."""
    if threading.current_thread() is not threading.main_thread():
        yield
        return
    handler = _Handler()
    old = {}
    for sig in signals_to_handle():
        try:
            old[sig] = signal.signal(sig, handler)
        except (OSError, ValueError, RuntimeError):
            log.debug("Cannot handle %s here", sig.name)
    try:
        yield
    finally:
        for sig, previous in old.items():
            try:
                signal.signal(sig, previous)
            except (OSError, ValueError, RuntimeError, TypeError):
                pass
