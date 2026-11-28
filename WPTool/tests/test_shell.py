"""shell: a fake input (a list of lines) and a captured output."""

import json

import pytest

from wptool.engine import Engine
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
