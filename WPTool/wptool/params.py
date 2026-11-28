"""The check and conversion of the parameters of a request (the engine, step 3).

The same in every mode: the shell and `call` give text, YAML and JSON give typed values, and both reach the command
as the type of its schema. `check_params` needs no engine: the mode `run` uses it to check a whole file first.
"""

from __future__ import annotations

import json
import math
from typing import TYPE_CHECKING, Any

from wptool.replies import bad_request

if TYPE_CHECKING:
    from wptool.registry import CommandSpec, Param

# Accepted and ignored in every request (D13): the agent's keys, which existing scripts still send.
IGNORED_KEYS = ("user", "waferAgentName")

_TRUE = ("true", "1", "yes")
_FALSE = ("false", "0", "no")


class _WrongType(Exception):
    """The value cannot be read as the type of its parameter."""


def drop_ignored(params: dict) -> dict:
    """A copy of `params` without the keys `user` and `waferAgentName` (D13)."""
    return {key: value for key, value in params.items() if key not in IGNORED_KEYS}


def check_params(spec: CommandSpec, params: dict) -> dict:
    """Check `params` against the schema of `spec` and convert them.

    Returns every parameter of the schema: the converted value, else its default, else None.
    Raises `ToolError` 400 for an unknown key, a missing required parameter, a wrong type, a value that is not
    allowed, or a value out of its limits.
    """
    for key in params:
        if key not in spec.params:
            raise bad_request(f"Unknown parameter '{key}' for {spec.name}")
    out = {}
    for name, param in spec.params.items():
        value = params.get(name)
        if value is None:
            # A missing optional parameter, or one that is null, counts as not given: it gets its default.
            if param.required:
                raise bad_request(f"Missing required parameter '{name}' for {spec.name}")
            out[name] = param.default
            continue
        out[name] = check_value(name, param, value)
    return out


def check_value(name: str, param: Param, value: Any) -> Any:
    """Convert one value to the type of `param` and check its choices and limits. Raises `ToolError` 400."""
    try:
        converted = convert(param.type, value)
    except _WrongType:
        raise bad_request(f"Invalid type for '{name}': expected {param.type}") from None
    if param.choices is not None:
        converted = _choose(name, param, converted)
    if param.minimum is not None and converted < param.minimum:
        raise bad_request(f"Invalid value for '{name}': {_show(converted)} is below the minimum {_show(param.minimum)}")
    if param.maximum is not None and converted > param.maximum:
        raise bad_request(f"Invalid value for '{name}': {_show(converted)} is above the maximum {_show(param.maximum)}")
    return converted


def convert(type_name: str, value: Any) -> Any:
    """Convert `value` to `type_name`, or raise `_WrongType`."""
    return _CONVERTERS[type_name](value)


def _number(value: Any) -> float:
    # bool is an int in Python: never accept True or False as a number.
    if isinstance(value, bool):
        raise _WrongType
    if isinstance(value, (int, float)):
        number = _to_float(value)
    elif isinstance(value, str):
        try:
            number = float(value)
        except ValueError:
            raise _WrongType from None
    else:
        raise _WrongType
    if not math.isfinite(number):
        raise _WrongType
    # Always a float, so that 100 (JSON) and "100" (the shell) give the same reply.
    return number


def _integer(value: Any) -> int:
    if isinstance(value, bool):
        raise _WrongType
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return _whole(value)
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            pass
        # "3.0" is the text of the float 3.0, which JSON and YAML accept: accept the text too, the same in every mode.
        try:
            number = float(value)
        except ValueError:
            raise _WrongType from None
        return _whole(number)
    raise _WrongType


def _whole(number: float) -> int:
    if not math.isfinite(number) or not number.is_integer():
        raise _WrongType
    return int(number)


def _to_float(value: int | float) -> float:
    try:
        return float(value)
    except OverflowError:
        raise _WrongType from None


def _boolean(value: Any) -> bool:
    # Never bool("false"), which is True (WPAgent's mistake).
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        text = value.strip().lower()
        if text in _TRUE:
            return True
        if text in _FALSE:
            return False
    raise _WrongType


def _string(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    raise _WrongType


def _object(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            loaded = json.loads(value)
        except ValueError:
            raise _WrongType from None
        if isinstance(loaded, dict):
            return loaded
    raise _WrongType


_CONVERTERS = {
    "string": _string,
    "number": _number,
    "integer": _integer,
    "boolean": _boolean,
    "object": _object,
}

TYPES = tuple(_CONVERTERS)


def _choose(name: str, param: Param, value: Any) -> Any:
    """The value of the list of choices that `value` names. With `ignore_case`, the form of the list."""
    for choice in param.choices:
        if value == choice:
            return choice
        if param.ignore_case and isinstance(value, str) and value.casefold() == choice.casefold():
            return choice
    allowed = ", ".join(_show(choice) for choice in param.choices)
    raise bad_request(f"Invalid value for '{name}': {_show(value)} (allowed: {allowed})")


def _show(value: Any) -> str:
    """A value for a message: 5.0 is shown as 5."""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)
