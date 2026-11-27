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
| `MoveChuckXY` | `x`, `y` (µm, float), `position`: `"Relative"` or `"Zero"` (all required) | `MoveChuckXYReply` + machine state, message "Moved chuck to x=.., y=.." | Plain (open-loop) XY move of the chuck. Developer-only: allowed only in state `UsedByDeveloper` (developer login). In its3.py it is only sent if the manual offset is not 0 (it is 0 now), so it is never sent. | `python3.12 main.py send MoveChuckXY --data='{"user":"user1","waferAgentName":"WPMIT_DEV","x":15,"y":15,"position":"Relative"}'` |
| `MoveChuckXYPrecise` | `x`, `y` (µm). Optional: `position` `"Relative"` (default), `"Zero"` or `"Center"`, `precision_um` (default 1.0), `max_iterations` (default 3), `correction_settle_s` (default 0.2) | `MoveChuckXYPreciseReply` + machine state (not in the Swagger file) | Closed-loop XY move: moves, reads the real position, and corrects until it is within `precision_um`. Developer/sequencer command (not in the user or expert command lists). its3.py uses it for dies with `precise_offset_um` in `die_overrides` and undoes it after separation. | `python3.12 main.py send MoveChuckXYPrecise --data='{"user":"user1","waferAgentName":"WPMIT_DEV","x":1.5,"y":-0.5,"position":"Relative"}'` |
| `MoveChuckContact` | none | `MoveChuckContactReply` + machine state | Raises the chuck so the probes touch the die. | `python3.12 main.py send MoveChuckContact --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `MoveChuckSeparation` | none | `MoveChuckSeparationReply` + machine state | Lowers the chuck so the probes lift off the die. | `python3.12 main.py send MoveChuckSeparation --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `MoveChuckHome` | none | `MoveChuckHomeReply` + machine state | Moves the chuck to the home (park) position. | `python3.12 main.py send MoveChuckHome --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `ShowStatus` | none (no `user` needed) | `ShowStatusReply`, message "Agent: .. \| Machine: connected/not connected, initialized/not initialized \| State: .. \| User: .. \| Project: .. \| Wafer: .." | Shows the agent and machine status. Reads only the agent's own state, so it works in any state, before `Initialize` and while the machine is off. | `python3.12 main.py send ShowStatus --data='{"waferAgentName":"WPMIT_DEV"}'` |
| `SetContactHeight` | `contactHeight` (µm, positive number, optional). If omitted, uses the contact height saved by the last `OpenProject` | `SetContactHeightReply` + machine state. Error 400 if no height is known or the value is not a positive number | Sets the contact height of the current chuck site. Does not move the chuck. Allowed in `OnDie_Wide_withPTPA`, `OnDie_Wide_withoutPTPA`, `UsedByDeveloper`. | `python3.12 main.py send SetContactHeight --data='{"user":"user1","waferAgentName":"WPMIT_DEV","contactHeight":10500.0}'` |
| `SetChuckOvertravel` | `overtravelGap` (µm). Swagger calls it `overdrive` | `SetChuckOvertravelReply` + machine state, message "SetOvertravel command successfully executed" | Enables overtravel and sets the overtravel gap for all chuck sites. Allowed in `OnDie_Wide_withPTPA`, `OnDie_Wide_withoutPTPA`, `UsedByDeveloper`. | `python3.12 main.py send SetChuckOvertravel --data='{"user":"user1","waferAgentName":"WPMIT_DEV","overtravelGap":20.0}'` |
| `DisableOvertravel` | none | `DisableOvertravelReply` + machine state, message "DisableOvertravel command successfully executed" | Sets the overtravel gap to 0. Allowed only in `UsedByDeveloper` (developer login). | `python3.12 main.py send DisableOvertravel --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `MoveChuckTopLeft` | none | `MoveChuckTopLeftReply` + machine state | Relative XY move of x=+15, y=-10 µm (fixed in code). Allowed only in `UsedByDeveloper` (developer login). | `python3.12 main.py send MoveChuckTopLeft --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `MoveChuckTopRight` | none | `MoveChuckTopRightReply` + machine state | Relative XY move of x=-15, y=-10 µm (fixed in code). Allowed only in `UsedByDeveloper` (developer login). | `python3.12 main.py send MoveChuckTopRight --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `MoveChuckBottomLeft` | none | `MoveChuckBottomLeftReply` + machine state | Relative XY move of x=+15, y=+10 µm (fixed in code). Allowed only in `UsedByDeveloper` (developer login). | `python3.12 main.py send MoveChuckBottomLeft --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `MoveChuckBottomRight` | none | `MoveChuckBottomRightReply` + machine state, message "Chuck moved to bottom-right" | Relative XY move of x=-15, y=+10 µm (fixed in code). Allowed only in `UsedByDeveloper` (developer login). | `python3.12 main.py send MoveChuckBottomRight --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `MoveChuckZ` | `z` (µm, float, required) | `MoveChuckZReply` + machine state, message "Moved chuck to z=.." | Moves the chuck to a Z height. Allowed only in `UsedByDeveloper` (developer login). | `python3.12 main.py send MoveChuckZ --data='{"user":"user1","waferAgentName":"WPMIT_DEV","z":10377.7}'` |
| `MoveChuckSafePosition` | none | `MoveChuckSafePositionReply` + machine state, message "Probe station is in safe position" | Off-axis, then XY to x=37500, y=160000 µm from center, then Z=10377.7 µm (all fixed in code). Allowed in `OpenedProject` or `Aligned`, ends in `ChuckSafePosition`. | `python3.12 main.py send MoveChuckSafePosition --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| `LocalMode` | none | `LocalModeReply` + machine state, message "Local mode" | Gives control of the prober back to its local UI (SENTIO). Allowed only in `UsedByDeveloper` (developer login). Most commands already do this at the end. | `python3.12 main.py send LocalMode --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| 🔴 `LoadWafer` | `waferId` (number, required), `orientation` (string) | `LoadWaferReply`, "Wafer has been loaded". Error 400 "Wafer already loaded" | Loads a wafer onto the chuck and updates the loaded wafer in the DB. State `Unloaded` → `UserLogged`. | `python3.12 main.py send LoadWafer --data='{"user":"user1","waferAgentName":"WPMIT_DEV","waferId":25,"orientation":"<orientation>"}'` |
| 🔴 `MoveChuckLoadedWafer` | none | `MoveChuckLoadedWaferReply` + machine state | Loads the same wafer again (load + off-axis), no DB update. State `ChuckUnloaded` → `UserLogged`. | `python3.12 main.py send MoveChuckLoadedWafer --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| 🔴 `UnloadWafer` | none | `UnloadWaferReply`, "Wafer unloaded". Error 400 "No wafer loaded" | Unloads the wafer and clears it in the DB. From `OpenedProject`, `Aligned`, `ChuckSafePosition` → `Unloaded`. | `python3.12 main.py send UnloadWafer --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| 🔴 `MoveChuckUnloadWafer` | none | `MoveChuckUnloadWaferReply`, "Wafer unloaded". Error 400 "No wafer loaded" | Unloads the wafer without a DB update. From `OpenedProject`, `Aligned`, `ChuckSafePosition` → `ChuckUnloaded`. | `python3.12 main.py send MoveChuckUnloadWafer --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| 🔴 `MoveChuckAsic` | `asicId` (int, DB id, required), `subsite` (int, default 0) | `MoveChuckAsicReply` + machine state | Moves to the die of an ASIC from the DB with the full sequence: OffAxis → RowColumn → AutoFocus → RunPTPA → Wide. From `Aligned` or any `OnDie_*` → `OnDie_Wide_withPTPA`. | `python3.12 main.py send MoveChuckAsic --data='{"user":"user1","waferAgentName":"WPMIT_DEV","asicId":123}'` |
| 🔴 `MoveChuckNextDie` | none | `MoveChuckNextDieReply` + machine state | Goes off-axis and steps to the next die of the wafer map. From `Aligned` or any `OnDie_*` → `OnDie_OffAxis_withoutPTPA`. | `python3.12 main.py send MoveChuckNextDie --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| 🔴 `MoveChuckPreviousDie` | none | `MoveChuckPreviousDieReply` + machine state | Goes off-axis and steps to the previous die. Same states as `MoveChuckNextDie`. | `python3.12 main.py send MoveChuckPreviousDie --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| 🔴 `MoveChuckToWorkArea` | `workArea` (string, required by the validator; the function argument is `work_area`) | `MoveChuckToWorkAreaReply` + machine state | Moves the chuck to a named work area of the prober. Developer only (`UsedByDeveloper`). | `python3.12 main.py send MoveChuckToWorkArea --data='{"user":"user1","waferAgentName":"WPMIT_DEV","workArea":"<work_area>"}'` |
| 🔴 `SwitchCamera` | `mountPoint` (string, required) | `SwitchCameraReply` + machine state | Switches the active camera. Developer only (`UsedByDeveloper`). | `python3.12 main.py send SwitchCamera --data='{"user":"user1","waferAgentName":"WPMIT_DEV","mountPoint":"<mount_point>"}'` |
| 🔴 `TakeScreenshot` | all optional: `fileName`, `snapshot_type` (`CameraRaw` / `WithOverlays`), `save_locally` (default true), `outputDir` (default `screenshotsSVT`), `wafer` | `TakeScreenshotReply` + file path | Saves a camera image (.jpg), under `Imaging/<wafer>/<outputDir>` when `wafer` is set. Developer only (`UsedByDeveloper`). | `python3.12 main.py send TakeScreenshot --data='{"user":"user1","waferAgentName":"WPMIT_DEV","snapshot_type":"CameraRaw","wafer":"Wafer25","outputDir":"BAM00"}'` |
| 🔴 `TestingLock` | `reason` (default "Testing in progress"), `testSequenceId` (optional) | `TestingLockReply`. Error if already locked by someone else | Locks the agent during a test so other users can't interfere. State `AtContact` → `AtContact_Locked`. | `python3.12 main.py send TestingLock --data='{"user":"user1","waferAgentName":"WPMIT_DEV","reason":"Testing BAM00"}'` |
| 🔴 `TestingUnlock` | `force` (bool, developer only) | `TestingUnlockReply`, or "WP Agent is not locked" | Releases the lock. Only the user who locked it or a developer can unlock. `AtContact_Locked` → `AtContact`. Swagger spells it `TestingUnLock`, the code uses `TestingUnlock`. | `python3.12 main.py send TestingUnlock --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'` |
| 🔴 `StressOpenProject` | `projectNameFirst`, `projectNameSecond`, `iterations` (required), `delay` (s, default 0) | `StressOpenProjectReply`, "test is DONE" | Opens the two projects in turn N times to stress-test project switching. Not in any state's command list, so developer only. | `python3.12 main.py send StressOpenProject --data='{"user":"user1","waferAgentName":"WPMIT_DEV","projectNameFirst":"<project_1>","projectNameSecond":"<project_2>","iterations":10}'` |
| 🔴 `RunSequencer` | `filepath` (path to a .json sequence). Swagger and the validator say `filePath`, but the code reads `filepath` | `RunSequencerReply` with the result of each step | Runs the commands listed in a JSON file one after another. Developer only. | `python3.12 main.py send RunSequencer --data='{"user":"user1","waferAgentName":"WPMIT_DEV","filepath":"<sequence.json>"}'` |
| 🔴 `Help` | `command` (optional) | `HelpReply` with the help text | Shows help for all commands or for one, from `utilities/WPCommandsHelpList.json`. Works in any state. | `python3.12 main.py send Help --data='{"waferAgentName":"WPMIT_DEV","command":"MoveChuckRowColumn"}'` |
| 🔴 `ListProbers` | `timeout` (s, default 15, optional) | `ListProbersReply` with the machines. Error 404 if none or the DB agent doesn't answer | Lists all wafer probe machines from the DB. Works in any state. | `python3.12 main.py send ListProbers --data='{"waferAgentName":"WPMIT_DEV"}'` |
| 🔴 `ListChipTypes` | none | `ListChipTypesReply`, "Chip types retrieval not yet implemented" | Not implemented yet in the code. | `python3.12 main.py send ListChipTypes --data='{"waferAgentName":"WPMIT_DEV"}'` |
| 🔴 `ListOrientations` | none | none: not registered in `WPCmdMap.py`, so the agent doesn't run it | A function exists in `actions/WPDataBaseActions.py` but it isn't connected to a command, and it's not implemented yet either. | `python3.12 main.py send ListOrientations --data='{"waferAgentName":"WPMIT_DEV"}'` |

🔴 = the remaining commands from the Swagger file and not tested by me.


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