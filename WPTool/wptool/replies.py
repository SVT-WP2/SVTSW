"""The reply of a request, and the error that a command raises (tool contract, D14, D15)."""

from __future__ import annotations

import json
from dataclasses import dataclass

SUCCESS = "Success"
ERROR = "Error"

# The error codes of the tool (D15). 401, 403 and 423 belong to the host, never to the tool.
BAD_REQUEST = 400  # a parameter is missing, has the wrong type or value, or the line cannot be read
NOT_FOUND = 404  # not a command of the tool: unknown, step 2, or dropped
CONFLICT = 409  # not allowed now, because of the state of the machine
FAILED = 500  # failed in the tool or on the machine
UNAVAILABLE = 503  # the machine is not reachable, or the tool is not connected

CODES = (BAD_REQUEST, NOT_FOUND, CONFLICT, FAILED, UNAVAILABLE)


class ToolError(Exception):
    """A refusal or a failure with its code. The engine turns it into an `Error` reply."""

    def __init__(self, code: int, message: str):
        if code not in CODES:
            raise ValueError(f"Not an error code of the tool: {code}")
        super().__init__(message)
        self.code = code
        self.message = message


def bad_request(message: str) -> ToolError:
    return ToolError(BAD_REQUEST, message)


def not_found(message: str) -> ToolError:
    return ToolError(NOT_FOUND, message)


def conflict(message: str) -> ToolError:
    return ToolError(CONFLICT, message)


def failed(message: str) -> ToolError:
    return ToolError(FAILED, message)


def unavailable(message: str) -> ToolError:
    return ToolError(UNAVAILABLE, message)


@dataclass(frozen=True)
class Reply:
    """The end of one request: `Success` with `data`, or `Error` with `error` = {code, message}."""

    id: str | None
    status: str
    data: dict | None = None
    error: dict | None = None

    @classmethod
    def success(cls, request_id: str | None, data: dict) -> Reply:
        return cls(id=request_id, status=SUCCESS, data=data)

    @classmethod
    def failure(cls, request_id: str | None, code: int, message: str) -> Reply:
        return cls(id=request_id, status=ERROR, error={"code": code, "message": message})

    @property
    def ok(self) -> bool:
        return self.status == SUCCESS

    def to_dict(self) -> dict:
        """Exactly the fields of the tool contract: `id` (left out when None), `status`, and `data` or `error`."""
        out: dict = {}
        if self.id is not None:
            out["id"] = self.id
        out["status"] = self.status
        if self.status == SUCCESS:
            out["data"] = self.data
        else:
            out["error"] = self.error
        return out

    def to_json(self) -> str:
        """The reply as one JSON line, without the end of line."""
        return json.dumps(self.to_dict(), ensure_ascii=False)
