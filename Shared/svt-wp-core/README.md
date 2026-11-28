# svt-wp-core

The Python package `svt_wp_core`: the code of WPAgent that the WP tool needs too. It is part of the plan of the WP tool
([#405](https://github.com/SVT-WP2/SVTSW/issues/405),
[the plan](../../Documentation/decisions/2026-11-wp-tool-phase-1.md), decisions D2, D3 and D18).

## Rules

- **No Kafka, no DB, no users, no global state** of the agent, and no checks of the agent. Importing the package, or
  any module of it, never imports `confluent_kafka` (`tests/test_no_kafka.py`).
- **Installed from the repository, by its path. Never from PyPI**, not even by its name: the repository is public, and
  anybody could publish a package with that name there.

## Install

From the root of the repository:

```
pip install -e "Shared/svt-wp-core[sentio]"
```

The die maps and the interface need only the standard library. The SENTIO driver needs the extra `sentio`
(`sentio-prober-control==24.4.0`, the pin of `WPAgent/requirements.txt`): it imports the SENTIO library when the module
is imported, as in WPAgent.

## Modules

| Module | Copy of | Needs |
|---|---|---|
| `svt_wp_core.interfaces.WPProberInterface` | `WPAgent/interfaces/WPProberInterface.py` | - |
| `svt_wp_core.drivers.WPSentioProber` | `WPAgent/drivers/WPSentioProber.py` | the extra `sentio` |
| `svt_wp_core.utilities.WPDieMaps` | `WPAgent/utilities/WPDieMaps.py` | - |
| `svt_wp_core/configs/WPMapConversion_ER2.json`, `WPMapConversion_ER2B.json` | `WPAgent/configs/` | - |

The folder and file names are those of WPAgent, so that `WPDieMaps` finds its maps in `configs/` next to its parent
folder without a change, and so that each WPAgent module has one twin here.

## Twins of WPAgent, until #414

The modules are **copies** of WPAgent at `a862772f`; WPAgent does not use the package yet. Until
[#414](https://github.com/SVT-WP2/SVTSW/issues/414) switches WPAgent to it, a copy differs from its WPAgent file only by:

1. its header comment, the first line: `# Shared copy of WPAgent/<path> at a862772f. Keep in step with WPAgent until #414.`
2. the prefix of its imports of other copied modules: `from interfaces.` becomes `from svt_wp_core.interfaces.`.

No fixes and no reformatting in a copy, not even of a known problem: change WPAgent and the copy together, in the same
pull request. `tests/test_twins.py` compares each copy with its WPAgent file, and each map file with its WPAgent file
(the line endings, which depend on the checkout, are made equal first); lint (`.flake8`) skips the copies. The
workflow `.github/workflows/shared-wp-core.yml` also runs when one of those WPAgent files changes.

More modules of WPAgent (the contacting and topography stores, the stitching, the needle-mark analysis,
`WPInitProbingConfig`) come with the commands of step 2 of the plan that need them, copied the same way. For each:

1. add it to the lists of `tests/test_twins.py`;
2. add it to the `exclude` of `.flake8`;
3. add its WPAgent path to both `paths` lists of `.github/workflows/shared-wp-core.yml`, so that a change of the
   WPAgent file runs the twin test.

New code is not a twin: it is linted and tested like any other module.

## Checks

```
cd Shared/svt-wp-core
pip install -e ".[dev,sentio]"
python -m flake8
python -m pytest -q
```

The tests need no prober: `tests/conftest.py` stubs the SENTIO library, as `WPAgent/tests/conftest.py` does.
`tests/test_installed.py` builds a wheel with `pip wheel --no-build-isolation` and the setuptools of the extra `dev`, so
no test needs the network. `tests/test_die_maps.py` also reads the run lists of `ITS3TestAgent/` (it skips that check
when they are not there).
