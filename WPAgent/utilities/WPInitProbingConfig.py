"""
Alignment projects used by InitProbing.

configs/WPInitProbingConfig.json maps an ASIC family (e.g. "MOSAIX") to the name of
the project that has to be open while the wafer is aligned:

    {"BABYMOSAIX": "<project name>", "MOSAIX": "<project name>"}

Family names are compared case-insensitively.
"""

import json
import pathlib

CONFIG_PATH = str(pathlib.Path(__file__).parent.parent / "configs" / "WPInitProbingConfig.json")


def load_alignment_projects(path: str = None) -> dict:
    """Return {FAMILY (upper case): project name}. Raises ValueError for a broken file."""
    path = path or CONFIG_PATH
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = json.load(f)
    except FileNotFoundError:
        raise ValueError(f"InitProbing config not found: {path}")
    except json.JSONDecodeError as e:
        raise ValueError(f"InitProbing config {path} is not valid JSON: {e}")
    if not isinstance(raw, dict):
        raise ValueError(f"InitProbing config {path} must be a JSON object {{family: project}}")
    return {str(family).strip().upper(): str(project).strip() for family, project in raw.items()}


def get_alignment_project(family: str, path: str = None):
    """Project to align with for this ASIC family, or None when the family is not configured."""
    if not family:
        return None
    return load_alignment_projects(path).get(str(family).strip().upper()) or None
