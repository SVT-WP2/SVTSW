"""
The copies of WPAgent in this package are twins of their WPAgent files, until #414 switches WPAgent to the package.

A Python copy may differ from its WPAgent file only by its header comment (first line) and by the prefix
`svt_wp_core.` in its imports of other copied modules. A map file is the same as its WPAgent file.
The line endings are not compared: they depend on the checkout (core.autocrlf), not on the content.

When WPAgent/ is not there (the package alone), the test is skipped; in CI (the variable CI is set) it fails instead.

Run (from Shared/svt-wp-core):  python -m pytest tests/test_twins.py -q
"""

import difflib
import os
import re
from pathlib import Path

import pytest

WPAGENT = Path(__file__).resolve().parents[3] / "WPAgent"
PACKAGE = Path(__file__).resolve().parents[1] / "svt_wp_core"
SOURCE_COMMIT = "a862772f"

# An explicit list, so that a module added later (new code, not a copy) is not compared.
# The path is the same in WPAgent/ and in svt_wp_core/.
PYTHON_TWINS = [
    "interfaces/WPProberInterface.py",
    "drivers/WPSentioProber.py",
    "utilities/WPDieMaps.py",
]
DATA_TWINS = [
    "configs/WPMapConversion_ER2.json",
    "configs/WPMapConversion_ER2B.json",
]

_PREFIX = re.compile(r"^(\s*)from svt_wp_core\.", re.MULTILINE)


def _wpagent_file(rel):
    if not WPAGENT.is_dir():
        if os.environ.get("CI"):
            pytest.fail(f"{WPAGENT} is missing: in CI the twin test must compare, not skip")
        pytest.skip(f"{WPAGENT} is not here: nothing to compare with")
    return WPAGENT / rel


def _text(path):
    return path.read_bytes().decode("utf-8").replace("\r\n", "\n")


def _diff(expected, actual, rel, note=""):
    return "".join(difflib.unified_diff(expected.splitlines(True), actual.splitlines(True),
                                        f"WPAgent/{rel}", f"svt_wp_core/{rel}{note}"))


@pytest.mark.parametrize("rel", PYTHON_TWINS)
def test_python_copy_is_a_twin(rel):
    wpagent = _text(_wpagent_file(rel))
    shared = _text(PACKAGE / rel)

    header = f"# Shared copy of WPAgent/{rel} at {SOURCE_COMMIT}. Keep in step with WPAgent until #414.\n"
    assert shared.startswith(header), f"svt_wp_core/{rel}: the first line must be the header {header!r}"
    shared = _PREFIX.sub(r"\1from ", shared[len(header):])

    assert shared == wpagent, _diff(wpagent, shared, rel, " (header removed, prefix undone)")


@pytest.mark.parametrize("rel", DATA_TWINS)
def test_map_file_is_a_twin(rel):
    wpagent = _text(_wpagent_file(rel))
    shared = _text(PACKAGE / rel)
    assert shared == wpagent, _diff(wpagent, shared, rel)
