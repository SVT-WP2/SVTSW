# WP tool: start here

The start page for anyone, person or AI agent, who works on a ticket of the WP tool: feature
[#405](https://github.com/SVT-WP2/SVTSW/issues/405) and its sub-issues. The tickets are written to be done one per
session, by somebody who has not seen the discussion behind them. This page and [progress.md](progress.md) carry what
one session must pass to the next.

## Read, in this order

1. **The ticket.** It names what to read for it, what to build, the tests, and when it is done.
2. **This page**, then **[progress.md](progress.md)**: what earlier tickets did differently from their text, what they
   found, and what was learned on the machine. It wins over a ticket where they differ, because it is newer.
3. **The plan**: [2026-11-wp-tool-phase-1](../../decisions/2026-11-wp-tool-phase-1.md). Above all the decisions D1 to
   D22 that the ticket names, and the tables "Commands" and "Behaviour that changes on purpose".
4. **The tool contract**: [tool-contract.md](../tool-contract.md).
5. **The command inventory**: [wpagent-command-inventory/](../wpagent-command-inventory/README.md), the sections that the
   ticket names. Its line numbers are those of `master` at `a862772f`.
6. **The code** the ticket names, and the code of the earlier tickets.

For the why behind the design (who owns which state, how the tool fits under the new WP agent), read
[2026-11-wp-state](../../decisions/2026-11-wp-state.md). The tickets do not need it, but it explains D10.

## The tickets

| # | Ticket | Goes into | Needs |
|---|---|---|---|
| [#406](https://github.com/SVT-WP2/SVTSW/issues/406) | S1: Shared :: WP Core :: SENTIO Driver and Die Maps | `master` | the docs pull request |
| [#407](https://github.com/SVT-WP2/SVTSW/issues/407) | T1: WP Tool :: CLI :: Package, Modes and Engine | `405-wp-tool` | docs, #406 |
| [#408](https://github.com/SVT-WP2/SVTSW/issues/408) | T2: WP Tool :: CLI :: Driver, Simulator and Connection | `405-wp-tool` | #407 |
| [#409](https://github.com/SVT-WP2/SVTSW/issues/409) | T3: WP Tool :: CLI :: Project, Alignment, Die and Contact | `405-wp-tool` | #408 |
| [#410](https://github.com/SVT-WP2/SVTSW/issues/410) | T4: WP Tool :: CLI :: XY Moves and Production Flows | `405-wp-tool` | #409 |
| [#411](https://github.com/SVT-WP2/SVTSW/issues/411) | T5: WP Tool :: Helpers :: Python Client | `405-wp-tool` | #410 |
| [#412](https://github.com/SVT-WP2/SVTSW/issues/412) | T6: ITS3 :: Use the WP Tool | `master`, after `405-wp-tool` is merged | #411, the run on WPMIT, the ITS3 owners |
| [#413](https://github.com/SVT-WP2/SVTSW/issues/413) | T7: WP Tool :: CLI :: Settings and Heights | `405-wp-tool` before its merge, else `master` | #410 |
| [#414](https://github.com/SVT-WP2/SVTSW/issues/414) | S2: WP :: Use the Shared Core | `master` | #406; only when the WPAgent owners agree |

The feature branch `405-wp-tool` is cut from `master` once the docs pull request and #406 are merged. It goes into
`master` in one pull request after #411 and the run on WPMIT (the plan, "Done when").

## Branches and pull requests

- One pull request per ticket. Branch name `<issue>-<short-name>`, for example `407-wp-tool-engine`, cut from the
  branch the table says.
- Title: `#<issue> :: <the ticket's title>`. Commit messages: `#<issue> :: <what the commit does>`, as in the rest of
  the repository. No AI attribution lines in commit messages.
- The pull request description says what was built, how it was tested (the commands and their result), and a section
  **Notes for later tickets**. Copy those notes into [progress.md](progress.md) in the same pull request.
- CI must be green on Linux and Windows before a review is asked.

## Rules for every ticket

These come from the plan; the decision is in brackets.

- **Side by side.** Nothing of `WPAgent/` changes, and the tool imports nothing from it (D1, D3). Only #414 changes
  WPAgent.
- **Stateless (D10).** The tool keeps only its connection (and the lock, D20). No command keeps a project, a height, a
  die, a wafer, or a machine fact for a later request. Every input is a parameter. A field added to `ToolState` is a
  design change: ask on the ticket first.
- **No DB, no Kafka, no users, no order checks** (D7, D8, D12).
- **Machine calls only through the driver layer** of #408, never through the SENTIO library object (D19). The engine,
  not the command, gives the machine back with `local_mode()` (D16). Every "moves" command gets the separation check
  (D11).
- **One computer drives one machine.** The lock of #408 refuses a second `wptool` on the same computer only; a tool on another computer, or a WPAgent listener, is not seen (D20).
- **Parameter names of the WPAgent code** where a command exists there (D13).
- **The repository is public.** No real machine address, host name, password, token or person's name in code, tests,
  logs, examples or pull requests. Use the example address `192.0.2.10` (a documentation address that is never
  routed).
- **Windows and Linux, Python 3.12** (D17). Tests run with no network and no prober, on the simulator of #408.
- **Plain English** in messages, docs and pull requests: short sentences, no jargon that the reader has to look up.

## How to run the checks

```
cd Shared/svt-wp-core
pip install -e ".[dev,sentio]"
python -m flake8
python -m pytest -q
```

```
cd WPTool
pip install -r requirements.txt
python -m flake8 wptool tests
python -m pytest tests -q
wptool describe
```

`WPTool/requirements.txt` installs the shared package from its folder; it is never installed by its name from PyPI
(D18).

## When the ticket and the code disagree

The tickets were written from the code of `master` at `a862772f`, and they can be wrong.

- A small mistake (a line number, a name, a test that cannot work as written): fix it in your work, and say what and
  why in the pull request and in [progress.md](progress.md).
- A rule that cannot hold, or a change of design (a new state, a new dependency, a change of a decision): stop and ask
  in a comment on the ticket.
- Never weaken a safety rule (the separation check, the contact check, giving the machine back, one tool per machine, a failed fact read that must not fail the command) to make a test pass.

## What only the machine can tell

Some values are known only from the real prober (WPMIT): the Z hints that SENTIO reports, the work area after each
move, whether SENTIO can report the open project. The simulator uses the best guess the plan gives, in one table each,
so that the run on WPMIT can correct them. Write every fact learned on the machine or from the SENTIO library into
[progress.md](progress.md), section "Facts".
