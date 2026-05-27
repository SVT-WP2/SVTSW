#!/usr/bin/env python3
"""
WPAgent Contract Checker
========================
Statically verifies two code contracts without importing any project modules:

  1. COMMAND_ROUTER keys (command names) must be PascalCase.
       "TestingLock"         ✅
       "testingLock"         ❌
       "testing_lock"        ❌

  2. Every function registered in COMMAND_ROUTER must contain at least one
     return statement that calls ResponseBuilder.success() or
     ResponseBuilder.error().

     Add names to EXEMPT_FUNCTIONS when a registered function intentionally
     returns something other than a ResponseBuilder response.

Usage:
    python check_contracts.py              # exits 0 if clean, 1 on issues
    python check_contracts.py --verbose    # also prints every OK check
    python check_contracts.py --no-color   # plain output (for CI)
"""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

# ── Configuration ─────────────────────────────────────────────────────────────

ROOT = Path(__file__).parent

# Functions registered in COMMAND_ROUTER that are allowed to NOT return
# ResponseBuilder (raw-dict returns, pass-throughs, etc.).
# Lambda wrappers are automatically skipped — no need to list them here.
EXEMPT_FUNCTIONS: set[str] = {
    "list_available_commands",  # returns raw dict, wrapped in lambda anyway
}

# ── ANSI colours (disabled with --no-color) ───────────────────────────────────

_USE_COLOR = "--no-color" not in sys.argv


def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _USE_COLOR else text


OK   = lambda t: _c("32", t)   # green
ERR  = lambda t: _c("31", t)   # red
WARN = lambda t: _c("33", t)   # yellow
DIM  = lambda t: _c("2",  t)   # dim

# ── AST helpers ───────────────────────────────────────────────────────────────

_PASCAL_RE = re.compile(r"^[A-Z][a-zA-Z0-9]+$")


def is_pascal_case(name: str) -> bool:
    return bool(_PASCAL_RE.match(name))


def parse_alias_to_file(tree: ast.Module) -> dict[str, Path]:
    """
    Parse 'import actions.WP* as <alias>' lines.
    Returns {alias: absolute_Path_to_py_file}.
    """
    mapping: dict[str, Path] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.asname and alias.name.startswith("actions."):
                    rel = alias.name.replace(".", "/") + ".py"
                    mapping[alias.asname] = ROOT / rel
    return mapping


# One entry per registered command:
#   cmd       – command name string  ("TestingLock")
#   alias     – module alias string  ("testing_actions")  or None for lambdas
#   func_name – function name string ("testing_lock")     or None for lambdas
Entry = tuple[str, str | None, str | None]


def parse_command_router(cmdmap_path: Path) -> tuple[list[Entry], dict[str, Path]]:
    """
    Return (entries, alias_to_file) by static AST analysis of WPCmdMap.py.
    Handles both dict-literal and COMMAND_ROUTER["key"] = … assignment forms.
    """
    source = cmdmap_path.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(cmdmap_path))
    alias_to_file = parse_alias_to_file(tree)
    entries: list[Entry] = []

    def _value_to_entry(cmd: str, value: ast.expr) -> Entry:
        if isinstance(value, ast.Attribute) and isinstance(value.value, ast.Name):
            return (cmd, value.value.id, value.attr)
        # lambda, Call, or anything complex → skip ResponseBuilder check
        return (cmd, None, None)

    for node in ast.walk(tree):
        # ── dict-literal: COMMAND_ROUTER = { "Cmd": module.func, … }
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "COMMAND_ROUTER":
                    if isinstance(node.value, ast.Dict):
                        for k, v in zip(node.value.keys, node.value.values):
                            if isinstance(k, ast.Constant) and isinstance(k.value, str):
                                entries.append(_value_to_entry(k.value, v))

        # ── subscript: COMMAND_ROUTER["Cmd"] = module.func
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if (
                    isinstance(target, ast.Subscript)
                    and isinstance(target.value, ast.Name)
                    and target.value.id == "COMMAND_ROUTER"
                ):
                    key = target.slice
                    if isinstance(key, ast.Constant) and isinstance(key.value, str):
                        entries.append(_value_to_entry(key.value, node.value))

    return entries, alias_to_file


def get_function_node(filepath: Path, func_name: str) -> ast.FunctionDef | None:
    """Return the AST node for a top-level function, or None if not found."""
    source = filepath.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(filepath))
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.FunctionDef) and node.name == func_name:
            return node
    return None


def has_responsebuilder_return(func_node: ast.FunctionDef) -> bool:
    """
    Return True if the function contains at least one:
        return ResponseBuilder.success(…)
        return ResponseBuilder.error(…)
    """
    for node in ast.walk(func_node):
        if not isinstance(node, ast.Return) or node.value is None:
            continue
        val = node.value
        if (
            isinstance(val, ast.Call)
            and isinstance(val.func, ast.Attribute)
            and isinstance(val.func.value, ast.Name)
            and val.func.value.id == "ResponseBuilder"
        ):
            return True
    return False


# ── Main checker ──────────────────────────────────────────────────────────────

def run_checks(verbose: bool = False) -> int:
    """Run all checks. Returns 0 (pass) or 1 (fail)."""
    cmdmap_path = ROOT / "WPCmdMap.py"
    if not cmdmap_path.exists():
        print(ERR(f"ERROR: {cmdmap_path} not found"), file=sys.stderr)
        return 1

    entries, alias_to_file = parse_command_router(cmdmap_path)
    errors: list[str] = []

    # ── 1. PascalCase names ───────────────────────────────────────────────────
    _section("1", "Command name formatting (PascalCase)")
    naming_bad: list[str] = []
    for cmd, _, _ in entries:
        if not is_pascal_case(cmd):
            naming_bad.append(cmd)

    if naming_bad:
        for cmd in naming_bad:
            msg = f"  {ERR('[NAMING]')}  '{cmd}' — not PascalCase"
            print(msg)
            errors.append(msg)
    else:
        print(f"  {OK('✓')} All {len(entries)} command names are PascalCase")

    if verbose and not naming_bad:
        for cmd, _, _ in entries:
            print(DIM(f"    ok  '{cmd}'"))

    # ── 2. ResponseBuilder returns ────────────────────────────────────────────
    print()
    _section("2", "Command functions return ResponseBuilder")
    rb_bad: list[str] = []
    rb_ok = 0
    rb_skip = 0

    for cmd, alias, func_name in entries:
        # lambda / complex wrapper — skip
        if func_name is None:
            rb_skip += 1
            if verbose:
                print(DIM(f"    skip  '{cmd}' (lambda/complex)"))
            continue

        # explicitly exempt
        if func_name in EXEMPT_FUNCTIONS:
            rb_skip += 1
            if verbose:
                print(DIM(f"    skip  '{cmd}' → {func_name} (exempt)"))
            continue

        # resolve file
        filepath = alias_to_file.get(alias) if alias else None
        if filepath is None or not filepath.exists():
            msg = (
                f"  {WARN('[MISSING]')}  '{cmd}' → alias '{alias}' "
                f"could not be resolved (file: {filepath})"
            )
            print(msg)
            rb_bad.append(msg)
            continue

        # find function AST
        func_node = get_function_node(filepath, func_name)
        if func_node is None:
            msg = (
                f"  {ERR('[MISSING]')}  '{cmd}' → "
                f"function '{func_name}' not found in {filepath.name}"
            )
            print(msg)
            rb_bad.append(msg)
            continue

        # check return
        if not has_responsebuilder_return(func_node):
            msg = (
                f"  {ERR('[NO_RB]')}   '{cmd}' → "
                f"{filepath.name}::{func_name}() — no ResponseBuilder return"
            )
            print(msg)
            rb_bad.append(msg)
        else:
            rb_ok += 1
            if verbose:
                print(OK(f"    ok  '{cmd}' → {filepath.name}::{func_name}()"))

    if not rb_bad:
        print(
            f"  {OK('✓')} All {rb_ok} checked functions return ResponseBuilder"
            + (f"  ({rb_skip} skipped)" if rb_skip else "")
        )

    errors.extend(rb_bad)

    # ── Summary ───────────────────────────────────────────────────────────────
    print()
    print("=" * 60)
    if errors:
        print(ERR(f" [FAIL]  {len(errors)} issue(s) found — see above"))
    else:
        print(OK(" [PASS]  All contract checks passed"))
    print("=" * 60)

    return 1 if errors else 0


def _section(num: str, title: str) -> None:
    print("=" * 60)
    print(f" [{num}] {title}")
    print("-" * 60)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    verbose = "--verbose" in sys.argv or "-v" in sys.argv
    sys.exit(run_checks(verbose=verbose))
