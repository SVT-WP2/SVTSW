"""The events of the tool: `ready`, `status` and `progress` (tool contract). Each mode gives its own sink."""

from __future__ import annotations

import json
import sys
from typing import Callable

from wptool import CONTRACT_VERSION, TOOL_NAME, __version__


def ready_event() -> dict:
    return {"event": "ready", "tool": TOOL_NAME, "version": __version__, "contract": CONTRACT_VERSION}


def status_event(snapshot: dict) -> dict:
    return {"event": "status", "data": snapshot}


def progress_event(request_id: str | None, data: dict) -> dict:
    event: dict = {}
    if request_id is not None:
        event["id"] = request_id
    event["event"] = "progress"
    event["data"] = data
    return event


class EventSink:
    """Gets the events of the engine. This base class drops them all."""

    def ready(self) -> None:
        pass

    def status(self, snapshot: dict) -> None:
        pass

    def progress(self, request_id: str | None, data: dict) -> None:
        pass


class RequestEvents:
    """The events of one request, for its command: `ctx.events.progress({...})` carries the id of the request."""

    def __init__(self, sink: EventSink, request_id: str | None):
        self._sink = sink
        self._request_id = request_id

    def progress(self, data: dict) -> None:
        self._sink.progress(self._request_id, data)


class JsonLineSink(EventSink):
    """serve: one JSON line per event, through the protocol writer."""

    def __init__(self, write: Callable[[dict], None]):
        self._write = write

    def ready(self) -> None:
        self._write(ready_event())

    def status(self, snapshot: dict) -> None:
        self._write(status_event(snapshot))

    def progress(self, request_id: str | None, data: dict) -> None:
        self._write(progress_event(request_id, data))


class TextSink(EventSink):
    """shell and run: one short line for people."""

    def __init__(self, write: Callable[[str], None]):
        self._write = write

    def status(self, snapshot: dict) -> None:
        machine = snapshot.get("machine")
        if snapshot.get("proberConnected") and machine:
            self._write(f"status: connected to {machine['address']}:{machine['port']}")
        else:
            self._write("status: not connected")

    def progress(self, request_id: str | None, data: dict) -> None:
        self._write(f"progress: {json.dumps(data, ensure_ascii=False)}")


class ErrorOutputSink(EventSink):
    """call: no ready and no status events; progress events go to the error output as JSON lines."""

    def progress(self, request_id: str | None, data: dict) -> None:
        sys.stderr.write(json.dumps(progress_event(request_id, data), ensure_ascii=False) + "\n")
        sys.stderr.flush()


class MemorySink(EventSink):
    """Tests: every event in a list, in order, as the JSON object of the tool contract."""

    def __init__(self):
        self.events: list[dict] = []

    def ready(self) -> None:
        self.events.append(ready_event())

    def status(self, snapshot: dict) -> None:
        self.events.append(status_event(snapshot))

    def progress(self, request_id: str | None, data: dict) -> None:
        self.events.append(progress_event(request_id, data))
