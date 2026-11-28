"""call: one command, its reply as one JSON line on the standard output, and the exit code."""

import io
import json

import pytest

from wptool.engine import Engine
from wptool.modes.call import call


def reply_of(result) -> dict:
    """The only line of the standard output."""
    assert result.stdout.endswith(b"\n") and not result.stdout.endswith(b"\r\n"), result.stdout
    lines = result.stdout.decode("utf-8").split("\n")
    assert lines[-1] == "" and len(lines) == 2, f"not one line: {result.stdout!r}"
    return json.loads(lines[0])


def test_show_status(call_tool):
    result = call_tool("ShowStatus")
    assert result.returncode == 0, result.stderr
    assert reply_of(result) == {
        "status": "Success",
        "data": {"message": "Tool: wp-tool 0.1.0 | Machine: none, not connected", "machine": None, "proberConnected": False},
    }


def test_an_error_reply_ends_with_1(call_tool):
    result = call_tool("_Fail")
    assert result.returncode == 1
    assert reply_of(result) == {"status": "Error", "error": {"code": 500, "message": "_Fail failed: failed on purpose"}}


def test_a_parameter_error_is_a_reply(call_tool):
    result = call_tool("_Echo", "count=many")
    assert result.returncode == 1
    assert reply_of(result)["error"] == {"code": 400, "message": "Invalid type for 'count': expected integer"}


@pytest.mark.parametrize(
    "words, text",
    [
        (["Nope"], "Unknown command: Nope"),
        (["MoveChuckAsic", "asicId=1"], "MoveChuckAsic is not in the WP tool yet: use WPAgent (step 2 of the WP tool plan)."),
        (["UserLogIn"], "UserLogIn is not a command of the WP tool: users belong to the agent (phase 2)."),
        (["Initialize"], "call connects and disconnects by itself"),
        (["Initialize", "address=192.0.2.10", "port=35555"], "call connects and disconnects by itself"),
        (["Disconnect"], "call connects and disconnects by itself"),
        (["Shutdown"], "call connects and disconnects by itself"),
        (["_Echo", "count"], "Expected key=value, got 'count'"),
    ],
)
def test_nothing_runs_and_the_exit_code_is_2(call_tool, words, text):
    result = call_tool(*words)
    assert result.returncode == 2
    assert result.stdout == b""
    assert text in result.stderr.decode("utf-8")


def test_one_word_is_one_pair(call_tool):
    # The shell of the system split the words and removed the quotes: 'projectName=ER2 test' is one word.
    result = call_tool("_Echo", "projectName=ER2 test", r"file=C:\My data\x.yaml", "text=a=b", 'name="quoted"')
    assert result.returncode == 0, result.stderr
    assert reply_of(result)["data"]["params"] == {
        "projectName": "ER2 test",
        "file": r"C:\My data\x.yaml",
        "text": "a=b",
        "name": '"quoted"',
        "mode": "normal",
    }


def test_a_single_word_that_starts_with_a_brace_is_the_json_form(call_tool):
    result = call_tool("_Echo", '{"number": 1, "count": 2, "flag": false, "options": {"a": "b"}}')
    assert result.returncode == 0, result.stderr
    assert reply_of(result)["data"]["params"] == {"number": 1.0, "count": 2, "flag": False, "options": {"a": "b"}, "mode": "normal"}


def test_an_option_after_the_command_is_a_parameter(call_tool):
    # --mock after <Command> is a word of the command: a word without =.
    result = call_tool("ShowStatus", "--mock")
    assert result.returncode == 2
    assert "Expected key=value, got '--mock'" in result.stderr.decode("utf-8")
    result = call_tool("_Echo", "--log-level=DEBUG")
    assert result.returncode == 1
    assert reply_of(result)["error"]["message"] == "Unknown parameter '--log-level' for _Echo"
    result = call_tool("_Echo", "text=--config")
    assert reply_of(result)["data"]["params"]["text"] == "--config"


def test_only_the_reply_line_is_on_the_standard_output(call_tool):
    result = call_tool("_Print", "text=printed ✅ by WPAgent's code")
    assert result.returncode == 0, result.stderr
    assert reply_of(result) == {"status": "Success", "data": {"message": "Printed"}}
    # What the command prints goes to the error output, in UTF-8.
    assert "printed ✅ by WPAgent's code" in result.stderr.decode("utf-8")


def test_progress_events_go_to_the_error_output(call_tool):
    result = call_tool("_Progress")
    assert reply_of(result)["data"] == {"message": "Sent 2 progress events"}
    err = result.stderr.decode("utf-8").splitlines()
    assert '{"event": "progress", "data": {"step": 1, "of": 2}}' in err
    assert '{"event": "progress", "data": {"step": 2, "of": 2}}' in err


def test_utf8_in_and_out(call_tool):
    result = call_tool("_Echo", "text=Ωµ✅ é")
    assert reply_of(result)["data"]["params"]["text"] == "Ωµ✅ é"
    assert "Ωµ✅ é".encode("utf-8") in result.stdout


def test_ctrl_c_runs_the_shutdown_path_and_ends_with_130(config, monkeypatch):
    calls = []
    monkeypatch.setattr(Engine, "on_shutdown", lambda self: calls.append("shutdown"))
    out = io.BytesIO()
    assert call(config, "_Interrupt", [], out) == 130
    assert out.getvalue() == b""
    assert calls == ["shutdown"]


def test_the_shutdown_path_runs_after_the_command(config, monkeypatch):
    calls = []
    monkeypatch.setattr(Engine, "on_shutdown", lambda self: calls.append("shutdown"))
    out = io.BytesIO()
    assert call(config, "ShowStatus", [], out) == 0
    assert calls == ["shutdown"]
    assert json.loads(out.getvalue())["status"] == "Success"
