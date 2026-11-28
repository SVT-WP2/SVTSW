"""serve: the JSON mode of the tool contract. One JSON line in, one JSON line out.

1. At start: the `ready` event, then a `status` event.
2. A reader thread puts each line of the standard input on a queue; the main thread waits on the queue with a
   timeout of 0.5 s. On Windows a signal or Ctrl+C reaches Python only while the main thread runs Python code, not
   while it blocks on a pipe (#408 installs the signal handlers).
3. Each line is one request: run through the engine, the reply line, then the `status` event if the state changed.
   A blank line is skipped without a reply; a UTF-8 BOM at the start of the input is dropped.
4. Shutdown: its reply, then exit code 0. The end of the input: the Shutdown path without a reply, exit code 0.
   Ctrl+C: the Shutdown path without a reply, exit code 130.

The standard output carries only these lines (contract rule 4): the caller points `sys.stdout` to the error output.
"""

from __future__ import annotations

import queue
import threading
from typing import BinaryIO, Callable

from wptool.config import Config
from wptool.data import DuplicateKeyError, loads_json
from wptool.engine import Engine, Request
from wptool.events import JsonLineSink
from wptool.modes import CTRL_C_TEXT, ProtocolWriter, log
from wptool.replies import BAD_REQUEST, Reply

REQUEST_FIELDS = ("id", "command", "params", "context")
WAIT_S = 0.5
BOM = b"\xef\xbb\xbf"
_EOF = object()


def serve(config: Config, stdin: BinaryIO, stdout: BinaryIO) -> int:
    """Serve requests from the binary stream `stdin`, write the protocol lines on `stdout`. Returns the exit code."""
    writer = ProtocolWriter(stdout)
    engine = Engine(config, events=JsonLineSink(writer.write))
    lines: queue.Queue = queue.Queue()
    reader = threading.Thread(target=read_lines, args=(chunk_reader(stdin), lines), name="wptool-stdin", daemon=True)
    try:
        engine.events.ready()
        engine.events.status(engine.state.snapshot())
        reader.start()
        while True:
            try:
                raw = lines.get(timeout=WAIT_S)
            except queue.Empty:
                continue
            if raw is _EOF:
                log.info("The end of the input: the tool ends")
                return 0
            if not raw.strip():
                # A blank line is not a request, and gets no reply: a host that pairs the replies by their order
                # would take a reply to it for the reply of its next request.
                continue
            request, error = parse_request(raw)
            if request is None:
                # Contract rule 5: a line that the tool cannot read gets an Error 400 reply without an id.
                writer.write_reply(Reply.failure(None, BAD_REQUEST, error))
                continue
            engine.execute(request, on_reply=writer.write_reply)
            if engine.stopped:
                return 0
    except KeyboardInterrupt:
        log.warning(CTRL_C_TEXT)
        return 130
    finally:
        engine.shutdown()


def chunk_reader(stream: BinaryIO) -> Callable[[], bytes]:
    """A function that reads the next bytes that are there (b"" at the end).

    It reads the raw stream when there is one, not the buffered one: a daemon thread that blocks inside the buffered
    stdin holds its lock, and Python can then fail at exit ("could not acquire lock ... at interpreter shutdown").
    """
    raw = getattr(stream, "raw", None)
    if raw is not None:
        return lambda: raw.read(65536) or b""
    return lambda: stream.read1(65536)


def read_lines(read_chunk: Callable[[], bytes], lines: queue.Queue) -> None:
    """The reader thread: each line (without its `\\n`) on the queue, then the end marker.

    A UTF-8 BOM at the start of the input is dropped (a host on Windows may write one).
    """
    pending = b""
    start = True
    try:
        while True:
            chunk = read_chunk()
            if not chunk:
                break
            pending += chunk
            if start:
                if len(pending) < len(BOM) and BOM.startswith(pending):
                    continue  # wait for the rest of a BOM
                if pending.startswith(BOM):
                    pending = pending[len(BOM):]
                start = False
            while True:
                end = pending.find(b"\n")
                if end < 0:
                    break
                lines.put(pending[:end])
                pending = pending[end + 1:]
    except Exception:
        log.exception("Cannot read the standard input: it counts as its end")
    finally:
        if pending:
            lines.put(pending)
        lines.put(_EOF)


def parse_request(raw: bytes) -> tuple[Request | None, str | None]:
    """The request of one line, or None and the reason why it cannot be read."""
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return None, "The line is not UTF-8"
    try:
        obj = loads_json(text)
    except DuplicateKeyError as e:
        # As a key given twice in a line of the shell, of run or of call.
        return None, e.sentence
    except ValueError as e:
        return None, f"The line is not JSON: {e}"
    if not isinstance(obj, dict):
        return None, "A request is one JSON object"
    for key in obj:
        if key not in REQUEST_FIELDS:
            return None, f"Unknown field '{key}' in the request (the fields are id, command, params and context)"
    command = obj.get("command")
    if not isinstance(command, str) or not command:
        return None, "The request has no command (a text)"
    request_id = obj.get("id")
    if request_id is not None and not isinstance(request_id, str):
        return None, "The id of a request must be a text"
    params = obj.get("params")
    if params is None:
        params = {}
    if not isinstance(params, dict):
        return None, "The params of a request must be a JSON object"
    context = obj.get("context")
    if context is not None and not isinstance(context, dict):
        return None, "The context of a request must be a JSON object"
    return Request(id=request_id, command=command, params=params, context=context), None
