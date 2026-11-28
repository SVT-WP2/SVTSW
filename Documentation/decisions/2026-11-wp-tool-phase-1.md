# 2026-11: the WP tool, phase 1

**Decided 2026-11-28.** A stateless command-line tool for the wafer prober, `wptool`, built side by side with WPAgent. The feature is [#405](https://github.com/SVT-WP2/SVTSW/issues/405), with its tickets #406 to #414. Who works on a ticket starts at [Tools/wp-tool](../Tools/wp-tool/README.md). Why the tool keeps no state, and how it fits under the new WP agent: [2026-11-wp-state](2026-11-wp-state.md).

## Goal

A proof of concept of `wptool`: a command-line tool that runs WPAgent's commands directly on a wafer prober (SENTIO or a simulator), with no Kafka, no DB, no users and no order checks. Then helpers, so that a script that drives WPAgent over Kafka today can use the tool instead.

This is phase 1 of dividing WPAgent into a **tool** (the machine commands) and an **agent** (Kafka, users, sessions, permissions, DB lookups), as proposed in #390.

How it is built:

- The tool is a new program in a new folder, `WPTool/`, next to `WPAgent/`. WPAgent keeps running the production measurements and does not change.
- The tool takes over **only the commands that production uses**: the measurement flows written down in #404 and the commands of the production script `ITS3TestAgent/its3_test_agent.py`. A few more commands come with them when they are simple, need no DB, and #404 does not mark them as untested. Every other command stays in WPAgent for now. Step 2 moves them to the tool one by one, each when somebody needs it and can test it on the machine.
- The code that both programs need and that has no Kafka, DB, users or global state (the SENTIO driver, its interface, the die maps) is copied into a shared Python package, `Shared/svt-wp-core/`. WPAgent switches to it later, in a separate ticket with its owners (#414).
- **Every request is independent** (D10). The tool remembers nothing between requests except the open connection to the machine. What a command needs comes with the request, as parameters; what the machine knows, the tool asks the machine at that moment. Its config file holds only the machine and the log, and no DB ids. The agent of phase 2 reads the DB and sends the current values with each request.
- Phase 2 is a new agent with its own Kafka interface (new topic names, sessions), side by side with WPAgent, until WPAgent is removed.

## Why a new program

#390 proposed a second front end on WPAgent's command router. The analysis shows why the tool should not take over WPAgent's command code:

- Every command module imports the Kafka library through the logger (`WPAgent/utilities/WPAgentLogger.py`) and the cache. The commands cannot be imported without `confluent_kafka`.
- The command handlers mix the machine work with the agent's checks: the agent name, the log-in, the testing lock, the levels, the state machine, the DB data in one global object (`SvtWPAagentGlobalParameters`).
- The state lives in module-level singletons. Changing these modules in place would put the running measurements at risk.
- Several commands do not work as the Kafka contract and the help file say (the colleague who wrote #404 found the same, and marked the commands she could not test). Moving everything at once would move these problems too.

So the tool's commands are written new, with the WPAgent handler of each command as the reference for which machine calls run in which order.

## Analysis

The command inventory of WPAgent at `master` `a862772f` is in `Documentation/Tools/wpagent-command-inventory/` (added with this plan). For each of the 93 commands of `COMMAND_ROUTER` it lists, with file and line: parameters, checks, every DB call, Kafka-specific behaviour, global state, prober calls in order, files, duration, reply, and what stops it without DB and Kafka. It also describes the validation path, the state machine, `Initialize`, the log-in, the sequencer, the ITS3 script, the prober drivers and the Python imports. Step 2 starts from it.

| Fact | Number |
|---|---|
| Commands in `COMMAND_ROUTER` | 93 |
| Commands that the eight flows of #404 use (without the users) | 14: `Initialize`, `OpenProject`, `InitProbing`, `AlignWafer`, `FindHome`, `MoveChuckRowColumn`, `SetPTPA`, `RunPTPA`, `MoveChuckWide`, `MoveChuckTopRight`, `MoveChuckContact`, `MoveChuckSeparation`, `MoveChuckOffAxis`, `MoveChuckHome` |
| Commands that the ITS3 script sends (without the users) | 15: `OpenProject`, `MoveChuckOffAxis`, `MoveChuckCenter`, `AutoFocus`, `AlignWafer`, `FindHome`, `MoveChuckSeparation`, `MoveChuckRowColumn`, `SetPTPA`, `RunPTPA`, `MoveChuckWide`, `MoveChuckXY`, `MoveChuckXYPrecise`, `MoveChuckContact`, `MoveChuckHome` (inventory B3, C.3.4). It also sends `UserLogIn`, `ResetAgent`, `UserLogOut`, and never `Initialize`: somebody else must initialize WPAgent before it runs. |
| Both together | 18 machine commands |
| Commands that read the DB | 7, of them 2 in the flows that need it: `Initialize` (the machine record, the wafer and the probe card) and `InitProbing` (the ASIC family of the project, which selects the project to align with). `OpenProject` also reads the project id and goes on without it; the tool drops that read. |
| Commands that #404 marks as not tested | 17 (red marks in `WPAgent/docs/WPAgentCommandsAndFlows.md` on the branch `404-wp-documantation`; an 18th red row, `ListOrientations`, is not a command of the code) |
| Commands that cannot succeed today | `RunSequencer` |
| Commands that fail on WPAgent's mock driver | among them `MoveChuckXYPrecise`, which the ITS3 script uses |

## Decisions

All tickets of this plan follow these. A ticket that needs to differ says so and changes this table.

| # | Decision | Reason |
|---|---|---|
| D1 | The tool is a new Python package in the new top-level folder `WPTool/`: package `wptool`, command `wptool`. It imports nothing from `WPAgent/`. | Side by side with WPAgent, which keeps running production. |
| D2 | `Shared/svt-wp-core/` (import name `svt_wp_core`) holds code **copied from WPAgent** that both programs need: the prober interface, the SENTIO driver, the die maps and their two map files (#406). New code of the tool (the simulator, the precise move, the commands) lives in `WPTool/`; it moves to the shared package only when a second program needs it. `Shared/` held TypeScript only until now (`Documentation/decisions/2026-11-repository-layout.md`); #406 keeps the pipelines of the UI and the DB agent from reacting to the Python package. | One copy of the driver code for both programs, without touching WPAgent in phase 1. |
| D3 | WPAgent does not change in phase 1. #414 switches it to the shared package later, with no change of behaviour, when its owners agree. The tool does not wait for #414. | Nothing that works today may break. |
| D4 | The commands of the tool are written new. The WPAgent handler of each command is the reference for the machine calls and their order; its inventory section lists them. | The handlers mix the machine work with the agent's checks and globals. |
| D5 | **Scope of step 1:** the commands that production uses (the flows of #404 and the ITS3 script), the queries that the tool needs anyway, and the commands that are simple, need no DB and are listed in #404 without the red mark of "not tested" (the table "Commands"). Every other command is **step 2**: it stays in WPAgent, and the tool answers 404 with a text that says so. Step 2 moves a command when somebody needs it in the tool and can test it on the machine; each gets its own ticket. | Small, tested steps. Some commands of WPAgent are not known to work. |
| D6 | The tool follows the tool contract 0.1: the modes `shell`, `run <file>`, `serve`, `describe`, the options `--config` and `--mock`, JSON lines in `serve`. The docs pull request of this plan adds the contract to the repo: `Documentation/Tools/tool-contract.md`. In step 1, `run <file>` runs a plain list of commands, one request each, and stops at the first error; loops and conditions (WPAgent's YAML sequencer) are step 2. A fifth mode, `call`, runs one command and ends: `wptool call <Command> key=value ...` connects to the machine of the config, runs the command, gives the machine back and prints the reply as one JSON line. The contract 0.1 has no such mode; the docs pull request adds it to the contract page. Because every request is independent (D10), the five modes give the same result for the same request; `shell`, `run` and `serve` only keep the connection open between requests. | One interface for every tool; the agent of phase 2 talks to the tool through `serve`; a script in any language can use `call`. |
| D7 | No users, roles, log-in, testing lock or agent name, and every command is available. Each command declares its level (`User`, `Expert`, `Developer`, from `WPAgent/utilities/WPCommandConstants.py`) only in `describe`. Permissions are the agent's job (phase 2). | The log-in protects nothing today (#390). |
| D8 | No order checks and no flow state machine: a command runs in any order. The order of a process belongs to whoever runs it (a script, the supervisor, the agent). The tool reports what the machine says after every command. | A check that anybody can switch off protects nothing; today everybody switches it off with a Developer log-in. |
| D9 | **No wafer in the tool.** The tool does not know or care whether a wafer is loaded. Loading and unloading are done outside the tool, through the UI. There are no wafer commands in the tool, and no wafer or probe card in its state. | Decided with the plan. |
| D10 | **Every request is independent.** What a command does depends only on its parameters and on what the machine says at that moment, never on what the tool remembers from earlier requests. The only state of the tool is the open connection to the machine (and the lock that goes with it, D20): a channel, not knowledge. The tool does not cache or watch the machine (it asks SENTIO when it needs a fact), and it does not cache, watch or update DB data (the caller sends the current values with the request that needs them). Every input is a parameter of its command. The config file holds only `machine` (the default for `Initialize`) and `log`. The tool takes no context parts; a request's `context` is accepted and ignored. See "Who is responsible for what". | A cached or watched copy of the DB needs Kafka or the DB, and drifts from the truth: WPAgent copies the orientations at `Initialize` and does not see a later change in the UI. A copy of the machine state drifts the same way when somebody uses SENTIO's own screen. |
| D11 | Four checks, and nothing switches them off: the **parameter check** (types, required, allowed values: 400); the **orientation check** of a command that opens a project (`OpenProject`, `InitProbing`), when the request gives the wafer and the probe card orientations: the project name must fit them (400). It checks only what the request carries; that the mounted wafer and card fit the project is the agent's rule, with the DB values of that moment. The **separation check**: before every command that moves or may move the chuck (marked "moves" in "Commands"), the tool asks SENTIO where the chuck is and refuses with 409 unless SENTIO reports `In Separation` (in any work area), or `In Default` while the work area is the off-axis area (`OffAxisCamera`). `In Default` is what WPMIT reports in the off-axis area, where the probes cannot touch the wafer; in another area it could mean any height. The allowed pairs (Z hint, work area) are one constant. The run on WPMIT ("Done when") confirms them and records the hint and the area after every step, also after `MoveChuckHome` (the start of the next run); #413 records them after its own moves before a flow uses them; a pair is added only from such a run. An error answer of the query is 503. The **contact check**: `MoveChuckContact` runs only in the probing area (`Probing`, the area after `MoveChuckWide`), else 409. | They look at facts, not at a remembered flow. An XY move at contact drags the needles over the wafer; a contact in the off-axis area is never meant. |
| D12 | The tool never writes the DB and never reads it. What a command did, and what the machine says after it, is in the `data` of its reply. | Tool contract, "Data from outside". |
| D13 | Parameter names: the names that the WPAgent code accepts today, which the ITS3 script and the flows use. Where the Kafka contract or the help file differ, they are wrong for the tool. The keys `user` and `waferAgentName` are accepted and ignored. | Existing scripts must run unchanged. |
| D14 | Replies and events follow the tool contract: `{id, status: "Success" | "Error", data | error: {code, message}}`. The success text of WPAgent (today in `error.message`) is `data.message`. | Tool contract. |
| D15 | Error codes: 400 parameter or orientation; 404 unknown command, a step-2 command or a dropped command; 409 the separation check, the contact check, a label move whose project is not the one SENTIO has open (#409), or a machine that another `wptool` uses; 500 failed on the machine or in the tool; 503 not connected, machine not reachable, or no answer to the position query. A failed command does not block the tool: the next command runs. | Tool contract. |
| D16 | The machine is given back after every request: when a request touched the machine (a command, or a check that queried it), `local_mode()` is its last call, whatever its result. Each step of `run` is a request. `Disconnect`, `Shutdown`, the end of `run`, the end of the input in `serve`, Ctrl+C and the signals SIGTERM and SIGHUP (SIGBREAK on Windows) also close the connection. | Tool contract rule 6. Any command puts SENTIO into remote mode until `*LOCAL`. |
| D17 | The tool runs on Windows (on or next to the SENTIO computer) and on Linux (next to the test scripts), with Python 3.12, wherever the TCP port of SENTIO can be reached. CI tests both. | The bench computers run Windows; the ITS3 script and WPAgent run on Linux. |
| D18 | Packages: the shared package with its extra `sentio` (`sentio-prober-control==24.4.0`), and `PyYAML`. No image packages in step 1. The shared package is installed only from its folder in the repository, never by name. | The repository is public: anybody could publish a package with that name on PyPI. |
| D19 | The tool runs on a **simulator** of the prober in tests and with `--mock`: a new module of `WPTool/` that follows the SENTIO semantics. WPAgent's mock (`WPMockProber`) stays as it is. No command calls the SENTIO library object directly; it calls a method of the driver layer. | Today the precise move calls `prober.prober` and fails on the mock, which also treats relative moves as absolute. |
| D20 | While the tool uses a machine, no WPAgent listener of that machine runs: neither the production service nor a DEV listener (WPMIT has both: `WPAgent/README.md` lines 224, 497, 502), and no second `wptool` uses it. The tool itself refuses a second `wptool` on the same machine from the same computer (#408, a lock); it cannot see a tool on another computer, nor WPAgent without Kafka. The ITS3 switch (#412) checks the WPAgent heartbeats before it starts the tool. **The README says in bold: one computer drives one machine.** | Two programs that drive one machine are unsafe. Even when it is not initialized, WPAgent's connection watch opens a TCP connection to SENTIO every 5 seconds (`WPAgent/services/WPProberConnectionWatch.py` lines 8-9, 38). |
| D21 | **Helpers:** a Python client that starts `wptool serve` and talks to it (#411), and on top of it a client with the shape of WPAgent's Kafka replies, so that a script that drives WPAgent over Kafka switches with a few lines. The ITS3 script gets a switch, `wp_transport` (`kafka` by default), in its own ticket with its owners (#412). | Production keeps running on Kafka until the owners switch, run by run. |
| D22 | Phase 2, the new agent, gets its own Kafka interface: new topic names and messages, with the session concept of #391. It starts the tool in `serve` mode. Nothing of it is in phase 1. | The old agent and its clients keep working until they are switched off. |

## Who is responsible for what

| Layer | Owns | Examples |
|---|---|---|
| SENTIO | the physical state | chuck position and Z height, work area, open project, alignment, PTPA setting, die position |
| `wptool` | how to do one thing on the machine safely | the machine calls of a command in their order, the parameter check, the separation check (asks SENTIO live), the orientation check of what the request carries, giving the machine back, one tool per machine |
| The agent (phase 2) | what is allowed, and with which data | users, sessions and the lock (#391), permissions, the DB lookups (machine address, the project to align with, the die of an ASIC, the mounted wafer and probe card), the rules across requests ("does this project fit the mounted wafer and card"), recording the results. It is on Kafka, so it can watch the DB. |
| The UI, the supervisor, a script | the process | the order of the steps, the loop over the dies |

At a bench without the agent, the script or the person is the agent: it sends the values with each request.

## What the tool keeps and reports

- **Kept:** only the connection: connected to a machine or not, the machine's address and port, and the lock (D20). It is the `status` event, sent when it changes (connect, disconnect).
- **Reported, never kept:** the machine facts, read from SENTIO after every machine command (except `Disconnect`, `GetChuckPosition` and `GetChuckXY`) and put into the `data` of its reply as `facts`: the chuck position hint (`In Contact`, `In Separation`, ...), the absolute chuck position X, Y, Z in µm, the work area and camera, the die position and the number of dies, and the open project when SENTIO can report it (#409 checks). The agent of phase 2 keeps the last facts as its live view and shows them in the UI (`Documentation/decisions/2026-11-wp-state.md`). `ShowStatus` reads them live when connected. A failed read of a fact is `null` with its text in `facts.errors`, and never changes the status of the reply. An `Error` reply carries no facts (tool contract): a host that keeps a view sends `ShowStatus` after an `Error` reply, for example after a precise move that missed its target but has moved the chuck.
- **Not kept** (D10): the open project, its contact height, the overtravel, the die, a wafer or a probe card (D9). No flow state and no `Error` state: a failed command answers with its error, the machine is given back, and the next command runs.

## Production flows

The measurement flows that the team runs today, written down in #404 (`WPAgent/docs/WPAgentCommandsAndFlows.md` on the branch `404-wp-documantation`). The tool must run each of them, from `Initialize` to `Disconnect` (the tool's end of a flow, in place of `UserLogOut`). #410 tests all eight on the simulator and ships them as script files for `run`.

| Flow | Commands (`[…]` repeats for each die) |
|---|---|
| ER2-BAM, PTPA | `Initialize`, `OpenProject` (ER2 babyMOSAIX), `InitProbing`, [`MoveChuckRowColumn`, `SetPTPA enable=true` (optional), `RunPTPA`, `MoveChuckWide`, `MoveChuckContact`, tests, `MoveChuckSeparation`], `MoveChuckOffAxis`, `MoveChuckHome`, `Disconnect` |
| ER2-SEG (MOSAIX), PTPA | the same with the ER2 MOSAIX project (`InitProbing` switches to the babyMOSAIX project to align, then back) |
| ER2B-BAM, PTPA | `Initialize`, `OpenProject` (ER2B babyMOSAIX), `AlignWafer align_die_col=-1 align_die_row=1`, `FindHome`, then the die loop and the end as ER2-BAM |
| ER2-thinned, PTPA | `Initialize`, `OpenProject` (the thinned SEG project), `MoveChuckOffAxis`, `InitProbing`, then the die loop and the end as ER2-BAM |
| each of the four, "+ TopRight" | the same, with `MoveChuckTopRight` between `MoveChuckWide` and `MoveChuckContact` |

#404 says "Next die: repeat from step 5" in every flow. In the ER2-BAM and ER2-SEG flows step 5 is `MoveChuckRowColumn`; in the ER2B flows it is `FindHome`, and in the thinned flows `InitProbing`. The plan reads all of them as a loop from `MoveChuckRowColumn` (the step number looks copied from the first flow). To be confirmed with the author of #404; the flow files of #410 say so in their comment. A hint for the question: the ITS3 script runs `FindHome` before every die (`its3_test_agent.py` line 845), so "from step 5" may be meant literally for ER2B, where step 5 is `FindHome`.

## The ITS3 script

`ITS3TestAgent/its3_test_agent.py` drives WPAgent over Kafka through its class `WPAgentClient` (inventory B3, section C). Its order of commands, without the users:

- Init (lines 497-587): `OpenProject` (BAM), `MoveChuckOffAxis`, `MoveChuckCenter`, `AutoFocus`, `AlignWafer`, `FindHome`. For a thinned run only `OpenProject` (SEG) and `MoveChuckOffAxis`.
- When the chip type changes (lines 914-943, 1040-1055; the default config does it at the first chip): `MoveChuckSeparation`, `MoveChuckOffAxis`, `OpenProject`, `MoveChuckCenter`, `AutoFocus`, `FindHome`.
- Per chip: `MoveChuckSeparation`, `MoveChuckOffAxis`, `OpenProject`, `FindHome`, `MoveChuckRowColumn`, `SetPTPA` (optional), `RunPTPA` (optional), `MoveChuckWide`, `MoveChuckXY` (15, 0, Relative), `MoveChuckXYPrecise` (only for some dies), `MoveChuckContact`.
- Every `MoveChuckOffAxis` of the script first undoes a pending precise offset: `MoveChuckSeparation`, `MoveChuckXYPrecise` back (lines 255-261, 301-317).
- At the end: `MoveChuckSeparation`, `MoveChuckOffAxis`, `MoveChuckHome`.

Through the tool (#411, #412):

- The script starts the tool itself (`wptool serve`, a separate program), on the same computer. The tool reaches SENTIO over TCP, as WPAgent does.
- The tool's client sends `Initialize` first. Today the script never sends it and needs a WPAgent that somebody else initialized.
- `UserLogIn`, `UserLogOut` and `ResetAgent` are answered `Success` by the client without going to the tool: the tool has no users and no `Error` state to reset.
- The replies keep the shape that the script reads (`status` `Success` or not, and the whole reply logged on a failure).
- The script sends `MoveChuckRowColumn` with `col` and `row` and never `InitProbing`, so it needs none of the new parameters. For the orientation check, the ITS3 config gets two optional keys with the mounted orientations, which the switch adds to every `OpenProject` (#412); without them the projects open unchecked.
- The script's own logic (the pending precise offset, the project type, what to skip on which failure) does not change.
- The tool runs in its own process group: Ctrl+C reaches only the script, whose cleanup still runs through the tool; the tool ends after it.

## Config file (`--config`)

YAML or JSON. Both keys are optional.

```yaml
machine:                    # the default of Initialize (and of the mode call): where SENTIO listens
  address: 192.0.2.10       # an example address; never commit a real one
  port: 35555
log: wptool.log
```

- Everything else is a parameter of the command that needs it (D10). For example the project to align with: WPAgent finds it through "project → ASIC family from the DB → `WPAgent/configs/WPInitProbingConfig.json`"; the tool gets it as `InitProbing alignmentProject=...`, and the caller (the agent, a script, the flow file) knows it. For the ER2 projects of today it is `ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW`, for the BAM and the MOSAIX projects alike.
- `--mock` makes the machine a simulator; `machine.address` is then not used.
- A wrong config stops the tool at start with a message that names the key (exit code 2).

## Commands

What happens to each of the 93 commands of `COMMAND_ROUTER`. "Write new" means: a new command of the tool that does what the WPAgent handler does with the machine (the same calls in the same order), without the agent's checks (D4).

"Machine" means the command needs a connection (503 without one); "offline" means it does not. "Moves" marks a command that moves or may move the chuck: the separation check (D11) runs before it. `OpenProject` counts as a move, because SENTIO restores the heights of the project; `AutoFocus`, `SetPTPA`, `SetChuckOvertravel` and `DisableOvertravel` too, because it is not known that they never move the chuck. The flows and the ITS3 script send `SetPTPA` only at separation, after `MoveChuckRowColumn`.

`changesMachine` in `describe` (tool contract): false for `ShowStatus`, `GetChuckPosition`, `GetChuckXY` and every offline command; true for every other machine command.

### Frame (T1)

| Command | Uses | Decision |
|---|---|---|
| `ShowStatus` | offline | Write new: the connection, and when connected the machine facts, read live. |
| `Shutdown` | — | **New** (tool contract): gives the machine back, replies, ends the tool. |

### Connection (T2)

| Command | Uses | Decision |
|---|---|---|
| `Initialize` | machine | Parameters `address` and `port` (defaults from the config `machine`; the machine has no name in the tool) and `force`, instead of the DB record. TCP check of the address (2 s), connect, read the machine facts, `local_mode()`. No wafer, no probe card (D9). `force=true` also covers WPAgent's `ReconnectProber`. |
| `Disconnect` | machine | **New**: `local_mode()`, close the connection. The tool keeps running. |
| `LocalMode` | machine | Write new. |

### Project, alignment, die and contact (T3)

| Command | Uses | Flows | ITS3 | Decision |
|---|---|---|---|---|
| `OpenProject` | machine, moves | yes | yes | Write new. Optional `waferOrientation`, `probeCardOrientation`: when the request gives both, the orientation check (D11). No DB: no project id. The tool does not remember the project. |
| `InitProbing` | machine | yes | no | Write new, independent of earlier requests (D10): `projectName` (the project of the measurement) and `alignmentProject` (the project to align with) are required parameters; the alignment die is `align_die_col`, `align_die_row`, default WPAgent's (-1, 1); optional orientations as `OpenProject`. It goes to separation, opens the project of the measurement (so that the off-axis move, the centering and the focus use its heights, as in WPAgent), opens the alignment project when it differs, aligns, opens the project of the measurement again, and finds home. No DB, no ASIC family. Its first call is `go_to_separation()`, so no separation check. |
| `AlignWafer` | machine, moves | ER2B | yes | Write new. |
| `FindHome` | machine, moves | ER2B | yes | Write new. |
| `MoveChuckCenter` | machine, moves | no | yes | Write new. |
| `AutoFocus` | machine, moves | no | yes | Write new. |
| `MoveChuckOffAxis` | machine, moves | yes | yes | Write new. |
| `MoveChuckRowColumn` | machine, moves | yes | yes | Write new, with `col`/`row`, or with `label` and `projectName` (the shared die maps choose the map by the project's wafer type; the tool does not remember the open project). The precise mode is step 2. |
| `SetPTPA` | machine, moves | yes | yes | Write new. |
| `RunPTPA` | machine, moves | yes | yes | Write new. |
| `MoveChuckWide` | machine, moves | yes | yes | Write new. |
| `MoveChuckContact`, `MoveChuckSeparation` | machine | yes | yes | Write new. They move in Z on purpose: no separation check. `MoveChuckContact` gets the contact check (D11). |
| `MoveChuckHome` | machine, moves | yes | yes | Write new. |
| `GetChuckPosition` | machine | — | — | Write new. A query; the separation check uses the same driver call. |

### XY moves (T4)

| Command | Uses | Flows | ITS3 | Decision |
|---|---|---|---|---|
| `MoveChuckXY` | machine, moves | no | yes | Write new. `x`, `y`, `position` (`Zero`, `Relative`, `Center`) all required: the schema of WPAgent, which WPAgent itself never applies. |
| `MoveChuckXYPrecise` | machine, moves | no | yes | Write new: the closed-loop move of WPAgent, as a function of `WPTool/` on the driver layer, so that it works on the simulator. |
| `MoveChuckTopRight` | machine, moves | yes | no | Write new. The fixed offsets of WPAgent. |
| `MoveChuckTopLeft`, `MoveChuckBottomLeft`, `MoveChuckBottomRight` | machine, moves | no | no | Write new, with `MoveChuckTopRight`: the same code with other signs, tested in #404. |
| `GetChuckXY` | machine | — | — | Write new, through the driver layer. The precise move uses the same call. |

### Settings and heights (T7)

Not used by the flows or the ITS3 script; simple, no DB, tested in #404.

| Command | Uses | Decision |
|---|---|---|
| `MoveChuckZ` | machine, moves | Write new. |
| `MoveChuckSafePosition` | machine, moves | Write new. WPAgent's fixed position, no parameters. |
| `SetContactHeight` | machine | Write new. `contactHeight` required: the tool does not remember the height that an earlier `OpenProject` read. |
| `SetChuckOvertravel` | machine, moves | Write new. `overtravelGap` required (the `overdrive` of the Kafka contract is wrong). |
| `DisableOvertravel` | machine, moves | Write new: the gap 0 and overtravel on, as WPAgent does it. WPAgent's optional `overtravelGap` only fills its global, so the tool has no such parameter. |

### Step 2: not in the tool yet

The tool answers 404 `<command> is not in the WP tool yet: use WPAgent (step 2 of the WP tool plan).` Each moves to the tool in its own ticket, when somebody needs it there and can test it on the machine.

| Commands | Why not in step 1 |
|---|---|
| `LoadWafer`, `UnloadWafer`, `MoveChuckLoadedWafer`, `MoveChuckUnloadWafer`, `UpdateLoadedWafer`, `UpdateInstalledProbeCard` | Loading is done through the UI (D9). If a command to move the wafer to the load position is needed later, it comes without the DB and without a wafer state. |
| `MoveChuckAsic` | It needs the ASIC record of the DB. `MoveChuckRowColumn label=...` does the same move with the die label. |
| `MoveChuckNextDie`, `MoveChuckPreviousDie`, `MoveChuckToWorkArea`, `SwitchCamera`, `TakeScreenshot`, `StressOpenProject` | Not used by production; marked as not tested in #404. |
| `ChangeProject`, `ReconnectProber` | Not used; `OpenProject` and `Initialize force=true` do the same. |
| `GetDieSize`, the precise mode of `MoveChuckRowColumn` | Not used; they need the contacting store and the die grid files. |
| `RunSequencerYAML`, `RunSequencer` | The sequencer. `RunSequencer` cannot succeed today. `run <file>` covers plain lists. |
| `Sleep` | Only WPAgent's YAML sequences use it, to let the chuck settle before an image (`seconds: $rs.settle` in `TakeImageBAM.yaml` and its siblings). It comes with the sequencer. A script that uses the client waits itself. |
| `TakeImage`, `ComputeCouplingConstants`, `BuildFlatfield`, `StitchImagesFull`, `CropImage`, `CleanupRasterImages`, `GenerateRasterSteps`, `ArchiveImaging`, `DeleteImagingFolder`, and the 12 imaging sequences (`TakeImageWaferER2`, `TakeImageBAM`, `TakeImageSEG`, `TakeImageLEC`, `TakeImageL2`, `TakeImageL1_0-3`, `TakeImageL1_1-4`, `TakeImageL0_0-2`, `TakeImageL0_1-3`, `TakeImageL0_2-4`, `BrightnessCorrection`, `TakeImageLECDie`) | Imaging: the image packages, the sequencer, file paths of the server. |
| `SaveChuckPosition`, `MoveChuckToSavedPosition`, `MoveChuckBySavedOffset`, `MeasureLECTopographyDie`, `AnalyzeNeedleMarks`, `ComputePadTargetOffset`, `ComputeTopographyCorrection`, `GetDieList`, and the 4 sequences `NeedleOffsetMeasureER2B`, `MoveToPadTarget`, `LECTopographyER2`, `LECTopographyER2B` | Contacting, needle marks and topography: the stores, the sequencer. |

### Not in the tool

| Command | Why |
|---|---|
| `UserLogIn`, `UserLogOut` | Users belong to the agent (phase 2). |
| `TestingLock`, `TestingUnlock` | The lock belongs to the agent (#391). |
| `ResetAgent` | The tool has no agent state to reset: after a failure the next command just runs. |
| `ListProbers` | A list of the DB. The tool knows one machine (`ShowStatus`). |
| `ListChipTypes` | A stub in WPAgent. |
| `GetInfo`, `GetAgentState` | `ShowStatus` has the same. |
| `Help`, `ListAvailableCommands` | `describe`, and `help` in the shell. |

The tool answers 404 with a text that says where it went.

Count: 30 commands of WPAgent in the tool (3 in T1 and T2, 15 in T3, 7 in T4, 5 in T7), plus the new `Shutdown` and `Disconnect`: 32. 52 commands of WPAgent wait for step 2, 11 are dropped: 93.

## Parameter names that differ

The tool takes the names of the code (D13). For the commands of step 1, the Kafka contract (`Documentation/Kafka/svt.wp-agent.kafka.yaml`) and the help file (`WPAgent/utilities/WPCommandsHelpList.json`) differ here:

| Command | Tool = WPAgent code | Kafka contract | Help file |
|---|---|---|---|
| `MoveChuckXY` | `x`, `y`, `position` | `x`, `y` | `x`, `y` |
| `SetChuckOvertravel` | `overtravelGap` | `overdrive` | no entry |
| `OpenProject` | `projectName` | `projectName` | `project_path` (its example uses `projectName`) |
| `AlignWafer` | `align_die_col`, `align_die_row`, `subsite` | none | the same as the code |

New parameters of the tool, because it remembers nothing (D10): `Initialize` `address`, `port`; `OpenProject` `waferOrientation`, `probeCardOrientation`; `InitProbing` `projectName`, `alignmentProject`, `align_die_col`, `align_die_row` (the names of `AlignWafer`), `waferOrientation`, `probeCardOrientation`; `MoveChuckRowColumn` `projectName` (with `label`). Changed: `SetContactHeight` `contactHeight` is required; `DisableOvertravel` has no `overtravelGap`.

## Behaviour that changes on purpose

| # | WPAgent today | The tool |
|---|---|---|
| 1 | A missing or unknown parameter is a `TypeError`: 500 and the `Error` state. | 400. |
| 2 | The schema of `MoveChuckXY` is never applied (it is validated under the name `MoveChuckXy`). | It is applied: `x`, `y`, `position` required. |
| 3 | The orientation check runs before 14 commands with the wafer and probe card orientations that `Initialize` copied from the DB (a later change in the UI is not seen); without them it refuses with 400. | A check of the orientations that the request carries, in the commands that open a project (`OpenProject`, `InitProbing`). Without them the project opens, and the reply says that the orientation was not checked. The rule with the DB values is the agent's. |
| 4 | `InitProbing` needs an earlier `OpenProject`, reads the ASIC family of the project from the DB and maps it to the alignment project with a file; the alignment die is fixed in the code. | The project, the alignment project and the die are parameters; `InitProbing` opens the project itself before it moves, then the alignment project when it differs. |
| 5 | `Initialize` reads the machine, the wafer and the probe card from the DB, sends no command of its own to SENTIO and no `local_mode()`. The connection is closed only when the listener stops. | The machine is a parameter or the config. `Initialize` ends with `local_mode()`. `Disconnect`, `Shutdown`, the end of the tool and the signals close the connection. |
| 6 | The mock treats `Relative` moves as absolute and has no precise move. | The simulator follows the SENTIO driver (D19). |
| 7 | An exception puts the agent into `Error`, which refuses every command except `ResetAgent` and `ReconnectProber`. | No `Error` state: the failed command answers with its error; the next command runs. |
| 8 | Printed emoji raise `UnicodeEncodeError` when the output of WPAgent goes to a pipe on Windows. | The tool writes UTF-8 to its outputs. |
| 9 | The order of the commands is checked by a state machine, unless a Developer is logged in (then nothing is checked, also not at contact). The ITS3 script logs in as a Developer. | No order checks (D8). Before every chuck move the tool asks the machine and refuses unless the chuck is in separation (D11), whoever runs it. An ITS3 run that starts with the chuck at contact now stops at its first move. |
| 10 | `local_mode()` comes after most commands, but not after the precise move; some commands query SENTIO after it, which puts SENTIO back into remote mode. | `local_mode()` is the last call of every request that touched the machine, whatever its result (D16). |
| 11 | WPAgent knows whether a wafer is loaded and refuses some commands without one. | The tool knows nothing about the wafer (D9). |
| 12 | WPAgent remembers the open project, its contact height, the overtravel and the die, and puts them into every reply. | The tool remembers nothing but the connection (D10). Every machine reply has the machine facts that SENTIO reports after the command (`data.facts`); a value that a command needs comes as a parameter. |

## Tickets and order

Each ticket is one pull request. The feature branch of this plan, `405-wp-tool`, is cut from the branch of the docs pull request (`405-wp-tool-docs`), so it has these pages. #406 and the tool tickets #407 to #411 go into it, in a line: each builds on the one before. The feature branch goes into `master` in one pull request after #411 and the run on WPMIT ("Done when"), once the users-and-roles branches and the docs pull request are in `master`. #412 is cut from `master` after that and goes into `master`; #413 goes into the feature branch when it is ready before that merge, else into `master`. #414 needs #406 in `master`, because WPAgent runs from `master`.

| # | Ticket | Adds | Needs |
|---|---|---|---|
| — | Docs pull request (no ticket) | `Documentation/decisions/2026-11-wp-tool-phase-1.md` (this plan) and its row in `Documentation/decisions/README.md`, a line at the top of `Documentation/decisions/2026-11-repository-layout.md` that points to it (`Shared/` now also holds a Python package), `Documentation/decisions/2026-11-wp-state.md` and its row, `Documentation/Tools/README.md`, `Documentation/Tools/tool-contract.md`, `Documentation/Tools/wpagent-command-inventory/`, `Documentation/Tools/wp-tool/README.md` (the start page for every ticket) and `Documentation/Tools/wp-tool/progress.md` (the notes between tickets), a row in `Documentation/README.md` | — |
| S1 | Shared :: WP Core :: SENTIO Driver and Die Maps | `Shared/svt-wp-core/`: the prober interface, the SENTIO driver and the die maps, copied; tests; a twin test; CI; the pipelines of the UI and the DB agent narrowed to `Shared/svt-ts-types` | the docs branch (the first pull request into `405-wp-tool`) |
| T1 | WP Tool :: CLI :: Package, Modes and Engine | `WPTool/`: package, `shell`, `run`, `serve`, `describe`, `call`, engine, registry, config, events, CI; `ShowStatus`, `Shutdown` | S1 |
| T2 | WP Tool :: CLI :: Driver, Simulator and Connection | the driver layer on the shared SENTIO driver, the simulator, `Initialize`, `Disconnect`, `LocalMode`, the separation check, giving the machine back | S1, T1 |
| T3 | WP Tool :: CLI :: Project, Alignment, Die and Contact | 15 commands, the orientation check | T2 |
| T4 | WP Tool :: CLI :: XY Moves and Production Flows | 7 commands, the precise move, the tests of the eight flows and of the ITS3 order, the flow script files | T3 |
| T5 | WP Tool :: Helpers :: Python Client | `wptool.client` (starts and drives `wptool serve`) and `wptool.compat` (replies in the shape of WPAgent's Kafka replies) | T4 |
| T6 | ITS3 :: Use the WP Tool | a switch `wp_transport` in the ITS3 script (`kafka` by default), with its owners | T5 and the run on WPMIT, in `master` |
| T7 | WP Tool :: CLI :: Settings and Heights | 5 commands | T4 (can run beside T5 and T6) |
| S2 | WP :: Use the Shared Core | WPAgent's copies of the three shared modules become aliases of them; no change of behaviour; with the WPAgent owners | S1; not needed by the tool, so it waits until the owners agree |

The proof of concept is T1 to T5 and the run on WPMIT. T6 lets the ITS3 script use it.

## Done when

- [ ] `wptool describe` lists the 32 commands with their schema and level.
- [ ] Every command has a test on the simulator; the five modes share one engine, and each mode has its own tests. A test runs the same requests through `call`, `run` and `serve` and gets the same replies (D10).
- [ ] The eight production flows of #404 run with `wptool run` on the simulator.
- [ ] The command order of the ITS3 script (without the users) runs on the simulator through `wptool.compat`.
- [ ] CI is green on Linux and Windows for `WPTool/` and for `Shared/svt-wp-core/`.
- [ ] `WPTool/README.md` says how to install it (Windows and Linux), what the config has, how to use the five modes and the client, and rule D20.
- [ ] A person has run this on the real prober (WPMIT), after #410 and before #411 is merged, with every WPAgent listener of WPMIT stopped (the service and any DEV listener, D20), once from Windows and once from Linux, starting after a `MoveChuckHome`:
  - `Initialize`; if the first move is refused by the separation check, note the pair that SENTIO reports, send `MoveChuckSeparation`, and go on (the flow files and the ITS3 switch send `MoveChuckSeparation` first for this reason);
  - `MoveChuckSeparation`, `OpenProject` (with the orientations), `InitProbing`, `MoveChuckRowColumn`, `SetPTPA enable=true`, `RunPTPA`, `MoveChuckWide`, `MoveChuckContact`, then `MoveChuckXY` (must be refused by the separation check), `MoveChuckSeparation`, `MoveChuckOffAxis`, `MoveChuckHome`;
  - then the ITS3 order of "The ITS3 script": the init (`MoveChuckCenter`, `AutoFocus`, `AlignWafer`, `FindHome`), the project switch, one chip with `MoveChuckXY x=15 y=0 position=Relative` and `MoveChuckXYPrecise x=0 y=10 position=Relative`, the undo of that offset, the cleanup;
  - `MoveChuckContact` in the off-axis area: must be refused by the contact check;
  - `Disconnect`;
  - the ITS3 order gets no refusal;
  - noted what SENTIO reports for the Z hint and the work area after each step. The simulator and the allowed pairs of the separation check (D11) are corrected from it. The result is a comment on the plan ticket.
- [ ] One ITS3 run with `wp_transport: wptool` on WPMIT gives the same prober moves as a run over Kafka (#412).
- [ ] WPAgent works as before: no file of `WPAgent/` changed until #414.

## Step 2 and later

- The commands of "Step 2: not in the tool yet", one ticket each, when needed and testable.
- The sequencer (loops, conditions, the YAML files of WPAgent) and the built-in sequences.
- The new agent (phase 2): its own Kafka interface with new topic names, sessions, users and permissions, the DB lookups; it starts the tool in `serve` mode (D22).
- WPAgent on the shared package (#414), then more shared code when a second program needs it.
- Stopping a long command in the middle (tool contract: not decided).
- A Docker image of the tool.
- Corrections of the Kafka contract and the help file of WPAgent.
- Removing `WPAgent/`.
