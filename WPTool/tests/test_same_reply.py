"""The same requests through call, run and serve give the same replies, without id (D10).

Machine commands are compared in #408 and later only as single requests on a fresh simulator: with --mock every call
starts a new simulator, while serve keeps one for its whole run.
"""

import json

import pytest

from wptool.modes.run import run_file

# A request in its three forms: the typed params (serve, and a step of run as a map), the words of call, and the
# line of a step of run.
CASES = [
    ("ShowStatus", {}, [], "ShowStatus"),
    (
        "_Echo",
        {"text": "a b", "number": 1.5, "count": 3, "flag": True, "options": {"k": [1, 2]}, "orientation": "west", "file": "C:\\data\\flow.yaml"},
        ["text=a b", "number=1.5", "count=3", "flag=true", 'options={"k": [1, 2]}', "orientation=west", "file=C:\\data\\flow.yaml"],
        '_Echo text="a b" number=1.5 count=3 flag=true options=\'{"k": [1, 2]}\' orientation=west file=C:\\data\\flow.yaml',
    ),
    (
        "_Echo",
        {"number": 100, "count": 4.0, "level": 10, "mode": "fast", "user": "someone", "waferAgentName": "machine-1"},
        ["number=100", "count=4.0", "level=10", "mode=fast", "user=someone", "waferAgentName=machine-1"],
        "_Echo number=100 count=4.0 level=10 mode=fast user=someone waferAgentName=machine-1",
    ),
    ("_Echo", {"projectName": "ER2 test", "text": "Ωµ✅"}, ['{"projectName": "ER2 test", "text": "Ωµ✅"}'], '_Echo {"projectName": "ER2 test", "text": "Ωµ✅"}'),
    ("_Progress", {}, [], "_Progress"),
    ("_Print", {"text": "x"}, ["text=x"], "_Print text=x"),
    ("_Fail", {}, [], "_Fail"),
    ("_Fail", {"code": 409}, ["code=409"], "_Fail code=409"),
]

# Not through run: run checks every step first and does not start (exit code 2).
NOT_IN_RUN = [
    ("_Echo", {"number": "far"}, ["number=far"]),
    ("_Echo", {"colour": "red"}, ["colour=red"]),
    ("_Wait", {}, []),
]


def without_id(reply: dict) -> dict:
    return {key: value for key, value in reply.items() if key != "id"}


@pytest.fixture
def serve_replies(serve_tool):
    process = serve_tool()
    process.read()
    process.read()

    def replies(requests):
        out = []
        for number, (command, params) in enumerate(requests):
            process.send({"id": str(number), "command": command, "params": params})
            while "event" in (line := process.read()):
                pass
            assert line["id"] == str(number)
            out.append(without_id(line))
        return out

    return replies


def call_reply(call_tool, command, words):
    result = call_tool(command, *words)
    assert result.returncode in (0, 1), result.stderr
    return json.loads(result.stdout.decode("utf-8"))


def run_replies(tmp_path, config, step):
    path = tmp_path / "step.json"
    path.write_text(json.dumps([step]), encoding="utf-8")
    replies = []
    run_file(path, config, on_reply=lambda number, request, reply: replies.append(reply.to_dict()))
    assert len(replies) == 1
    return replies[0]


def test_call_run_and_serve_give_the_same_replies(tmp_path, config, call_tool, serve_replies):
    served = serve_replies([(command, params) for command, params, _, _ in CASES])
    for (command, params, words, line), from_serve in zip(CASES, served):
        from_call = call_reply(call_tool, command, words)
        from_line = run_replies(tmp_path, config, line)
        from_map = run_replies(tmp_path, config, {"command": command, "params": params})
        assert from_call == from_line == from_map == from_serve, command
    # The cases cover both results.
    assert {reply["status"] for reply in served} == {"Success", "Error"}


def test_call_and_serve_give_the_same_errors(call_tool, serve_replies):
    served = serve_replies([(command, params) for command, params, _ in NOT_IN_RUN])
    for (command, params, words), from_serve in zip(NOT_IN_RUN, served):
        assert from_serve["error"]["code"] == 400
        assert call_reply(call_tool, command, words) == from_serve
