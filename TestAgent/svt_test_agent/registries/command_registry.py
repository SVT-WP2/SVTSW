"""
Default command registry for the SVT Test Agent.

This module imports the command handler implementation, instantiates a
single handler object, and exposes dictionaries that map command names
to bound handler callables. These mappings are used by the Test Agent
to resolve incoming command names to the correct implementation.

Location: svt_test_agent/registries/command_registry.py
"""

from __future__ import annotations

from typing import Callable, Dict

from svt_test_agent.command_handler import CmdHandler

# Single handler instance whose methods are bound as command handlers.
_HANDLER = CmdHandler()


def _get_handler_method(name: str) -> Callable[..., object]:
    """
    Look up a callable method on the shared CmdHandler instance by name.

    Raises:
        ValueError: if the attribute is missing or not callable.
    """
    fn = getattr(_HANDLER, name, None)
    if not callable(fn):
        raise ValueError(f"CmdHandler has no callable '{name}'")
    return fn


DEFAULT_COMMAND_HANDLERS: Dict[str, Callable[..., object]] = {
    "GetAllTests":     _get_handler_method("GetAllTests"),
    "RunTest":         _get_handler_method("RunTest"),
    "RunLoopTest":     _get_handler_method("RunLoopTest"),
    "RunSequenceTest": _get_handler_method("RunSequenceTest"),
    "AbortTest":       _get_handler_method("AbortTest"),
    "TestStatus":      _get_handler_method("TestStatus"),
}


CHIP_COMMAND_OVERRIDES: Dict[str, Dict[str, Callable[..., object]]] = {
    "SLDO": {
        # Example override:
        # "RunTest": _get_handler_method("RunTestForSLDO"),
    },
    "NVG": {},
}
