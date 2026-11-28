"""The command line of the shell and of the steps of `run`, and the words of `call`.

A line is `<Command>` followed by `key=value` pairs, or followed by one JSON object:

    OpenProject projectName="ER2 test"
    MoveChuckXY {"x": 100, "y": -50, "position": "Relative"}

The values of `key=value` are text; the engine converts them by the schema. A backslash is a normal character, so
Windows paths stay as they are (`file=C:\\data\\flow.yaml`).
"""

from __future__ import annotations

import shlex

from wptool.data import DuplicateKeyError, loads_json
from wptool.replies import bad_request


def parse_line(line: str) -> tuple[str, dict]:
    """The command and the parameters of one line. Raises `ToolError` 400 when the line cannot be parsed."""
    text = line.strip()
    if not text:
        raise bad_request("The line is empty: expected <Command> [key=value ...]")
    parts = text.split(maxsplit=1)
    if len(parts) == 2 and parts[1].startswith("{"):
        # The JSON form: everything after the command is one JSON object.
        return parts[0], parse_json_params(parts[1])
    try:
        lex = shlex.shlex(text, posix=True)
        lex.whitespace_split = True
        # No escape character: a backslash is a normal character (Windows paths); no comments (`#` is a value).
        lex.escape = ""
        lex.commenters = ""
        words = list(lex)
    except ValueError as e:
        raise bad_request(f"Cannot read the line: {e}") from None
    if not words:
        raise bad_request("The line is empty: expected <Command> [key=value ...]")
    return words[0], parse_pairs(words[1:])


def parse_words(words: list[str]) -> dict:
    """The parameters of `call`: the words after <Command>, as the shell of the system split them.

    Each word is one `key=value` pair, split at its first `=`. A single word that starts with `{` is the JSON form.
    """
    if len(words) == 1 and words[0].startswith("{"):
        return parse_json_params(words[0])
    return parse_pairs(words)


def parse_pairs(words: list[str]) -> dict:
    params: dict = {}
    for word in words:
        key, sep, value = word.partition("=")
        if not sep or not key:
            raise bad_request(f"Expected key=value, got '{word}'")
        if key in params:
            # The same text in every form of a request: a key=value line, a JSON line, a script file.
            raise bad_request(DuplicateKeyError(key).sentence)
        params[key] = value
    return params


def parse_json_params(text: str) -> dict:
    try:
        params = loads_json(text)
    except DuplicateKeyError as e:
        raise bad_request(e.sentence) from None
    except ValueError as e:
        raise bad_request(f"Cannot read the parameters as JSON: {e}") from None
    if not isinstance(params, dict):
        raise bad_request("The JSON parameters must be one object, for example {\"x\": 100}")
    return params
