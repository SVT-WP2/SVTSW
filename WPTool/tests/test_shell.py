"""shell: a fake input (a list of lines) and a captured output."""

import json
import os
import select
import signal
import subprocess
import sys
import time

import pytest

from conftest import TIMEOUT_S, run_tool, tool_env

from wptool.engine import Engine
from wptool.events import TextSink
from wptool.modes.shell import PROMPT, run_shell


class FakeInput:
    """input(prompt) from a list of lines; then EOFError, or the exception given as a line."""

    def __init__(self, lines):
        self.lines = list(lines)
        self.prompts = []

    def __call__(self, prompt):
        self.prompts.append(prompt)
        if not self.lines:
            raise EOFError
        line = self.lines.pop(0)
        if isinstance(line, BaseException) or (isinstance(line, type) and issubclass(line, BaseException)):
            raise line
        return line


def shell(config, lines):
    out = []
    reader = FakeInput(lines)
    code = run_shell(config, read_line=reader, write=out.append)
    return code, out, reader


def echoed(out):
    """The params of the first _Echo reply: `OK Echo`, then the other fields of data as indented JSON."""
    start = out.index("OK Echo") + 1
    end = out.index("}", start) + 1
    return json.loads("\n".join(out[start:end]))["params"]


def test_key_value_with_quotes(config):
    code, out, _ = shell(config, ['_Echo projectName="ER2 test" name=\'a b\' count=3', "exit"])
    assert code == 0
    assert echoed(out) == {"projectName": "ER2 test", "name": "a b", "count": 3, "mode": "normal"}


def test_the_json_form(config):
    code, out, _ = shell(config, ['_Echo {"number": 5, "flag": "no", "options": {"a": [1]}}', "exit"])
    assert echoed(out) == {"number": 5.0, "flag": False, "options": {"a": [1]}, "mode": "normal"}


@pytest.mark.parametrize(
    "line, path",
    [
        (r"_Echo file=C:\data\flow.yaml", r"C:\data\flow.yaml"),
        (r'_Echo file="C:\My data\flow.yaml"', r"C:\My data\flow.yaml"),
        (r"_Echo file=\\server\share\flow.yaml", r"\\server\share\flow.yaml"),
    ],
)
def test_windows_paths_reach_the_command_unchanged(config, line, path):
    code, out, _ = shell(config, [line, "exit"])
    assert echoed(out)["file"] == path


def test_ok_with_the_other_fields_of_data(config):
    code, out, _ = shell(config, ["status"])
    assert out[1] == "OK Tool: wp-tool 0.1.0 | Machine: none, not connected"
    assert json.loads("\n".join(out[2:6])) == {"machine": None, "proberConnected": False}
    assert out[2:6] == ["{", '  "machine": null,', '  "proberConnected": false', "}"]


def test_ok_without_other_fields_is_one_line(config):
    code, out, _ = shell(config, ["_Print text=x", "exit"])
    # No JSON after the OK line: the next line is the reply of exit.
    assert out[out.index("OK Printed") + 1] == "OK Shutting down"


def test_error_lines(config):
    code, out, _ = shell(config, ["_Fail", "_Fail code=409", "UserLogIn", "Sleep seconds=1", "_Echo count=x", "_Echo name=\"a", "nope=1", "exit"])
    assert code == 0
    assert out[1:8] == [
        "ERROR 500: _Fail failed: failed on purpose",
        "ERROR 409: Refused on purpose with 409",
        "ERROR 404: UserLogIn is not a command of the WP tool: users belong to the agent (phase 2).",
        "ERROR 404: Sleep is not in the WP tool yet: use WPAgent (step 2 of the WP tool plan).",
        "ERROR 400: Invalid type for 'count': expected integer",
        "ERROR 400: Cannot read the line: No closing quotation",
        "ERROR 404: Unknown command: nope=1",
    ]
    # A failed command does not end the shell.
    assert out[-1] == "OK Shutting down"


def test_help(config):
    code, out, _ = shell(config, ["help", "exit"])
    text = "\n".join(out)
    assert "Commands without the machine:" in text
    assert "Commands of the machine:" in text
    assert "  ShowStatus  Show the tool and its connection to the machine" in out
    assert any(line.startswith("  Shutdown ") for line in out)
    assert "Words of the shell: help, help <Command>, status, exit, quit." in out
    # Grouped by kind: the offline commands come before the title of the machine commands.
    assert out.index("Commands without the machine:") < out.index("  ShowStatus  Show the tool and its connection to the machine") < out.index("Commands of the machine:")


def test_help_of_a_command(config):
    code, out, _ = shell(config, ["help ShowStatus", "help _Echo", "help MoveChuckAsic", "help a b", "exit"])
    assert out[1:4] == ["ShowStatus: Show the tool and its connection to the machine", "  kind: OFFLINE, level: User", "  parameters: none"]
    assert "    mode: string, optional, default normal, one of normal, fast" in out
    assert "    orientation: string, optional, one of West, East, North, South (any case)" in out
    assert "    number: number, optional: any number" in out
    assert "ERROR 404: MoveChuckAsic is not in the WP tool yet: use WPAgent (step 2 of the WP tool plan)." in out
    assert "ERROR 400: help takes one command name at most" in out


def test_status_runs_show_status(config):
    code, out, _ = shell(config, ["status", "exit"])
    assert out[1] == "OK Tool: wp-tool 0.1.0 | Machine: none, not connected"


@pytest.mark.parametrize("word", ["exit", "quit", "Shutdown"])
def test_exit_quit_and_shutdown_end_the_shell(config, word):
    code, out, reader = shell(config, [word, "ShowStatus"])
    assert code == 0
    assert out[-1] == "OK Shutting down"
    # The line after it is never read.
    assert reader.lines == ["ShowStatus"]


def test_exit_with_a_parameter_is_an_error(config):
    code, out, _ = shell(config, ["exit now", "exit"])
    assert out[1] == "ERROR 400: exit takes no parameters"


def test_an_empty_line_does_nothing(config):
    code, out, reader = shell(config, ["", "   ", "exit"])
    assert out[1:] == ["OK Shutting down"]
    assert reader.prompts == [PROMPT] * 3


@pytest.mark.parametrize("end", [EOFError, KeyboardInterrupt])
def test_the_end_of_the_input_and_ctrl_c_at_the_prompt_run_shutdown(config, monkeypatch, end):
    calls = []
    monkeypatch.setattr(Engine, "on_shutdown", lambda self: calls.append("shutdown"))
    code, out, _ = shell(config, ["status", end])
    assert code == 0
    assert out[-2:] == ["", "OK Shutting down"]
    assert calls == ["shutdown"]


def test_ctrl_c_while_a_command_runs_ends_with_130(config, monkeypatch):
    calls = []
    monkeypatch.setattr(Engine, "on_shutdown", lambda self: calls.append("shutdown"))
    code, out, reader = shell(config, ["_Interrupt", "status"])
    assert code == 130
    assert calls == ["shutdown"]
    # It stops the tool, not only the command.
    assert reader.lines == ["status"]


def test_progress_events_are_one_line_each(config):
    code, out, _ = shell(config, ["_Progress", "exit"])
    assert out[1:4] == ['progress: {"step": 1, "of": 2}', 'progress: {"step": 2, "of": 2}', "OK Sent 2 progress events"]


def test_the_banner(config):
    code, out, _ = shell(config, [])
    assert out[0] == "wp-tool 0.1.0: type help for the commands, exit to end."


def test_status_lines_after_a_connect_and_a_disconnect(config, connect_commands):
    code, out, _ = shell(config, ["_Connect", "ShowStatus", "_Disconnect", "exit"])
    # One line for people, after the reply, only when the connection changed.
    assert out[1:3] == ["OK Connected", "status: connected to 192.0.2.10:35555"]
    assert out[3] == "OK Tool: wp-tool 0.1.0 | Machine: 192.0.2.10:35555, connected"
    assert out.count("status: connected to 192.0.2.10:35555") == 1
    assert out[out.index("OK Disconnected") + 1] == "status: not connected"


def test_the_shell_in_its_own_process_with_streams_that_are_not_utf8(tmp_path, config_file):
    # tool_env gives the process ASCII streams: the tool sets UTF-8 on stdin, stdout and stderr itself, and a lone
    # surrogate or a byte that is not UTF-8 is replaced, it never ends the shell.
    stdin = "_Echo text=Ω✅\n".encode("utf-8") + b'_Echo {"text": "\\udc80"}\n' + b"_Echo text=a\xffb\n" + b"exit\n"
    result = run_tool(["shell", "--config", str(config_file)], cwd=tmp_path, stdin=stdin)
    assert result.returncode == 0, result.stderr
    out = result.stdout.decode("utf-8")
    assert '"text": "Ω✅"' in out
    assert '"text": "?"' in out
    assert '"text": "a\ufffdb"' in out
    assert out.rstrip().endswith("OK Shutting down")
    assert b"Logging error" not in result.stderr
    assert b"Traceback" not in result.stderr


@pytest.mark.skipif(sys.platform == "win32", reason="SIGINT cannot be sent to one process on Windows")
def test_ctrl_c_at_the_prompt_in_its_own_process_runs_shutdown(tmp_path, config_file):
    proc = subprocess.Popen(
        [sys.executable, "-m", "wptool", "shell", "--config", str(config_file)],
        cwd=tmp_path, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=tool_env(),
    )
    try:
        out = b""
        deadline = time.monotonic() + TIMEOUT_S
        while not out.endswith(PROMPT.encode()) and time.monotonic() < deadline:
            # Wait for the prompt without blocking for ever (this test runs on Linux only).
            ready, _, _ = select.select([proc.stdout], [], [], max(0.0, deadline - time.monotonic()))
            if ready:
                out += proc.stdout.read1(4096)
        assert out.endswith(PROMPT.encode()), out
        os.kill(proc.pid, signal.SIGINT)
        rest, _ = proc.communicate(timeout=TIMEOUT_S)
        assert proc.returncode == 0
        assert rest.decode("utf-8").strip().endswith("OK Shutting down")
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait(timeout=TIMEOUT_S)


def test_the_status_line_for_people():
    out = []
    sink = TextSink(out.append)
    sink.status({"machine": None, "proberConnected": False})
    sink.status({"machine": {"address": "192.0.2.10", "port": 35555}, "proberConnected": True})
    sink.status({"machine": {"address": "192.0.2.10", "port": 35555}, "proberConnected": False})
    assert out == ["status: not connected", "status: connected to 192.0.2.10:35555", "status: not connected"]
