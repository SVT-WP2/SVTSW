"""
Importing svt_wp_core, and any module of it, does not import confluent_kafka.

Each check runs in a child Python: a module that another test has already imported cannot hide an import there.
The child sets sys.modules["confluent_kafka"] = None, so that any import of it raises ImportError, and imports every
module that pkgutil finds in the package (a module added later is checked too).

Run (from Shared/svt-wp-core):  python -m pytest tests/test_no_kafka.py -q
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
COPIED_MODULES = {
    "svt_wp_core.interfaces.WPProberInterface",
    "svt_wp_core.drivers.WPSentioProber",
    "svt_wp_core.utilities.WPDieMaps",
}

CHILD = r"""
import importlib
import importlib.util
import json
import pkgutil
import sys
from unittest.mock import MagicMock

sys.modules["confluent_kafka"] = None  # an import of it raises ImportError

if sys.argv[1] == "stub":
    stub = MagicMock()
    for name in ["sentio_prober_control", "sentio_prober_control.Sentio", "sentio_prober_control.Sentio.Enumerations",
                 "sentio_prober_control.Sentio.ProberSentio", "sentio_prober_control.Sentio.Response",
                 "sentio_prober_control.Communication", "sentio_prober_control.Sentio.CommandGroups"]:
        sys.modules[name] = stub
elif importlib.util.find_spec("sentio_prober_control") is None:
    print(json.dumps({"skip": "the SENTIO library is not installed (extra sentio)"}))
    sys.exit(0)

import svt_wp_core

names = ["svt_wp_core"] + [m.name for m in pkgutil.walk_packages(svt_wp_core.__path__, "svt_wp_core.")]
for name in names:
    importlib.import_module(name)
kafka = sorted(n for n in sys.modules if n == "confluent_kafka" or n.startswith("confluent_kafka."))
print(json.dumps({"modules": names, "package": svt_wp_core.__file__,
                  "kafka": [n for n in kafka if sys.modules[n] is not None]}))
"""


def _import_all(sentio):
    run = subprocess.run([sys.executable, "-c", CHILD, sentio], cwd=PACKAGE_ROOT,
                         capture_output=True, text=True, timeout=120)
    assert run.returncode == 0, f"an import failed:\n{run.stdout}\n{run.stderr}"
    result = json.loads(run.stdout.strip().splitlines()[-1])
    if "skip" in result:
        pytest.skip(result["skip"])
    assert Path(result["package"]).resolve().is_relative_to(PACKAGE_ROOT.resolve()), result["package"]
    return result


def test_no_module_imports_kafka_with_the_sentio_library_stubbed():
    result = _import_all("stub")
    assert COPIED_MODULES <= set(result["modules"])
    assert result["kafka"] == []


def test_no_module_imports_kafka_with_the_real_sentio_library():
    """The driver imports the names it needs from the pinned SENTIO library (24.4.0), when the extra is installed."""
    result = _import_all("real")
    assert COPIED_MODULES <= set(result["modules"])
    assert result["kafka"] == []
