# WP tool: progress notes

What each ticket of [#405](https://github.com/SVT-WP2/SVTSW/issues/405) did, what it found, and what the next ones must
know. Every pull request of a ticket updates this page. Add to it; do not rewrite what an earlier ticket wrote, except to
mark a point as done. Keep each entry short and concrete: a file, a name, a value.

Where this page and a ticket differ, this page wins: it is newer.

## Status

| Ticket | Status | Pull request | Note |
|---|---|---|---|
| #406 S1 | in review | (this pull request, into `405-wp-tool`) | `Shared/svt-wp-core/` 0.1.0 |
| #407 T1 | not started | | |
| #408 T2 | not started | | |
| #409 T3 | not started | | |
| #410 T4 | not started | | |
| #411 T5 | not started | | |
| #412 T6 | not started | | needs the ITS3 owners |
| #413 T7 | not started | | |
| #414 S2 | not planned yet | | only when the WPAgent owners agree |

## Changes to the tickets

What a ticket did differently from its text, and why. Later tickets build on what was done, not on the text.

- **#406: the branches were rebased onto `master` first (28 Nov 2026).** The copies come from WPAgent at `a862772f`
  (`master`, #387: it adds `disconnect()` to the interface and the SENTIO driver), but the branch stack of the users
  and roles (392 to 397), and with it `405-wp-tool-docs` and `405-wp-tool`, was based on the commit before it
  (`2f38d988`). The whole stack was rebased onto `a862772f`, patch for patch unchanged, so that `WPAgent/` on the
  feature branch is the source of the copies and the twin test can pass.
- **#406: the twin test compares the text with the line endings made equal** (`\r\n` to `\n`), the map files too,
  and not the raw bytes. The line endings depend on the checkout (`core.autocrlf`), not on the content; git stores
  both files with `\n`.
- **#406: the SENTIO stub** is lines 8 to 26 of `WPAgent/tests/conftest.py` (the ticket said 9 to 27).
- **#406: `tests/test_no_kafka.py` has a second check**, with the real SENTIO library when the extra `sentio` is
  installed (CI installs it): every module still imports, so the names that the driver imports exist in 24.4.0.
- **#406: `tests/test_installed.py` builds the wheel from a copy of the sources** in a temporary folder. pip builds
  in the source folder, which would leave `build/` and `*.egg-info` in the package, and a stale `build/lib` can put
  a deleted file into a later wheel. The check runs in `python -I -S -X utf8`: `-S` keeps site-packages, and with it
  the editable install, out; `-X utf8` because `label_to_coordinates` prints an emoji, and a Windows pipe is not
  UTF-8.
- **#406: the workflow runs `python -m pytest -q -rs`**, so that the log names every skipped test and why.

## Findings for later tickets

Anything a later ticket needs: a helper that exists, a name that was chosen, a trap in the code, a test fixture to
reuse.

- **#406, the imports:** `from svt_wp_core.drivers.WPSentioProber import SentioProberImpl`,
  `from svt_wp_core.interfaces.WPProberInterface import AbstractProber`,
  `from svt_wp_core.utilities.WPDieMaps import label_to_coordinates, wafer_type, project_dies`. Install:
  `pip install -e Shared/svt-wp-core[sentio]` (from the repository root).
- **#406, the driver closes its connection:** `SentioProberImpl.disconnect()` sends no command (socket `shutdown`,
  the library's `comm.disconnect()`, `close`) and is safe to call twice. It does not send `*LOCAL`: giving the machine
  back stays the engine's job (D16).
- **#406, a trap for `serve` (#407, #409): the copies print to stdout.** `label_to_coordinates` prints one line with an
  emoji for every label (`WPDieMaps.py` line 121 of the copy), and the driver prints warnings and some answers
  (`WPSentioProber.py` lines 41, 80, 176, 372 of the copy). In `serve`, stdout carries the JSON lines. The copies
  cannot change (twin rule), so the tool must send stdout to stderr or to its log while it calls them (for example
  `contextlib.redirect_stdout`), and it must not fail on the emoji on a Windows console.
- **#406, the die maps keep a cache:** `WPDieMaps._maps` holds each map file once it is read. It is read-only data of
  the package, not a fact of the machine, so it does not break D10.
- **#406, the SENTIO stub of the tests:** `Shared/svt-wp-core/tests/conftest.py` puts a `MagicMock` in `sys.modules`
  for the SENTIO library before any test is collected, also when the real library is installed. A test that needs
  the real library runs in a child Python (`tests/test_no_kafka.py` shows how).
- **#406, a new copy of WPAgent** (step 2): copy it with the header and only the import prefix changed, add it to the
  lists of `tests/test_twins.py`, to the `exclude` of `Shared/svt-wp-core/.flake8`, and to the paths of
  `.github/workflows/shared-wp-core.yml`.
- **#406, lint:** `Shared/svt-wp-core/.flake8` uses `ignore =` like `WPAgent/.flake8`, which replaces flake8's default
  list: W504 (a line break after a binary operator) is reported in new code.
- **#406, for the merge of the feature branch into `master`:** `ui.yml`, `db-agent-next.yml` and `ui-e2e.yml` change
  (their path filter is `Shared/svt-ts-types/**` now, not `Shared/**`), so the merge runs them once on `master`. They
  build the UI and the DB agent as they are and deploy the same versions to dev. Say so in that pull request.

## Facts

Learned from the SENTIO library, from WPMIT, or from the code, with where it comes from.

- Connecting to SENTIO sends `*RCS 1`; any command puts SENTIO into remote mode until `*LOCAL`
  (`sentio-prober-control` 24.4.0, library research of 23 Nov 2026).
- At 24.4.0 the library has a query of the open project (`get_project`), and none for "aligned", "PTPA valid" or the
  active camera (library research of 23 Nov 2026). #409 confirms the project query.
- WPMIT reports `In Default` for the chuck in the off-axis area (seen in a status of WPMIT). Which Z hints SENTIO can
  report in general is open; #408 reads the library for them, the run on WPMIT records them.
- Today's WPAgent mock reports `WideFieldCamera` after `move_chuck_wide`; the SENTIO driver sends `WorkArea.Probing`
  (`WPAgent/drivers/WPSentioProber.py` line 212). The simulator of #408 uses `Probing` until the run on WPMIT says
  otherwise.
- `sentio-prober-control==24.4.0` requires `pyvisa` and `deprecated`, not pinned by it (pip installed PyVISA 1.16.2
  and Deprecated 3.0.1 on 28 Nov 2026). The names that `WPSentioProber.py` imports at module level exist in 24.4.0
  (`Shared/svt-wp-core/tests/test_no_kafka.py`, with the real library).

## The run on WPMIT

The checklist is in the plan ("Done when"). Write here, step by step, what SENTIO reported for the Z hint and the work
area, and what was corrected in the simulator and in the separation check because of it.

- (not run yet)
