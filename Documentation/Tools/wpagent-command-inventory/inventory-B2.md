# WPAgent command inventory, part B2

Continues `inventory-B.md`: commands 19 to 40 of part B (contacting, die grid, topography, sequencer, sequencer helpers), the map-conversion file, then section A (the sequencer in full) and section B (the files in `WPAgent/sequencer/`).

- Source: `master` at commit `a862772f` (27 Nov 2026). Paths are relative to the repository root. Nothing was run: every statement here comes from reading the code.
- Short names of files, the 11 points per command, and section 0 of `inventory-B.md` (0.1 to 0.6, gaps G1 to G7) are used as they are and not repeated.
- "not found" means: searched for, and not in this export.

## Extra short names

| Short | File |
|---|---|
| `Cfg/` | `WPAgent/configs/` |
| `Contact` | `WPAgent/utilities/WPContacting.py` |
| `DieGrid` | `WPAgent/utilities/WPDieGrid.py` |
| `DieMaps` | `WPAgent/utilities/WPDieMaps.py` |
| `TopoU` | `WPAgent/utilities/WPTopography.py` |
| `ImgCfg` | `WPAgent/utilities/WPImagingConfig.py` |
| `StitchF` | `WPAgent/utilities/WPImageStitchingFull.py` |
| `NM/` | `WPAgent/utilities/needle_mark/` |
| `Name` | `WPAgent/utilities/WPMachineName.py` |
| `Seq` | `WPAgent/sequencer/WPSequencer.py` (class `WPSequencer`) |
| `SeqYC` | `WPAgent/sequencer/WPSequencerYAML.py` (class `WPSequencerYAML`) |
| `MsgSt` | `WPAgent/utilities/WPMessagesStatus.py` |
| `Help`, `Contract`, `Test`, `Mock`, `Sentio` | as in `inventory-B.md` |

## Notes on `inventory-B.md` (found while doing this part)

1. The common facts of commands 3 to 18 call `MoveChuckXYPrecise` "command 35". In the order of `COMMAND_ROUTER` it is command 34 (`CmdMap:164`); `Sleep` is 35.
2. The common facts of commands 3 to 18 say that `user` and `waferAgentName` of the request "go into every step (`SeqY:21-24`)". The code puts them into the sequence context only (`SeqY:21-24`). A step receives them only through `user: $user` and `waferAgentName: $waferAgentName` in its own `params` (`SeqY:58`). Every active step of the 22 YAML files has both lines: 214 steps, 214 `user: $user`, 214 `waferAgentName: $waferAgentName` (count by search in `seq/*.yaml`).
3. Commands 3 and 15 say the EOS (or `archive_dir`) folder "must exist". `ArchiveImaging` creates missing destination folders itself (`Img:792-794`). It fails (code 500) only when the process cannot create or write them (`Img:823-826`). See command 39.
4. `inventory-B.md` refers to a section E (packages) and a section F (dry runs). Neither section is in that file. They are not in this file either.

## Facts common to commands 19 to 40

- **G1** holds for every command of this part: all are reached through `CmdMap`, which imports every action module at load time (`CmdMap:1-14`).
- **Decorated commands** (19 to 29): the validator runs in full, except for the two bypass commands `GetDieSize` and `GetDieList` (`Val:70-72`). None of the decorated, non-bypass commands is in `USER_COMMANDS` or `EXPERT_COMMANDS` (`Const:36-95`), so alone they are for a Developer only. None of them is in a state table of a normal state (`SM:40-196`), so alone they run only in the state `UsedByDeveloper` (`SM:289-290`). None is in `LOCK_EXEMPT_COMMANDS` (`Val:23-41`).
- **A missing required argument** (for example `folder` of `AnalyzeNeedleMarks`) is a `TypeError` when the handler is called. That is an exception: code 500, reply type `UnhandledErrorReply`, and the agent enters `Error` (`CmdMap:314-326`). The same happens for an unknown key when the handler has no `**kwargs`: in this part only `SaveChuckPosition` (`Con:25`) and `RunSequencer` (`SeqJ:6`).
- **Sequencer helpers** (30 to 40): see the common facts before command 30.
- **DB:** none of the 22 handlers calls the DB client (same search as `inventory-B.md` 0.6, last paragraph). Two of them store `g.loaded_wafer_id`, a value that only the DB paths set (inventory-A section E); without the DB it is `null` in the record.
- **Mock driver:** `MockProberImpl` has no attribute `prober` (`Mock:20-54`). Every command that calls `prober.prober...` fails on the mock: `GetChuckXY` (31), `MoveChuckXYPrecise` (34), and through it `MoveChuckToSavedPosition` (20) and `MoveChuckBySavedOffset` (21). `GenerateRasterSteps` (33) catches the failure and goes on.

---

# Commands 19 to 40, in the order of `COMMAND_ROUTER`

## 19. SaveChuckPosition

1. **Handler.** `CmdMap:128` → `save_chuck_position`, `Con:24-90`. Decorator `@validate_command` (`Con:24`); validated name `SaveChuckPosition` (`Dec:54-56`).
2. **Parameters** (`Con:25`):
   | Name | Type | Required | Default | Notes |
   |---|---|---|---|---|
   | `name` | str | no | `"contact"` | Key of the record. An empty name raises `ValueError` in the store (`Contact:93-94`), caught: code 500 (`Con:85-90`). |
   | `label` | str | no | `None` | Stored in the record only (`Con:69`). |
   | `user`, `waferAgentName` | str | no | `None` | Validator. `user` is also stored in the record (`Con:73`). |
   - No `**kwargs`: an unknown key gives code 500 and the `Error` state (common facts).
   - `Help:312-321`: `name`, `label`, same defaults. `Contract`: no entry.
3. **Checks.** Validator in full (Developer alone; Expert inside `NeedleOffsetMeasureER2B`). State machine: `UsedByDeveloper` only. Testing lock applies. No orientation check (not in `Val:540-555`). Then `_ensure_initialized()` (`Con:42-44`). Then an open project: empty `g.projectName` gives code 400 `An open project is required to save a position` (`Con:46-48`).
4. **DB.** None. The record keeps `g.loaded_wafer_id` (`Con:72`), set only from the DB; `null` without it.
5. **Kafka.** Only 0.4.
6. **Globals.** Read: `projectName`, `loaded_wafer_id`, `current_die_col`, `current_die_row`, `current_die_subsite`, `chuck_z_position_state`, `current_working_area` (`Con:47`, `63-72`). Written by `update_current_info`: `current_die_col`, `current_die_row`, `total_dies_number`, `chuck_z_position_state`, `current_working_area`, `camera_mount_point` (`Test:30-47`). The state does not change, also after an error (`Con:85-90`).
7. **Prober**, in order: `update_current_info` → `get_current_index`, `get_dies_number`, `get_chuck_position` (2 times), `get_current_working_area` (2 times) (`Con:53`; `Test:32-47`); `get_chuck_xy` (`Con:54`; `Sentio:321-334`); `get_contact_height` (`Con:55`; `Sentio:336-351`); `local_mode` (`Con:56`). No move.
8. **Files.** Reads and rewrites `Contacting/<projectName>/positions.json`: `{"latest": {name: record}, "history": [...]}` (`Contact:9-13`, `25-26`, `39-41`, `59-61`, `92-100`). Written through `positions.json.tmp` and a rename (`Contact:103-109`). Path: the constant `Contacting` relative to the working directory, the project name from the global.
9. **Duration.** `Help:320`: under 1 second.
10. **Reply.** Type `SaveChuckPositionReply`. Text `Saved position '<name>': x=<x> um, y=<y> um, contact height=<h> um, die col=<c> row=<r> (<label>), <work area>, <Z state> -> <path>` (`Con:77-83`). Any error after `_ensure_initialized`, also a lost connection, is caught: code 500 `Could not save position '<name>': <error>` (`Con:85-90`).
11. **Without DB and Kafka.** G2 (Developer log-in, state `UsedByDeveloper`), G3, G4, G5. A config file would give: prober type and address, agent name, project name. The wafer id is optional.

## 20. MoveChuckToSavedPosition

1. **Handler.** `CmdMap:129` → `move_chuck_to_saved_position`, `Con:96-122`. `@validate_command`. The move is `_move_precise` (`Con:167-181`), which calls `move_chuck_xy_precise` (command 34, `Img:88-259`).
2. **Parameters** (`Con:97-98`): `name` str, default `"ptpa_ref"`; `precision_um` 0.15; `max_iterations` 10; `correction_settle_s` 0.1. All optional. `**kwargs`: unknown keys are ignored. Numbers are converted inside command 34 (`Img:130-134`); a bad value gives code 500 there. `Help:323-334`: the same four, same defaults. `Contract`: no entry.
3. **Checks.** Validator in full. State machine: `UsedByDeveloper` only. Testing lock. `_ensure_initialized()` (`Con:109-111`). The saved record must exist: no project gives `ValueError` (`Contact:33-35`), no record gives `KeyError` (`Contact:86-89`); both code 400 `Cannot move to position '<name>': <reason>` (`Con:114-117`).
   - The work area and Z state saved with the record are not compared with the current ones (`Con:96-122`). The docstring leaves this "to the state machine" (`Con:102`), but no state table names the command (`SM:40-196`). For comparison, `MoveChuckRowColumn` with `precise` refuses a saved position of another work area (`Grid:53-55`).
4. **DB.** None.
5. **Kafka.** Only 0.4.
6. **Globals.** Reads `projectName` (`Con:113-115`). After a successful move `update_current_info` writes the fields listed in command 19 (`Con:175-177`).
7. **Prober.** Command 34 with `position="Zero"` and the saved `x_um`, `y_um` (`Con:119-122`, `170-171`). Then `get_current_prober`, `update_current_info`, `local_mode` (`Con:175-178`); an error there is ignored (`Con:179-180`). No Z move.
8. **Files.** Reads `Contacting/<project>/positions.json`, entry `latest[<name>]` (`Contact:49-56`). Writes nothing.
9. **Duration.** `Help:333`: 1 to 5 seconds. At most `max_iterations` correction moves, each followed by `correction_settle_s` (`Img:195-234`).
10. **Reply.** Type `MoveChuckToSavedPositionReply`. Success: `At saved position '<name>': x=<x>, y=<y>, err=(<ex>,<ey>) µm, iter=<n>` (`Con:181`; `Img:250-253`). Failure of the move: `At saved position '<name>' failed: <message>`, with the code of command 34, which is 500 (`Con:172-174`). A lost connection: code 503 (`Img:255-256` raises; `CmdMap:309-312`).
11. **Without DB and Kafka.** G2, G3, G4, G5. A `positions.json` written before by command 19. Fails on the mock driver (common facts).

## 21. MoveChuckBySavedOffset

1. **Handler.** `CmdMap:130` → `move_chuck_by_saved_offset`, `Con:125-164`. `@validate_command`. Move through `_move_precise` (`Con:167-181`).
2. **Parameters** (`Con:126-127`): `name` `"pad_target"`; `max_offset_um` 40.0; `precision_um` 0.15; `max_iterations` 10; `correction_settle_s` 0.1. All optional, `**kwargs`. `float(max_offset_um)` (`Con:155`) is outside a `try`: a text that is not a number is an exception, code 500 and `Error` state (`CmdMap:314-326`). `Help:336-348`: the same five, same defaults. `Contract`: no entry.
3. **Checks.** Validator in full. State machine: `UsedByDeveloper` only. Testing lock. `_ensure_initialized()` (`Con:144-146`). The saved offset must exist, code 400 otherwise (`Con:149-153`). If `|dx_um|` or `|dy_um|` is above `max_offset_um`: nothing moves, the agent enters `Error`, code 500 (`Con:155-159`). This also happens inside a trusted sequence: `enter_error_state` has no trusted-sequence guard (`SM:315-323`).
4. **DB.** None.
5. **Kafka.** Only 0.4.
6. **Globals.** Reads `projectName` (`Con:148-150`). Writes the `Error` state on the limit. After a move, `update_current_info` (`Con:175-177`).
7. **Prober.** Command 34 with `position="Relative"`, `x=dx_um`, `y=dy_um` (`Con:163-164`, `170-171`). Then `update_current_info` and `local_mode` (`Con:175-178`). No Z move.
8. **Files.** Reads `Contacting/<project>/offsets.json`, entry `latest[<name>]` (`Contact:44-46`, `64-71`). That file is written by command 23.
9. **Duration.** `Help:347`: 1 to 5 seconds.
10. **Reply.** Type `MoveChuckBySavedOffsetReply`. Success: `Applied offset '<name>' (<dx>, <dy>) um: x=<x>, y=<y>, err=(...) µm, iter=<n>` (`Con:163-164`, `181`). Errors: 400 no offset; 500 limit (with `Error` state) or failed move; 503 lost connection.
11. **Without DB and Kafka.** G2, G3, G4, G5. An `offsets.json` from command 23. Fails on the mock driver.

## 22. AnalyzeNeedleMarks

1. **Handler.** `CmdMap:131` → `analyze_needle_marks`, `Con:184-233`. `@validate_command`. The analysis package `NM/` is imported inside the handler (`Con:213`).
2. **Parameters** (`Con:185-187`):
   | Name | Type | Required | Default | Notes |
   |---|---|---|---|---|
   | `folder` | str | yes | | Die folder, for example `BAM00`. |
   | `wafer` | str | no | `""` | Without a wafer the folder is `<folder>` alone and `root` is ignored (`Con:240-241`). |
   | `config` | str | no | `"lec"` | A built-in name (`NM/configs/*.json`) or the path of a JSON file (`NM/api.py:27-49`). |
   | `pattern` | str | no | `"*_LEC.tif"` | The newest match by modification time; names that start with `.` are skipped (`NM/api.py:56-67`). |
   | `contrast` | bool | no | `False` | Also write `<stem>_contrast.tif`. Text `true`, `1`, `yes` count as true (`Con:389-393`). |
   | `require_ok` | bool | no | `False` | Fail with 400 when the pad count or pad sizes do not match the config (`Con:230-232`; `NM/api.py:101`). |
   | `root` | str | no | `"Imaging"` | Top folder, for example the EOS archive (`Con:208-209`). |
   - `Help:425-439`: the same seven; `folder` required. Help says the reports go to `Imaging/<wafer>/<folder>/` (`Help:426`); the code writes them next to the image, under `root` (`NM/api.py:86-90`). Help does not say that `root` is ignored without `wafer`. `Contract`: no entry.
3. **Checks.** Validator in full. State machine: `UsedByDeveloper` only. Testing lock. No prober check, no project check.
4. **DB.** None.
5. **Kafka.** Only 0.4. The text `"false"` stays text after `ast.literal_eval` (0.4 point 2); `_as_bool` reads it as false (`Con:389-393`).
6. **Globals.** None read or written by the handler (`Con:184-233`). After a failed result `execute_command` calls `_try_local_mode()`, which sends `local_mode` to a connected prober (`CmdMap:307`, `188-205`).
7. **Prober.** None.
8. **Files.**
   - Reads the newest `<root>/<wafer>/<folder>/<pattern>` (`Con:215-217`) and the config JSON (`NM/api.py:44-47`).
   - Writes next to the image: `<stem>_overlay.tif`, `<stem>_marks.csv`, `<stem>_marks.json`, and `<stem>_contrast.tif` with `contrast` (`NM/report.py:40-55`).
   - `root` may be the server-only EOS path; `NeedleOffsetMeasure_ER2B.yaml` passes it (`seq/NeedleOffsetMeasure_ER2B.yaml:117`).
9. **Duration.** `Help:438`: 5 to 30 seconds.
10. **Reply.** Type `AnalyzeNeedleMarksReply`. Text, parts joined by ` | ` (`Con:371-386`): `<folder>: <found>/<expected> pads`, `no mark=<n>, single=<n>, multiple=<n>, at edge=<n>`, then optionally `marks at edge on pads [...]`, `PAD COUNT MISMATCH`, `<n> pads off design size`, and last `report: <json file name>`. The summary dict itself is not in the reply. Errors: 400 for a `NeedleMarkError` (no image, unknown config) and for a doubtful detection with `require_ok`; 500 for any other error, without the `Error` state (`Con:219-232`).
11. **Without DB and Kafka.** G2 and G3 only. No prober, no DB, no project. Needs OpenCV and numpy (`NM/image.py:8-9`; `NM/report.py:10-11`). It can run offline on images on disk.

## 23. ComputePadTargetOffset

1. **Handler.** `CmdMap:132` → `compute_pad_target_offset`, `Con:245-353`. `@validate_command`.
2. **Parameters** (`Con:246-249`). The criteria default to `Cfg/WPContactingConfig.json` (`Cfg/WPContactingConfig.json:11-17`); a value given here replaces the file value for this call (`Contact:118-129`):
   | Name | Type | Required | Default | Allowed values (`Contact:131-145`, `151-157`) |
   |---|---|---|---|---|
   | `folder` | str | yes | | |
   | `wafer` | str | no | `""` | as command 22 |
   | `root` | str | no | `"Imaging"` | as command 22 |
   | `name` | str | no | `"pad_target"` | key in `offsets.json` |
   | `corner` | str | no | file: `"bottom_left"` | `center`, `bottom_left`, `bottom_right`, `top_left`, `top_right` |
   | `inset_um` | float | no | file: 20.0 | above 0 and below half the pad (`Contact:166-168`) |
   | `max_aspect` | float | no | file: 2.0 | at least 1 |
   | `min_valid_fraction` | float | no | file: 0.95 | above 0, at most 1 |
   | `max_spread_um` | float | no | file: 10.0 | above 0 |
   | `chuck_sign_x` | int | no | file: -1 | +1 or -1 |
   | `chuck_sign_y` | int | no | file: 1 | +1 or -1 |
   - `Help:441-459`: the same eleven. `Contract`: no entry. `NeedleOffsetMeasure_ER2B.yaml` does not pass `chuck_sign_x` or `chuck_sign_y` (`seq/NeedleOffsetMeasure_ER2B.yaml:121-133`).
3. **Checks.** Validator in full. State machine: `UsedByDeveloper` only. Testing lock. A bad criterion: code 400 (`Con:274-279`). An open project is needed: code 400 (`Con:285-287`). No prober check.
4. **DB.** None.
5. **Kafka.** Only 0.4.
6. **Globals.** Reads `projectName` (`Con:285-287`, `331`, `334`). Writes none.
7. **Prober.** None.
8. **Files.**
   - Reads `Cfg/WPContactingConfig.json` (path from the code location, `Contact:114-115`).
   - Reads the newest `<root>/<wafer>/<folder>/*_marks.json` by modification time, hidden names skipped (`Con:289-299`). This is the newest report of the folder, not necessarily the one of the newest image.
   - Writes `Contacting/<project>/offsets.json` (`latest` and `history`) (`Con:334`; `Contact:74-76`, `92-109`).
9. **Duration.** `Help:458`: under 1 second.
10. **Reply.** Type `ComputePadTargetOffsetReply`. Text (`Con:344-351`): `<folder>: offset '<name>' to <corner> (inset <i> um): chuck dx=<dx> um, dy=<dy> um | offset to center x=<x>, y=<y> um | <used>/<n> pads, spread <s> um, inset x <..> um, y <..> um -> <path>`. Errors 400: no report (`Con:293-295`), `count_ok` false in the report (`Con:300-303`), too few usable pads or too large spread (`Con:306-308`, `356-368`), missing keys or bad values (`Con:336-337`). Other errors: 500 without the `Error` state (`Con:338-342`).
11. **Without DB and Kafka.** G2, G3, G5 (the project name is used only for the output folder and the record). No prober, no DB.

## 24. GetDieSize

1. **Handler.** `CmdMap:135` → `get_die_size`, `Grid:117-147`. `@validate_command`, but the command is a bypass command (`Const:25`).
2. **Parameters.** None (`Grid:118`: `user`, `waferAgentName`, `**kwargs`). `Help:405-411`: `data` empty. `Contract`: no entry.
3. **Checks.** No state-machine check (`CmdMap:277`). The validator returns at once (`Val:70-72`): no agent name, log-in, lock or level check. Then `_ensure_initialized()` (`Grid:123-125`).
4. **DB.** None.
5. **Kafka.** Only 0.4. As a bypass command it can run while another command runs in another pool thread (0.4 point 3); it ends with `local_mode` (`Grid:134`).
6. **Globals.** Reads `projectName`, `current_die_col`, `current_die_row` (`Grid:138-141`). Writes through `update_current_info` (`Grid:133`; fields as command 19).
7. **Prober**, in order: `get_die_size` (`Grid:30`; `Sentio:227-231`, SENTIO `map:get_index_size`); `get_map_axis_orient` (`Grid:131`; `Sentio:233-235`); `get_grid_origin` (`Grid:132`; `Sentio:237-239`); `update_current_info` (`Grid:133`); `local_mode` (`Grid:134`). No move.
8. **Files.** Reads `Contacting/<project>/die_grid.json` if it exists (`Grid:140-141`; `DieGrid:27`, `32-43`). Without a project the `ValueError` of `contacting_folder` is caught and nothing is read (`Grid:142-143`).
9. **Duration.** `Help:410`: under 1 second.
10. **Reply.** Type `GetDieSizeReply`. Text `Die size <w> x <h> um, axis orientation <UR|UL|DR|DL>, grid origin <origin>, current die col=<c> row=<r>`, plus `; learned: +1 col = [..] um, +1 row = [..] um` when `die_grid.json` has steps (`Grid:138-146`). Any prober error, also a lost connection, gives code 500 `Could not read the die size: <error>` (`Grid:135-136`).
11. **Without DB and Kafka.** G4 only. No log-in, any state. The project is optional. The die size is the one of the wafer map that SENTIO has loaded (`Sentio:230`).

## 25. GetDieList

1. **Handler.** `CmdMap:138` → `get_die_list`, `Topo:28-54`. `@validate_command`, bypass command (`Const:26`).
2. **Parameters.** None (`Topo:29`). `Help:350-356`: `data` empty. `Contract`: no entry.
3. **Checks.** None: no state check (`CmdMap:277`), validator skipped (`Val:70-72`), no prober check.
4. **DB.** None.
5. **Kafka.** The result has `type` and `data`, so the listener sends it unchanged (`Kafka:607-610`), with the extra top-level key `steps`. The sender receives the die list.
6. **Globals.** Reads `projectName` (`Topo:44-46`). Writes none.
7. **Prober.** None.
8. **Files.** Reads `Cfg/WPMapConversion_<wafer type>.json`. The wafer type is the part of the project name before the first `_` (`DieMaps:34-44`). The path comes from the code location (`DieMaps:27`). A map is read once per process and kept (`DieMaps:31`, `56-71`): a changed map file is seen only after a restart.
9. **Duration.** `Help:355`: under 1 second.
10. **Reply.** Type `GetDieListReply`. Text `<n> dies in <project>: <label>, <label>, ...` (`Topo:51-52`). Extra key `steps: [{"label", "col", "row"}, ...]` (`Topo:50`, `53`): the dies of the map whose `SN_prefix` is the ASIC named in the project, in map order (`DieMaps:74-88`). Errors, code 400: no project, no map file for the wafer type, no ASIC found in the project name (`Topo:47-48`; `DieMaps:36-39`, `58-60`, `86-87`).
11. **Without DB and Kafka.** G5 only (a project name). No log-in, no prober, no DB. The map files are part of the code.

## 26. MeasureLECTopographyDie

1. **Handler.** `CmdMap:139` → `measure_lec_topography_die`, `Topo:57-169`. `@validate_command_with_name("MeasureLECTopographyDie")` (`Topo:57`): the name is given because the function name would give `MeasureLecTopographyDie` (`Dec:54-56`).
2. **Parameters** (`Topo:58-60`):
   | Name | Type | Required | Default | Notes |
   |---|---|---|---|---|
   | `label` | str | yes | | Die label, alias or SVT serial number of the open project's map (`DieMaps:91-122`). |
   | `wafer` | str | in effect yes | `""` | Empty gives code 400 (`TopoU:45-49`; `Topo:99-101`). |
   | `positions` | list or str | no | `None` = all | Indices 0 to `n_points`-1. Text `"0,4,8"` or `"[0,4,8]"` is accepted (`Topo:250-262`). |
   | `n_points` | int | no | 9 | |
   | `row_spacing_um` | float | no | 2476 | |
   | `start_config` | str | no | `"LEC"` | Block of `Cfg/WPImagingConfig.json` (`ImgCfg:19-28`). |
   | `settle_s` | float | no | 0.2 | |
   | `min_points` | int | no | `None` = half of the positions, rounded up (`Topo:98`) | |
   - `Help:358-373`: `label` and `wafer` required, the others optional, same defaults. `Contract`: no entry.
3. **Checks.** Validator in full (Developer alone; Expert inside `LECTopographyER2` and `LECTopographyER2B`). State machine: `UsedByDeveloper` only. Testing lock. Not in the orientation list (`Val:540-555`), so no orientation check, although it moves the chuck. `_ensure_initialized()` (`Topo:88-90`). The label must be in the map of the open project and belong to its ASIC; the start block and the wafer name must be valid; otherwise code 400 `Topography of '<label>' refused: <reason>` (`Topo:93-101`).
4. **DB.** None. The record keeps `g.loaded_wafer_id` (`Topo:142`); `null` without the DB.
5. **Kafka.** Only 0.4. `positions` sent as `"[0,4,8]"` becomes a list through `ast.literal_eval` (`Kafka:169-176`); `"0,4,8"` becomes a tuple; both are accepted (`Topo:256-257`).
6. **Globals.** Reads `projectName`, `loaded_wafer_id`. Writes `chuck_z_position_state = "Separation"` without reading the prober (`Test:401`), `current_die_col/row/subsite` (`Topo:108`; `WPAagentGlobalParameters.py:328-339`), then the fields of `update_current_info` (`Topo:129`). A failed move puts the agent in `Error` (`Topo:131-135`).
7. **Prober**, in order:
   1. `move_chuck_offaxis_area` (`Test:397-401`; `Sentio:207-208`);
   2. `go_to_die(col, row)` (`Topo:107`; `Sentio:151-152`, SENTIO `map.step_die`);
   3. `get_chuck_xy` (`Topo:109`);
   4. for each selected position `i`: `move_chuck_xy(x0 + sx, y0 + sy - i * row_spacing_um, "Zero")` (`Topo:112`), wait `settle_s`, `get_chuck_xy` (`Topo:115`), `auto_focus` (`Topo:117`; `Sentio:188-191`), `get_chuck_z` (`Topo:118`; `Sentio:193-195`). A failed autofocus is recorded and the loop goes on (`Topo:119-123`);
   5. `move_chuck_xy(x0, y0, "Zero")` back to the die (`Topo:128`);
   6. `update_current_info`, `local_mode` (`Topo:129-130`).
8. **Files.** Reads `Cfg/WPImagingConfig.json` (`ImgCfg:15-16`) and `Cfg/WPMapConversion_<type>.json`. Reads and rewrites `Contacting/topography/<wafer>/LEC_topography.json`: `{"wafer", "dies": {label: record}, "history": [...]}` (`TopoU:7-14`, `39-40`, `45-54`, `62-79`), through a `.tmp` file (`Contact:103-109`).
9. **Duration.** `Help:372`: 30 to 60 seconds. 9 autofocus points by default; the two topography sequences use 3 (`seq/LECTopography_ER2.yaml:24`).
10. **Reply.** Type `MeasureLECTopographyDieReply`. Text `<label>: <n>/<m> points [..], focus mean <..> um, std <..>, range <..>, slope <..> um/mm` plus `, INCOMPLETE (< <k> points)` when incomplete, then ` -> <path>`; or `<label>: INCOMPLETE, no autofocus succeeded (<m> tried) -> <path>` (`Topo:160-167`). An incomplete die is a success, so a wafer scan goes on (`Topo:72-75`). Errors: 400 refused (`Topo:100-101`); 500 with the `Error` state for a failed move or a lost connection (`Topo:131-135`); 500 `measured but not saved` (`Topo:153-158`).
11. **Without DB and Kafka.** G2, G3, G4, G5. Not G6, not G7. The wafer name is a parameter. Works on the mock driver: it has every method used here (`Mock:150-155`, `206-211`, `255-260`, `301-308`).

## 27. ComputeTopographyCorrection

1. **Handler.** `CmdMap:140` → `compute_topography_correction`, `Topo:172-247`. `@validate_command`.
2. **Parameters** (`Topo:173-174`): `die` str, required; `wafer` str, default `""`, in effect required (empty gives 400 through `TopoU:45-49`); `reference` `"BAMTest"`; `max_abs_um` 40.0; `min_common` 2; `**kwargs`. `Help:375-387`: `die` and `wafer` required, same defaults. `Contract`: no entry.
3. **Checks.** Validator in full. State machine: `UsedByDeveloper` only. Testing lock. No prober check, no project check. Both dies must be measured (code 400, `Topo:199-201`; `TopoU:82-88`) and complete (code 400, `Topo:202-206`). They must share at least `min_common` positions (code 400, `Topo:208-212`). `|dz|` above `max_abs_um`: nothing is saved, the agent enters `Error`, code 500 (`Topo:214-219`). With `min_common` 0 or less and no common position, `dz` is `None` (`TopoU:147-148`) and `abs(None)` raises (`Topo:215`): code 500 and `Error` state (`CmdMap:314-326`).
4. **DB.** None.
5. **Kafka.** Only 0.4.
6. **Globals.** None read. Writes the `Error` state on the limit.
7. **Prober.** None.
8. **Files.** Reads `Contacting/topography/<wafer>/LEC_topography.json` (`TopoU:62-68`). Reads and rewrites `Contacting/topography/<wafer>/dies/<die>.json`, key `topography_correction`, other keys kept (`TopoU:57-59`, `91-100`; `Topo:238`).
9. **Duration.** `Help:386`: under 1 second.
10. **Reply.** Type `ComputeTopographyCorrectionReply`. Text `<die> vs <reference>: dz=<dz> um on LEC positions [..] (spread <s> um), overdrive correction <od> um -> <path>` (`Topo:244-245`).
11. **Without DB and Kafka.** G2 and G3 only. Files only.

## 28. RunSequencer

1. **Handler.** `CmdMap:150-152`, a lambda → `run_sequencer`, `SeqJ:5-59`, `@validate_command` (`SeqJ:5`). The path comes from `get_filepath_param` (`CmdMap:208-220`).
2. **Parameters.**
   - The lambda passes only `filepath=` and `executor=` (`CmdMap:150-152`). `user` and `waferAgentName` of the request are dropped.
   - `filepath`: `data["filepath"]`, else the first key that ends in `.json` (`CmdMap:214-219`).
   - `executor` is not used: the function imports `execute_command` itself (`SeqJ:10`, `30`).
   - `Help:240-252`: key `filepath` (lower case). Its example path `/sequencer/TestSequence.json` (`Help:250`) does not exist: the file is `TestSequance.json`, and the leading `/` makes the path absolute.
   - Validator schema: `filePath`, required (`Val:383-385`). `Contract`: `filePath`, required (`Contract:1637-1647`), tag "3. DEVELOPER LEVEL" (`Contract:1280`).
   - **Disagreement:** two spellings, and none of them works (point 3).
3. **Checks.**
   - State machine: `UsedByDeveloper` only (`CmdMap:277-287`). Inside a trusted sequence: code 403 (`CmdMap:262-266`).
   - Validator, agent name: `waferAgentName` is `None` because the lambda dropped it. Result: code 500 when `g.wpAgentName` is empty, otherwise code 403 `Wrong agent: This is '<name>', not 'None'` (`Val:111-123`; `Name:12-25`).
   - Even with an agent name, the schema needs `filePath` (`Val:286-291`), and the function receives `filepath` and `executor`: code 400 `Missing required parameter: 'filePath'`. Adding `filePath` does not help: the function has no such parameter and no `**kwargs` (`SeqJ:6`), so the call raises `TypeError`: code 500 and `Error` state.
   - **Result: `RunSequencer` cannot reach its file in any call path of this code.**
4. **DB.** None of its own.
5. **Kafka.** The sender turns a text parameter that ends in `.json` into `{"filepath": ...}` (`Kafka:195-197`); `execute_command` does the same (`CmdMap:243-245`). The listener runs the request only when `data` has the `waferAgentName` of the machine (0.4 point 1); then the lambda drops it.
6. **Globals.** None of its own.
7. **Prober.** None of its own.
8. **Files.** Would read the JSON file at `filepath` (`SeqJ:13-14`), relative to the working directory or absolute.
9. **Duration.** "Variable" (`Help:251`).
10. **Reply.** Type `RunSequencerReply` (`Dec:54-56`). As written: success `Successfully executed <n> commands` (`SeqJ:48`); a failed step: 500 `Step <i> '<command>' failed: <message>` (`SeqJ:39-46`); a step that returns nothing: 500 (`SeqJ:32-35`); 404 file not found, 400 bad JSON, 500 other (`SeqJ:50-59`). The step results are collected (`SeqJ:16`, `37`) but not returned.
11. **Without DB and Kafka.** Not usable as it is, with or without Kafka. A tool would have to call the JSON runner without the decorator, or fix the lambda and the schema. Format: section A.2.

## 29. RunSequencerYAML

1. **Handler.** `CmdMap:153-157`, a lambda → `run_sequencer_yaml`, `SeqY:8-108`, `@validate_command` (`SeqY:8`). It is validated as `RunSequencerYaml` (`Dec:54-56`), not as the router key `RunSequencerYAML`.
2. **Parameters.**
   - `filepath`: `data["filepath"]`, else a key that ends in `.json` (`CmdMap:214-219`). A YAML path must be sent as `filepath`. Without it, `open(None)` fails: code 500 `Sequencer error: ...` (`SeqY:106-108`).
   - `user`, `waferAgentName`: named parameters (`SeqY:9`).
   - Every other key goes to `**kwargs` and replaces the value of the same name in the file's `params` (`SeqY:17-20`). There is no list of allowed keys.
   - A key `executor` in the request clashes with the explicit `executor=` of the lambda (`CmdMap:155-156`): `TypeError`, code 500 and `Error` state.
   - No schema for `RunSequencerYaml` (`Val:321-416`). `Help`: no entry. `Contract`: no entry.
3. **Checks.** State machine: `RunSequencerYAML` only in `UsedByDeveloper`; code 403 inside a trusted sequence (`CmdMap:262-266`). Validator: agent name, log-in, testing lock, level: `RunSequencerYaml` is in no set (`Const:36-95`), so Developer only. The sequence is not trusted: every step goes through all checks again, state machine included (section A.3).
4. **DB.** None of its own; the steps' own.
5. **Kafka.** Only 0.4. Values of the request go through `ast.literal_eval` before they replace file values (`Kafka:169-176`). One reply at the end; the sender's default timeout is 30 s (0.4 point 9).
6. **Globals.** None of its own.
7. **Prober.** None of its own.
8. **Files.** Reads the YAML file at `filepath` (`SeqY:14-15`): any path the process can read, relative to the working directory or absolute. No check of the path.
9. **Duration.** The sum of the steps. Progress on the console only (`SeqY:68`, `73-74`, `90`).
10. **Reply.** Type `RunSequencerYamlReply`. Success text `Successfully executed YAML sequence from <filepath>` (`SeqY:98`). Errors: a failed step 500 `Step <i> '<command>' failed: <message>` (`SeqY:83-86`); a step that returns nothing 500 (`SeqY:78-81`); 404 file not found, 400 bad YAML, 500 other (`SeqY:100-108`). No step result is returned.
11. **Without DB and Kafka.** G2 (Developer, state `UsedByDeveloper`) and G3, for the command and again for each decorated step: each step must carry the same `user` and `waferAgentName` (section A.3). Plus the gaps of the step commands.

## Sequencer helpers: facts common to commands 30 to 40

- **Handlers** are plain functions in `Img` without a decorator (`Img:14-870`). So: no agent-name, log-in, testing-lock, level or schema check. Sent alone, they run only in the state `UsedByDeveloper`: none is in a state table (`SM:40-196`). Inside a built-in sequence they run for an Expert (section A.4).
- All have `**kwargs`: unknown keys are ignored. A missing required argument is a `TypeError`: code 500 and `Error` state (common facts above).
- None calls `_ensure_initialized()`. `GetChuckXY` and `MoveChuckXYPrecise` call `get_current_prober()`, which raises `ProberNotConnectedError` when there is no connection (`Fac:132-162`): code 503 (`CmdMap:309-312`). `GenerateRasterSteps` tries the prober and goes on without it. The other eight never use the prober.
- None calls the DB. None reads or writes a global of the agent (`Img:14-870`), apart from the connection flag that `get_current_prober()` reads (`Fac:152-160`).
- `Help` and `Contract` have no entry for any of the eleven.
- The reply type is fixed text in each function. Where it differs from the command name, it is said below.
- `Kafka`: only 0.4 for all eleven, plus what is said per command.

## 30. ComputeCouplingConstants

1. **Handler.** `CmdMap:160` → `compute_coupling_constants`, `Img:262-344`.
2. **Parameters** (`Img:262-263`): `log_file` str, default `"chuck_xy_log.csv"`; `wafer` str, default `""`.
3. **Checks.** Common facts. The log file must exist (code 400, `Img:276-278`) and hold at least 4 data rows (code 400, `Img:291-293`).
4. **DB.** None. 5. **Kafka.** Only 0.4. 6. **Globals.** None. 7. **Prober.** None.
8. **Files.**
   - Reads `log_file` (parameter, relative to the working directory) as CSV with the columns `label, x_um, y_um`. Labels `RR_CC` or `RR_CC.jpg` are used, `HOME` and other labels are skipped (`Img:281-289`). The file is written by command 31.
   - Writes `Imaging/<wafer>/CALIBRATION_MOVEMENT/coupling_constants.json` with `y_col_correction_um`, `x_row_correction_um`, `calibrated`, `source_log`, `num_columns`, `num_rows` (`Img:64-66`, `313-325`). With an empty `wafer` the path is `Imaging/CALIBRATION_MOVEMENT/...` (`Img:66`).
   - Deletes `log_file` afterwards (`Img:328-332`).
   - The docstring says `calibration/coupling_constants.json` (`Img:268`); the code uses the path above.
9. **Duration.** Fast; no prober, one small file.
10. **Reply.** Type `ComputeCouplingConstantsReply`. Text `Coupling constants saved → <path>` followed by two lines with the two values and the raw drifts (`Img:334-338`). With only one column or one row the averages divide by zero; this is caught: code 500 (`Img:304`, `310`, `342-344`).
11. **Without DB and Kafka.** G2 (state `UsedByDeveloper`) only. Files only.

## 31. GetChuckXY

1. **Handler.** `CmdMap:161` → `get_chuck_xy`, `Img:23-62`.
2. **Parameters** (`Img:23`): `log_file` str, default `"chuck_xy_log.csv"` (empty: no file); `label` str, default `""`.
3. **Checks.** Common facts. No connection: code 503 (`Img:39`, `58-59`).
4. **DB.** None. 5. **Kafka.** Only 0.4. 6. **Globals.** None.
7. **Prober.** One call: `prober.prober.get_chuck_xy(ChuckSite.Wafer, ChuckXYReference.Zero)` (`Img:40`). This bypasses the driver class and calls the SENTIO library object that the driver keeps in `self.prober` (`Sentio:14`). On the mock driver it fails: code 500 (`Img:60-62`; common facts). No `local_mode`.
8. **Files.** `log_file`: with `label == "HOME"` the file is rewritten with a header row; otherwise one row is appended, without a header even when the file is new (`Img:44-54`). Path: parameter, relative to the working directory.
9. **Duration.** One prober query.
10. **Reply.** Type `GetChuckXYReply`. Text `x=<x>, y=<y>` (`Img:56`).
11. **Without DB and Kafka.** G2, G4. Not on the mock driver.

## 32. BuildFlatfield

1. **Handler.** `CmdMap:162` → `build_flatfield_for_folder`, `Img:732-754`, which calls `build_flatfield` (`StitchF:150-213`).
2. **Parameters** (`Img:732-734`): `folder` str, required; `wafer` str, `""`; `sample_n` int, 64; `sigma` float, 300; `output` str, `"flatfield.npy"`.
3. **Checks.** Common facts. At least 3 readable tiles (`StitchF:188-190`).
4. **DB.** None. 5. **Kafka.** Only 0.4. 6. **Globals.** None. 7. **Prober.** None.
8. **Files.** Reads tiles named `<row>_<col>.jpg` or `.jpeg` in `Imaging/<wafer>/<folder>` (or `<folder>` without a wafer) (`Img:743`; `StitchF:96-114`), a random sample of at most `sample_n` (`StitchF:176-177`). Writes `<that folder>/<output>` as a numpy file (`Img:744`; `StitchF:209-211`).
9. **Duration.** Not stated in the code: not found.
10. **Reply.** Type `BuildFlatfieldReply`. Text `Flatfield saved → <path>` (`Img:749-750`). Any error: code 500 (`Img:751-754`).
11. **Without DB and Kafka.** G2 only. Needs numpy and OpenCV (`StitchF:43-44`) and scipy (`StitchF:165-168`).

## 33. GenerateRasterSteps

1. **Handler.** `CmdMap:163` → `generate_raster_steps`, `Img:347-598`.
2. **Parameters** (`Img:347-402`). All optional. Numbers are converted with `int()` or `float()` (`Img:429-447`, `468-471`).
   | Name | Default | Notes |
   |---|---|---|
   | `num_columns`, `num_rows` | 1, 1 | |
   | `column_spacing_um`, `row_spacing_um` | -2968, 2476 | Normal mode: the relative moves use the absolute values (`Img:572`, `591-592`). The tile positions, used by the mask mode and the absolute targets, use the signed values (`Img:479-481`). |
   | `start_x_um`, `start_y_um` | `None` | `None` (or an empty YAML value): both are taken from block `start_config` of `Cfg/WPImagingConfig.json` (`Img:433-440`; `ImgCfg:19-28`). |
   | `start_config` | `"LEC"` | |
   | `settle_time_s` | 1 | |
   | `col_settle_time_s`, `row_settle_time_s` | `None` | `None` means `settle_time_s` (`Img:444-445`). |
   | `y_col_correction_um`, `x_row_correction_um` | `None` | Without the circle mask, `None` loads `Imaging/<wafer>/CALIBRATION_MOVEMENT/coupling_constants.json` (`Img:454-461`; `Img:69-85`). Every sequence file passes explicit numbers (section B). |
   | `wafer_radius_um` | 0 | Above 0: circle-mask mode (`Img:447-448`). |
   | `wafer_center_x_um`, `wafer_center_y_um` | 0, 0 | Same frame as `start_x_um`/`start_y_um`. |
   | `debug_edge_cols_only` | `False` | Mask mode only: the first and last tile of each row (`Img:519`, `528-529`). Converted with `bool()`: the text `"false"` is true. |
   | `wafer` | `""` | Only for the coupling-constants path. |
3. **Checks.** Common facts. There is no `try` around the body: a missing coupling-constants file (`Img:77-82`), a bad start block (`ImgCfg:23-28`) or a value that is not a number is an exception: code 500, `UnhandledErrorReply` and `Error` state (`CmdMap:314-326`).
4. **DB.** None.
5. **Kafka.** The result has no `type` and no `data`, so the listener replaces it with `{status: "Success", type: "GenerateRasterStepsReply", data: {output: "No output", executionTimeMs}}` (`Kafka:611-620`). The `steps` do not reach the sender (as `inventory-B.md` 0.4 point 7).
6. **Globals.** None.
7. **Prober.** At most one query: `prober.prober.get_chuck_xy(Wafer, Zero)` to anchor the absolute targets (`Img:500-508`). Any failure (no connection, mock driver) is caught and the absolute targets are `None` (`Img:507-508`, `510-514`). No move.
8. **Files.** Reads `Cfg/WPImagingConfig.json` only when a start value is `None`; reads the coupling-constants file only in normal mode with a correction left `None`. Writes nothing.
9. **Duration.** Fast; computation only.
10. **Reply.** Not a `ResponseBuilder` reply: `{"status": "Success", "steps": [...]}` (`Img:551`, `598`). Each step is a dict with `action` (`"move"` or `"snapshot"`), `x`, `y` (relative move in µm; 0 for a snapshot), `filename` (`RR_CC.jpg` for a snapshot, row index counted from the bottom, `Img:526`, `564`), `settle` (s), and for a move `abs_x`, `abs_y` (absolute target, or `None` without a prober).
    - Normal mode: one move to the start, then for each row the snapshots with a column move between them, and a row-return move between rows (`Img:554-596`). That is `1 + R·C + R·(C-1) + (R-1)` steps.
    - Mask mode: a move and a snapshot for each tile whose centre lies inside the circle, moving directly from tile to tile, no drift corrections (`Img:517-551`).
    - No sequence file passes `abs_x`/`abs_y` on to command 34 (search for `abs_` in `seq/*.yaml`: no match).
11. **Without DB and Kafka.** G2 only. No prober needed. Through Kafka the steps are lost; a direct call returns them.

## 34. MoveChuckXYPrecise

1. **Handler.** `CmdMap:164` → `move_chuck_xy_precise`, `Img:88-259`. Also called directly by commands 20 and 21 (`Con:169-171`) and by the precise mode of `MoveChuckRowColumn` (`Grid:72`, `108-109`).
2. **Parameters** (`Img:88-92`):
   | Name | Type | Required | Default | Notes |
   |---|---|---|---|---|
   | `x`, `y` | float | yes | | µm; a delta for `Relative`, a target for `Zero`. |
   | `position` | str | no | `"Relative"` | `"Relative"` or `"Zero"`: closed loop. Any other value: one plain move and success, no loop (`Img:163-166`). The docstring lists `"Center"` as supported (`Img:120`); it takes that no-loop branch. |
   | `abs_target_x`, `abs_target_y` | float | no | `None` | Both given: the target is absolute and `x`, `y` are recomputed as deltas from the current position (`Img:142-151`). The primary move still uses `position` (`Img:169`), so only `position="Relative"` gives the intended move. |
   | `precision_um` | float | no | 1.0 | Accepted error per axis; never below 0.10 µm (`Img:185-186`). |
   | `max_iterations` | int | no | 3 | Correction moves. |
   | `correction_settle_s` | float | no | 0.2 | Wait after each correction. |
   - Callers use other values: the sequence files 0.15 / 100 / 0.1 (for example `seq/TakeImageLECDie.yaml:84-86`; 0.15 / 20 / 0.1 for the SEG dies of `seq/TakeImageLEC.yaml:201-203`); commands 20 and 21 0.15 / 10 / 0.1 (`Con:97`, `126`).
   - `ITS3TestAgent/its3_test_agent.py:293` sends this command alone with `x`, `y`, `position` and a 60 s timeout. Alone it runs only in the state `UsedByDeveloper` (common facts).
3. **Checks.** Common facts. No connection: code 503 (`Img:129`, `255-256`).
4. **DB.** None. 5. **Kafka.** Only 0.4. 6. **Globals.** None; no `update_current_info` (commands 20 and 21 add it).
7. **Prober**, in order (`Img:136-234`):
   1. `prober.prober.get_chuck_xy(Wafer, Zero)`: the start position (direct SENTIO library call, as command 31);
   2. `prober.move_chuck_xy(x, y, position)`: the primary move through the driver (`Img:169`; `Sentio:89-97`);
   3. up to `max_iterations + 1` times: `prober.prober.get_chuck_xy(...)`; if the error is above the limit and corrections are left, `prober.prober.move_chuck_xy(ChuckXYReference.Relative, cx, cy)` and a wait (`Img:195-234`). The first correction is twice the error; later ones subtract the coupling learned from the first (`Img:211-224`).
   - No `local_mode`. Fails on the mock driver (no `prober` attribute): code 500.
8. **Files.** None.
9. **Duration.** One SENTIO move plus at most `max_iterations` corrections and waits. With the sequence value 100 and 0.1 s that is up to 100 extra moves per tile.
10. **Reply.** Type `MoveChuckXYPreciseReply`. Success `x=<x>, y=<y>, err=(<ex>,<ey>) µm, iter=<n>` (`Img:250-253`). Not reached: code 500 `Precision not reached after <n> corrections: residual=(<ex>, <ey>) µm  (tolerance=<p> µm)` (`Img:243-248`). Other errors: code 500 with the error text (`Img:257-259`). A failed result does not change the state; `execute_command` then calls `_try_local_mode()` (`CmdMap:307`).
11. **Without DB and Kafka.** G2, G4. Not on the mock driver, so a tool tested with the mock cannot test any precise move.

## 35. Sleep

1. **Handler.** `CmdMap:165` → `sleep`, `Img:14-20`.
2. **Parameters**: `seconds`, default 1, converted with `float()` (`Img:17`). A value that is not a number is an exception: code 500 and `Error` state.
3. **Checks.** Common facts.
4. to 8. None. While it sleeps, it holds a pool thread (0.4 point 3).
9. **Duration.** `seconds`.
10. **Reply.** Type `SleepReply`. Text `Slept <seconds>s` (`Img:20`).
11. **Without DB and Kafka.** G2 only.

## 36. StitchImagesFull

1. **Handler.** `CmdMap:166` → `stitch_images_large_for_wafer`, `Img:606-651`, which calls `stitch_images_large` (`StitchF:509-557`, body `StitchF:559-992`).
2. **Parameters** (`Img:606-609`):
   | Name | Default | Notes |
   |---|---|---|
   | `folder` | required | Die or output folder. |
   | `wafer` | `""` | Folder `Imaging/<wafer>/<folder>`, or `<folder>` without a wafer (`Img:600-602`). |
   | `save_overview_jpg` | `False` | Also write a scaled overview. Converted with `bool()` (`Img:641`). |
   | `pyramid_tiff` | `True` | Write the full-resolution pyramidal BigTIFF. Converted with `bool()` (`Img:639`). |
   | `tiff_quality` | 75 | The sequence files pass 85. |
   | `name_suffix` | `""` | Added to the file name, for example `_LEC`. |
   | `n_workers` | `None` | `None`: `min(cpu count, 6)` threads (`StitchF:659`). |
   | `flatfield` | `None` | Path of a `.npy`. Empty and a wafer given: `Imaging/<wafer>/CALIBRATION_COLOR/flatfield.npy` when it exists (`Img:626-634`). The docstring says `Imaging/<wafer>/FLATFIELD/flatfield.npy` (`Img:613-614`); the code uses `CALIBRATION_COLOR`. |
   | `flatfield_strength` | 1.0 | |
3. **Checks.** Common facts.
4. **DB.** None.
5. **Kafka.** 0.4, plus: `bool("false")` is true (`Img:639-641`). The text `"false"` from Kafka stays text (0.4 point 2), so `save_overview_jpg: "false"` writes an overview and `pyramid_tiff: "false"` still writes the TIFF. `False` (capital F) is converted to a bool and works.
6. **Globals.** None. 7. **Prober.** None.
8. **Files.**
   - Reads the tiles `<row>_<col>.jpg` of the folder (`StitchF:96-114`, `610-614`) and the flatfield file (`StitchF:641-650`).
   - Writes `<timestamp>_<die><name_suffix>.tif` (`Img:621-623`; `StitchF:726-728`) and, with `save_overview_jpg`, `<timestamp>_<die><name_suffix>.jpg` (`StitchF:977-983`), in the same folder. Temporary files `<tif>.l*.tmp` during the run (`StitchF:468-469`).
   - The TIFF is skipped when the free disk space is below the need (`StitchF:729-733`). If neither file is written: `RuntimeError`, code 500 (`StitchF:987-992`).
9. **Duration.** Long for large grids. Progress on the console every 200 tile pairs (`StitchF:682-683`). No time is stated in the code.
10. **Reply.** Type `StitchImagesReply` (not `StitchImagesFullReply`). Text `Stitched -> <absolute path of the .tif, or of the overview>` (`Img:646`; `StitchF:988-991`). Any error: code 500 (`Img:648-651`).
11. **Without DB and Kafka.** G2 only. Needs OpenCV, numpy, and tifffile with imagecodecs for the TIFF (`StitchF:32`, `316`, `740-742`).

## 37. CropImage

1. **Handler.** `CmdMap:167` → `crop_stitched_image`, `Img:653-729`. Only commented-out steps of the sequence files use it (for example `seq/TakeImageBAM.yaml:127-138`).
2. **Parameters** (`Img:653-655`): `folder` required; `wafer` `""`; `x_px`, `y_px` 0 (from the bottom-left corner); `width_px`, `height_px` `None` (0 or `None`: up to the right or top edge); `source` `""` (newest `.tif` or `.jpg` of the folder); `output` `""` (overwrite the source); `tif_quality` 75.
3. **Checks.** Common facts. The function has no `try`: every error is an exception, code 500, `UnhandledErrorReply` and `Error` state (`CmdMap:314-326`). This includes: tifffile missing (`Img:670`), a `.jpg` source (the newest file may be a `.jpg`, `Img:677-680`, but it is opened with `tifffile` only, `Img:695`, `714`), a value that is not a number.
4. **DB.** None. 5. **Kafka.** Only 0.4. 6. **Globals.** None. 7. **Prober.** None.
8. **Files.** Reads the source; reads the whole full-resolution page into memory (`Img:715`). Writes the output: TIFF with JPEG compression for `.tif`/`.tiff`, otherwise through Pillow (`Img:718-723`). The default overwrites the source (`Img:692`).
9. **Duration.** Not stated: not found.
10. **Reply.** Type `CropImageReply`. Text `Saved <w>×<h> crop to '<path>'` (`Img:728-729`). Code 404 when there is no source (`Img:682-690`), 400 when the region is outside the image (`Img:709-711`).
11. **Without DB and Kafka.** G2 only. Needs tifffile, numpy, Pillow.

## 38. CleanupRasterImages

1. **Handler.** `CmdMap:168` → `cleanup_raster_images`, `Img:829-844`.
2. **Parameters** (`Img:829`): `folder` required; `wafer` `""`.
3. **Checks.** Common facts.
4. to 7. None.
8. **Files.** Deletes the files named `<2-3 digits>_<2-3 digits>.jpg` or `.jpeg`, any case, in `Imaging/<wafer>/<folder>` (`Img:834-838`). Other files stay. Cannot be undone. A missing folder: code 500 (`Img:841-844`).
9. **Duration.** Fast.
10. **Reply.** Type `CleanupRasterImagesReply`. Text `Deleted <n> tiles from <folder>` (`Img:839-840`).
11. **Without DB and Kafka.** G2 only.

## 39. ArchiveImaging

1. **Handler.** `CmdMap:169` → `archive_imaging`, `Img:757-826`.
2. **Parameters** (`Img:757-758`): `source_dir` `"Imaging"`; `dest_dir` `"/eos/project/a/aliceits3/ITS3-WP3/MOSAIX/prober_imaging"` (server only).
3. **Checks.** Common facts. Missing source: code 400 (`Img:770-772`).
4. **DB.** None. 5. **Kafka.** Only 0.4. 6. **Globals.** None. 7. **Prober.** None.
8. **Files.**
   - Walks `source_dir`. Folders named `CALIBRATION_COLOR` or `CALIBRATION_MOVEMENT`, at any depth, are skipped and stay (`Img:779-790`).
   - Creates each destination folder with `os.makedirs` (`Img:792-794`), copies each file with `shutil.copy2`, then deletes the source file (`Img:796-806`).
   - Removes the empty source folders from the bottom up, `source_dir` itself included when it is empty (`Img:809-813`).
   - With the default `source_dir` it moves the whole `Imaging/` folder, every wafer in it, not only the current one.
9. **Duration.** Depends on the amount of data and on the destination; not stated in the code.
10. **Reply.** Type `ArchiveImagingReply`. Text `Moved <n> files from <source> to <dest>`, plus ` (<k> calibration files kept locally)` (`Img:815`, `820-821`). Errors for single files are collected: code 500 with the list, and those files stay (`Img:804-806`, `816-819`). Any other error, for example a destination that cannot be created: code 500 (`Img:823-826`).
11. **Without DB and Kafka.** G2 only. A config file would have to give a local destination. The EOS path is the default here, fixed text in 10 of the 16 built-in sequences (all `TakeImage*` files except `TakeImageLECDie`), and the default of the parameter `archive_dir` in `TakeImageLECDie` and `NeedleOffsetMeasureER2B` (section B).

## 40. DeleteImagingFolder

1. **Handler.** `CmdMap:170` → `delete_imaging_folder`, `Img:847-870`.
2. **Parameters** (`Img:847`): `wafer` `""`. Empty: code 400 `Folder not found: ` (`Img:857-860`).
3. **Checks.** Common facts. The value of `wafer` is joined into the path as it is, without any check (`Img:857`).
4. **DB.** None. 5. **Kafka.** Only 0.4. 6. **Globals.** None. 7. **Prober.** None.
8. **Files.** `shutil.rmtree("Imaging/<wafer>")`, calibration folders included (`Img:857-862`). Cannot be undone. No sequence file uses this command (search in `seq/`).
9. **Duration.** Fast.
10. **Reply.** Type `DeleteImagingFolderReply`. Text `Deleted Imaging/<wafer> entirely` (`Img:863-865`).
11. **Without DB and Kafka.** G2 only.

## Map conversion (`WPAgent/actions/WPMapConversionActions.py`)

Not reachable from any command.

- `COMMAND_ROUTER` has no entry for it (`CmdMap:39-175`), and `CmdMap` does not import it (`CmdMap:1-14`).
- No file of the export imports the module: the only mentions are `WPAgent/README.md:115` and the linter exclusion list, which calls it "not in COMMAND_ROUTER, not imported — dead code" (`WPAgent/linters/CheckKafkaConventions.py:35`). Its helper `get_converter` (`WPAgent/utilities/WPMapConverter.py:426`) is used only by this module.
- Its docstrings show commands such as `ConvertGlobalToLocal` and `ConvertLocalToGlobal` (`MapAct:52-56`, `124-129`); sent today they get code 404 `Unknown command` (`CmdMap:269-273`).
- Its default map `configs/WPMapConversion.json` (`MapAct:15`, `159`) is not in `Cfg/`; only `WPMapConversion_ER2.json` and `WPMapConversion_ER2B.json` are. Its functions return `{"status": "success"/"error", "output", "data"}`, not the reply format of `RB`.
- Die labels and coordinates are done today by `DieMaps` (used by `MoveChuckRowColumn`, `GetDieList`, `MeasureLECTopographyDie`: `Test:5`; `Topo:17`).

---

# A. The sequencer in full

## A.1 What runs a sequence

| Entry | Format | Runner | Who | Trusted |
|---|---|---|---|---|
| `RunSequencer` (`CmdMap:150-152`) | JSON | `run_sequencer` (`SeqJ:5-59`) | nobody: it cannot succeed (command 28) | no |
| `RunSequencerYAML` (`CmdMap:153-157`) | YAML | `run_sequencer_yaml` (`SeqY:8-108`) | Developer, state `UsedByDeveloper` | no |
| 16 built-in commands (`CmdMap:110-125`, made by `_yaml_command`, `CmdMap:22-37`) | YAML, fixed file | `run_sequencer_yaml` | Expert in state `Aligned`, or Developer | yes |
| class `WPSequencer` (`Seq:9-59`) and class `WPSequencerYAML` (`SeqYC:7-60`) | JSON / YAML | | not used: no file imports them (search in the export; only `WPAgent/README.md:134-135` and `WPAgent/WPAgentStruct.mermaid:67` name them) | |

The two unused classes would also fail with every handler of today: they treat a step as failed unless its `status` is `"success"` in lower case (`Seq:49`; `SeqYC:47`, `55`), and the handlers return `"Success"` (`MsgSt:4-5`; `RB:73-78`).

## A.2 JSON sequence files (`RunSequencer`)

- The file is a JSON list. Each element is `{"command": "<name>", "data": {...}}` (`SeqJ:13-20`).
- No variables, no loops, no conditions, no passing of results.
- `user` and `waferAgentName` given to the runner are written into every step's `data` (`SeqJ:22-25`); the router never gives them (command 28).
- Each step runs through `execute_command` (`SeqJ:10`, `30`), with every check of a normal request (A.3, "Executor").
- The first failed step stops the run (`SeqJ:39-46`). The step results are collected (`SeqJ:16`, `37`) and dropped. Reply: section "Reply" of command 28.
- Two JSON layouts exist in `seq/`. `TestSequance.json` uses `data` (the layout of `run_sequencer`). `AutoProbe.json` and `LoadWaferSequence.json` use `params` (the layout of the unused class `Seq:44`); `run_sequencer` would ignore their parameters (`SeqJ:20`).

Example, the whole of `seq/TestSequance.json:1-16`:

```json
[
  {
    "command": "AutoFocus",
    "data": {
      "user": "user1",
      "waferAgentName": "CERN"
    }
  },
  {
    "command": "MoveChuckPreviousDie",
    "data": {
      "user": "user1",
      "waferAgentName": "CERN"
    }
  }
]
```

## A.3 YAML sequence files (`run_sequencer_yaml`)

**Document.** A YAML mapping with two keys, read with `yaml.safe_load` (`SeqY:14-18`):
- `params:` a mapping of input variables and their defaults. Missing: `{}`. An empty `params:` is `None` and makes the run fail at `context.update` with code 500 `Sequencer error` (`SeqY:17-20`, `106-108`).
- `steps:` a list of steps. Missing: `[]`, and the run succeeds with no step.
- A document that is not a mapping (an empty file, a list) fails at `doc.get`: code 500 `Sequencer error`.

**Variables.**
- The context starts as `params` (`SeqY:17`). Every key of the request except `filepath`, `user`, `waferAgentName` replaces or adds a context value (`SeqY:20`). Then `user` and `waferAgentName` are set, if given (`SeqY:21-24`).
- There is one context for the whole run. Loop variables and `as` results are written into it and stay after the loop (`SeqY:51`, `89`).
- Values keep their YAML types (`true`, numbers, lists). Request values arrive as Python values after `ast.literal_eval` (0.4 point 2).

**References** (`resolve`, `SeqY:26-42`).
- A string value that starts with `$` is a reference: `$name` is `context["name"]`; `$name.a.b` walks into dicts (`SeqY:27-37`).
- Only a whole value is replaced. `"Imaging/$wafer"` stays as it is (the check is `value.startswith("$")`, `SeqY:27`).
- An unknown name, or a missing key inside a dict, gives the literal text, for example `"$wafr"`, to the command; there is no error (`SeqY:31`, `34-36`).
- References inside dicts and lists are resolved too (`SeqY:38-41`).

**Command step** (`SeqY:57-90`). Keys:
- `command`: the command name (required; a missing key ends the run with code 500 `Sequencer error`, `SeqY:57`, `106-108`);
- `params`: the data of the command, resolved (`SeqY:58`); missing: `{}`;
- `as`: store the result (see "Passing results");
- `when`: a condition.

**Condition** (`when`, `SeqY:62-70`).
- The only form is `<left> == <right>`. The text is split at `==`; with exactly two parts, `<left>` is resolved, `<right>` loses spaces and double quotes, and the step runs only if `str(left) == right`.
- Any other text (no `==`, two `==`, `!=`) is not checked at all: the step runs (`SeqY:65`).
- No `and`, `or`, `not`, numbers or other operators. Single quotes on the right side are not removed.
- `when` on a `foreach` step is ignored (`SeqY:47-55` runs before `SeqY:62`).

**Loop step** (`SeqY:47-55`). Keys: `foreach` (a list, or a reference to one), `as` (loop variable name, default `item`), `steps` (the inner list). Loops can be nested: the inner list is run by the same function (`SeqY:52`).
- Iterating a text iterates its characters: an unknown reference `$dies` loops over `$`, `d`, `i`, `e`, `s`. `None` raises: code 500 `Sequencer error`.

**Passing results between steps** (`SeqY:59`, `88-90`).
- `as: <name>` on a command step stores `context[<name>] = {"steps": result.get("steps", [])}` after the step succeeded.
- Only the key `steps` of the result is kept. Only two commands put `steps` into their result: `GenerateRasterSteps` (`Img:551`, `598`) and `GetDieList` (`Topo:53`). With any other command, `as` stores `{"steps": []}`.
- Nothing else of a step's result (its text, its `data`) can reach a later step.

**Error handling.**
- The first failed step ends the whole run, also from inside nested loops (`SeqY:52-54`, `83-86`). There is no retry, no `on_error`, no final or cleanup step. Nothing is undone.
- A step that returns nothing: code 500 (`SeqY:78-81`).
- A step that raises is caught by `execute_command` (code 500, `UnhandledErrorReply`, `Error` state, `CmdMap:314-326`) and comes back as a failed result, so the run stops with it.
- The reply of a failed run always has code 500 (`SeqY:86`). The code of the step (for example 400, 403, 409, 503) is lost; only its message is kept, in the text `Step <i> '<command>' failed: <message>`. `<i>` counts in the current list, skipped `when` steps included (`SeqY:45`, `73`).

**Reply of the whole sequence.** One reply at the end. Type `RunSequencerYamlReply` (also for the 16 built-in commands: `SeqY:8-11`). Text `Successfully executed YAML sequence from <filepath>` (`SeqY:98`). `data` is the global state at the end (`RB:14-68`). No step result is returned.

**Progress.** Console only: the `when` check (`SeqY:68`), `[Step i/n] Executing: <command>` and its parameters (`SeqY:73-74`), what `as` stored (`SeqY:90`). Each step is also one line in `WPAgentLogger.log`, written by `execute_command` (`CmdMap:328-330`).

**Executor** (how a step is run).
- `run_sequencer_yaml` calls `executor(command, data)` for every step (`SeqY:76`). Every caller passes `_exec_in_sequence` (`CmdMap:34`, `155`), which is `execute_command(command, data)` (`CmdMap:180-185`).
- So a step goes through the same path as a Kafka request, without the Kafka parts (0.4): refusal of `RunSequencer`/`RunSequencerYAML` inside a trusted sequence (`CmdMap:262-266`), unknown command 404 (`CmdMap:269-273`), the state-machine check unless trusted (`CmdMap:277-287`), the handler with its own validator, `_try_local_mode()` after a failed result, 503 for `ProberNotConnectedError`, 500 and `Error` state for an exception, one log line (`CmdMap:289-330`).
- For `RunSequencerYAML` the run is not trusted: each step needs a state that allows it (in practice `UsedByDeveloper`), and each decorated step checks again agent name, log-in, lock, level, schema and orientations with the `user` and `waferAgentName` of its own `params`.
- `executor` is a parameter (`SeqY:9`). Called without it, the first step fails with code 500 `Sequencer error` (`None` is not callable). A caller can pass another function: this is the only point where the per-step checks could be replaced without changing the runner.

Example of `as`, `foreach` and a dotted reference, `seq/LECTopography_ER2.yaml:42-59`:

```yaml
  - command: GetDieList
    as: baby_dies
    params:
      user: $user
      waferAgentName: $waferAgentName

  - foreach: $baby_dies.steps
    as: d
    steps:
      - command: MeasureLECTopographyDie
        params:
          user: $user
          waferAgentName: $waferAgentName
          label: $d.label
          wafer: $wafer
          positions: $positions
          settle_s: $settle_s
          min_points: $min_points
```

Example of `when`, `seq/TakeImageLECDie.yaml:89-105`:

```yaml
      - command: Sleep
        params:
          user: $user
          waferAgentName: $waferAgentName
          seconds: $rs.settle
        when: "$rs.action == move"

      - command: TakeScreenshot
        params:
          user: $user
          waferAgentName: $waferAgentName
          fileName: $rs.filename
          outputDir: $die
          wafer: $wafer
          snapshot_type: $snapshot_type
          save_locally: $save_locally
        when: "$rs.action == snapshot"
```

## A.4 Trusted sequences (`Ctx`)

**What marks one.** The handler made by `_yaml_command` is validated once with the name of the built-in command (`CmdMap:29`), then runs `run_sequencer_yaml` inside `with trusted_sequence(command_name)` (`CmdMap:31-36`). `trusted_sequence` sets a `contextvars.ContextVar` for the time of the block and resets it at the end, also after an exception (`Ctx:24-33`). `in_trusted_sequence()` tests it (`Ctx:36-37`). Custom files (`RunSequencerYAML`, `RunSequencer`) are never marked (`Ctx:18`).

**What changes while it is set:**
1. `execute_command` refuses `RunSequencer` and `RunSequencerYAML` with code 403 (`CmdMap:262-266`). Another built-in command as a step is allowed: `NeedleOffsetMeasure_ER2B.yaml` runs `TakeImageLECDie` (`seq/NeedleOffsetMeasure_ER2B.yaml:100-109`). The inner block sets the mark again and restores the outer one at its end (`Ctx:29-33`).
2. `execute_command` skips the state-machine check of each step (`CmdMap:277`).
3. The validator skips the level check of each step for a non-Developer (`Val:230-233`).
4. `transition()` returns at once, so no step changes the state (`SM:229-232`). After the run the agent is in the state it had before, `Aligned` for an Expert, even when the chuck has moved, for example to another die or back from contact.

**What does not change:**
- The validator of each decorated step still checks the agent name, the log-in, the testing lock, the parameter schema and the orientations (`Val:74-104`; `Ctx:15-16`). So `InitProbing`, `MoveChuckRowColumn`, `MoveChuckContact`, `RunPTPA`, `AutoFocus`, `MoveChuckXY` inside a sequence still need G6 (`Val:540-555`).
- `enter_error_state()` and `force_state()` have no trusted guard (`SM:261-270`, `315-323`). A failing step can still put the agent in `Error`, for example commands 21 and 27 on their limits, or any exception in a step (`CmdMap:322-324`).
- The sequence command itself was checked against the state machine (`Aligned` or `UsedByDeveloper`, `SM:188-189`) and the level (`Const:77-95`).

**Scope.** The mark is a `ContextVar`, so it holds only in the thread that runs the sequence. A command that runs at the same time in another pool thread (0.4 point 3) is not trusted.

**Effect for an Expert.** Through the steps of the 16 built-in commands an Expert runs commands that are Developer-only when sent alone (in no set of `Const:36-95`): the helpers `GenerateRasterSteps`, `MoveChuckXYPrecise`, `Sleep`, `StitchImagesFull`, `CleanupRasterImages`, `ArchiveImaging`, `BuildFlatfield`; and `TakeScreenshot`, `FindHome`, `MoveChuckCenter`, `MoveChuckXY`, `SaveChuckPosition`, `AnalyzeNeedleMarks`, `ComputePadTargetOffset`, `MoveChuckToSavedPosition`, `MoveChuckBySavedOffset`, `MeasureLECTopographyDie` (steps: section B). The helpers `ComputeCouplingConstants`, `GetChuckXY`, `CropImage` and `DeleteImagingFolder` are not used by any of the 16 files.

## A.5 What this means for a tool without DB and Kafka

- **Only the YAML runner works.** `RunSequencer` cannot succeed (command 28). The classes in `seq/*.py` are not used and do not match today's replies (A.1). Two of the three JSON files use another layout, and their commands are not all in the router (section B).
- **Every step is validated again.** Through `_exec_in_sequence` each step of every sequence needs a logged-in user (G2), `g.wpAgentName` and the same `waferAgentName` in the step (G3), and for the orientation-checked steps the DB orientations (G6). A built-in sequence needs, before its first step, the state `Aligned` (only `InitProbing` reaches it, which needs the DB: G7) or a Developer. A tool must either fill these globals or pass its own `executor` (A.3, "Executor").
- **The sequence reply carries no data.** No step result is returned, `as` keeps only a `steps` list, and every failure becomes code 500 with the step's code lost (A.3).
- **The built-in files carry server and site facts as fixed text:** the EOS archive path, the ER2/ER2B project names (whose `NotchW_ArrowW` part drives the orientation check, `Val:498-512`), `InitProbing`, the working-directory paths `sequencer/<file>.yaml`, `Imaging/`, `Contacting/` (`CmdMap:110-125`; `inventory-B.md` 0.5). Every imaging loop uses `MoveChuckXYPrecise`, which fails on the mock driver (command 34).

---

# B. The files in `WPAgent/sequencer/`

The folder holds 22 YAML files, 3 JSON files and 3 Python files (`WPSequencer.py`, `WPSequencerYAML.py`, `__init__.py`; code, not sequences) (listing of `seq/`).

- **Registered by `COMMAND_ROUTER` but missing from the folder:** none. All 16 paths of `CmdMap:110-125` exist.
- **Not registered** (marked **NOT REG.** below): 6 YAML files and the 3 JSON files. A YAML file of these can run only through `RunSequencerYAML` (Developer, not trusted: command 29, A.3). A JSON file only through `RunSequencer`, which cannot succeed (command 28).
- Notation: `→` next step; `[ ... ]` the steps of a `foreach`; `(when move)` / `(when snapshot)` is `when: "$rs.action == move"` / `"... == snapshot"`. "baby" is the project `ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW`, "MOSAIX" is `ER2_MOSAIX_Vertical_V0_NotchW_ArrowW`, "EOS" is `/eos/project/a/aliceits3/ITS3-WP3/MOSAIX/prober_imaging`; all three as fixed text in the step.
- Every YAML file has the input variables `user` and `waferAgentName` (empty defaults); they are not repeated in the table. For the 16 registered files the defaults of the other variables are in `inventory-B.md` (commands 3 to 18, point 2); the table gives the names only.
- The imaging loop "R" below is: `GenerateRasterSteps` (as `raster`, `y_col_correction_um: 0`, `x_row_correction_um: 0`) → `[ MoveChuckXYPrecise (precision_um 0.15, max_iterations 100, correction_settle_s 0.1; when move) → Sleep (seconds $rs.settle; when move) → TakeScreenshot (fileName $rs.filename; when snapshot) ]`.

| # | File | Router | Commands in order (lines) | Input variables (lines) | Notes |
|---|---|---|---|---|---|
| 1 | `AnalyzeNeedleMarks_ER2.yaml` | **NOT REG.** | `[ AnalyzeNeedleMarks (folder $die) ]` over `$dies` (29-44) | `wafer` "Wafer", `dies` 25 labels (BAM00..BAM19, SEG0..SEG4), `config` "lec", `contrast` false, `require_ok` false, `root` EOS (12-27) | No prober. Its header example names `sequencer/AnalyzeNeedleMarks.yaml` (9), which does not exist. |
| 2 | `AnalyzeNeedleMarks_ER2B.yaml` | **NOT REG.** | as file 1 (30-45) | as file 1; `dies` 32 labels (BAM00..BAM13, S3G0..S3G8, S6G0..S6G8) (12-28) | Same header example (9). |
| 3 | `AutoProbe.json` | **NOT REG.** | Initialize → OpenProject {projectName "nkf7_arrow_e_test_21_07"} → Load → MoveChuckToWorkArea {work_area 1} → AutoFocus → MoveChuckXY {x, y} → AlignWafer → MoveChuckHome → RunPTPA (1-39) | none | Layout `params`, which `run_sequencer` ignores (`SeqJ:20`). `Load` is not in `COMMAND_ROUTER` (404). The schema of `MoveChuckToWorkArea` wants `workArea` (`Val:379-381`); that of `MoveChuckXY` also wants `position` (`Val:353-357`). |
| 4 | `BrightnessCorrection.yaml` | `BrightnessCorrection` (`CmdMap:120`) | OpenProject (baby) → InitProbing → MoveChuckCenter → GenerateRasterSteps (as raster, corrections 0.0) → `[ MoveChuckXY (Relative; when move) → Sleep (when move) → TakeScreenshot (outputDir $flatfield_die; when snapshot) ]` → BuildFlatfield (sample_n 25) → CleanupRasterImages (35-121) | `flatfield_die`, `num_columns`, `num_rows`, `column_spacing_um`, `row_spacing_um`, `start_x_um`, `start_y_um`, `col_settle_time_s`, `row_settle_time_s`, `snapshot_type`, `save_locally`, `wafer`, `flatfield_sigma`, `flatfield_output` (14-33) | Uses `MoveChuckXY`, not the precise move. |
| 5 | `DebugChuckMovement.yaml` | **NOT REG.** | OpenProject (baby) → InitProbing → MoveChuckRowColumn (label BAM00) → GetChuckXY (label "HOME") → GenerateRasterSteps (as raster) → `[ MoveChuckXY (Relative; when move) → Sleep (when move) → GetChuckXY (label $rs.filename; when snapshot) ]` → ComputeCouplingConstants (41-121) | `wafer` "Wafer", `num_columns` 5, `num_rows` 4, `column_spacing_um` -2968, `row_spacing_um` 2476, `start_x_um` -21088, `start_y_um` -27245, `col_settle_time_s` 0.5, `row_settle_time_s` 2, `y_col_correction_um` 0.0, `x_row_correction_um` 0.0, `log_file` "chuck_xy_log.csv" (19-39) | Writes the coupling constants that `GenerateRasterSteps` loads when its corrections are empty. The header says labels look like `R<row>C<col>_move` (7); the steps write `HOME` and the tile names `RR_CC.jpg` (66, 111). |
| 6 | `DebugWaferEdges.yaml` | **NOT REG.** | OpenProject (baby) → InitProbing → OpenProject (MOSAIX) → FindHome → MoveChuckRowColumn (label SEG4) → 4 times: MoveChuckXY (fixed relative offset) → Sleep ($pause_s) → MoveChuckXY (back) (11-131) | `pause_s` 5 (6-9) | Fixed offsets in µm (46-47, 69-70, 92-93, 115-116). |
| 7 | `DebugWaferGrid.yaml` | **NOT REG.** | OpenProject (baby) → InitProbing → OpenProject (MOSAIX) → FindHome → MoveChuckRowColumn (label SEG4) → GenerateRasterSteps (as raster, circle mask, corrections 0, `debug_edge_cols_only` true) → `[ MoveChuckXYPrecise (when move) ]` (34-99) | `num_columns` 103, `num_rows` 123, `column_spacing_um` -2968, `row_spacing_um` 2476, `start_x_um` -2688, `start_y_um` 75281, `col_settle_time_s` 0.1, `row_settle_time_s` 0.1, `snapshot_type` "CameraRaw", `save_locally` true, `wafer` "Wafer", `wafer_radius_um` 151000, `wafer_center_x_um` -154056, `wafer_center_y_um` -76096, `output_folder` "WaferGridDebug" (8-32) | Moves only: no snapshot step, so `snapshot_type`, `save_locally`, `output_folder` are not used. Comments name `FullWaferImaging.yaml` (12, 26), which is not in the folder. |
| 8 | `FlatfieldCalibration.yaml` | **NOT REG.** | file 4 without OpenProject and InitProbing: MoveChuckCenter → GenerateRasterSteps → `[ MoveChuckXY → Sleep → TakeScreenshot ]` → BuildFlatfield → CleanupRasterImages (37-112) | same names and defaults as file 4 (16-35) | Runs in whatever project is open (3-5). |
| 9 | `LECTopography_ER2.yaml` | `LECTopographyER2` (`CmdMap:124`) | OpenProject ($baby_project) → FindHome → GetDieList (as baby_dies) → `[ MeasureLECTopographyDie (label $d.label) ]` over `$baby_dies.steps` → OpenProject ($mosaix_project) → FindHome → GetDieList (as mosaix_dies) → `[ MeasureLECTopographyDie ]` (28-90) | `wafer`, `baby_project`, `mosaix_project`, `positions`, `settle_s`, `min_points` (17-26) | The only use of `as` with `GetDieList`. |
| 10 | `LECTopography_ER2B.yaml` | `LECTopographyER2B` (`CmdMap:125`) | as file 9 (28-90) | as file 9; ER2B project names (21-22) | |
| 11 | `LoadWaferSequence.json` | **NOT REG.** | WP_SENTIO_SVT_INITIALISE → WP_SENTIO_INITIALISE_TESTING_PROJECT → WP_LOAD_WAFER → WP_CURRENT_STABILITY_MULTIPLE_TOUCHES → WP_SIGNAL_TEST (1-49) | none | Layout `params`. None of the five names is in `COMMAND_ROUTER` (`CmdMap:39-175`): each would get 404. Holds a prober host name and port as fixed text (5). |
| 12 | `MoveToPadTarget.yaml` | `MoveToPadTarget` (`CmdMap:123`) | MoveChuckToSavedPosition ($position_name) → MoveChuckBySavedOffset ($offset_name) (28-47) | `position_name`, `offset_name`, `max_offset_um`, `precision_um`, `max_iterations`, `correction_settle_s` (16-26) | No Z move. |
| 13 | `NeedleOffsetMeasure_ER2B.yaml` | `NeedleOffsetMeasureER2B` (`CmdMap:122`) | OpenProject ($project) → FindHome → MoveChuckRowColumn ($label, $col, $row) → RunPTPA → SaveChuckPosition (name $position_name, label $die) → MoveChuckWide → MoveChuckContact → MoveChuckSeparation → MoveChuckOffAxis → TakeImageLECDie (label, col, row, die, wafer, archive_dir) → AnalyzeNeedleMarks (folder $die, root $archive_dir) → ComputePadTargetOffset (folder $die, root $archive_dir, criteria, name $offset_name) (46-133) | `project`, `label`, `col`, `row`, `die`, `wafer`, `archive_dir`, `config`, `contrast`, `corner`, `inset_um`, `max_aspect`, `min_valid_fraction`, `max_spread_um`, `position_name`, `offset_name` (21-44) | Runs another built-in sequence (file 22) as a step (A.4). The analysis reads from `archive_dir`, after the archive step of file 22. |
| 14 | `TakeImageBAM.yaml` | `TakeImageBAM` (`CmdMap:111`) | OpenProject (baby) → InitProbing → `[ MoveChuckRowColumn (label $die) → R (outputDir $die) → StitchImagesFull (folder $die) → CleanupRasterImages → ArchiveImaging (EOS) ]` over `$bams` (30-152) | `bams`, `num_columns`, `num_rows`, `column_spacing_um`, `row_spacing_um`, `start_x_um`, `start_y_um`, `col_settle_time_s`, `row_settle_time_s`, `snapshot_type`, `save_locally`, `wafer`, `bam_save_jpg`, `bam_save_tif`, `tif_quality`, `flatfield`, `flatfield_strength` (3-28) | A `CropImage` step is commented out (127-138). |
| 15 | `TakeImageL0_0-2.yaml` | `TakeImageL0_0-2` (`CmdMap:117`) | as file 20 | as file 20 | Differences from file 20: `segs` ["SEG2"], `num_columns` 1, `num_rows` 25, `output_folder` "L0" (6-8, 19). |
| 16 | `TakeImageL0_1-3.yaml` | `TakeImageL0_1-3` (`CmdMap:118`) | as file 20 | as file 20 | `segs` ["SEG3"], `num_rows` 25, `output_folder` "L0" (6, 8, 19). |
| 17 | `TakeImageL0_2-4.yaml` | `TakeImageL0_2-4` (`CmdMap:119`) | as file 20 | as file 20 | `num_rows` 25, `output_folder` "L0" (8, 19). |
| 18 | `TakeImageL1_0-3.yaml` | `TakeImageL1_0-3` (`CmdMap:115`) | as file 20 | as file 20 | `segs` ["SEG3"], `num_rows` 33, `output_folder` "L1" (6, 8, 19). |
| 19 | `TakeImageL1_1-4.yaml` | `TakeImageL1_1-4` (`CmdMap:116`) | as file 20 | as file 20 | `num_rows` 33, `output_folder` "L1" (8, 19). |
| 20 | `TakeImageL2.yaml` | `TakeImageL2` (`CmdMap:114`) | OpenProject (MOSAIX) → MoveChuckCenter → AutoFocus → FindHome → `[ MoveChuckRowColumn (label $die) → R (outputDir $output_folder) → StitchImagesFull (folder $output_folder) → CleanupRasterImages → ArchiveImaging (EOS) ]` over `$segs` (31-163) | `segs`, `num_columns`, `num_rows`, `column_spacing_um`, `row_spacing_um`, `start_x_um`, `start_y_um`, `col_settle_time_s`, `row_settle_time_s`, `snapshot_type`, `save_locally`, `output_folder`, `wafer`, `seg_save_jpg`, `seg_save_tif`, `tif_quality`, `flatfield`, `flatfield_strength` (3-29) | No InitProbing. Files 15 to 19 differ from it only in the lines named there (`diff` of the files). |
| 21 | `TakeImageLEC.yaml` | `TakeImageLEC` (`CmdMap:113`) | OpenProject (baby) → InitProbing → `[ MoveChuckRowColumn → R (outputDir $die) → StitchImagesFull (name_suffix) → CleanupRasterImages ]` over `$bams` → OpenProject (MOSAIX) → FindHome → `[ MoveChuckRowColumn → R with max_iterations 20 → StitchImagesFull → CleanupRasterImages → ArchiveImaging (EOS) ]` over `$segs` (34-271) | `bams`, `segs`, `num_columns`, `num_rows`, `column_spacing_um`, `row_spacing_um`, `start_x_um`, `start_y_um`, `col_settle_time_s`, `row_settle_time_s`, `snapshot_type`, `save_locally`, `wafer`, `bam_save_jpg`, `seg_save_jpg`, `bam_save_tif`, `seg_save_tif`, `tif_quality`, `name_suffix`, `flatfield`, `flatfield_strength` (3-32) | `ArchiveImaging` only in the SEG loop (266-271). Two `CropImage` steps commented out (132-143, 246-257). |
| 22 | `TakeImageLECDie.yaml` | `TakeImageLECDie` (`CmdMap:121`) | MoveChuckRowColumn ($label, $col, $row) → R (outputDir $die) → StitchImagesFull (folder $die) → CleanupRasterImages → ArchiveImaging (dest $archive_dir) (46-132) | `label`, `col`, `row`, `die`, `wafer`, `num_columns`, `num_rows`, `column_spacing_um`, `row_spacing_um`, `start_x_um`, `start_y_um`, `col_settle_time_s`, `row_settle_time_s`, `snapshot_type`, `save_locally`, `save_jpg`, `save_tif`, `tif_quality`, `name_suffix`, `flatfield`, `flatfield_strength`, `archive_dir` (14-44) | No OpenProject: needs an open project for a label. Also a step of file 13. |
| 23 | `TakeImageSEG.yaml` | `TakeImageSEG` (`CmdMap:112`) | OpenProject (baby) → InitProbing → OpenProject (MOSAIX) → FindHome → `[ MoveChuckRowColumn → R (outputDir $output_folder) → StitchImagesFull (folder $output_folder) → CleanupRasterImages → ArchiveImaging (EOS) ]` over `$segs` (31-164) | as file 20, with `output_folder` "SEG" (3-29) | A `CropImage` step is commented out (139-150). |
| 24 | `TakeImageWafer_ER2.yaml` | `TakeImageWaferER2` (`CmdMap:110`) | OpenProject (baby) → InitProbing → OpenProject (MOSAIX) → FindHome → MoveChuckRowColumn (label SEG4) → GenerateRasterSteps (circle mask, corrections 0) → `[ MoveChuckXYPrecise → Sleep → TakeScreenshot (outputDir $output_folder) ]` → StitchImagesFull (folder $output_folder) → CleanupRasterImages → ArchiveImaging (EOS) (48-170) | `num_columns`, `num_rows`, `column_spacing_um`, `row_spacing_um`, `start_x_um`, `start_y_um`, `col_settle_time_s`, `row_settle_time_s`, `snapshot_type`, `save_locally`, `wafer`, `wafer_radius_um`, `wafer_center_x_um`, `wafer_center_y_um`, `output_folder`, `save_jpg`, `save_tif`, `tif_quality`, `flatfield`, `flatfield_strength` (14-46) | Does not use `Cfg/WPImagingConfig.json` (its own start values). |
| 25 | `TestSequance.json` | **NOT REG.** | AutoFocus → MoveChuckPreviousDie (1-16) | none | Layout `data` (the layout of `run_sequencer`). Fixed `user` "user1" and `waferAgentName` "CERN" in each step. `Help:250` names it `TestSequence.json`. |

**Commands used by the files.** Over all 25 files the active steps use 41 different command names (count by search over `seq/*.yaml` and `seq/*.json`). 35 are in `COMMAND_ROUTER`. Not in it: `Load` (file 3) and the five `WP_*` names of file 11. The helpers `CropImage` and `DeleteImagingFolder` appear in no active step; `ComputeCouplingConstants` and `GetChuckXY` only in file 5, which is not registered.

---

# Summary of commands 19 to 40

"Dev" = Developer alone, state `UsedByDeveloper`. "Dev (state)" = no validator; only the state `UsedByDeveloper` limits it. No command of this part reads or writes the DB itself; "glob." = it stores the DB-sourced `g.loaded_wafer_id` (`null` without the DB).

| # | Command | Level | DB read | DB write | Files | Long | Blocker without DB/Kafka |
|---|---|---|---|---|---|---|---|
| 19 | SaveChuckPosition | Dev | glob. | no | w `Contacting/<proj>/positions.json` | no | G2 G3 G4 G5 |
| 20 | MoveChuckToSavedPosition | Dev | no | no | r positions.json | 1-5 s | G2 G3 G4 G5; not on mock |
| 21 | MoveChuckBySavedOffset | Dev | no | no | r offsets.json | 1-5 s | G2 G3 G4 G5; not on mock |
| 22 | AnalyzeNeedleMarks | Dev | no | no | r image, w 3-4 reports | 5-30 s | G2 G3 |
| 23 | ComputePadTargetOffset | Dev | no | no | r config, report; w offsets.json | no | G2 G3 G5 |
| 24 | GetDieSize | any (bypass) | no | no | r die_grid.json (optional) | no | G4 |
| 25 | GetDieList | any (bypass) | no | no | r map config | no | G5 |
| 26 | MeasureLECTopographyDie | Dev | glob. | no | r 2 configs; w LEC_topography.json | 30-60 s | G2 G3 G4 G5 |
| 27 | ComputeTopographyCorrection | Dev | no | no | r LEC_topography.json; w dies/<die>.json | no | G2 G3 |
| 28 | RunSequencer | Dev | no | no | r JSON file | variable | cannot succeed in any path |
| 29 | RunSequencerYAML | Dev | no | no | r YAML file (any path) | sum of steps | G2 G3 for it and every step; steps' gaps |
| 30 | ComputeCouplingConstants | Dev (state) | no | no | r CSV, w coupling JSON, deletes CSV | no | G2 |
| 31 | GetChuckXY | Dev (state) | no | no | w CSV | no | G2 G4; not on mock |
| 32 | BuildFlatfield | Dev (state) | no | no | r tiles, w .npy | not found | G2 |
| 33 | GenerateRasterSteps | Dev (state) | no | no | r imaging config, coupling JSON (if needed) | no | G2; steps lost over Kafka |
| 34 | MoveChuckXYPrecise | Dev (state) | no | no | none | up to max_iterations moves | G2 G4; not on mock |
| 35 | Sleep | Dev (state) | no | no | none | `seconds` | G2 |
| 36 | StitchImagesFull | Dev (state) | no | no | r tiles, flatfield; w .tif (.jpg) | yes | G2 |
| 37 | CropImage | Dev (state) | no | no | r/w image (overwrites) | not found | G2; any error = `Error` state |
| 38 | CleanupRasterImages | Dev (state) | no | no | deletes tiles | no | G2 |
| 39 | ArchiveImaging | Dev (state) | no | no | moves `Imaging/` to dest (EOS default) | depends | G2; local `dest_dir` |
| 40 | DeleteImagingFolder | Dev (state) | no | no | deletes `Imaging/<wafer>` | no | G2 |

<!-- END-OF-PART -->
