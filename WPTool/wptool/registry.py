"""The commands of the tool: the `@command` decorator, their specs, and `REGISTRY`.

A command module registers its functions with `@command(...)`; `wptool.commands` imports every command module.
The function gets a `CommandContext` and the converted parameters as keyword arguments (a parameter that was not
given and has no default is None), returns the `data` of the reply as a dict, and raises `ToolError` to refuse.
"""

from __future__ import annotations

import dataclasses
import inspect
import logging
from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Callable

from wptool.params import TYPES, check_value
from wptool.replies import ToolError

if TYPE_CHECKING:
    from wptool.config import Config
    from wptool.connection import Connection
    from wptool.driver import Machine
    from wptool.events import RequestEvents
    from wptool.state import ToolState


class Kind(StrEnum):
    OFFLINE = "OFFLINE"  # no machine
    MACHINE = "MACHINE"  # needs a connection to the machine


class Level(StrEnum):
    """The lowest role that may send the command (`WPAgent/utilities/WPCommandConstants.py`). Only for describe (D7)."""

    USER = "User"
    EXPERT = "Expert"
    DEVELOPER = "Developer"


@dataclass(frozen=True)
class Param:
    """One parameter of a command. Types: string, number, integer, boolean, object.

    `ignore_case=True` accepts a choice in any case and passes on the form of the list (`west` becomes `West`).
    """

    type: str
    required: bool = False
    default: Any = None
    choices: tuple | list | None = None
    ignore_case: bool = False
    minimum: float | None = None
    maximum: float | None = None
    description: str = ""

    def __post_init__(self):
        if self.type not in TYPES:
            raise ValueError(f"Unknown parameter type '{self.type}' (types: {', '.join(TYPES)})")
        if self.choices is not None:
            if not self.choices:
                raise ValueError("choices must not be empty")
            object.__setattr__(self, "choices", tuple(self.choices))
        if self.ignore_case and (self.choices is None or not all(isinstance(c, str) for c in self.choices)):
            raise ValueError("ignore_case needs choices that are texts")
        if (self.minimum is not None or self.maximum is not None) and self.type not in ("number", "integer"):
            raise ValueError("minimum and maximum are only for the types number and integer")
        if self.minimum is not None and self.maximum is not None and self.minimum > self.maximum:
            raise ValueError("minimum is above maximum")
        if self.required and self.default is not None:
            raise ValueError("a required parameter has no default")


@dataclass
class CommandContext:
    """What a command gets besides its parameters.

    A command talks to the machine only through `machine`, the driver layer (D19), and never calls `local_mode()`:
    the engine gives the machine back after the request (D16).
    """

    state: ToolState
    config: Config
    events: RequestEvents  # ctx.events.progress({...}) during a long command
    log: logging.Logger
    shutdown: Callable[[], None]  # the Shutdown path of the engine (gives the machine back); Shutdown calls it
    connection: Connection  # open, close; Initialize and Disconnect use it

    @property
    def machine(self) -> Machine:
        """The driver layer of the open connection, or `ToolError` 503 without one."""
        return self.connection.require()


@dataclass(frozen=True)
class CommandSpec:
    name: str
    summary: str
    kind: Kind
    level: Level
    func: Callable[..., dict]
    params: dict[str, Param]
    changes_machine: bool
    moves_chuck: bool
    long: bool
    needs_connection: bool


REGISTRY: dict[str, CommandSpec] = {}


def command(
    *,
    name: str,
    summary: str,
    kind: Kind,
    level: Level,
    params: dict[str, Param] | None = None,
    changes_machine: bool | None = None,
    moves_chuck: bool = False,
    long: bool = False,
    needs_connection: bool | None = None,
) -> Callable[[Callable[..., dict]], Callable[..., dict]]:
    """Register the decorated function as the command `name`.

    - `changes_machine` (default: true for MACHINE): false for ShowStatus, GetChuckPosition, GetChuckXY and every
      offline command; true for every other machine command (the plan, "Commands"). Only for describe.
    - `moves_chuck`: the command moves or may move the chuck ("moves" in the plan): the engine runs the separation
      check before it (D11). It needs a connection.
    - `long`: the command can take more than 30 s.
    - `needs_connection` (default: true for MACHINE): without a connection the engine refuses with 503. Initialize and
      Disconnect set it to false.
    """
    params = dict(params or {})
    kind = Kind(kind)
    level = Level(level)
    if changes_machine is None:
        changes_machine = kind is Kind.MACHINE
    if needs_connection is None:
        needs_connection = kind is Kind.MACHINE

    def register(func: Callable[..., dict]) -> Callable[..., dict]:
        if name in REGISTRY:
            raise ValueError(f"Command {name} is registered twice")
        if kind is Kind.OFFLINE and (changes_machine or moves_chuck or needs_connection):
            raise ValueError(f"{name}: an offline command does not change or move the machine, nor need a connection")
        if moves_chuck and not needs_connection:
            raise ValueError(f"{name}: a command that moves the chuck needs a connection (the separation check asks the machine)")
        checked: dict[str, Param] = {}
        for param_name, param in params.items():
            if not isinstance(param, Param):
                raise ValueError(f"{name}: parameter '{param_name}' is not a Param")
            if param.default is not None:
                # The default passes its own check, and the spec keeps it converted: a command gets the same type
                # whether the parameter was given or not (Param("number", default=0) gives 0.0).
                try:
                    default = check_value(param_name, param, param.default)
                except ToolError as e:
                    raise ValueError(f"{name}: the default of '{param_name}' does not pass its own check: {e.message}") from None
                param = dataclasses.replace(param, default=default)
            checked[param_name] = param
        _check_signature(name, func, checked)
        REGISTRY[name] = CommandSpec(
            name=name,
            summary=summary,
            kind=kind,
            level=level,
            func=func,
            params=checked,
            changes_machine=changes_machine,
            moves_chuck=moves_chuck,
            long=long,
            needs_connection=needs_connection,
        )
        return func

    return register


def _check_signature(name: str, func: Callable[..., dict], params: dict[str, Param]) -> None:
    """The function takes the context, then exactly the parameters of the schema (or **kwargs)."""
    args = list(inspect.signature(func).parameters.values())
    if not args or args[0].kind not in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD):
        raise ValueError(f"{name}: the first argument of the function is the CommandContext")
    rest = args[1:]
    if any(arg.kind is inspect.Parameter.VAR_KEYWORD for arg in rest):
        return
    names = {arg.name for arg in rest}
    if names != set(params):
        raise ValueError(f"{name}: the function takes {sorted(names)}, the schema has {sorted(params)}")
