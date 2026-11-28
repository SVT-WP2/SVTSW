"""serve: the JSON lines of the tool contract, through `python -m wptool serve` in its own process."""

import io
import json
import os
import queue
import signal
import sys
import time

import pytest

from wptool.engine import Engine
from wptool.modes.serve import parse_request, read_lines, serve

READY = {"event": "ready", "tool": "wp-tool", "version": "0.1.0", "contract": "0.1"}
STATUS = {"event": "status", "data": {"machine": None, "proberConnected": False}}


def start(serve_tool):
    process = serve_tool()
    assert process.read() == READY
    assert process.read() == STATUS
    return process


def test_ready_then_status_then_replies_then_shutdown(serve_tool):
    process = start(serve_tool)
    assert process.request({"id": "1", "command": "ShowStatus"}) == {
        "id": "1",
        "status": "Success",
        "data": {"message": "Tool: wp-tool 0.1.0 | Machine: none, not connected", "machine": None, "proberConnected": False},
    }
    assert process.request({"id": "2", "command": "Shutdown"}) == {"id": "2", "status": "Success", "data": {"message": "Shutting down"}}
    assert process.wait() == 0
    assert process.rest() == []


def test_a_request_without_id_gets_a_reply_without_id(serve_tool):
    process = start(serve_tool)
    assert process.request({"command": "_Echo", "params": {"count": "2"}, "context": {"ignored": True}}) == {
        "status": "Success",
        "data": {"message": "Echo", "params": {"count": 2, "mode": "normal"}},
    }


@pytest.mark.parametrize(
    "line, reason",
    [
        (b"not json\n", "The line is not JSON"),
        (b'{"id": "1", "command": "_Echo", "params": {"count": 1, "count": 2}}\n', "The key 'count' is given twice"),
        (b'{"id": "1", "id": "2", "command": "ShowStatus"}\n', "The key 'id' is given twice"),
        (b'["ShowStatus"]\n', "A request is one JSON object"),
        (b'{"id": "1"}\n', "The request has no command"),
        (b'{"id": 1, "command": "ShowStatus"}\n', "The id of a request must be a text"),
        (b'{"id": "1", "command": "ShowStatus", "params": [1]}\n', "The params of a request must be a JSON object"),
        (b'{"id": "1", "command": "ShowStatus", "context": "x"}\n', "The context of a request must be a JSON object"),
        (b'{"id": "1", "command": "ShowStatus", "user": "someone"}\n', "Unknown field 'user' in the request"),
        (b'{"id": "1", "command": "_Echo", "params": {"number": NaN}}\n', "The line is not JSON"),
        (b'{"id": "1", "command": "\xff"}\n', "The line is not UTF-8"),
    ],
)
def test_a_line_that_cannot_be_read_gets_400_without_id(serve_tool, line, reason):
    process = start(serve_tool)
    process.send(line)
    reply = process.read()
    assert list(reply) == ["status", "error"]
    assert reply["status"] == "Error"
    assert reply["error"]["code"] == 400
    assert reply["error"]["message"].startswith(reason)
    # The tool goes on.
    assert process.request({"id": "2", "command": "ShowStatus"})["id"] == "2"


def test_errors_of_commands_keep_the_id(serve_tool):
    process = start(serve_tool)
    assert process.request({"id": "a", "command": "Nope"}) == {"id": "a", "status": "Error", "error": {"code": 404, "message": "Unknown command: Nope"}}
    assert process.request({"id": "b", "command": "_Fail"})["error"] == {"code": 500, "message": "_Fail failed: failed on purpose"}
    assert process.request({"id": "c", "command": "_Echo", "params": {"x": 1}})["error"]["code"] == 400


def test_print_goes_to_the_error_output(serve_tool):
    process = start(serve_tool)
    assert process.request({"id": "p", "command": "_Print", "params": {"text": "printed ✅"}}) == {"id": "p", "status": "Success", "data": {"message": "Printed"}}
    process.request({"id": "q", "command": "Shutdown"})
    assert process.wait() == 0
    # Every line of the standard output was JSON (read() parsed each), and the text is on the error output.
    assert process.rest() == []
    assert "printed ✅" in process.stderr.decode("utf-8")


def test_progress_lines_carry_the_id_and_come_before_the_reply(serve_tool):
    process = start(serve_tool)
    process.send({"id": "7", "command": "_Progress"})
    assert process.read() == {"id": "7", "event": "progress", "data": {"step": 1, "of": 2}}
    assert process.read() == {"id": "7", "event": "progress", "data": {"step": 2, "of": 2}}
    assert process.read() == {"id": "7", "status": "Success", "data": {"message": "Sent 2 progress events"}}


def test_closing_the_input_ends_with_0_without_a_reply(serve_tool):
    process = start(serve_tool)
    process.request({"id": "1", "command": "ShowStatus"})
    process.close_input()
    assert process.wait() == 0
    assert process.rest() == []


def test_a_last_line_without_its_end_of_line_is_still_a_request(serve_tool):
    process = start(serve_tool)
    process.send(b'{"id": "1", "command": "ShowStatus"}')
    process.close_input()
    assert process.read()["id"] == "1"
    assert process.wait() == 0


def test_every_line_ends_with_newline_and_not_crlf(serve_tool):
    process = serve_tool()
    process.send({"id": "1", "command": "_Progress"})
    process.send(b"not json\n")
    process.send({"id": "2", "command": "_Echo", "params": {"text": "Ωµ✅"}})
    process.send({"id": "3", "command": "Shutdown"})
    assert process.wait() == 0
    lines = process.rest()
    assert len(lines) == 2 + 3 + 1 + 1 + 1
    for raw in lines:
        assert raw.endswith(b"\n") and not raw.endswith(b"\r\n"), raw
        json.loads(raw.decode("utf-8"))
    # UTF-8, not escaped.
    assert "Ωµ✅".encode("utf-8") in lines[-2]


def test_a_request_line_may_end_with_crlf(serve_tool):
    process = start(serve_tool)
    process.send(b'{"id": "1", "command": "ShowStatus"}\r\n')
    assert process.read()["id"] == "1"


def test_a_blank_line_gets_no_reply(serve_tool):
    # A host that pairs the replies by their order must not get a reply that belongs to no request.
    process = start(serve_tool)
    process.send(b"\n")
    process.send(b"   \n")
    process.send(b"\t\r\n")
    assert process.request({"id": "1", "command": "ShowStatus"})["id"] == "1"
    process.send({"id": "2", "command": "Shutdown"})
    assert process.read()["id"] == "2"
    assert process.wait() == 0
    assert process.rest() == []


def test_a_bom_at_the_start_of_the_input_is_dropped(serve_tool):
    process = start(serve_tool)
    process.send(b'\xef\xbb\xbf{"id": "1", "command": "ShowStatus"}\n')
    assert process.read()["id"] == "1"


def test_a_bom_in_pieces():
    lines = queue.Queue()
    chunks = iter([b"\xef", b"\xbb", b'\xbf{"id": "1", "command": "ShowStatus"}\n\xef\xbb\xbf\n', b""])
    read_lines(lambda: next(chunks), lines)
    assert lines.get_nowait() == b'{"id": "1", "command": "ShowStatus"}'
    # Only at the start of the input.
    assert lines.get_nowait() == b"\xef\xbb\xbf"
    assert lines.qsize() == 1  # the end marker


def test_a_command_name_is_taken_as_given(serve_tool):
    process = start(serve_tool)
    assert process.request({"id": "1", "command": " ShowStatus"})["error"] == {"code": 404, "message": "Unknown command:  ShowStatus"}


def test_a_lone_surrogate_does_not_end_serve(serve_tool, log_file):
    # A JSON escape of half a UTF-16 pair: the reply carries it as the same escape, the log file too.
    process = start(serve_tool)
    process.send(b'{"id": "5", "command": "_Echo", "params": {"text": "\\udc80"}}\n')
    raw = process.read_raw()
    assert b'"text": "\\udc80"' in raw
    assert json.loads(raw.decode("utf-8"))["data"]["params"]["text"] == "\udc80"
    assert process.request({"id": "6", "command": "Shutdown"})["id"] == "6"
    assert process.wait() == 0
    stderr = process.stderr.decode("utf-8")
    assert "Logging error" not in stderr
    log = log_file.read_text(encoding="utf-8")
    assert 'id=5 command=_Echo params={"text": "\\udc80"}' in log


@pytest.mark.skipif(sys.platform == "win32", reason="SIGINT cannot be sent to one process on Windows")
def test_ctrl_c_while_serve_waits_for_a_line_ends_with_130(serve_tool):
    process = start(serve_tool)
    time.sleep(1)
    os.kill(process.proc.pid, signal.SIGINT)
    assert process.wait() == 130
    assert process.rest() == []


@pytest.mark.skipif(sys.platform == "win32", reason="SIGINT cannot be sent to one process on Windows")
def test_ctrl_c_while_a_command_runs_ends_with_130(serve_tool):
    process = start(serve_tool)
    process.send({"id": "w", "command": "_Wait", "params": {"seconds": 20}})
    time.sleep(1)
    os.kill(process.proc.pid, signal.SIGINT)
    assert process.wait() == 130
    # No reply: the Shutdown path without a reply.
    assert process.rest() == []


def test_ctrl_c_in_process(config, monkeypatch):
    calls = []
    monkeypatch.setattr(Engine, "on_shutdown", lambda self: calls.append("shutdown"))
    out = io.BytesIO()
    stdin = io.BytesIO(b'{"id": "1", "command": "_Interrupt"}\n{"id": "2", "command": "ShowStatus"}\n')
    assert serve(config, stdin, out) == 130
    assert calls == ["shutdown"]
    assert [json.loads(line)["event"] for line in out.getvalue().splitlines()] == ["ready", "status"]


def test_the_end_of_the_input_in_process(config, monkeypatch):
    calls = []
    monkeypatch.setattr(Engine, "on_shutdown", lambda self: calls.append("shutdown"))
    out = io.BytesIO()
    assert serve(config, io.BytesIO(b'{"id": "1", "command": "ShowStatus"}\n'), out) == 0
    assert calls == ["shutdown"]
    assert len(out.getvalue().splitlines()) == 3


def test_parse_request():
    request, error = parse_request(b'{"id": "1", "command": "_Echo", "params": null, "context": {"a": 1}}')
    assert error is None
    assert (request.id, request.command, request.params, request.context) == ("1", "_Echo", {}, {"a": 1})
