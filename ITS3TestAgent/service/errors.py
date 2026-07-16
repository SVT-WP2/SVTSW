"""Command failures that map onto a non-Success reply status."""

from __future__ import annotations

from service.models import ReplyStatus


class CommandError(Exception):
    """Raised by a command handler; the listener turns it into an error reply.

    Anything else escaping a handler is a bug and becomes UnexpectedError.
    """

    def __init__(self, message: str, status: ReplyStatus = ReplyStatus.BadRequest):
        super().__init__(message)
        self.message = message
        self.status = status
