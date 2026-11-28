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
| #408 T2 | in review | [#418](https://github.com/SVT-WP2/SVTSW/pull/418), into `407-wp-tool-engine` (then `405-wp-tool`) | `WPTool/`: the driver layer, the simulator, the connection and its lock, the separation check, `Initialize`, `Disconnect`, `LocalMode` |
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
- **#408: the branch is cut from `407-wp-tool-engine`, and its pull request goes into it**: #416 and #417 were not
  merged yet.
- **#408, the open point of #407 on the `status` event after `Shutdown`: there is none.** The engine sends no
  `status` event once the Shutdown path has run (`Engine.execute`, `not self.stopped`): the tool ends, and that is
  the news, as the example session of the tool contract shows. The end of the input, Ctrl+C and the signals send
  none either. The state is still right (`proberConnected` false after the close). The tool contract says so now
  (rule 6). Tests: `tests/test_connection.py` (`test_shutdown_calls_local_mode_before_disconnect...`,
  `test_serve_shutdown_reply_is_the_last_line`).
- **#408, the open point of #407 on the order in `Engine.shutdown()`: `stopped` stays first, and `on_shutdown` never
  raises.** `Connection.close()` runs `local_mode()` and `disconnect()` each in its own `try` (the driver layer logs
  the error), and releases the lock and sets the state in a `finally`; `disconnect()` runs also when a signal cuts
  `local_mode()` off. So the Shutdown path runs once (a second run would send `*LOCAL` to a half-closed
  connection), `Shutdown` always replies `Success`, and serve ends with exit code 0, as contract rule 6 asks; an
  error of the machine is in the log. Test: `test_a_failing_close_does_not_fail_shutdown`.
- **#408: the simulator is two classes**, `SimulatedProber` (the machine: its state, the tables, the test hooks) and
  `SimulatorLink` (one connection, with its own `connected`; `is_alive()` and `disconnect()` are the link's). The
  ticket has one object whose `connected` changes. But the new connection is opened before the old one is closed,
  both on the same simulator: with one flag, the close of the old connection would make the new one dead. Every
  link passes the other methods on to the simulator, and a call on a closed link raises `ConnectionError`, as on a
  closed socket. One more hook: `drop_connections()` (a restarted machine: `is_alive()` gives false).
- **#408: the lock is taken before the TCP check** (the ticket's order for the seam is "the TCP check, the lock"; it
  also says that the lock comes "before it connects"). A second `wptool` on a held machine so sends nothing to it,
  not even the TCP connect (`test_the_second_wptool_gets_409...` counts the connects of the listener). A failed TCP
  check releases a lock that it took.
- **#408, the lock file:** the letters of the address are made small (host names have no case, and Windows files
  have none); the file is first opened without `O_CREAT` (Linux refuses `O_CREAT` on another user's file in a
  sticky shared folder, fs.protected_regular), with `O_BINARY` on Windows (`os.open` is in text mode there, and
  wrote the process id as `<pid>\r`), and made mode 0o666 with `fchmod` on Linux (the umask takes the write right of
  the others away). A lock file that cannot be opened is 500 `Failed to connect: cannot open the lock file ...`.
- **#408: `Initialize` of another machine than the connected one connects to it, also without `force`** (the old
  connection is closed after the new one is open). The ticket's step 2 answers "Already connected to A" whatever
  machine the request names; a script that asked for B would go on, on A.
- **#408: the reply "Already connected" also has `machine` and `facts`** (the rule for every machine command).
- **#408, the separation check asks the work area only when the hint alone does not decide** (today `In Default`).
  The refusal of a hint that no pair allows (`In Contact`, `In Hover`) names no area: `The chuck is not in
  separation (SENTIO reports 'In Contact'): run MoveChuckSeparation first`. With the area: `... reports 'In
  Default' in Probing) ...`. An error of either query is the 503 of the position query (the work area comes from
  SENTIO's `get_chuck_position_hint` too).
- **#408, the facts:** a new name `dieIndex` for the index of the die; `errors` is always there (an empty list); a
  number that is not finite (NaN) is `null` with a text in `errors`: a NaN in the data would make the reply 500.
- **#408: the SENTIO driver gives `get_dies_number()` as `"n"`, not `"n,..."`**: the library's `map.get_num_dies`
  returns an int, and the driver makes it a text (`str()`). The driver layer reads the first part of either, and
  the simulator gives `"n"`.
- **#408, `call` of a machine command:** a request that fails the parameter check gets its 400 without a connect;
  the 400 of a missing machine has its own text (`No machine to connect to: give machine.address and machine.port
  in the config, or start the tool with --mock`): call takes no parameters of `Initialize`.
- **#408: the registry refuses `moves_chuck=True` with `needs_connection=False`**: the separation check asks the
  machine, so such a move would have no check.
- **#408, test-only additions:** the commands `_Move` (a `moves_chuck` XY move), `_Query` (a machine command that
  reads the facts) and `_Pid` (the process id of the tool), and the variable `WPTOOL_TEST_LOCK_DIR` (read only with
  `WPTOOL_TESTING=1`): the tests keep their lock files out of the folder of the computer. `_Pid`: on Windows, the
  `python.exe` of a venv is a launcher, so `Popen.pid` is not the process id that the tool writes into the lock.
- **#408, the simulator's own values** (the ticket leaves them open): the die (col, row) is at the home position
  plus (col, row) times a pitch of (3000, 2500) µm, so a die move changes X and Y; `move_chuck_z` reports `In
  Default` (a height without a name: the check refuses it in `Probing`); the overtravel gap is added at contact when
  it is on; `move_error_um` is a pair (dx, dy) and is added to `move_chuck_xy` only.

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
  `Shutdown`; the example session of the tool contract shows none. Decide which, and test it. (#408: done, none;
  see "Changes to the tickets".)
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
  fills the hook, and tests them. (#408: done, `stopped` first and `on_shutdown` never raises; see "Changes to the
  tickets".)
- **#407, the log:** the handlers are on the root logger (the libraries of #408 reach the file too); the file gets
  DEBUG. One INFO line per request: `id=... command=... params=... status=... code=... duration_ms=...`.
- **#408, for every machine command of #409, #410, #413:** talk to the machine only through `ctx.machine` (the
  driver layer, `wptool/driver.py`; it raises 503 without a connection); end with `return finish(ctx, data)`
  (`wptool/facts.py`: `data.facts`), except `GetChuckPosition` and `GetChuckXY` (single queries); never call
  `local_mode()` (the engine does, `tests/test_finish.py` checks the source of `wptool/commands/`). `moves_chuck=True`
  runs the separation check first. A driver method that the layer lacks is added to `Machine` in the same ticket,
  and to `METHODS` and the simulator (`tests/test_sentio_driver_calls.py` and
  `test_every_method_of_the_layer_is_documented` list every layer method with the library calls it makes).
- **#408, for #409 (the contact check):** `MoveChuckContact` and `MoveChuckSeparation` have `moves_chuck=False` (they
  move in Z on purpose). The contact check fits in `Engine._check_machine` next to the separation check, as its own
  module in `wptool/checks/`: `machine.get_current_working_area() == "Probing"`, the value of the table
  `AREA_AFTER["move_chuck_wide"]` of the simulator. The simulator's work areas and Z hints are the tables at the top of
  `wptool/simulator.py`; the separation check's pairs are `ALLOWED` in `wptool/checks/separation.py`.
- **#408, the simulator for #409 and #410:** `project`, `ptpa_enabled`, `aligned`, `contact_height`,
  `overtravel_gap`, `overtravel_enabled`, `col`, `row` are plain attributes; `open_project` does not restore heights
  (add it when a test needs it); `find_home` and `run_ptpa` shift (x, y, contact height) by `find_home_shift_um` and
  `ptpa_shift_um`; `move_error_um` (dx, dy) is added to every `move_chuck_xy` (the precise move of #410);
  `Machine.move_chuck_xy` gives the position after the move that SENTIO answers.
- **#408, test fixtures** (`WPTool/tests/conftest.py`): `mock_engine` (an engine with `--mock`;
  `mock_engine.connection.simulator`), `seam` (the test seam in this process), `listener` (a local TCP listener:
  `listener.machine`, `listener.connections(at_least=1)`, which waits for the accept thread), `closed_port`,
  `write_config(path, log_file, machine)`, `machine_calls(log_file)` and `calls_by_request(log_file)` (the machine
  calls of a tool process from its DEBUG log, per request), `SEAM` (the variables for a tool process), the autouse
  `lock_dir`. `tests/fake_sentio.py`: `install(monkeypatch)` puts a recording fake of the SENTIO library under the
  shared driver and gives `(SentioProberImpl, library)`.
- **#408, the shared package is imported only to connect to a real machine** (`wptool.connection.sentio_driver`).
  The simulator reads the two map files from the package folder with `importlib.util.find_spec`, without importing
  it (`test_the_tool_imports_the_shared_package_only_to_connect...`).
- **#408, the copies print to stdout (the trap of #406):** `align_wafer` and `set_contact_height` of the SENTIO
  driver print a line. In `serve` and `call` it goes to the error output (#407); in `shell` and `run` it is on the
  output, among the lines for people.
- **#408, for #411 (the client):** no `status` event after the reply of `Shutdown`; the exit codes 143 (SIGTERM), 129
  (SIGHUP), 149 (SIGBREAK); on Windows the client ends the tool with `CTRL_BREAK_EVENT` to a tool started with
  `CREATE_NEW_PROCESS_GROUP` (SIGTERM ends a Windows process at once, without the close). The tool ignores a second
  signal while it closes. On Windows a signal reaches Python only between two steps of Python code: a command that
  waits for SENTIO (or `time.sleep`) ends first.
- **#408, traps seen in the tests:** on Linux, `close()` of a listening socket does not wake an `accept()` that
  another thread waits in, and the port still listens: `shutdown()` it first (the `Listener` of conftest). On
  Windows, `os.open` without `O_BINARY` writes `\n` as `\r\n`.

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
- **The Z hints of `sentio-prober-control` 24.4.0** (`Sentio/Enumerations.py`, `ZPositionHint`): `Default` (0,
  "unset or undefined", used internally), `Contact` (1), `Hover` (2), `Separation` (3), `Lift` (4), `Transfer` (5,
  the chuck while the loader moves a wafer). The SENTIO driver gives them as `In Default`, `In Contact`, `In Hover`,
  `In Separation`, `In Lift`, `In Transfer`. The separation check allows only `In Separation` and `In Default` in
  `OffAxisCamera`; `Hover`, `Lift` and `Transfer` stay refused (`tests/test_sentio_driver_calls.py` reads the enum of
  the installed library and fails on a new value). The driver turns any answer with "contact" into `In Contact` and
  any with "sep" into `In Separation` (`WPSentioProber.py` lines 309-317); the library's `get_prop` gives a number
  as a float (`In 3.0`). (Read in the library source, 28 Nov 2026.)
- `status.get_prop("Z_Position_Hint", "chuck")` sends `status:get_prop Z_Position_Hint, chuck`; `local_mode()` sends
  `*LOCAL` and reads no answer; `SentioProber.__init__` sends `*RCS 1` (library 24.4.0).
- The library's `map.get_num_dies(DieNumber.Selected)` returns an int, `map.step_die(col, row, site)` a tuple of three
  ints, `move_chuck_xy(ref, x, y)` the (x, y) after the move, `move_chuck_home()` (x, y), `move_chuck_contact()` and
  `move_chuck_separation()` a height. `move_chuck_xy` with `ref=None` (the driver's value for an unknown reference)
  fails with `AttributeError` before it sends anything (library 24.4.0).
- The library has no wrapper of `map:die:get_current_index`; the driver sends it raw, and the format
  "index,col,row" is how WPAgent reads it (`update_current_info`). To confirm on WPMIT.
- The work areas of the library are `WorkArea.Probing` and `WorkArea.Offaxis` (sent as `Probing` and `Offaxis`); the
  text `OffAxisCamera` of the position hint is not in the library (it comes from SENTIO; the driver's comment).
- The library's TCP communicator is IPv4 only (`AF_INET`) and splits the address at `:` into exactly two parts, with
  no timeout on the socket: an IPv6 address cannot be used with the SENTIO driver (`Failed to connect: Invalid
  address format`). The lock file name handles `:` anyway (library 24.4.0, `Communication/CommunicatorTcpIp.py`).
- `Initialize` of `192.0.2.10:35555` (never routed) answers 503 after 2.4 s, the 2 s of the TCP check (Windows, by
  hand, 28 Nov 2026).

## The run on WPMIT

The checklist is in the plan ("Done when"). Write here, step by step, what SENTIO reported for the Z hint and the work
area, and what was corrected in the simulator and in the separation check because of it.

- (not run yet)
