"""describe: the command list of the tool contract as one JSON object. No config needed.

The WP tool adds `kind`, `movesChuck` and `long` to each command, and `ignoreCase` to a parameter whose choices are
accepted in any case (a host that checks requests with the list must know it).
"""

from __future__ import annotations

import json
from typing import BinaryIO

import wptool.commands  # noqa: F401  (registers every command)
from wptool import CONTRACT_VERSION, TOOL_NAME, __version__
from wptool.registry import REGISTRY, CommandSpec, Param


def describe_tool() -> dict:
    commands = sorted(REGISTRY.values(), key=lambda spec: spec.name)
    return {
        "tool": TOOL_NAME,
        "version": __version__,
        "contract": CONTRACT_VERSION,
        "commands": [describe_command(spec) for spec in commands],
    }


def describe_command(spec: CommandSpec) -> dict:
    return {
        "name": spec.name,
        "summary": spec.summary,
        "level": spec.level.value,
        "changesMachine": spec.changes_machine,
        # The WP tool takes every input as a parameter (D10): it declares no context.
        "context": [],
        "params": {name: describe_param(param) for name, param in spec.params.items()},
        "kind": spec.kind.value,
        "movesChuck": spec.moves_chuck,
        "long": spec.long,
    }


def describe_param(param: Param) -> dict:
    out: dict = {"type": param.type, "required": param.required}
    if param.default is not None:
        out["default"] = param.default
    if param.choices is not None:
        out["choices"] = list(param.choices)
        if param.ignore_case:
            out["ignoreCase"] = True
    if param.minimum is not None:
        out["minimum"] = param.minimum
    if param.maximum is not None:
        out["maximum"] = param.maximum
    if param.description:
        out["description"] = param.description
    return out


def write_describe(out: BinaryIO) -> int:
    """Write the command list on the binary stream `out` (UTF-8, `\\n`) and return the exit code 0."""
    text = json.dumps(describe_tool(), ensure_ascii=False, indent=2) + "\n"
    out.write(text.encode("utf-8"))
    out.flush()
    return 0
