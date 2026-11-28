"""The signals end the tool and give the machine back (D16): SIGTERM, SIGHUP on Linux, SIGBREAK on Windows.

On Windows SIGTERM cannot be sent to a process (os.kill ends it at once); CTRL_BREAK_EVENT, sent to a tool started
in a new process group, is the signal SIGBREAK.
"""

import signal
import subprocess
import sys
import time

import pytest
from conftest import calls_by_request

from wptool.signals import _Handler, handle_signals, signals_to_handle

WINDOWS = sys.platform == "win32"


def start(serve_tool):
    flags = subprocess.CREATE_NEW_PROCESS_GROUP if WINDOWS else 0
    process = serve_tool("--mock", creationflags=flags)
    assert process.read()["event"] == "ready"
    process.read()
    assert process.request({"id": "1", "command": "Initialize"})["status"] == "Success"
    process.read()  # status
    return process


def send(process, sig):
    if WINDOWS:
        process.proc.send_signal(signal.CTRL_BREAK_EVENT)
    else:
        process.proc.send_signal(sig)


def the_end_gave_the_machine_back(log_file):
    requests = calls_by_request(log_file)
    assert requests[-1] == ("<end>", ["local_mode()", "disconnect()"]), requests
    assert "Connection to mock:0 closed" in log_file.read_text(encoding="utf-8")


SIGNALS = [("SIGBREAK", 149)] if WINDOWS else [("SIGTERM", 143), ("SIGHUP", 129)]


@pytest.mark.parametrize("name, code", SIGNALS)
def test_a_signal_closes_the_connection_and_ends_the_tool(serve_tool, log_file, name, code):
    process = start(serve_tool)
    send(process, getattr(signal, name, None))
    assert process.wait() == code
    # No reply and no event after the signal.
    assert process.rest() == []
    the_end_gave_the_machine_back(log_file)
    assert f"{name}: the tool gives the machine back and ends (exit code {code})" in process.stderr.decode("utf-8", "replace")


@pytest.mark.skipif(WINDOWS, reason="on Windows a signal waits until the command ends (it reaches Python between two steps)")
def test_a_signal_cuts_off_a_command_and_the_machine_is_given_back_after_it(serve_tool, log_file):
    process = start(serve_tool)
    process.send({"id": "2", "command": "_Wait", "params": {"seconds": 30}})
    time.sleep(0.5)
    started = time.monotonic()
    process.proc.send_signal(signal.SIGTERM)
    assert process.wait() == 143
    assert time.monotonic() - started < 10
    assert process.rest() == []
    the_end_gave_the_machine_back(log_file)


@pytest.mark.skipif(not WINDOWS, reason="Windows only")
def test_on_windows_the_signal_ends_the_tool_after_the_command(serve_tool, log_file):
    process = start(serve_tool)
    process.send({"id": "2", "command": "_Wait", "params": {"seconds": 1}})
    time.sleep(0.3)
    send(process, None)
    assert process.wait() == 149
    the_end_gave_the_machine_back(log_file)


def test_the_signals_of_this_system():
    names = {sig.name for sig in signals_to_handle()}
    assert names == ({"SIGTERM", "SIGBREAK"} if WINDOWS else {"SIGTERM", "SIGHUP"})


def test_the_handler_raises_system_exit_once():
    handler = _Handler()
    with pytest.raises(SystemExit) as e:
        handler(signal.SIGTERM, None)
    assert e.value.code == 128 + signal.SIGTERM
    # A second signal while the tool ends is ignored, so that the close can finish.
    assert handler(signal.SIGTERM, None) is None


def test_handle_signals_installs_and_restores():
    before = {sig: signal.getsignal(sig) for sig in signals_to_handle()}
    with handle_signals():
        for sig in signals_to_handle():
            assert isinstance(signal.getsignal(sig), _Handler)
    assert {sig: signal.getsignal(sig) for sig in signals_to_handle()} == before
