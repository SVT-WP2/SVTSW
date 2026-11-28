"""Reading JSON and YAML, the same way in every mode: strict JSON (no NaN, no Infinity), and a key given twice is an
error in JSON and in YAML (both would otherwise keep the last one), so that the same request gets the same reply."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml


class DataFileError(Exception):
    """A YAML or JSON file that cannot be read."""


class DuplicateKeyError(ValueError):
    def __init__(self, key: Any):
        super().__init__(f"the key '{key}' is given twice")
        self.key = key
        # The text of the 400 reply, the same in every form of a request.
        self.sentence = f"The key '{key}' is given twice"


def loads_json(text: str) -> Any:
    """`json.loads`, but NaN, Infinity and a key given twice raise `ValueError`."""
    return json.loads(text, parse_constant=_no_constant, object_pairs_hook=_unique_keys)


def _no_constant(name: str) -> Any:
    raise ValueError(f"{name} is not a JSON value")


def _unique_keys(pairs: list[tuple[str, Any]]) -> dict:
    out: dict = {}
    for key, value in pairs:
        if key in out:
            raise DuplicateKeyError(key)
        out[key] = value
    return out


class _UniqueKeyLoader(yaml.SafeLoader):
    """`yaml.SafeLoader` that refuses a key given twice in one map (a key from a merge `<<` may be overridden)."""

    def construct_mapping(self, node, deep=False):
        if isinstance(node, yaml.MappingNode):
            seen = set()
            for key_node, _ in node.value:
                if key_node.tag == "tag:yaml.org,2002:merge":
                    continue
                key = self.construct_object(key_node, deep=True)
                try:
                    duplicate = key in seen
                except TypeError:
                    continue  # not hashable: the base class says so
                if duplicate:
                    raise yaml.constructor.ConstructorError(None, None, f"the key '{key}' is given twice", key_node.start_mark)
                seen.add(key)
        return super().construct_mapping(node, deep=deep)


def loads_yaml(text: str) -> Any:
    """`yaml.safe_load`, but a key given twice raises `yaml.YAMLError`."""
    return yaml.load(text, Loader=_UniqueKeyLoader)


def load_data_file(path: str | Path) -> Any:
    """Read a YAML or JSON file as UTF-8 (a BOM is dropped). A `.json` file is read as JSON, any other as YAML."""
    path = Path(path)
    try:
        text = path.read_text(encoding="utf-8-sig")
    except OSError as e:
        raise DataFileError(f"cannot read {path}: {e.strerror or e}") from None
    except UnicodeDecodeError as e:
        raise DataFileError(f"cannot read {path}: it is not UTF-8 ({e.reason} at byte {e.start})") from None
    is_json = path.suffix.lower() == ".json"
    try:
        return loads_json(text) if is_json else loads_yaml(text)
    except (ValueError, yaml.YAMLError) as e:
        raise DataFileError(f"{path} is not valid {'JSON' if is_json else 'YAML'}: {e}") from None
