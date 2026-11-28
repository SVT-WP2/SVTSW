# WPAgent command inventory, part B

Imaging, contacting, die grid, topography, map conversion, sequencer and the built-in YAML sequences.

- Source: `master` at commit `a862772f` (27 Nov 2026). Paths are relative to the repository root.
- Every statement has a `file:line` reference.
- "Checked by a dry run" marks a statement that was also confirmed by running the code with stub modules (section F).
- "not found" means: searched for, and not in this export.

## Short names of files

| Short | File |
|---|---|
| `CmdMap` | `WPAgent/WPCmdMap.py` |
| `Img` | `WPAgent/actions/WPImagingActions.py` |
| `Con` | `WPAgent/actions/WPContactingActions.py` |
| `Grid` | `WPAgent/actions/WPDieGridActions.py` |
| `Topo` | `WPAgent/actions/WPTopographyActions.py` |
| `MapAct` | `WPAgent/actions/WPMapConversionActions.py` |
| `SeqJ` | `WPAgent/actions/WPSequencerActions.py` |
| `SeqY` | `WPAgent/actions/WPSequencerActionsYAML.py` |
| `Test` | `WPAgent/actions/WPTestingActions.py` (other analyst; only its helpers are quoted here) |
| `DbAct` | `WPAgent/actions/WPDataBaseActions.py` (other analyst) |
| `Proj` | `WPAgent/actions/WPProjectActions.py` (other analyst) |
| `Login` | `WPAgent/actions/WPLoginActions.py` (other analyst) |
| `Val` | `WPAgent/utilities/WPValidator.py` |
| `Dec` | `WPAgent/utilities/WPValidationDecorator.py` |
| `Const` | `WPAgent/utilities/WPCommandConstants.py` |
| `Ctx` | `WPAgent/utilities/WPSequenceContext.py` |
| `SM` | `WPAgent/stateMachine/WpAgentStateMachine.py` |
| `RB` | `WPAgent/utilities/WPResponseBuilder.py` |
| `Glob` | `WPAgent/globals/WPAagentGlobalParameters.py` |
| `Kafka` | `WPAgent/WPKafkaClient.py` |
| `Fac` | `WPAgent/drivers/WPFactory.py` |
| `Sentio` | `WPAgent/drivers/WPSentioProber.py` |
| `Mock` | `WPAgent/drivers/WPMockProber.py` |
| `Help` | `WPAgent/utilities/WPCommandsHelpList.json` |
| `Contract` | `Documentation/Kafka/svt.wp-agent.kafka.yaml` |
| `ITS3` | `ITS3TestAgent/its3_test_agent.py` |
| `seq/` | `WPAgent/sequencer/` |

## Scope

`COMMAND_ROUTER` has 93 keys (`CmdMap:39-175`; counted by a dry run). This part covers 40 of them:

| Group | Count | Router lines |
|---|---|---|
| `imaging_actions.*` | 13 | `CmdMap:108-109`, `160-170` |
| Built-in YAML sequences (`_yaml_command`) | 16 | `CmdMap:110-125` |
| Contacting | 5 | `CmdMap:128-132` |
| Die grid | 1 | `CmdMap:135` |
| Topography | 3 | `CmdMap:138-140` |
| Sequencer | 2 | `CmdMap:150-157` |

`WPMapConversionActions.py` gives no command (see "Map conversion" after command 40).

---

## 0. Facts that hold for every command

### 0.1 How a command runs

1. The Kafka listener gets a request and calls `execute_command(command, params)` (`Kafka:558-602`).
2. `execute_command` (`CmdMap:237-332`) does this, in order:
   - Makes `data` a dict (`CmdMap:243-257`).
   - Inside a trusted sequence it refuses `RunSequencer` and `RunSequencerYAML` with code 403 (`CmdMap:262-266`).
   - Unknown command: code 404 (`CmdMap:269-273`).
   - State-machine check: skipped for `BYPASS_COMMANDS` and for steps of a trusted sequence. Otherwise code 409 when `agentStateMachine.can_execute()` is false (`CmdMap:277-287`).
   - Calls the handler: `COMMAND_ROUTER[message_type](**data)` (`CmdMap:292-293`).
   - A failed result that is not a parameter error calls `_try_local_mode()` (`CmdMap:295-307`, `188-205`).
   - `ProberNotConnectedError`: code 503, the state does not change (`CmdMap:309-312`).
   - Any other exception: code 500, reply type `UnhandledErrorReply`, and the agent enters the `Error` state unless the command is a bypass command (`CmdMap:314-326`). Checked by a dry run.
   - Writes one log line with the data and the full result (`CmdMap:328-330`).
3. The handler arguments are the keys of `data`. A handler without `**kwargs` raises `TypeError` for an unknown key. That is an exception of the kind above: code 500 and `Error` state. Checked by a dry run with `TakeScreenshot` and `filePath`.

### 0.2 The three kinds of checks

**a) State machine** (`SM:276-292`). A command may run when one of these is true:
- it is in `BYPASS_COMMANDS` (`Const:9-29`);
- the state is `UsedByDeveloper` (`SM:289-290`). Only the log-in of a Developer sets this state (`Login:77-78`, `93-94`; `Proj:476`);
- the command is in the transition table of the current state (`SM:40-196`).

Of the 40 commands here, only the 16 built-in sequences are in a table of a normal state, and only in `Aligned` (`SM:188-189`). `TakeScreenshot` is in the `UsedByDeveloper` table (`SM:176`), which changes nothing because that state allows everything.

**b) Validator**, only for handlers with `@validate_command` or `@validate_command_with_name` (`Dec:32-85`, `88-138`). Order of checks (`Val:46-104`):
1. Bypass command: no check at all (`Val:70-72`).
2. Agent name: `g.wpAgentName` must be set (else code 500) and `waferAgentName` of the request must name the same machine (else code 403) (`Val:106-125`).
3. Log-in: a user must be logged in; a `user` in the request must be that user (code 401) (`Val:127-146`).
4. Testing lock: when the agent is locked, only the lock owner or a Developer may run a command that is not in `LOCK_EXEMPT_COMMANDS` (code 423) (`Val:23-41`, `148-209`). None of the 40 commands is in that exempt list.
5. User level: Developer may run everything. Expert may run `USER_COMMANDS` and `EXPERT_COMMANDS`. User may run `USER_COMMANDS` (code 403) (`Val:211-266`; sets in `Const:36-95`). The level of a user comes from `WPAgent/configs/WPUserHierarchy.json` (`Login:14-40`).
6. Parameter schema, if the command has one (`Val:268-311`, schemas `Val:321-416`). Of the 40 commands only `RunSequencer` has a schema (`Val:383-385`).
7. Orientation check, only for the commands listed in `Val:540-555`. None of the 40 commands is in that list, but steps of the sequences are (see 0.6, G6).

The command name used by `@validate_command` is built from the function name: `run_sequencer_yaml` becomes `RunSequencerYaml` (`Dec:54-56`).

**c) Prober ready**: `_ensure_initialized()` (`Test:12-23`) calls `check_prober_ready()` (`WPAgent/utilities/WPHelpers.py:85-112`). It fails with code 503 and reply type `NotInitializedReply` when `g.prober_connected is False`, when the factory has no prober, or when `g.address` or `g.machineType` is empty.

**Result for the 40 commands** (checked by a dry run):

| Group | Commands | Validator | Who can run it alone |
|---|---|---|---|
| Imaging helpers, no decorator | TakeScreenshot, TakeImage, ComputeCouplingConstants, GetChuckXY, BuildFlatfield, GenerateRasterSteps, MoveChuckXYPrecise, Sleep, StitchImagesFull, CropImage, CleanupRasterImages, ArchiveImaging, DeleteImagingFolder | none: no agent name, no user, no lock check | Only while the state is `UsedByDeveloper`. In every other state: code 409. |
| Decorated, not in a user set | SaveChuckPosition, MoveChuckToSavedPosition, MoveChuckBySavedOffset, AnalyzeNeedleMarks, ComputePadTargetOffset, MeasureLECTopographyDie, ComputeTopographyCorrection, RunSequencerYAML, RunSequencer | full | Developer only (and the state is then `UsedByDeveloper`) |
| Bypass | GetDieSize, GetDieList | skipped | Anyone, in any state, without log-in |
| Built-in sequences | 16 commands | full, level Expert | Expert in state `Aligned`, or Developer |

Inside a built-in sequence all the commands of the first two rows can run for an Expert (section A.4).

### 0.3 The reply

- Every handler here, except `GenerateRasterSteps`, returns `ResponseBuilder.success()` or `.error()` (`RB:70-87`): `{status, type, data, error: {code, message}}`.
- The result text of a command is in `error.message`, also on success (code 0) (`RB:71-78`).
- `data` is the same for every command. It is a copy of the global state (`RB:14-68`): `userLogged`, `userLoggedHierarchy`, `asicSerialNumber`, `wpMachineId`, `WPAG_State`, `proberConnected`, `proberInitialized`, `wpAgentName`, `loadedWafer` (`{waferId, orientation}`, or the number `1` when no wafer is loaded: `RB:30-37`), `installedProbeCard` (`{probeCardId, orientation}` or null), `openedProjectId`, `projectName`, `overdrive`, `contactHeight`, `cameraMountPoint`, `currentWorkingArea`, `waferMapDiePosition {colIndex, rowIndex, subsiteIndex}`, `chuckZPositionState`, `totalDiesNumber`.
- The Kafka listener adds `executionTimeMs` to `data` (`Kafka:607-610`).
- "Reply" in the command sections below gives only what differs: the reply type, the text of `error.message`, and extra keys.

### 0.4 Kafka-specific behaviour (same for every command)

1. A request runs only when its `waferAgentName` names the machine of this listener. Other requests are dropped without a reply (`Kafka:319-324`, `566-568`).
2. Every value of `data` goes through `ast.literal_eval` (`Kafka:169-176`, `570-571`). The text `"5"` becomes the number 5, `"[0,4,8]"` a list, `"True"` a bool. `"true"` and `"false"` stay text.
3. Requests run in a pool of 4 threads (`Kafka:441`, `478`). Two commands can run at the same time. Nothing stops a running command.
4. The running command is counted (`Kafka:601-602`; `WPAgent/utilities/WPCommandActivity.py:25-37`). The connection watch waits while the count is above 0 (`Kafka:457`).
5. After every command the state snapshot is written to `WPAgent.cache.json` in the working directory (`Kafka:605`; `WPAgent/utilities/WPAgentCache.py:21`, `42-49`). No code reads this file.
6. One reply, at the end, to the topic and partition of the request headers (`Kafka:573-590`, `628-642`). There is no progress message.
7. A result without `type` and `data` is replaced by `{status, type: "<Command>Reply", data: {output, executionTimeMs}}` (`Kafka:611-626`). This happens to `GenerateRasterSteps`: its `steps` do not reach the sender.
8. When the listener stops, a running command has 20 s to end (`Kafka:43`, `527`).
9. The sender in `main.py send` waits 30 s by default (`WPAgent/WPAgent.py:55-64`; `Kafka:187`, `290-303`). A long sequence replies after that.
10. Every command and every step of a sequence is logged to `WPAgentLogger.log` in the working directory (`WPAgent/utilities/WPAgentLogger.py:28`, `51`, `95-117`). Sending logs to Kafka is off by default (`WPAgent/utilities/WPAgentLogger.py:30`, `129`).

### 0.5 Where paths come from

- Relative to the working directory of the process: `Imaging/`, `Contacting/`, `sequencer/*.yaml` (the built-in sequences, `CmdMap:110-125`), `chuck_xy_log.csv`, `screenshots`, `screenshotsSVT`, `WPAgentLogger.log`, `WPAgent.cache.json`. The working directory is `/app` in the container (`WPAgent/Dockerfile:9`) and `/data/SVTSoftware/SVTSW/WPAgent` in the service file (`WPAgent/WPagent.service:10`). `Imaging/` and `Contacting/` are in `WPAgent/.gitignore:5-6`.
- Relative to the code (`__file__`): `configs/WPImagingConfig.json` (`WPAgent/utilities/WPImagingConfig.py:15-16`), `configs/WPContactingConfig.json` (`WPAgent/utilities/WPContacting.py:114-115`), `configs/WPMapConversion_<wafer type>.json` (`WPAgent/utilities/WPDieMaps.py:27-28`), `configs/WPInitProbingConfig.json` (`WPAgent/utilities/WPInitProbingConfig.py:15`), `configs/WPUserHierarchy.json` (`Login:14-15`), `utilities/needle_mark/configs/*.json` (`WPAgent/utilities/needle_mark/api.py:27`).
- Server only: `/eos/project/a/aliceits3/ITS3-WP3/MOSAIX/prober_imaging` (default of `ArchiveImaging`, `Img:757`; fixed text in the sequence files). A mount of `/eos` in a compose file: not found in this export.
- No environment variable is read by the 40 commands. `SVT_WP_AGENT_MACHINE_NAME` and `SVT_WP_AGENT_KAFKA_BROKER` are read only at the start of the listener (`WPAgent/WPAgent.py:40-41`, `198-202`).

### 0.6 What a process without Kafka, DB and log-in is missing (G1 to G7)

- **G1 Packages.** `confluent_kafka` must be importable even when Kafka is not used: `WPAgent/utilities/WPAgentLogger.py:5` imports it at module level. That module is loaded by `CmdMap:6`, by every reply (`RB:20` loads `WPAgent/services/WPProberConnectionWatch.py:36`) and by `_ensure_initialized` (`WPAgent/utilities/WPHelpers.py:93`). `sentio_prober_control` must be importable for the four action files, also with the mock driver (`Fac:3` loads `Sentio:4-9`). Checked by a dry run (section E).
- **G2 State.** Without a logged-in user the state is `ServiceOn`. Its table has only `Error` (`SM:44-46`). Every command that is not a bypass command gets code 409.
- **G3 Agent name.** Decorated commands need `g.wpAgentName` and a matching `waferAgentName` (`Val:106-125`). The listener sets the name at start (`WPAgent/WPAgent.py:301-302`).
- **G4 Prober connection.** Only the `Initialize` command creates the driver (`Proj:270-341`). For a real machine the address comes from the DB record (`WPAgent/WPAgent.py:231-235`, `305`; `WPAgent/services/WPMachineRecord.py:60-110`). A mock config has its address in the file (`WPAgent/WPAgent.py:227-229`).
- **G5 Open project.** `g.projectName` is set only by `OpenProject` and `ChangeProject` (`Test:1154-1155`, `1203-1204`). They ask the DB for the project id, but go on without an answer (`DbAct:95-112`).
- **G6 Orientations.** `g.wafer_orientation` and `g.probe_card_orientation` come from the DB: at `Initialize` (`Proj:111-135`) or from the DB commands (`DbAct:202`, `279-280`, `321`, `404`). With an open project, these steps of sequences fail with code 400 without them: `InitProbing`, `MoveChuckContact`, `RunPTPA`, `AutoFocus`, `MoveChuckRowColumn`, `MoveChuckXY` and others (`Val:540-585`). The values must also match the project name, for example `..._NotchW_ArrowW` needs `West` and `West` (`Val:498-512`, `618-662`).
- **G7 InitProbing.** It reads the ASIC family of the project from the DB and fails with code 404 without an answer (`Test:733-740`; `DbAct:115-132`).

None of the six action files of this part, and none of their helper modules, calls the DB client. The only users of `DBKafkaClient` are `DbAct`, `Proj`, `WPAgent/services/WPMachineRecord.py` and `WPAgent/WPAgent.py` (search in the export). `WPAgent/interfaces/WPDbService.py` (`IDBService`) is not used by any code (search in the export).

---

# Commands, in the order of `COMMAND_ROUTER`

## 1. TakeScreenshot

1. **Handler.** `CmdMap:108` → `take_screenshot`, `Img:954-1010`.
2. **Parameters** (`Img:954-962`):
   | Name | Type | Required | Default | Notes |
   |---|---|---|---|---|
   | `fileName` | str | no | none | The driver makes `screenshot_<date>_<time>.jpg` and forces the extension `.jpg` (`Sentio:417-423`). |
   | `snapshot_type` | str | no | `"CameraRaw"` | `"CameraRaw"` or `"WithOverlays"`; any other value means `CameraRaw` (`Sentio:411-415`). |
   | `save_locally` | bool | no | `True` | `False`: SENTIO saves the file on the prober PC (`Sentio:433-439`). |
   | `outputDir` | str | no | `"screenshotsSVT"` | |
   | `wafer` | str | no | `""` | With a wafer the folder is `Imaging/<wafer>/<outputDir>` (`Img:600-602`, `987`). |
   | `user`, `waferAgentName` | str | no | none | Not used. |
   - No `**kwargs`: an unknown key gives code 500 and the `Error` state (0.1, point 3).
   - `Help`: no entry.
   - `Contract`: `data` must have `filePath` (`Contract:2118-2128`); tag "1. USER LEVEL", "Required state: Any" (`Contract:610-616`).
   - **Disagreement.** The function has `fileName`, not `filePath`. Sending `filePath` gives code 500 and the `Error` state (checked by a dry run). The command is not in `USER_COMMANDS` (`Const:36-54`) and is not allowed in "any" state.
3. **Checks.** No decorator. State machine: only `UsedByDeveloper` (0.2). Then `_ensure_initialized()` (`Img:980-982`). As a step of a built-in sequence: no check except `_ensure_initialized()`.
4. **DB.** None.
5. **Kafka.** Only 0.4. The parameter name of the contract does not work (point 2).
6. **Globals.** Reads `prober_connected`, `address`, `machineType` (through `_ensure_initialized`). Writes nothing.
7. **Prober.** `take_screenshot(filename, snapshot_type, save_locally, output_dir)` (`Img:990-995`). In the SENTIO driver this is `vision.snap_image(file, what, where)` (`Sentio:428-439`). No `local_mode()` after it.
8. **Files.** Creates the folder (`Img:988`). Writes one JPEG: `<folder>/<fileName>`. Path: parameters, relative to the working directory.
9. **Duration.** Fast. No progress output.
10. **Reply.** Type `TakeScreenshotReply`. Text: `Screenshot saved: <absolute path>` (`Img:997-1002`). `RuntimeError` gives code 400, other errors code 500 (`Img:1004-1010`).
11. **Without DB and Kafka.** G2 (state must be `UsedByDeveloper`) and G4 (a prober connection). Needs from a config: prober address and type.

## 2. TakeImage

1. **Handler.** `CmdMap:109` → `take_image`, `Img:872-952`.
2. **Parameters** (`Img:872-885`). All optional. No `**kwargs`. No type conversion: text values break the arithmetic (`Img:910`).
   | Name | Default |
   |---|---|
   | `snapshot_type` | `"CameraRaw"` |
   | `save_locally` | `True` |
   | `outputDir` | `"screenshots"` |
   | `num_columns`, `num_rows` | 5, 5 |
   | `column_spacing_um`, `row_spacing_um` | -2968, 2476 |
   | `start_x_um`, `start_y_um` | -21088, -27245 |
   | `settle_time_s` | 0.25 |
   - `Help`: no entry. `Contract`: no entry.
3. **Checks.** No decorator. State machine: only `UsedByDeveloper`. Then `_ensure_initialized()` (`Img:895-897`).
4. **DB.** None.
5. **Kafka.** Only 0.4.
6. **Globals.** As command 1.
7. **Prober**, in order: `find_home()` (`Img:907`); `go_to_die(-3, 0)`, a fixed die (`Img:908`); `move_chuck_xy(start_x, start_y, "Relative")` (`Img:909`); `move_chuck_xy(column_spacing/4, -row_spacing/4, "Relative")` (`Img:910`); then for every tile `take_screenshot(...)` (`Img:919-924`) and `move_chuck_xy(..., "Relative")` between tiles (`Img:929`, `934-938`). No `local_mode()` at the end.
8. **Files.** Folder `outputDir` (not under `Imaging/`). Tiles `RR_CC.jpg` (`Img:917`). Stitched image `<outputDir>/stitched.webp`, or `.jpg` when it is too large for WebP (`Img:942`; `WPAgent/utilities/WPImageStitching.py:886-888`, `1013-1021`, `861-864`).
9. **Duration.** Long: 25 moves and snapshots by default, then stitching. Progress: `print` lines of the stitcher on the console only.
10. **Reply.** Type `TakeImageReply`. Text: `Captured <n> images, stitched -> <path>` (`Img:944-947`). Any error: code 500 (`Img:949-952`).
11. **Without DB and Kafka.** G2 and G4. Needs OpenCV and numpy: the import at `Img:900` runs before the first move (checked by a dry run).

## Built-in sequences: facts common to commands 3 to 18

- **Handler.** `_yaml_command(command_name, yaml_path)` builds it (`CmdMap:22-37`). The path is fixed text, `sequencer/<file>.yaml`, relative to the working directory. A wrong working directory gives code 404 `File not found` (checked by a dry run).
- **Parameters.** Every key of the `params:` block of the YAML file is an input variable. A key of the request with the same name replaces the default (`SeqY:17-24`). A key `filepath` of the request is dropped (`CmdMap:35`). `user` and `waferAgentName` of the request go into every step (`SeqY:21-24`). Values written as fixed text in a step cannot be changed by the request.
- **Checks.**
  - State machine: allowed only in `Aligned` (`SM:188-189`), or in `UsedByDeveloper`. Code 409 otherwise, reply type `<Command>Reply`.
  - Validator with the command name (`CmdMap:29`): agent name, log-in, testing lock, level Expert (`Const:77-95`). A User gets code 403 (checked by a dry run).
  - Then `run_sequencer_yaml` is validated once more as `RunSequencerYaml` (`SeqY:8-9`). The level check passes because the sequence is trusted (`Val:232-233`).
  - Steps: see section A.4. In short: no state-machine check, no level check, the state does not change; agent name, log-in, testing lock, parameter schema and orientation checks of each decorated step still apply.
- **Kafka.** Only 0.4. The sender timeout of 30 s is shorter than most sequences (0.4, point 9).
- **Globals.** The sequence code itself reads and writes none. The steps do (see each step's command).
- **Reply.** Reply type `RunSequencerYamlReply`, not `<Command>Reply` (the inner decorator sets it: `SeqY:8-11`; checked by a dry run). Success text: `Successfully executed YAML sequence from sequencer/<file>.yaml` (`SeqY:98`). Failure: code 500, text `Step <i> '<command>' failed: <message of the step>` (`SeqY:83-86`). `<i>` counts inside the current step list, also inside a loop (`SeqY:45`). No results of the steps are returned.
- **Progress.** Console only: `[Step i/n] Executing: <command>` and `Parameters: {...}` for every step (`SeqY:73-74`).
- **After an error.** The sequence stops at the first failed step. Nothing is undone. A step that raises an exception puts the agent in `Error` (`CmdMap:314-326`; checked by a dry run). A step that returns an error leaves the state as it was, unless the step itself calls `enter_error_state` (checked by a dry run).
- **Mock driver.** `MoveChuckXYPrecise` fails on the mock (command 35). Every sequence that uses it stops at its first move on a mock.

The steps and the input variables of each file are in section B.

## 3. TakeImageWaferER2

1. **Handler.** `CmdMap:110` → `seq/TakeImageWafer_ER2.yaml`.
2. **Parameters** (`seq/TakeImageWafer_ER2.yaml:14-46`): `num_columns` 103, `num_rows` 123, `column_spacing_um` -2968, `row_spacing_um` 2476, `start_x_um` -2688, `start_y_um` 75281, `col_settle_time_s` 0.1, `row_settle_time_s` 0.1, `snapshot_type` "CameraRaw", `save_locally` true, `wafer` "Wafer", `wafer_radius_um` 151000, `wafer_center_x_um` -154056, `wafer_center_y_um` -76096, `output_folder` "Wafer", `save_jpg` false, `save_tif` true, `tif_quality` 85, `flatfield` "", `flatfield_strength` 1.0. All optional. Fixed in the steps: both ER2 project names, die `SEG4`, the precise-move settings, the archive folders (`seq/TakeImageWafer_ER2.yaml:52`, `63`, `76`, `120-123`, `169-170`). `Help`, `Contract`: no entry.
3. **Checks.** Common facts above. Level Expert, state `Aligned`.
4. **DB**, through steps:
   - `OpenProject` (2 times) → `get_project_id_by_name` → DB message `GetAllWaferProbeProjects`, read. The value is stored in `g.opened_project_id`. No answer within 15 s: the id is `None` and the step goes on (`Test:1205`; `DbAct:95-112`; `WPAgent/services/WPDbKafkaClient.py:194-199`).
   - `InitProbing` → `get_project_family_by_name` → `GetAllWaferProbeProjects`, read. The value (`asicFamilyType`) selects the alignment project in `configs/WPInitProbingConfig.json`. No answer: code 404, the sequence stops (`Test:733-751`; `DbAct:115-132`).
5. **Kafka.** Common facts.
6. **Globals.** By the steps only.
7. **Prober.** By the steps (section B, file 1).
8. **Files.** Tiles and the stitched TIFF in `Imaging/<wafer>/<output_folder>/`. Flatfield read from `Imaging/<wafer>/CALIBRATION_COLOR/flatfield.npy` if it is there. At the end everything under `Imaging/` moves to the EOS path (fixed, server only).
9. **Duration.** Very long: 9744 tiles are inside the circle of the default values (12669 grid positions; computed from `Img:479-486` with the defaults). Each tile is a precise move, a wait and a snapshot. Then stitching.
10. **Reply.** Common facts.
11. **Without DB and Kafka.** G2 with level Expert or Developer, G3, G4, G6, G7 (`InitProbing`). The EOS folder must exist. Needs OpenCV, numpy, tifffile.

## 4. TakeImageBAM

1. **Handler.** `CmdMap:111` → `seq/TakeImageBAM.yaml`.
2. **Parameters** (`seq/TakeImageBAM.yaml:3-28`): `bams` list of 20 labels `BAM00`..`BAM19`, `num_columns` 10, `num_rows` 9, `column_spacing_um` -2968, `row_spacing_um` 2476, `start_x_um` empty, `start_y_um` empty (empty means block `LEC` of `configs/WPImagingConfig.json`), `col_settle_time_s` 0.1, `row_settle_time_s` 0.1, `snapshot_type` "CameraRaw", `save_locally` true, `wafer` "Wafer", `bam_save_jpg` false, `bam_save_tif` true, `tif_quality` 85, `flatfield` "", `flatfield_strength` 1.0. Fixed: project `ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW` (`seq/TakeImageBAM.yaml:34`), archive folders (`151-152`). `Help`, `Contract`: no entry.
3. **Checks.** Common facts. Level Expert, state `Aligned`.
4. **DB.** `OpenProject` (1 time, read, tolerant) and `InitProbing` (read, needed), as command 3.
5. **Kafka.** Common facts.
6. **Globals.** By the steps.
7. **Prober.** By the steps (section B, file 2).
8. **Files.** `Imaging/<wafer>/<die>/` per die: tiles, stitched TIFF. After every die: tiles deleted, `Imaging/` moved to EOS.
9. **Duration.** Long: 90 tiles per die, 20 dies by default.
10. **Reply.** Common facts.
11. **Without DB and Kafka.** As command 3.

## 5. TakeImageSEG

1. **Handler.** `CmdMap:112` → `seq/TakeImageSEG.yaml`.
2. **Parameters** (`seq/TakeImageSEG.yaml:3-29`): `segs` ["SEG4"], `num_columns` 91, `num_rows` 41, spacings as command 4, `start_x_um` and `start_y_um` empty, settle times 0.1, `snapshot_type`, `save_locally`, `output_folder` "SEG", `wafer` "Wafer", `seg_save_jpg` false, `seg_save_tif` true, `tif_quality` 85, `flatfield` "", `flatfield_strength` 1.0. Fixed: both ER2 project names (`35`, `46`), archive folders (`163-164`). `Help`, `Contract`: no entry.
3. **Checks.** Common facts. Level Expert, state `Aligned`.
4. **DB.** `OpenProject` (2 times, tolerant), `InitProbing` (needed), as command 3.
5. **Kafka.** Common facts.
6. **Globals.** By the steps.
7. **Prober.** By the steps (section B, file 3).
8. **Files.** All dies write into the same folder `Imaging/<wafer>/<output_folder>/` (`seq/TakeImageSEG.yaml:121`, `131`).
9. **Duration.** Very long: 3731 tiles per die.
10. **Reply.** Common facts.
11. **Without DB and Kafka.** As command 3.

## 6. TakeImageLEC

1. **Handler.** `CmdMap:113` → `seq/TakeImageLEC.yaml`.
2. **Parameters** (`seq/TakeImageLEC.yaml:3-32`): `bams` 20 labels, `segs` ["SEG0".."SEG4"], `num_columns` 1, `num_rows` 9, spacings as command 4, `start_x_um` and `start_y_um` empty, settle times 0.1, `snapshot_type`, `save_locally`, `wafer` "Wafer", `bam_save_jpg` false, `seg_save_jpg` false, `bam_save_tif` true, `seg_save_tif` true, `tif_quality` 85, `name_suffix` "_LEC", `flatfield` "", `flatfield_strength` 1.0. Fixed: both ER2 project names (`38`, `154`), `max_iterations` 100 for BAM dies and 20 for SEG dies (`88`, `202`), archive folders (`270-271`). `Help`, `Contract`: no entry.
3. **Checks.** Common facts. Level Expert, state `Aligned`.
4. **DB.** `OpenProject` (2 times, tolerant), `InitProbing` (needed), as command 3.
5. **Kafka.** Common facts.
6. **Globals.** By the steps.
7. **Prober.** By the steps (section B, file 4).
8. **Files.** `Imaging/<wafer>/<die>/<timestamp>_<die>_LEC.tif`. `ArchiveImaging` runs only inside the SEG loop, after each SEG die (`seq/TakeImageLEC.yaml:266`).
9. **Duration.** Long: 9 tiles per die, 25 dies.
10. **Reply.** Common facts.
11. **Without DB and Kafka.** As command 3.

## 7. TakeImageL2

1. **Handler.** `CmdMap:114` → `seq/TakeImageL2.yaml`.
2. **Parameters** (`seq/TakeImageL2.yaml:3-29`): `segs` ["SEG4"], `num_columns` 91, `num_rows` 41, spacings as command 4, `start_x_um` and `start_y_um` empty, settle times 0.1, `snapshot_type`, `save_locally`, `output_folder` "L2", `wafer` "Wafer", `seg_save_jpg` false, `seg_save_tif` true, `tif_quality` 85, `flatfield` "", `flatfield_strength` 1.0. Fixed: project `ER2_MOSAIX_Vertical_V0_NotchW_ArrowW` (`35`), archive folders (`162-163`). `Help`, `Contract`: no entry.
3. **Checks.** Common facts. Level Expert, state `Aligned`.
4. **DB.** `OpenProject` only (1 time, read, tolerant). No `InitProbing`.
5. **Kafka.** Common facts.
6. **Globals.** By the steps.
7. **Prober.** By the steps (section B, file 5).
8. **Files.** `Imaging/<wafer>/<output_folder>/`, then EOS.
9. **Duration.** Very long: 3731 tiles per die.
10. **Reply.** Common facts.
11. **Without DB and Kafka.** G2, G3, G4, G6. Not G7. The EOS folder must exist. Needs OpenCV, numpy, tifffile.

## 8. TakeImageL1_0-3

Same as command 7, with these differences (`diff` of the files): file `seq/TakeImageL1_0-3.yaml` (`CmdMap:115`), `segs` ["SEG3"], `num_rows` 33, `output_folder` "L1" (`seq/TakeImageL1_0-3.yaml:6`, `8`, `19`). 3003 tiles per die.

## 9. TakeImageL1_1-4

Same as command 7, with these differences: file `seq/TakeImageL1_1-4.yaml` (`CmdMap:116`), `segs` ["SEG4"], `num_rows` 33, `output_folder` "L1" (`seq/TakeImageL1_1-4.yaml:6`, `8`, `19`). 3003 tiles per die.

## 10. TakeImageL0_0-2

Same as command 7, with these differences: file `seq/TakeImageL0_0-2.yaml` (`CmdMap:117`), `segs` ["SEG2"], `num_columns` 1, `num_rows` 25, `output_folder` "L0" (`seq/TakeImageL0_0-2.yaml:6-8`, `19`). 25 tiles per die. Note: this file has 1 column, the other two L0 files have 91.

## 11. TakeImageL0_1-3

Same as command 7, with these differences: file `seq/TakeImageL0_1-3.yaml` (`CmdMap:118`), `segs` ["SEG3"], `num_rows` 25, `output_folder` "L0" (`seq/TakeImageL0_1-3.yaml:6`, `8`, `19`). 2275 tiles per die.

## 12. TakeImageL0_2-4

Same as command 7, with these differences: file `seq/TakeImageL0_2-4.yaml` (`CmdMap:119`), `segs` ["SEG4"], `num_rows` 25, `output_folder` "L0" (`seq/TakeImageL0_2-4.yaml:6`, `8`, `19`). 2275 tiles per die.

## 13. BrightnessCorrection

1. **Handler.** `CmdMap:120` → `seq/BrightnessCorrection.yaml`.
2. **Parameters** (`seq/BrightnessCorrection.yaml:14-33`): `flatfield_die` "CALIBRATION_COLOR", `num_columns` 5, `num_rows` 5, `column_spacing_um` -2968, `row_spacing_um` 2476, `start_x_um` -21088, `start_y_um` -27245, `col_settle_time_s` 0.2, `row_settle_time_s` 1, `snapshot_type` "CameraRaw", `save_locally` true, `wafer` "Wafer", `flatfield_sigma` 300, `flatfield_output` "flatfield.npy". Fixed: project `ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW` (`39`), `sample_n` 25 (`111`). `Help`, `Contract`: no entry.
3. **Checks.** Common facts. Level Expert, state `Aligned`.
4. **DB.** `OpenProject` (tolerant) and `InitProbing` (needed), as command 3.
5. **Kafka.** Common facts.
6. **Globals.** By the steps.
7. **Prober.** By the steps (section B, file 11). It uses `MoveChuckXY`, not `MoveChuckXYPrecise`.
8. **Files.** Tiles in `Imaging/<wafer>/CALIBRATION_COLOR/`, result `flatfield.npy` in the same folder, tiles deleted at the end. No archive step.
9. **Duration.** Minutes: `InitProbing`, 25 tiles, the flatfield.
10. **Reply.** Common facts.
11. **Without DB and Kafka.** G2, G3, G4, G6, G7. Needs OpenCV, numpy, scipy.

## 14. TakeImageLECDie

1. **Handler.** `CmdMap:121` → `seq/TakeImageLECDie.yaml`.
2. **Parameters** (`seq/TakeImageLECDie.yaml:14-44`): `label` "" , `col` empty, `row` empty (give a label, or `col` and `row`), `die` "Test" (folder name), `wafer` "Wafer", `num_columns` 1, `num_rows` 9, spacings as command 4, `start_x_um` and `start_y_um` empty, settle times 0.1, `snapshot_type`, `save_locally`, `save_jpg` false, `save_tif` true, `tif_quality` 85, `name_suffix` "_LEC", `flatfield` "", `flatfield_strength` 1.0, `archive_dir` the EOS path.
   - With the defaults the first step fails: no label and no `col`/`row` gives code 400 (`Test:464-472`).
   - `Help:461-473` lists only `label`, `col`, `row`, `die`, `wafer`. `Contract`: no entry.
3. **Checks.** Common facts. Level Expert, state `Aligned`. It is also a step of `NeedleOffsetMeasureER2B` (`seq/NeedleOffsetMeasure_ER2B.yaml:100`).
4. **DB.** None in its steps.
5. **Kafka.** Common facts.
6. **Globals.** By the steps. It needs an open project for a label (`Test:489`).
7. **Prober.** By the steps (section B, file 12).
8. **Files.** `Imaging/<wafer>/<die>/<timestamp>_<die>_LEC.tif`, then moved to `archive_dir` (a parameter here).
9. **Duration.** `Help:472`: 2 to 5 minutes. 9 tiles.
10. **Reply.** Common facts.
11. **Without DB and Kafka.** G2, G3, G4, G5 (for a label), G6 (`MoveChuckRowColumn` with an open project). No DB call of its own. `archive_dir` can be a local folder.

## 15. NeedleOffsetMeasureER2B

1. **Handler.** `CmdMap:122` → `seq/NeedleOffsetMeasure_ER2B.yaml`.
2. **Parameters** (`seq/NeedleOffsetMeasure_ER2B.yaml:21-44`): `project` "ER2B_babyMOSAIX_Vertical_V0_NotchW_ArrowW", `label` "BAMTest", `col` empty, `row` empty, `die` "BAMTest", `wafer` "Wafer", `archive_dir` the EOS path, `config` "lec", `contrast` false, `corner`, `inset_um`, `max_aspect`, `min_valid_fraction`, `max_spread_um` all empty (empty means `configs/WPContactingConfig.json`), `position_name` "ptpa_ref", `offset_name` "pad_target".
   - `Help:475-489` lists `label`, `col`, `row`, `die`, `wafer`, `corner`, `inset_um`. `Contract`: no entry.
3. **Checks.** Common facts. Level Expert, state `Aligned`.
4. **DB.** `OpenProject` (1 time, read, tolerant).
5. **Kafka.** Common facts.
6. **Globals.** By the steps.
7. **Prober.** By the steps (section B, file 13). It goes to contact (`MoveChuckContact`).
8. **Files.** `Contacting/<project>/positions.json`, `Contacting/<project>/offsets.json`, the image and the mark reports in `<archive_dir>/<wafer>/<die>/`. The analysis reads the image from `archive_dir`, after the archive step (`seq/NeedleOffsetMeasure_ER2B.yaml:117`, `127`).
9. **Duration.** `Help:488`: 5 to 10 minutes.
10. **Reply.** Common facts.
11. **Without DB and Kafka.** G2, G3, G4, G6 (`MoveChuckRowColumn`, `RunPTPA`, `MoveChuckContact`). No G7. `archive_dir` must be a folder that exists. Needs OpenCV, numpy, tifffile.

## 16. MoveToPadTarget

1. **Handler.** `CmdMap:123` → `seq/MoveToPadTarget.yaml`.
2. **Parameters** (`seq/MoveToPadTarget.yaml:16-26`): `position_name` "ptpa_ref", `offset_name` "pad_target", `max_offset_um` 40, `precision_um` 0.15, `max_iterations` 10, `correction_settle_s` 0.1.
   - `Help:413-423` lists the first three. `Contract`: no entry.
3. **Checks.** Common facts. Level Expert, state `Aligned`.
4. **DB.** None.
5. **Kafka.** Common facts.
6. **Globals.** By the steps (commands 20 and 21).
7. **Prober.** By the steps (section B, file 14).
8. **Files.** Reads `Contacting/<project>/positions.json` and `offsets.json`.
9. **Duration.** `Help:422`: 2 to 10 seconds.
10. **Reply.** Common facts.
11. **Without DB and Kafka.** G2, G3, G4, G5 (the files are per project). No DB data.

## 17. LECTopographyER2

1. **Handler.** `CmdMap:124` → `seq/LECTopography_ER2.yaml`.
2. **Parameters** (`seq/LECTopography_ER2.yaml:17-26`): `wafer` "Wafer", `baby_project` "ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW", `mosaix_project` "ER2_MOSAIX_Vertical_V0_NotchW_ArrowW", `positions` [0, 4, 8], `settle_s` 0.2, `min_points` empty.
   - `Help:389-395` says `wafer` is required. The file has the default "Wafer". `Contract`: no entry.
3. **Checks.** Common facts. Level Expert, state `Aligned`.
4. **DB.** `OpenProject` (2 times, read, tolerant).
5. **Kafka.** Common facts.
6. **Globals.** By the steps.
7. **Prober.** By the steps (section B, file 15).
8. **Files.** `Contacting/topography/<wafer>/LEC_topography.json`. Reads `configs/WPMapConversion_ER2.json` and `configs/WPImagingConfig.json`.
9. **Duration.** `Help:394`: minutes. 25 dies in the ER2 map (20 and 5), 3 autofocus points per die by default.
10. **Reply.** Common facts.
11. **Without DB and Kafka.** G2, G3, G4. No step of this file has an orientation check or needs DB data.

## 18. LECTopographyER2B

Same as command 17, with these differences: file `seq/LECTopography_ER2B.yaml` (`CmdMap:125`), `baby_project` "ER2B_babyMOSAIX_Vertical_V0_NotchW_ArrowW", `mosaix_project` "ER2B_MOSAIX_Vertical_V0_NotchW_ArrowW" (`seq/LECTopography_ER2B.yaml:21-22`). `Help:397-403`. The ER2B map has 33 dies (15 and 18).

<!-- END-OF-PART -->
