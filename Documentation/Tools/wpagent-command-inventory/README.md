# WPAgent command inventory

What each command of WPAgent does, at `master` commit `a862772f` (27 Nov 2026): for each of the 93 commands of
`COMMAND_ROUTER` (`WPAgent/WPCmdMap.py`), with file and line, its parameters, checks, DB calls, Kafka behaviour, global
state, prober calls in order, files, duration, reply, and what stops it without the DB and Kafka. It was written for
the WP tool plan ([2026-11-wp-tool-phase-1](../../decisions/2026-11-wp-tool-phase-1.md)): the tool's commands are
written new, with the WPAgent handler as the reference for which machine calls run in which order.

Nothing was run against a prober, Kafka or a DB: every statement comes from reading the code. A statement marked
"by the code" is a conclusion that was not run. The line numbers are those of `a862772f`; WPAgent may have changed
since, so check a line before you rely on it.

| File | What |
|---|---|
| [inventory-A.md](inventory-A.md) | The 53 commands of `WPTestingActions.py`, `WPProjectActions.py`, `WPLoginActions.py`, `WPDataBaseActions.py`, `WPCommandActions.py`; the validator and the orientation check (section 0); the state machine; `Initialize`; the log-in; the global state |
| [inventory-B.md](inventory-B.md) | Imaging, contacting, die grid, topography, map conversion, the sequencer and the built-in sequences (commands 1 to 18); the rules shared by them (section 0, gaps G1 to G7) |
| [inventory-B2.md](inventory-B2.md) | Commands 19 to 40 of part B; the sequencer in full (section A); the 25 files of `WPAgent/sequencer/` (section B) |
| [inventory-B3.md](inventory-B3.md) | The production script `ITS3TestAgent/its3_test_agent.py` (section C); the prober driver (section D); the Python packages and imports (section E) |
