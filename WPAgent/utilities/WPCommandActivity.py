"""
WPCommandActivity - the commands that run right now.

The Kafka listener counts every request while it runs (WPKafkaClient._handle_message).
Two things depend on the count:

- The connection watch stays quiet while a command runs: the command uses the
  connection to the WP machine (services/WPProberConnectionWatch.py).
- The commands that replace the connection (Initialize with force, ReconnectProber)
  refuse to run next to another command: closing the old connection would cut that
  command in the middle of its work on the machine.

A sequence (RunSequencer) is one command: its steps run in the same thread.
"""

import threading
from contextlib import contextmanager

_lock = threading.Lock()
_running = 0
# How many commands the current thread has counted (a sequence step runs inside its sequence)
_thread = threading.local()


@contextmanager
def command_running():
    """Count the command of the current thread while the `with` block runs."""
    global _running
    with _lock:
        _running += 1
    _thread.depth = getattr(_thread, "depth", 0) + 1
    try:
        yield
    finally:
        _thread.depth -= 1
        with _lock:
            _running -= 1


def running_commands() -> int:
    """The number of commands that run right now."""
    with _lock:
        return _running


def other_running_commands() -> int:
    """The number of commands that run right now in other threads than the current one."""
    own = 1 if getattr(_thread, "depth", 0) > 0 else 0
    with _lock:
        return _running - own
