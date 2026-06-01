import sys
from pathlib import Path

import pytest

# Make sure check_contracts is importable from project root
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from linters.CheckContracts import (
    EXEMPT_FUNCTIONS,
    ROOT,
    get_function_node,
    has_responsebuilder_return,
    is_pascal_case,
    parse_command_router,
)

# ── Load COMMAND_ROUTER once at collection time ───────────────────────────────

_cmdmap = ROOT / "WPCmdMap.py"
_entries, _alias_to_file = parse_command_router(_cmdmap)

# All commands
_all_commands = [cmd for cmd, _, _ in _entries]

# Commands backed by a real function (not lambda) and not exempt
_checkable = [
    (cmd, alias, func)
    for cmd, alias, func in _entries
    if func is not None and func not in EXEMPT_FUNCTIONS and alias is not None
]


# ── 1. PascalCase names ───────────────────────────────────────────────────────


@pytest.mark.parametrize("cmd", _all_commands, ids=_all_commands)
def test_command_name_is_pascal_case(cmd: str) -> None:
    """Every key in COMMAND_ROUTER must be PascalCase (e.g. 'TestingLock')."""
    assert is_pascal_case(cmd), (
        f"Command '{cmd}' is not PascalCase. "
        "Rename the key in COMMAND_ROUTER to match the convention."
    )


# ── 2. ResponseBuilder returns ────────────────────────────────────────────────


@pytest.mark.parametrize(
    "cmd,alias,func_name",
    _checkable,
    ids=[cmd for cmd, _, _ in _checkable],
)
def test_command_function_returns_responsebuilder(
    cmd: str, alias: str, func_name: str
) -> None:
    """
    Every registered command function must return ResponseBuilder.success()
    or ResponseBuilder.error().

    If a function intentionally returns something else, add its name to
    EXEMPT_FUNCTIONS in check_contracts.py.
    """
    filepath = _alias_to_file.get(alias)
    assert filepath is not None and filepath.exists(), (
        f"'{cmd}': cannot resolve module alias '{alias}' to a file. "
        "Check imports in WPCmdMap.py."
    )

    func_node = get_function_node(filepath, func_name)
    assert func_node is not None, (
        f"'{cmd}': function '{func_name}' not found in {filepath.name}. "
        "Is it registered under the wrong module alias in COMMAND_ROUTER?"
    )

    assert has_responsebuilder_return(func_node), (
        f"'{cmd}': {filepath.name}::{func_name}() has no "
        "ResponseBuilder.success() or ResponseBuilder.error() return. "
        "Either fix the function or add it to EXEMPT_FUNCTIONS."
    )