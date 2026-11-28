"""
A normal (not editable) install has the two map files, and the die maps find them there.

The test builds a wheel of the package (pip wheel --no-deps) from a copy of its sources, unpacks it into a temporary
folder, and runs the check in a child Python that sees only that folder and the standard library (-I -S: no
site-packages, so the editable install of the test run cannot answer instead). An editable install proves nothing
about the data files, because it reads them from the source folder.

pip builds the wheel in an isolated environment, so it fetches setuptools when its cache has none.

Run (from Shared/svt-wp-core):  python -m pytest tests/test_installed.py -q
"""

import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
MAP_FILES = ["svt_wp_core/configs/WPMapConversion_ER2.json", "svt_wp_core/configs/WPMapConversion_ER2B.json"]
MODULE_FILES = [
    "svt_wp_core/__init__.py",
    "svt_wp_core/interfaces/WPProberInterface.py",
    "svt_wp_core/drivers/WPSentioProber.py",
    "svt_wp_core/utilities/WPDieMaps.py",
]

CHECK = r"""
import json
import sys

sys.path.insert(0, sys.argv[1])

import svt_wp_core
from svt_wp_core.utilities import WPDieMaps

print(json.dumps({
    "module": WPDieMaps.__file__,
    "config_dir": WPDieMaps.CONFIG_DIR,
    "version": svt_wp_core.__version__,
    "wafer_types": WPDieMaps.available_wafer_types(),
    "ER2": WPDieMaps.label_to_coordinates("BAM01", "ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW"),
    "ER2B": WPDieMaps.label_to_coordinates("BAM01", "ER2B_babyMOSAIX_Vertical_V0_NotchW_ArrowW"),
}))
"""


@pytest.fixture(scope="module")
def wheel(tmp_path_factory):
    """The wheel, built from a copy of the sources, so that the build leaves nothing (build/, *.egg-info) in the folder."""
    sources = tmp_path_factory.mktemp("sources")
    for name in ["pyproject.toml", "README.md"]:
        shutil.copy2(PACKAGE_ROOT / name, sources / name)
    shutil.copytree(PACKAGE_ROOT / "svt_wp_core", sources / "svt_wp_core", ignore=shutil.ignore_patterns("__pycache__"))

    out = tmp_path_factory.mktemp("wheel")
    run = subprocess.run([sys.executable, "-m", "pip", "wheel", ".", "--no-deps", "-w", str(out)],
                         cwd=sources, capture_output=True, text=True, timeout=600)
    assert run.returncode == 0, f"pip wheel failed:\n{run.stdout}\n{run.stderr}"
    wheels = list(out.glob("svt_wp_core-*.whl"))
    assert len(wheels) == 1, wheels
    return wheels[0]


def test_the_wheel_holds_the_modules_and_the_map_files(wheel):
    names = set(zipfile.ZipFile(wheel).namelist())
    for name in MODULE_FILES + MAP_FILES:
        assert name in names, f"{name} is not in {wheel.name}"
    assert not [n for n in names if n.startswith("tests/")], "the tests must not be in the wheel"


def test_the_die_maps_find_their_maps_in_the_install(wheel, tmp_path):
    site = tmp_path / "site"
    zipfile.ZipFile(wheel).extractall(site)

    # -I: no user site, no PYTHON* variables; -S: no site-packages; -X utf8: the die maps print an emoji.
    run = subprocess.run([sys.executable, "-I", "-S", "-X", "utf8", "-c", CHECK, str(site)],
                         cwd=tmp_path, capture_output=True, text=True, encoding="utf-8", timeout=120)
    assert run.returncode == 0, f"the check failed:\n{run.stdout}\n{run.stderr}"
    result = json.loads(run.stdout.strip().splitlines()[-1])

    assert Path(result["module"]).resolve().is_relative_to(site.resolve()), result["module"]
    assert Path(result["config_dir"]).resolve() == (site / "svt_wp_core" / "configs").resolve()
    assert {"ER2", "ER2B"} <= set(result["wafer_types"])
    assert result["ER2"] == [-2, 0]
    assert result["ER2B"] == [0, 0]

    version = wheel.name.split("-")[1]
    assert result["version"] == version, "__version__ and the version of pyproject.toml differ"
