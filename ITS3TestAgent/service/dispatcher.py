"""Message dispatch: request body in, reply body out.

Deliberately Kafka-free — ``service/listener.py`` owns the I/O and calls this.
That keeps the whole command surface exercisable without a broker, and means a
second transport (or the status stream) can reuse the same dispatch.

Envelope (mirrors the WPAgent dialect the UI already speaks):

    in   {"type": "StartRun", "data": {...}}
    out  {"type": "StartRunReply", "status": "Success", "data": {...}}
         {"type": "StartRunReply", "status": "BadRequest", "error": {"message": "..."}}
"""

from __future__ import annotations

import logging
import time

from pydantic import ValidationError

from service.commands import COMMANDS, build_handlers
from service.errors import CommandError
from service.models import ReplyStatus

log = logging.getLogger("its3.service")


class Dispatcher:
    def __init__(self, mgr: object) -> None:
        self.handlers = build_handlers(mgr)

    def dispatch(self, body: dict) -> dict:
        """Route one request body to its handler and build the reply body.

        Never raises: every failure becomes an error reply, because a handler
        blowing up must not kill the listener loop.
        """
        command = "Unknown"
        started = time.time()

        try:
            if not isinstance(body, dict):
                raise CommandError("Message body must be a JSON object")

            command = body.get("type") or "Unknown"
            data    = body.get("data") or {}

            spec = COMMANDS.get(command)
            if spec is None:
                raise CommandError(
                    f"Unknown command '{command}'. Known commands: "
                    f"{', '.join(sorted(COMMANDS))}",
                    ReplyStatus.NotFound,
                )

            try:
                request = spec.request.model_validate(data)
            except ValidationError as exc:
                raise CommandError(f"Invalid data for {command}: {exc}",
                                   ReplyStatus.BadRequest) from exc

            log.info("-> %s %s", command, data or "")
            result = self.handlers[command](request)

            payload = result.model_dump(mode="json")
            payload["executionTimeMs"] = round((time.time() - started) * 1000)
            return {"type": f"{command}Reply",
                    "status": ReplyStatus.Success.value,
                    "data": payload}

        except CommandError as exc:
            log.warning("<- %s %s: %s", command, exc.status.value, exc.message)
            return {"type": f"{command}Reply", "status": exc.status.value,
                    "error": {"message": exc.message}}
        except Exception as exc:
            log.exception("Command %s raised", command)
            return {"type": f"{command}Reply",
                    "status": ReplyStatus.UnexpectedError.value,
                    "error": {"message": str(exc)}}
