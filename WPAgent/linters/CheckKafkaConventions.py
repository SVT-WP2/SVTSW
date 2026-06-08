#!/usr/bin/env python3


from __future__ import annotations

import ast
import re
import sys
from pathlib import Path
from dataclasses import dataclass

# ── Config ─────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).parent.parent  # WPAgent/ root (this file lives in linters/)

# Files to scan (relative to ROOT, globs supported)
SCAN_DIRS = ["actions", "services", "utilities", "stateMachine", "globals"]
SCAN_EXTRA = [
    "WPAgent.py",
    "WPCmdMap.py",
    "WPCommandHandler.py",
    "WPKafkaClient.py",
    "main.py",
]

# Files exempt from the header-literal check.
# - WPKafkaClient.py  :
# - WPKafkaHeaders.py :
# - WPDbKafkaClient.py: ,
#
HEADER_STRINGS_EXEMPT = {"WPKafkaClient.py", "WPKafkaHeaders.py", "WPDbKafkaClient.py"}

# Files to exclude from all checks (dead code / pending deletion / non-listener code)
SCAN_EXCLUDE = {
    "WPMapConversionActions.py",  # not in COMMAND_ROUTER, not imported — dead code
    "WPCommandActions.py",  # pending deletion
    "WPInitializationService.py",  # producer-side interactive CLI, not a Kafka listener
    "WPCacheHeartbeat.py",  # internal monitoring heartbeat, not a command response
    "WPListenerHeartbeat.py",  # internal monitoring heartbeat, not a command response
}

# Valid status values per SVT convention
VALID_STATUS = {"Success", "Error", "BadRequest", "NotFound", "UnexpectedError"}

# Kafka header raw string values that must only appear via their constants
KAFKA_HEADER_STRINGS = {
    "kafka_correlationId",
    "kafka_replyTopic",
    "kafka_replyPartition",
}

# camelCase: starts with lowercase letter, no underscores, allows digits
_CAMEL_RE = re.compile(r"^[a-z][a-zA-Z0-9]*$")
# Full topic: svt.<segment>(.<segment>)*
_TOPIC_RE = re.compile(r"^svt(\.[a-z][a-z0-9-]*)+$")

# Keys that are allowed to deviate from camelCase (enum-style identifiers)
CAMEL_WHITELIST = {"WPAG_State"}

# ── Colour helpers ─────────────────────────────────────────────────────────────

_USE_COLOR = "--no-color" not in sys.argv


def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _USE_COLOR else text


OK = lambda t: _c("32", t)
ERR = lambda t: _c("31", t)
WARN = lambda t: _c("33", t)
DIM = lambda t: _c("2", t)

# ── Issue dataclass ────────────────────────────────────────────────────────────


@dataclass
class Issue:
    severity: str  # "error" | "warning"
    check: str
    file: str
    line: int
    message: str

    def __str__(self) -> str:
        tag = (
            ERR(f"[{self.severity.upper()}]")
            if self.severity == "error"
            else WARN("[WARN]")
        )
        return f"  {tag}  {self.file}:{self.line}  {self.message}"


# ── File collection ────────────────────────────────────────────────────────────


def collect_files() -> list[Path]:
    files: list[Path] = []
    for d in SCAN_DIRS:
        files.extend((ROOT / d).rglob("*.py"))
    for f in SCAN_EXTRA:
        p = ROOT / f
        if p.exists():
            files.append(p)
    return [
        f for f in files if "__pycache__" not in str(f) and f.name not in SCAN_EXCLUDE
    ]


def parse(filepath: Path) -> tuple[ast.Module, list[str]] | None:
    try:
        source = filepath.read_text(encoding="utf-8", errors="replace")
        return ast.parse(source, filename=str(filepath)), source.splitlines()
    except SyntaxError:
        return None


# ── Check 1: Topic name format ─────────────────────────────────────────────────


def check_topic_names(files: list[Path]) -> list[Issue]:
    """All svt.* string literals must be valid dash-case topic names."""
    issues: list[Issue] = []
    for filepath in files:
        result = parse(filepath)
        if result is None:
            continue
        tree, _ = result
        fname = filepath.name
        for node in ast.walk(tree):
            if not (isinstance(node, ast.Constant) and isinstance(node.value, str)):
                continue
            val: str = node.value
            if not val.startswith("svt."):
                continue
            if not _TOPIC_RE.match(val):
                issues.append(
                    Issue(
                        severity="error",
                        check="topic-name",
                        file=fname,
                        line=node.lineno,
                        message=(
                            f"Topic '{val}' violates dash-case convention. "
                            "Expected: svt.<dash-case-segment>(.<dash-case-segment>)*"
                        ),
                    )
                )
    return issues


# ── Check 2: Reply topic suffix ────────────────────────────────────────────────


def check_reply_topics(files: list[Path]) -> list[Issue]:
    """
    - Strings ending in .reply must form a valid X.reply topic.
    - Variable names containing 'reply_topic' (non-constant) assigned a literal must end in .reply.
    """
    issues: list[Issue] = []
    for filepath in files:
        result = parse(filepath)
        if result is None:
            continue
        tree, _ = result
        fname = filepath.name

        for node in ast.walk(tree):
            # Literal string ending in .reply → validate base is a valid topic
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                val: str = node.value
                if val.endswith(".reply"):
                    base = val[:-6]  # strip ".reply"
                    if base and not _TOPIC_RE.match(base):
                        issues.append(
                            Issue(
                                severity="error",
                                check="reply-topic",
                                file=fname,
                                line=node.lineno,
                                message=(
                                    f"Reply topic '{val}' — base '{base}' "
                                    "is not a valid topic name."
                                ),
                            )
                        )

            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if (
                        isinstance(target, ast.Name)
                        and "reply_topic" in target.id.lower()
                        and not target.id.isupper()
                        and isinstance(node.value, ast.Constant)
                        and isinstance(node.value.value, str)
                    ):
                        val = node.value.value
                        if not val.endswith(".reply"):
                            issues.append(
                                Issue(
                                    severity="error",
                                    check="reply-topic",
                                    file=fname,
                                    line=node.lineno,
                                    message=(
                                        f"Variable '{target.id}' is assigned '{val}' "
                                        "but reply topics must end in .reply"
                                    ),
                                )
                            )
    return issues


# ── Check 3: Kafka header string literals ──────────────────────────────────────


def check_header_literals(files: list[Path]) -> list[Issue]:
    """
    The Kafka header names (kafka_correlationId, kafka_replyTopic, kafka_replyPartition)
    must not appear as raw string literals outside their constant definition file.
    Use KAFKA_HEADER__* constants instead.
    """
    issues: list[Issue] = []
    for filepath in files:
        if filepath.name in HEADER_STRINGS_EXEMPT:
            continue  # constants are defined here — allowed
        result = parse(filepath)
        if result is None:
            continue
        tree, _ = result
        fname = filepath.name

        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Constant)
                and isinstance(node.value, str)
                and node.value in KAFKA_HEADER_STRINGS
            ):
                issues.append(
                    Issue(
                        severity="warning",
                        check="header-literal",
                        file=fname,
                        line=node.lineno,
                        message=(
                            f"Raw header string '{node.value}' should be referenced "
                            f"via its constant (KAFKA_HEADER__{node.value.replace('kafka_', '').upper()})."
                        ),
                    )
                )
    return issues


# ── Check 4: Status values ─────────────────────────────────────────────────────


def check_status_values(files: list[Path]) -> list[Issue]:
    """
    In dict literals {"status": VALUE}, VALUE must be one of the valid status strings.
    Also checks == / != comparisons where the literal is a candidate status value.
    """
    issues: list[Issue] = []
    _status_like = re.compile(
        r"^(success|error|ok|fail|bad.?request|not.?found|unexpected).*$", re.I
    )

    for filepath in files:
        result = parse(filepath)
        if result is None:
            continue
        tree, _ = result
        fname = filepath.name

        for node in ast.walk(tree):
            # Dict literal: {"status": "VALUE"}
            if isinstance(node, ast.Dict):
                for k, v in zip(node.keys, node.values):
                    if (
                        isinstance(k, ast.Constant)
                        and k.value == "status"
                        and isinstance(v, ast.Constant)
                        and isinstance(v.value, str)
                    ):
                        val = v.value
                        if val not in VALID_STATUS:
                            # Wrong-casing of a valid status → error (easy to fix)
                            # Truly non-standard value → warning (may be intentional)
                            is_wrong_case = val.lower() in {
                                s.lower() for s in VALID_STATUS
                            }
                            issues.append(
                                Issue(
                                    severity="error" if is_wrong_case else "warning",
                                    check="status-value",
                                    file=fname,
                                    line=v.lineno,
                                    message=(
                                        f"Invalid status value '{val}'. "
                                        f"Must be one of: {', '.join(sorted(VALID_STATUS))}"
                                    ),
                                )
                            )

            # Comparison: flag if literal looks like a misspelled status
            if isinstance(node, ast.Compare):
                for comp in [node.left] + list(node.comparators):
                    if (
                        isinstance(comp, ast.Constant)
                        and isinstance(comp.value, str)
                        and _status_like.match(comp.value)
                        and comp.value not in VALID_STATUS
                    ):
                        issues.append(
                            Issue(
                                severity="warning",
                                check="status-value",
                                file=fname,
                                line=comp.lineno,
                                message=(
                                    f"Status-like string '{comp.value}' in comparison "
                                    f"is not a valid status value. "
                                    f"Valid values: {', '.join(sorted(VALID_STATUS))}"
                                ),
                            )
                        )
    return issues


# ── Check 5: Data key naming (camelCase) ───────────────────────────────────────


def check_data_key_naming(files: list[Path]) -> list[Issue]:
    """
    Keys inside Kafka message data dicts must be camelCase (first letter lowercase,
    no underscores). Only checks dict literals that appear to be Kafka message data:
    - dicts that are the value of a "data" key in a parent dict with a "type" key
    """
    issues: list[Issue] = []

    def _check_dict_keys(node: ast.Dict, fname: str, context: str) -> list[Issue]:
        found = []
        for k in node.keys:
            if not (isinstance(k, ast.Constant) and isinstance(k.value, str)):
                continue
            key = k.value
            if key in CAMEL_WHITELIST:
                continue
            if not _CAMEL_RE.match(key):
                found.append(
                    Issue(
                        severity="warning",
                        check="data-key-naming",
                        file=fname,
                        line=k.lineno,
                        message=(
                            f"Data key '{key}' in {context} is not camelCase. "
                            "Keys in Kafka message data must start with a lowercase letter "
                            "and contain no underscores."
                        ),
                    )
                )
        return found

    for filepath in files:
        result = parse(filepath)
        if result is None:
            continue
        tree, _ = result
        fname = filepath.name

        for node in ast.walk(tree):
            if not isinstance(node, ast.Dict):
                continue

            # Pattern: {"type": ..., "data": {<keys>}}
            keys_vals = {
                k.value: v
                for k, v in zip(node.keys, node.values)
                if isinstance(k, ast.Constant) and isinstance(k.value, str)
            }
            if "type" in keys_vals and "data" in keys_vals:
                data_val = keys_vals["data"]
                if isinstance(data_val, ast.Dict):
                    issues.extend(_check_dict_keys(data_val, fname, "message data"))

            # Also flag top-level message dict keys themselves
            if "type" in keys_vals:
                allowed_top = {"type", "data", "status", "error"}
                for k in node.keys:
                    if isinstance(k, ast.Constant) and isinstance(k.value, str):
                        if k.value not in allowed_top and not _CAMEL_RE.match(k.value):
                            issues.append(
                                Issue(
                                    severity="warning",
                                    check="data-key-naming",
                                    file=fname,
                                    line=k.lineno,
                                    message=(
                                        f"Message field '{k.value}' is not camelCase."
                                    ),
                                )
                            )

    return issues


# ── Runner ─────────────────────────────────────────────────────────────────────

CHECKS = [
    ("1", "Topic name format        (dash-case, dot-separated)", check_topic_names),
    ("2", "Reply topic suffix       (must end in .reply)", check_reply_topics),
    (
        "3",
        "Kafka header literals    (use constants, not strings)",
        check_header_literals,
    ),
    ("4", "Status values            (valid enum set)", check_status_values),
    ("5", "Data key naming          (camelCase)", check_data_key_naming),
]


def run_checks(verbose: bool = False) -> int:
    files = collect_files()
    all_issues: list[Issue] = []

    print("=" * 65)
    print(" WPAgent Kafka Convention Checker")
    print(f" Scanning {len(files)} files")
    print("=" * 65)

    for num, title, check_fn in CHECKS:
        print()
        print(f"[{num}] {title}")
        print("-" * 65)

        issues = check_fn(files)
        all_issues.extend(issues)

        if issues:
            for issue in issues:
                print(issue)
        else:
            print(f"  {OK('✓')} No violations found  ({len(files)} files scanned)")

    # ── Summary
    print()
    print("=" * 65)
    total_err = sum(1 for i in all_issues if i.severity == "error")
    total_warn = sum(1 for i in all_issues if i.severity == "warning")
    if total_err > 0:
        print(ERR(f" [FAIL]  {total_err} error(s), {total_warn} warning(s)"))
    elif total_warn > 0:
        print(WARN(f" [WARN]  0 errors, {total_warn} warning(s) — review above"))
    else:
        print(OK(" [PASS]  All Kafka convention checks passed"))
    print("=" * 65)

    return 1 if total_err > 0 else 0


if __name__ == "__main__":
    verbose = "--verbose" in sys.argv or "-v" in sys.argv
    sys.exit(run_checks(verbose=verbose))
