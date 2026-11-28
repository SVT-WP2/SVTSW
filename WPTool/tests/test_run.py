"""run FILE: a plain list of steps, checked before the first one runs, one request each."""

import json

import pytest

from conftest import run_tool

from wptool.engine import Engine
from wptool.modes.run import run_file, run_mode

YAML_STEPS = """\
# Both forms of a step. A line with ": " in it (the JSON form) must be in quotes.
- ShowStatus
- _Echo projectName="ER2 test" count=3
- '_Echo {"number": 2, "flag": true}'
- command: _Echo
  params: {text: hello, user: someone, waferAgentName: machine-1}
- command: ShowStatus
"""

JSON_STEPS = [
    "ShowStatus",
    '_Echo projectName="ER2 test" count=3',
    '_Echo {"number": 2, "flag": true}',
    {"command": "_Echo", "params": {"text": "hello", "user": "someone", "waferAgentName": "machine-1"}},
    {"command": "ShowStatus"},
]


def write(tmp_path, name, content):
    path = tmp_path / name
    path.write_text(content if isinstance(content, str) else json.dumps(content, indent=1), encoding="utf-8")
    return path


def run(path, config):
    replies = []
    code = run_file(path, config, on_reply=lambda number, request, reply: replies.append((number, request, reply)))
    return code, replies


@pytest.mark.parametrize("name, content", [("flow.yaml", YAML_STEPS), ("flow.json", JSON_STEPS)])
def test_both_forms_run_in_order_and_end_with_0(tmp_path, config, name, content):
    code, replies = run(write(tmp_path, name, content), config)
    assert code == 0
    assert [(number, request.command) for number, request, _ in replies] == [
        (1, "ShowStatus"),
        (2, "_Echo"),
        (3, "_Echo"),
        (4, "_Echo"),
        (5, "ShowStatus"),
    ]
    assert all(reply.ok for _, _, reply in replies)
    assert replies[1][2].data["params"] == {"projectName": "ER2 test", "count": 3, "mode": "normal"}
    assert replies[2][2].data["params"] == {"number": 2.0, "flag": True, "mode": "normal"}
    # user and waferAgentName inside params are ignored (D13).
    assert replies[3][2].data["params"] == {"text": "hello", "mode": "normal"}


BAD_LAST_STEPS = [
    ("Nope", "Unknown command: Nope"),
    ("MoveChuckAsic asicId=5", "MoveChuckAsic is not in the WP tool yet"),
    ("UserLogIn user=someone", "UserLogIn is not a command of the WP tool"),
    ("_Echo count=many", "Invalid type for 'count': expected integer"),
    ("_Echo colour=red", "Unknown parameter 'colour' for _Echo"),
    ("_Wait", "Missing required parameter 'seconds' for _Wait"),
    ('_Echo name="a b', "Cannot read the line: No closing quotation"),
    ({"command": "_Echo", "params": {"level": 11}}, "Invalid value for 'level': 11 is above the maximum 10"),
    ({"command": "_Echo", "args": {}}, "Unknown key 'args' in the step"),
    ({"params": {}}, "The step has no command"),
    ({"command": "_Echo", "params": [1]}, "The params of the step must be a map"),
    (5, "A step is a command line (a text) or a map"),
]


@pytest.mark.parametrize("last, reason", BAD_LAST_STEPS)
def test_a_bad_last_step_ends_with_2_and_runs_no_step(tmp_path, config, capsys, last, reason):
    steps = ["_Echo text=first", *["ShowStatus"] * 28, last]
    code, replies = run(write(tmp_path, "flow.json", steps), config)
    assert code == 2
    # The _Echo of the first step recorded nothing: no step ran.
    assert replies == []
    err = capsys.readouterr().err
    assert err.startswith("run: step 30 (")
    assert reason in err


@pytest.mark.parametrize(
    "content, reason",
    [
        ("ShowStatus\n", "must be a list of steps"),
        ("{command: ShowStatus}\n", "must be a list of steps"),
        ("- [unclosed\n", "is not valid YAML"),
        # Without quotes, YAML reads a line with ": " as a map, or cannot read it.
        ("- _Echo text: a\n", "Unknown key '_Echo text' in the step"),
        ('- _Echo {"text": "a"}\n', "is not valid YAML"),
    ],
)
def test_a_bad_file_ends_with_2(tmp_path, config, capsys, content, reason):
    code, replies = run(write(tmp_path, "flow.yaml", content), config)
    assert code == 2
    assert replies == []
    assert reason in capsys.readouterr().err


def test_a_file_that_does_not_exist_ends_with_2(tmp_path, config, capsys):
    code, replies = run(tmp_path / "missing.yaml", config)
    assert code == 2
    assert "run: cannot read" in capsys.readouterr().err


def test_an_empty_list_runs_nothing(tmp_path, config):
    assert run(write(tmp_path, "flow.json", []), config) == (0, [])


def test_a_failing_step_ends_with_1_and_runs_no_step_after_it(tmp_path, config, monkeypatch):
    calls = []
    monkeypatch.setattr(Engine, "on_shutdown", lambda self: calls.append("shutdown"))
    code, replies = run(write(tmp_path, "flow.json", ["_Echo text=1", "_Fail", "_Echo text=3"]), config)
    assert code == 1
    assert [(number, reply.status) for number, _, reply in replies] == [(1, "Success"), (2, "Error")]
    assert replies[1][2].error == {"code": 500, "message": "_Fail failed: failed on purpose"}
    # The Shutdown path ran.
    assert calls == ["shutdown"]


def test_a_step_shutdown_ends_with_0(tmp_path, config):
    code, replies = run(write(tmp_path, "flow.json", ["ShowStatus", "Shutdown", "_Fail"]), config)
    assert code == 0
    assert [request.command for _, request, _ in replies] == ["ShowStatus", "Shutdown"]


def test_after_the_last_step_the_shutdown_path_runs(tmp_path, config, monkeypatch):
    calls = []
    monkeypatch.setattr(Engine, "on_shutdown", lambda self: calls.append("shutdown"))
    assert run(write(tmp_path, "flow.json", ["ShowStatus"]), config)[0] == 0
    assert calls == ["shutdown"]


def test_ctrl_c_ends_with_130(tmp_path, config, monkeypatch):
    calls = []
    monkeypatch.setattr(Engine, "on_shutdown", lambda self: calls.append("shutdown"))
    code, replies = run(write(tmp_path, "flow.json", ["ShowStatus", "_Interrupt", "ShowStatus"]), config)
    assert code == 130
    assert len(replies) == 1
    assert calls == ["shutdown"]


def test_the_output_of_the_mode_run(tmp_path, config):
    out = []
    path = write(tmp_path, "flow.json", ["ShowStatus", "_Progress", "_Fail code=503", "ShowStatus"])
    assert run_mode(path, config, write=out.append) == 1
    assert out == [
        "[1/4] ShowStatus",
        "OK Tool: wp-tool 0.1.0 | Machine: none, not connected",
        "{",
        '  "machine": null,',
        '  "proberConnected": false',
        "}",
        "[2/4] _Progress",
        'progress: {"step": 1, "of": 2}',
        'progress: {"step": 2, "of": 2}',
        "OK Sent 2 progress events",
        "[3/4] _Fail",
        "ERROR 503: Refused on purpose with 503",
    ]


def test_run_through_the_command_line(tmp_path, config_file):
    path = write(tmp_path, "flow.yaml", "- ShowStatus\n- _Print text=Ωµ✅\n")
    result = run_tool(["run", str(path), "--config", str(config_file)], cwd=tmp_path)
    assert result.returncode == 0, result.stderr
    out = result.stdout.decode("utf-8").splitlines()
    assert out[0] == "[1/2] ShowStatus"
    assert "[2/2] _Print" in out
    # UTF-8 on the standard output, also on a Windows pipe.
    assert "Ωµ✅" in out
    assert out[-1] == "OK Printed"


def test_a_bad_file_through_the_command_line_ends_with_2(tmp_path, config_file):
    result = run_tool(["run", str(tmp_path / "missing.yaml"), "--config", str(config_file)], cwd=tmp_path)
    assert result.returncode == 2
    assert b"run: cannot read" in result.stderr
    assert result.stdout == b""
