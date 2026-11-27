# WPAgent commands and flow

Every command is sent as a Kafka message to `svt.wp-agent.request`:

```json
{ "type": "<Command>", "data": { "user": "<wp_user>", "waferAgentName": "<wp_agent_name>", ...parameters } }
```

 The reply comes back on `svt.wp-agent.request.reply` as `{ "status", "type": "<Command>Reply", "data": WpMachineStateDto, "error" }`. `its3.py` treats `status` = `Success` / `ok` as success. `WpMachineStateDto` is the agent and machine state: `WPAG_State`, user, opened project, loaded wafer, current die, `proberConnected`, `proberInitialized`.

## Part 1. Commands

| Command | Required parameters | Reply | What it does | Example |
|---|---|---|---|---|
| `Initialize` | `force` (bool, optional: initialize again when already initialized). Manual address fallback: not in the current WPAgent code, any other key gets error 400 | `InitializeReply` + machine state, or error 503 if the machine is off | The only way to connect the agent to the WP machine. The user sends it when the machine is needed; the address comes from the DB. | `python3.12 main.py send Initialize --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `UserLogIn` | none | `UserLogInReply` + machine state | Logs the user in. Needed before the other commands. | `python3.12 main.py send UserLogIn --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `UserLogOut` | none | `UserLogOutReply` + machine state | Logs the user out. The last command of the run. | `python3.12 main.py send UserLogOut --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `ResetAgent` | none | `ResetAgentReply` + machine state | Resets the agent state machine. Logs the user out, so `UserLogIn` must follow. | `python3.12 main.py send ResetAgent --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `OpenProject` | `projectName` (string) | `OpenProjectReply` + machine state | Opens the prober project for the chip type (BAM or SEG). | `python3.12 main.py send OpenProject --data='{"user":"user1","waferAgentName":"WPMIT_DEV","projectName":"<project_name>"}'` |
| `MoveChuckOffAxis` | none | `MoveChuckOffAxisReply` + machine state | Moves the chuck to the off-axis (camera) area, away from the probes. | `python3.12 main.py send MoveChuckOffAxis --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `MoveChuckCenter` | none | `MoveChuckCenterReply` + machine state | Moves the chuck to the wafer center. | `python3.12 main.py send MoveChuckCenter --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `AutoFocus` | none | `AutoFocusReply` + machine state | Auto-focuses the active camera. | `python3.12 main.py send AutoFocus --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `AlignWafer` | none in spec. The py file sends `align_die_col: -1`, `align_die_row: 1` | `AlignWaferReply` + machine state | Aligns the wafer. | `python3.12 main.py send AlignWafer --data='{"user":"user1","waferAgentName":"WPMIT_DEV","align_die_col":-1,"align_die_row":1}'` |
| `InitProbing` | none | `InitProbingReply` + machine state | Runs OffAxis, Center, AutoFocus, AlignWafer and FindHome in one command. Run after loading a wafer, before testing. | `python3.12 main.py send InitProbing --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `FindHome` | none | `FindHomeReply` + machine state, or error "Failed to find home position" | Finds the home die using vision, so row/column moves are correct. | `python3.12 main.py send FindHome --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `MoveChuckRowColumn` | **Either** `col` + `row` (int) **or** `label` (string), not both. Optional: `subsite` (int, default 0), `precise` (bool, default false), `reference`, `precision_um`, `max_iterations`, `correction_settle_s`, `step_tolerance_um` (see below) | `MoveChuckDieReply` + machine state, message e.g. "Moved to die 'BAM03' (col=.., row=..)". Error 400 if neither or both of col/row and label are given | Moves to a die. Always goes to the off-axis side first, so the state becomes `OnDie_OffAxis_withoutPTPA`. With `precise: true` it moves by exact die pitches with closed-loop XY instead of the prober's step_die. | `python3.12 main.py send MoveChuckRowColumn --data='{"user":"user1","waferAgentName":"WPMIT_DEV","col":3,"row":2}'`<br>`python3.12 main.py send MoveChuckRowColumn --data='{"user":"user1","waferAgentName":"WPMIT_DEV","label":"BAM03"}'`<br>`python3.12 main.py send MoveChuckRowColumn --data='{"user":"user1","waferAgentName":"WPMIT_DEV","label":"BAM03","precise":true,"reference":"BAMTest"}'` |
| `SetPTPA` | `enable` (true / false) | `SetPTPAReply` + machine state | Enables or disables Probe Tip Position Alignment. | `python3.12 main.py send SetPTPA --data='{"user":"user1","waferAgentName":"WPMIT_DEV","enable":true}'` |
| `RunPTPA` | none | `RunPTPAReply` + machine state | Runs Probe Tip Position Alignment: aligns the probe tips to the die pads with vision. | `python3.12 main.py send RunPTPA --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `MoveChuckWide` | none | `MoveChuckWideReply` + machine state | Moves the die from off-axis to the wide area under the probes, ready for contact. | `python3.12 main.py send MoveChuckWide --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `MoveChuckXY` | `x`, `y` (numbers). The py file also sends `position: "Relative"` | `MoveChuckXYReply` + machine state | Moves the chuck by X/Y. Only sent if the manual offset in the code is not 0 (it is 0 now). | `python3.12 main.py send MoveChuckXY --data='{"user":"user1","waferAgentName":"WPMIT_DEV","x":15,"y":15,"position":"Relative"}'` |
| `MoveChuckXYPrecise` | `x`, `y` in µm, `position: "Relative"` | Not in the Swagger file | Precise shift before contact for dies with `precise_offset_um` in `die_overrides`. Undone after separation. | `python3.12 main.py send MoveChuckXYPrecise --data='{"user":"user1","waferAgentName":"WPMIT_DEV","x":1.5,"y":-0.5,"position":"Relative"}'` |
| `MoveChuckContact` | none | `MoveChuckContactReply` + machine state | Raises the chuck so the probes touch the die. | `python3.12 main.py send MoveChuckContact --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `MoveChuckSeparation` | none | `MoveChuckSeparationReply` + machine state | Lowers the chuck so the probes lift off the die. | `python3.12 main.py send MoveChuckSeparation --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `MoveChuckHome` | none | `MoveChuckHomeReply` + machine state | Moves the chuck to the home (park) position. | `python3.12 main.py send MoveChuckHome --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |


### `MoveChuckRowColumn` variants

| Variant | Parameters | How it moves |
|---|---|---|
| By coordinates | `col`, `row`, optional `subsite` | Prober `step_die` to that column/row of the wafer map. |
| By label | `label`, optional `subsite` | The label is turned into col/row with the die map of the open project. ITS3 labels like `BAM00`, `SEG0`; SVT labels like `MOSAIX-1_ER2-W1` or `babyMOSAIX-1_1_ER2-W1`. |
| Precise | `col`+`row` or `label`, plus `precise: true` | Target XY = reference XY + whole die pitches (die size from the wafer map), reached with closed-loop `MoveChuckXYPrecise`. The chuck lands on the same point inside the target die as on the reference die. No calibration needed. Cannot be combined with `subsite` (error 400). |

Precise-only parameters:

| Parameter | Default | Meaning |
|---|---|---|
| `reference` | empty | A position saved with `SaveChuckPosition` in the off-axis area, e.g. `BAMTest` (after PTPA on it). Empty means the current position/die. |
| `precision_um` | 0.5 | Target accuracy of the closed-loop XY move, µm. |
| `max_iterations` | 10 | Max correction steps of the closed-loop move. |
| `correction_settle_s` | 0.1 | Wait between correction steps, s. |
| `step_tolerance_um` | 50.0 | Accepted difference between the prober's die-to-die step and the die size, µm. |

## Part 2. Flow #1 ER2B Wafer

**Start**

1. `Initialize`
2. `UserLogIn`
3. `OpenProject`
4.`MoveChuckOffAxis`
5.`MoveChuckCenter`
6.`AutoFocus`
7.`AlignWafer`
8.`FindHome`
9.Program the FPGA with `test_system` firmware and run the `Initialization` commands from the config.

**For each chip in the CSV with `TEST=yes`**

10.`MoveChuckRowColumn` with the die's `col`, `row`
11. If PTPA is on for this die: `SetPTPA` false → `SetPTPA` true (only if `re_enable_ptpa`), then `RunPTPA`. If it fails: `ResetAgent` + `UserLogIn` (if `reset_on_ptpa_failure`) and skip the chip.
12`MoveChuckWide`
13. `MoveChuckXY` (only if a manual offset is set) and `MoveChuckXYPrecise` (only if the die has `precise_offset_um`)
14. `MoveChuckContact`
15. Run `set_daq`, then the test `Sequence` commands for the chip.

**End (always runs)**

16. `MoveChuckSeparation`
17. `MoveChuckOffAxis` (first undoes any precise offset)
18. `MoveChuckHome`
19. `UserLogOut`

Flow #2 ER2 Wafer
**Start**

1. `Initialize`
2. `UserLogIn`
3. `OpenProject`
4.`MoveChuckOffAxis`
5.`MoveChuckCenter`
6.`InitProbing`
7.Program the FPGA with `test_system` firmware and run the `Initialization` commands from the config.

**For each chip in the CSV with `TEST=yes`**

8.`MoveChuckRowColumn` with the die's `col`, `row`
9. If PTPA is on for this die: `SetPTPA` false → `SetPTPA` true (only if `re_enable_ptpa`), then `RunPTPA`. If it fails: `ResetAgent` + `UserLogIn` (if `reset_on_ptpa_failure`) and skip the chip.
10`MoveChuckWide`
11.`MoveChuckXY` (only if a manual offset is set) and `MoveChuckXYPrecise` (only if the die has `precise_offset_um`)
12.`MoveChuckContact`
13.Run `set_daq`, then the test `Sequence` commands for the chip.

**End (always runs)**
14.`MoveChuckSeparation`
15.`MoveChuckOffAxis` (first undoes any precise offset)
17.`MoveChuckHome`
18`UserLogOut`