"""The five modes of the tool, and what they share: the protocol writer and the reply lines for people."""

from __future__ import annotations

import json
import logging
import sys
from typing import BinaryIO

from wptool.replies import Reply

log = logging.getLogger("wptool.modes")

CTRL_C_TEXT = "Ctrl+C: the tool runs the Shutdown path and ends (it stops the tool, not only the command)"


class ProtocolWriter:
    """Writes one JSON object per line on a binary stream: UTF-8, `\\n` and never `\\r\\n`, flushed after each line.

    Binary, so that Windows writes the same bytes as Linux. Strict JSON: no NaN. A lone surrogate becomes its JSON
    escape (`\\udc80`), so that the line stays valid JSON.
    """

    def __init__(self, stream: BinaryIO):
        self._stream = stream

    def write(self, obj: dict) -> None:
        line = json.dumps(obj, ensure_ascii=False, allow_nan=False) + "\n"
        self._stream.write(line.encode("utf-8", "backslashreplace"))
        self._stream.flush()

    def write_reply(self, reply: Reply) -> None:
        self.write(reply.to_dict())


def reply_lines(reply: Reply) -> list[str]:
    """The reply for people (shell and run): `OK <message>`, then the other fields of `data` as indented JSON;
    or `ERROR <code>: <message>`."""
    if not reply.ok:
        return [f"ERROR {reply.error['code']}: {reply.error['message']}"]
    data = dict(reply.data or {})
    message = data.pop("message", "")
    lines = [f"OK {message}".rstrip()]
    if data:
        lines.extend(json.dumps(data, indent=2, ensure_ascii=False).splitlines())
    return lines


def print_line(line: str) -> None:
    """One line for people on the standard output (looked up at each call)."""
    print(line, flush=True)


def print_error(line: str) -> None:
    """One line for people on the error output."""
    print(line, file=sys.stderr, flush=True)
