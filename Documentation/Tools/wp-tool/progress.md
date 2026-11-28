# WP tool: progress notes

What each ticket of [#405](https://github.com/SVT-WP2/SVTSW/issues/405) did, what it found, and what the next ones must
know. Every pull request of a ticket updates this page. Add to it; do not rewrite what an earlier ticket wrote, except to
mark a point as done. Keep each entry short and concrete: a file, a name, a value.

Where this page and a ticket differ, this page wins: it is newer.

## Status

| Ticket | Status | Pull request | Note |
|---|---|---|---|
| #406 S1 | in review | [#416](https://github.com/SVT-WP2/SVTSW/pull/416), into `405-wp-tool` | `Shared/svt-wp-core/` 0.1.0 |
| #407 T1 | in review | [#417](https://github.com/SVT-WP2/SVTSW/pull/417), into `406-shared-wp-core` (then `405-wp-tool`) | `WPTool/` 0.1.0: the frame, `ShowStatus`, `Shutdown` |
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
- **#406: the extra `dev` also pins `setuptools==80.9.0`**, and `tests/test_installed.py` builds the wheel with
  `pip wheel --no-build-isolation`: an isolated build would fetch setuptools from PyPI, and the tests must need no
  network.
- **#406: the path filters of `shared-wp-core.yml` also have `ITS3TestAgent/run_list.csv` and
  `ITS3TestAgent/run_list_er2b.csv`**, the run lists that `tests/test_die_maps.py` checks the maps against.
- **#407: the branch is cut from `406-shared-wp-core`, and its pull request goes into it**, not into `405-wp-tool`:
  #416 was not merged yet.
- **#407: `integer` also accepts the text of a whole number written as a float** (`"3.0"` gives 3; `"3.5"` is still
  400). The ticket says "a text that `int()` reads", but it accepts the float 3.0, which JSON and YAML give; the
  shell's text `count=3.0` must give the same reply (D10).
- **#407: `number` always gives a float** (100 becomes 100.0), so that `x=100` in the shell and `"x": 100` in JSON
  give the same reply. A default too: the registry converts each default once and keeps the converted value in the
  spec, so `Param("number", default=0)` reaches the command as 0.0 and `Param("string", default=5)` as "5", given or
  not (`tests/test_engine.py`).
- **#407: `describe` adds `"ignoreCase": true`** to a parameter whose choices are accepted in any case. A host that
  checks the requests with the list must know that `west` is fine. The tool contract says so now
  (`Documentation/Tools/tool-contract.md`, "The command list").
- **#407: in the config, `machine` needs both `address` and `port`** when it is given (the ticket makes the two keys
  optional, not their subkeys). A half machine is a typo that stops the tool at start. `null` for `machine` or `log`
  counts as not given.
- **#407: a `.json` file is read as JSON, any other as YAML** (the config and the script files), and a UTF-8 BOM is
  dropped. YAML refuses the tabs that JSON files often have.
- **#407: `errors="replace"` on all three standard streams**, not only on the error output, and
  `errors="backslashreplace"` on the log file: a byte that is not UTF-8 in the shell's input, or a lone surrogate in a
  value (the JSON escape `\udc80`, or a byte of argv on Linux), must not end the tool nor drop a line of the log. The
  protocol writer writes a lone surrogate as its JSON escape. Tested in tool processes with ASCII streams: the shell
  (`tests/test_shell.py`), serve and call (`test_serve.py`, `test_call.py`, with the log file).
- **#407: serve reads the raw standard input** (`sys.stdin.buffer.raw`) in its reader thread. A daemon thread that
  blocks inside the buffered stdin holds its lock, and Python can abort at exit ("could not acquire lock for
  <_io.BufferedReader name='<stdin>'> at interpreter shutdown"). The protocol writer writes the encoded bytes to
  `sys.stdout.buffer` (UTF-8, `\n`, flushed per line) instead of a second `io.TextIOWrapper` on the same buffer: the
  same bytes on Linux and Windows.
- **#407: `CommandContext` also has `shutdown`**, the Shutdown path of the engine (`Engine.shutdown()`), which the
  command `Shutdown` calls before its reply. The ticket lists `state`, `config`, `events` and `log`.
- **#407: serve is strict about a request line.** An unknown field (`user` at the top level), an `id` that is not a
  text, or `NaN` or `Infinity` get the 400 reply without `id`. `params: null` counts as `{}`. A line may end with
  `\r\n`.
- **#407: serve skips a blank line without a reply** (the review of #417). Rule 5 of the contract gives a 400 to "a
  line that the tool cannot read"; a blank line is taken as no line at all, because a host that pairs the replies
  by their order would take a reply to it for the reply of its next request. A UTF-8 BOM at the start of the input
  is dropped.
- **#407: a key given twice is 400 in every form of a request**, not "the last one wins": a `key=value` line, the
  JSON form, a line of serve, the words of call (exit code 2 there, as for any word that cannot be read), and the
  JSON and YAML files (script and config; exit code 2). `wptool/data.py` reads all JSON with an
  `object_pairs_hook`, and YAML with a `SafeLoader` subclass that refuses a key twice in one map (a key that a merge
  `<<` brings in may still be overridden). The text is the same everywhere: `The key '<key>' is given twice`.
- **#407: the command name is taken as given in every mode** (the map form of a `run` step was stripped before):
  only the splitting of a line at its spaces removes spaces.
- **#407: `ToolState` is a `@dataclass(slots=True)`**: no attribute other than its two fields can be set, not even in
  a method (`tests/test_state.py`).
- **#407: one more test-only command, `_Interrupt`** (raises `KeyboardInterrupt`). It tests Ctrl+C while a command
  runs in every mode, also on Windows, where SIGINT cannot be sent to one process. The real SIGINT test of serve runs
  on Linux only.
- **#407: the workflow runs `python -m pytest tests -q -rs`**, as #406 does, so that the log names the skipped test.

## Findings for later tickets

Anything a later ticket needs: a helper that exists, a name that was chosen, a trap in the code, a test fixture to
reuse.

- **#406, the imports:** `from svt_wp_core.drivers.WPSentioProber import SentioProberImpl`,
  `from svt_wp_core.interfaces.WPProberInterface import AbstractProber`,
  `from svt_wp_core.utilities.WPDieMaps import label_to_coordinates, wafer_type, project_dies`. Install:
  `pip install -e "Shared/svt-wp-core[sentio]"` (from the repository root; the quotes are needed in zsh).
- **#406, the driver closes its connection:** `SentioProberImpl.disconnect()` sends no command (socket `shutdown`,
  the library's `comm.disconnect()`, `close`) and is safe to call twice. It does not send `*LOCAL`: giving the machine
  back stays the engine's job (D16).
- **#406, a trap for `serve` (#407, #409): the copies print to stdout.** `label_to_coordinates` prints one line with an
  emoji for every label (`WPDieMaps.py` line 121 of the copy), and the driver prints warnings and some answers
  (`WPSentioProber.py` lines 41, 80, 176, 372 of the copy). In `serve`, stdout carries the JSON lines. The copies
  cannot change (twin rule), so the tool must send stdout to stderr or to its log while it calls them (for example
  `contextlib.redirect_stdout`), and it must not fail on the emoji on a Windows console. (#407: done for the whole run
  of serve and call, `wptool/cli.py`; UTF-8 on the streams, `wptool/logs.py`.)
- **#406, the die maps keep a cache:** `WPDieMaps._maps` holds each map file once it is read. It is read-only data of
  the package, not a fact of the machine, so it does not break D10.
- **#406, the SENTIO stub of the tests:** `Shared/svt-wp-core/tests/conftest.py` puts a `MagicMock` in `sys.modules`
  for the SENTIO library before any test is collected, also when the real library is installed. A test that needs
  the real library runs in a child Python (`tests/test_no_kafka.py` shows how).
- **#406, a new copy of WPAgent** (step 2): copy it with the header and only the import prefix changed, add it to the
  lists of `tests/test_twins.py`, to the `exclude` of `Shared/svt-wp-core/.flake8`, and to the paths of
  `.github/workflows/shared-wp-core.yml`.
- **#406, lint:** `Shared/svt-wp-core/.flake8` uses `ignore =` like `WPAgent/.flake8`, which replaces flake8's whole
  default list. So new code also gets W504 (a line break after a binary operator), E226 (no spaces around an
  arithmetic operator), E704, E121, E123, E126 and E24.
- **#406, for the merge of the feature branch into `master`:** `ui.yml`, `db-agent-next.yml` and `ui-e2e.yml` change
  (their path filter is `Shared/svt-ts-types/**` now, not `Shared/**`), so the merge runs them once on `master`. They
  build the UI and the DB agent as they are and deploy the same versions to dev. Say so in that pull request.
- **#407, the hooks for #408** are empty methods of `Engine` (`wptool/engine.py`): `_check_connection` (check 1, the
  503), `_check_machine` (check 2, always last: the separation check), `on_finish(request, reply)` (after every
  request, whatever its result: `local_mode()`), `on_shutdown()` (give the machine back, close the connection).
  `needs_connection` defaults to true for kind `MACHINE`, so `Initialize` must set `needs_connection=False`.
- **#407, the Shutdown path:** every mode function calls `engine.shutdown()` in its `finally`; it runs `on_shutdown`
  once and sets `engine.stopped`. The command `Shutdown` calls it (through `ctx.shutdown()`) before its reply, and the
  modes end when `engine.stopped` is true.
- **#407, Ctrl+C and the signals (#408):** each mode catches `KeyboardInterrupt` and returns 130
  (`wptool/modes/shell.py`, `run.py`, `serve.py`, `call.py`; `cli.main` as a last net). The engine catches only
  `Exception`. For SIGTERM, SIGHUP and SIGBREAK, raise from the handler an exception that is not an `Exception`, and
  catch it next to `KeyboardInterrupt` in those places, with the code 128 plus the signal number.
- **#407, a question for #408: the `status` event after `Shutdown`.** The engine sends a `status` event after the reply
  whenever the snapshot changed. When `on_shutdown` closes the connection, a `status` event follows the reply of
  `Shutdown`; the example session of the tool contract shows none. Decide which, and test it.
- **#407, a failing `on_finish`:** a `Success` reply becomes 500 `<command> failed: <text>`; an `Error` reply keeps its
  error, and the failure of the finish is in the log (`Engine._finish`).
- **#407, the registry checks at import time:** the function takes the context, then exactly the parameters of the
  schema (or `**kwargs`); an `OFFLINE` command cannot set `changes_machine`, `moves_chuck` or `needs_connection`; a
  default must pass its own check; a name is registered once.
- **#407, `run` checks the steps with `wptool.engine.validate`** (the engine's steps 1 to 3, no machine). The checks
  before the command (#408) run only when the step runs.
- **#407, helpers to reuse:** `wptool.modes.ProtocolWriter` (one JSON line on a binary stream), `wptool.modes.reply_lines`
  (`OK ...`/`ERROR ...`), `wptool.lines.parse_line` and `parse_words`, `wptool.engine.resolve` (the 404 of a name),
  `wptool.events.MemorySink`.
- **#407, test fixtures** (`WPTool/tests/conftest.py`): `config` and `config_file` (the log in `tmp_path/log`, never in
  the working directory), `call_tool(*words)`, `serve_tool()` (a `ServeProcess` with `request`, `read`, `read_raw`,
  `close_input`, `wait`, `rest`), `run_tool(args, cwd)`, `temp_command` (registers a command for one test) and
  `connect_commands` (`_Connect` and `_Disconnect`, which change the state as #408's commands will, for the `status`
  lines and events). `tests/test_engine.py` has `Recorder`, an engine that records its hooks. The tool processes of the tests start with
  `PYTHONIOENCODING=ascii` and `PYTHONUTF8=0`: streams that are not UTF-8 on every system, so that a test with an
  emoji fails when the tool stops setting UTF-8 itself (Python 3.15 is in UTF-8 mode by default and would hide it).
- **#407, for #411 (the client):** a request line has only `id`, `command`, `params` and `context`, and `id` is a text.
  The reply of a line that cannot be read has no `id`; a blank line gets no reply. The client must read the error
  output of `serve` (or send it to a file): the tool writes one INFO log line per request there, and a full pipe
  would block the tool.
- **#407, for #408: the order in `Engine.shutdown()`.** It sets `stopped` before it calls `on_shutdown`, so a failing
  `on_shutdown` is not tried again (the `finally` of the mode calls `shutdown()` once more, and it does nothing), and
  serve still ends with exit code 0 after a 500 reply to `Shutdown`. #408 decides the order and the exit code when it
  fills the hook, and tests them.
- **#407, the log:** the handlers are on the root logger (the libraries of #408 reach the file too); the file gets
  DEBUG. One INFO line per request: `id=... command=... params=... status=... code=... duration_ms=...`.

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
- The lists of `WPTool/wptool/notintool.py` cover the 93 names of `COMMAND_ROUTER` (`WPAgent/WPCmdMap.py`, with
  `ListAvailableCommands`) with the 30 commands that the plan moves to the tool: 52 in step 2, 11 dropped, no name
  twice, none missing (a one-time script of #407, 28 Nov 2026; the tests do not read WPAgent).
- `argparse` with `nargs=argparse.REMAINDER` after a positional takes every later word, options too: in
  `wptool call ShowStatus --mock`, `--mock` is a word of the command (Python 3.12 and 3.15).
- PyYAML reads the step `- _Echo text: a` as a map and cannot read `- _Echo {"text": "a"}` at all: a step line with
  `: ` needs quotes (PyYAML 6.0.2).
- PyYAML 6.0.2 has no wheel for Python 3.15; pip builds it from its source (seen on 28 Nov 2026). CI uses 3.12.

## The run on WPMIT

The checklist is in the plan ("Done when"). Write here, step by step, what SENTIO reported for the Z hint and the work
area, and what was corrected in the simulator and in the separation check because of it.

- (not run yet)
