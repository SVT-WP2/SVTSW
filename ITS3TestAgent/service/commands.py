"""Command registry — the single source of truth for the ITS3 TestAgent's
Kafka command surface.

``service/listener.py`` dispatches through it and
``contract/generate_contract.py`` generates the OpenAPI YAML from it, so a new
command shows up in both the agent and the contract with no hand-written YAML:

  1. add its request/reply models to ``service/models.py``
  2. add a ``CommandSpec`` below, naming the ``RunManager`` method
  3. re-run ``python3 contract/generate_contract.py``

``COMMANDS`` is deliberately free of handler objects so the generator can
import it without constructing the runtime.  Handler lookup by name mirrors
TestAgent's ``registries/command_registry.py``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from pydantic import BaseModel

from service.models import (
    GetStatusReply,
    GetStatusRequest,
    StartRunReply,
    StartRunRequest,
    StopRunReply,
    StopRunRequest,
)


@dataclass(frozen=True)
class CommandSpec:
    request: type[BaseModel]
    reply: type[BaseModel]
    summary: str
    handler_name: str
    tags: tuple[str, ...] = ("Run lifecycle",)


#: Command name -> spec.  Reply messages are typed ``<name>Reply``.
COMMANDS: dict[str, CommandSpec] = {
    "StartRun": CommandSpec(
        request=StartRunRequest,
        reply=StartRunReply,
        summary="Start a test run for one wafer",
        handler_name="start_run",
    ),
    "StopRun": CommandSpec(
        request=StopRunRequest,
        reply=StopRunReply,
        summary="Request a graceful stop of the active run",
        handler_name="stop_run",
    ),
    "GetStatus": CommandSpec(
        request=GetStatusRequest,
        reply=GetStatusReply,
        summary="Poll run state and per-chip progress",
        handler_name="get_status",
    ),
}


def build_handlers(mgr: object) -> dict[str, Callable[[BaseModel], BaseModel]]:
    """Bind each command to its method on the RunManager instance."""
    handlers: dict[str, Callable[[BaseModel], BaseModel]] = {}
    for name, spec in COMMANDS.items():
        fn = getattr(mgr, spec.handler_name, None)
        if not callable(fn):
            raise ValueError(
                f"{type(mgr).__name__} has no callable '{spec.handler_name}' "
                f"for command '{name}'"
            )
        handlers[name] = fn
    return handlers
