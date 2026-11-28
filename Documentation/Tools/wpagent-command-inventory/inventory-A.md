# WPAgent command inventory, part A

Scope: the 53 commands of `COMMAND_ROUTER` whose handlers are in `WPTestingActions.py`, `WPProjectActions.py`, `WPLoginActions.py`, `WPDataBaseActions.py` and `WPCommandActions.py`.
Source: `master` at commit `a862772f` (27 Nov 2026). Paths are relative to the repository root. Read-only analysis. Nothing was run against a prober, Kafka or a DB.
Every statement has a file and line. Where a statement is a conclusion from reading the code and was not run, it says "by the code".

## Legend: file short names

| Short | File |
|---|---|
| CM | `WPAgent/WPCmdMap.py` |
| TA | `WPAgent/actions/WPTestingActions.py` |
| PA | `WPAgent/actions/WPProjectActions.py` |
| LA | `WPAgent/actions/WPLoginActions.py` |
| DA | `WPAgent/actions/WPDataBaseActions.py` |
| CA | `WPAgent/actions/WPCommandActions.py` |
| DG | `WPAgent/actions/WPDieGridActions.py` |
| VD | `WPAgent/utilities/WPValidationDecorator.py` |
| VA | `WPAgent/utilities/WPValidator.py` |
| CC | `WPAgent/utilities/WPCommandConstants.py` |
| HL | `WPAgent/utilities/WPCommandsHelpList.json` |
| HP | `WPAgent/utilities/WPHelpers.py` |
| RB | `WPAgent/utilities/WPResponseBuilder.py` |
| DM | `WPAgent/utilities/WPDieMaps.py` |
| SM | `WPAgent/stateMachine/WpAgentStateMachine.py` |
| GP | `WPAgent/globals/WPAagentGlobalParameters.py` |
| DB | `WPAgent/services/WPDbKafkaClient.py` |
| MR | `WPAgent/services/WPMachineRecord.py` |
| CW | `WPAgent/services/WPProberConnectionWatch.py` |
| HB | `WPAgent/services/WPHeartbeat.py` |
| FA | `WPAgent/drivers/WPFactory.py` |
| SP | `WPAgent/drivers/WPSentioProber.py` |
| MP | `WPAgent/drivers/WPMockProber.py` |
| KC | `WPAgent/WPKafkaClient.py` |
| AG | `WPAgent/WPAgent.py` |
| KY | `Documentation/Kafka/svt.wp-agent.kafka.yaml` |

`g` means the singleton `SvtWPAagentGlobalParameters.getInstance()` (GP:138-142).

## 0. Rules that are the same for many commands

The command sections refer to these rules by their number.

### 0.1 Dispatch: `execute_command(message_type, data)` (CM:237-332)

1. `data` is made a dict. A string `k=v` becomes `{k: v}`. `None` becomes `{}` (CM:243-257).
2. An unknown command gets a 404 reply (CM:269-273).
3. State check. It runs when the command is not in `BYPASS_COMMANDS` and the call is not a step of a trusted built-in sequence. It asks `agentStateMachine.can_execute(message_type)` with the router key. A refusal is a 409 reply: `Command 'X' not allowed in state 'S'. Available: ...` (CM:277-287).
4. The handler is called as `action(**data)` (CM:292-293). Every key of `data` becomes a keyword argument. A key that the handler does not accept, or a missing required argument, raises `TypeError`. That goes to step 6.
5. A reply whose status is not `Success`: when its message has "missing", "invalid parameter" or "required", nothing more happens. Otherwise `_try_local_mode()` runs (CM:296-307). `_try_local_mode()` calls `prober.local_mode()` on the current connection, when the agent is connected and initialized (CM:188-205).
6. Exceptions. `ProberNotConnectedError` gives a 503 reply and no state change (CM:309-312). Any other exception gives the reply type `UnhandledErrorReply` with code 500. The state machine goes to `Error` when the command is not in `BYPASS_COMMANDS`. Then `_try_local_mode()` runs (CM:314-326).
7. One log line goes to `WPAgentLogger` (CM:329-330). The logger writes the file `WPAgentLogger.log` in the working directory. Its Kafka output is off by default (`WPAgent/utilities/WPAgentLogger.py`:28-30, 41-44, 51).

### 0.2 Validator (V)

The decorators `@validate_command` and `@validate_command_with_name(name)` call `WPCommandValidator.validate_command` before the handler (VD:67-76, 119-128). Section A has the full path. Short form:

- A command in `BYPASS_COMMANDS` skips the validator fully (VA:71-72).
- Step 1: agent name. Step 2: login. Step 3: testing lock. Step 4: user level. Step 5: parameter schema. Step 6: orientation check (VA:74-102).
- `@validate_command` makes the command name from the function name: `"".join(word.capitalize() for word in func_name.split("_"))` (VD:54-55). Two router keys do not match their derived name: `MoveChuckXY` is validated as `MoveChuckXy`, and `MoveChuckToWorkArea` as `MoveChuckWorkArea`. The repo test knows this: `KNOWN_MISMATCH = {"MoveChuckXY", "MoveChuckToWorkArea"}` (`WPAgent/tests/unit/TestValidationNames.py`:38).
- Handlers with no decorator have no validator at all: `list_probers` (DA:57), `list_chip_types` (DA:81), `initialize_machine` (PA:270), `show_status` (PA:344), `get_info` (PA:372), `reset_agent` (PA:529), `get_agent_state` (PA:556), `help` (PA:568), `list_available_commands` (CA:6).

### 0.3 READY check: `_ensure_initialized()` (TA:12-23, HP:85-112)

It returns an error reply with type `NotInitializedReply` and code 503 when one of these is true:

- `g.prober_connected` is `False` (HP:97-98).
- `ProberFactory` has no prober (HP:102-103).
- `g.address` or `g.machineType` is not set (HP:105-110).

It touches no DB and no Kafka. `g.prober_connected` is `None` until something sets it (GP:20). `None` passes the check.

### 0.4 UCI: `update_current_info(currentProber)` (TA:26-47)

It does nothing when the prober is `None` (TA:28-29). Otherwise it calls the prober in this order:

1. `get_current_index()` (TA:32). Writes `g.current_die_col`, `g.current_die_row` (TA:33-34).
2. `get_dies_number()` (TA:37). Writes `g.total_dies_number`.
3. `get_chuck_position()` two times (TA:40, 41). Writes `g.chuck_z_position_state`.
4. `get_current_working_area()` two times (TA:44, 47). Writes `g.current_working_area` (without the suffix "Camera") and `g.camera_mount_point` (the raw value).

These are queries to SENTIO. It does not call `local_mode()`.

### 0.5 ERR pattern of the handlers in TA

Almost every handler in TA ends like this (example TA:80-84):

- `except ProberNotConnectedError: raise`. The reply is the 503 of rule 0.1 step 6.
- `except Exception as e`: `agentStateMachine.enter_error_state(str(e))`, then a reply with code 500.

So a prober error puts the agent in the `Error` state. A refusal before the `try` block (READY check, a parameter check) does not.

### 0.6 Reply envelope (RB:70-87)

Every reply is `{status, type, data, error: {code, message}}`. On success the text is in `error.message` and `error.code` is 0 (RB:73-78). On error the status is `UnexpectedError` (RB:82-87).

`data` is the same for every command (RB:14-68). It is a snapshot of `g`:
`userLogged`, `userLoggedHierarchy`, `asicSerialNumber`, `wpMachineId`, `WPAG_State`, `proberConnected`, `proberInitialized`, `wpAgentName`, `loadedWafer`, `installedProbeCard`, `openedProjectId`, `projectName`, `overdrive`, `contactHeight`, `cameraMountPoint`, `currentWorkingArea`, `waferMapDiePosition {colIndex, rowIndex, subsiteIndex}`, `chuckZPositionState`, `totalDiesNumber`.

- `loadedWafer` is `{waferId, orientation}`, or the number `1` when no wafer is loaded (RB:30-37).
- `installedProbeCard` is `{probeCardId, orientation}` or `null` (RB:39-46).

"Reply: standard" in a command section means: this `data`, no extra fields.

### 0.7 What the Kafka listener adds around every command

- It drops a request whose `waferAgentName` does not name this machine. No reply is sent (KC:319-324, 567-568).
- It converts each string parameter with `ast.literal_eval` when that works (KC:169-176, 570-571). `"5"` becomes `5`. `"true"` stays a string.
- It counts the running command with `command_running()` (KC:601-602). `Initialize` with force and `ReconnectProber` use this count (PA:308, 516).
- It adds `executionTimeMs` to `data` (KC:607-610).
- It writes a snapshot of the reply data to `WPAgent.cache.json` after every command and on every heartbeat (KC:425-426, 438, 605; `WPAgent/utilities/WPAgentCache.py`:42-49). The Kafka output of this cache is off by default (`WPAgentCache.py`:22, 37-40). No code reads this file back (search for `cache.json` finds only the writer).
- The reply goes to the topic named in the request header (KC:628-642).
- It runs up to 4 commands at the same time (KC:441).
- It starts the heartbeat (topic `svt.wp-agent.heartbeat`, every 2 s; HB:72, 126-154, 207) and the connection watch (KC:455-458). The watch sets `g.prober_connected`, reconnects, and can put the agent in `Error` (CW:186-275).

No command in this part sends progress messages. A command sends one reply at its end. Other output is `print()` to the console.

### 0.8 Preconditions P1 to P5

None of these needs Kafka or the DB at the time of the command. All of them are values in process memory. They are lost when the process ends.

- **P1 agent name.** `g.wpAgentName` must be set, and `data.waferAgentName` must name the same machine (VA:106-125). Today only `listen()` sets `g.wpAgentName` (AG:302).
- **P2 login and level.** `g.userLogged` and `g.userLoggedHierarchy` must be set (VA:127-146, 211-266). Only `UserLogIn` sets them (LA:76, 93).
- **P3 state.** The state machine must be in a state that allows the command (CM:277-287). It starts in `ServiceOn` (SM:35). `ServiceOn` allows no command (SM:44-46).
- **P4 prober.** The process must hold a prober connection (`ProberFactory`), and `g.address` and `g.machineType` must be set (rule 0.3). `Initialize` makes the connection (PA:222).
- **P5 orientation data.** For the commands of rule 0.9, when a project is open: `g.probe_card_orientation` and `g.wafer_orientation` must be set (VA:571-584). Today they come only from the DB (section E).

### 0.9 ORI: the orientation check (VA:530-665)

It runs for these validator names (VA:540-555): `InitProbing`, `MoveChuckContact`, `RunPTPA`, `SetPTPA`, `AutoFocus`, `AlignWafer`, `MoveChuckAsic`, `MoveChuckRowColumn`, `MoveChuckNextDie`, `MoveChuckPreviousDie`, `LoadWafer`, `MoveChuckLoadedWafer`, `MoveChuckZ`, `MoveChuckXY`.

Two of them never get it: `AutoFocus` is a bypass command (VA:71-72, CC:28), and `MoveChuckXY` is validated under the name `MoveChuckXy` (rule 0.2).

The check, in order:

1. No project open (`g.projectName` empty): pass (VA:566-568).
2. `g.probe_card_orientation` empty: 400 `No probe card installed...` (VA:571-576).
3. `g.wafer_orientation` empty: 400 `No wafer loaded or orientation not set...` (VA:579-584).
4. Project name has "vertical" or "cantilever": the word must not conflict with the text of `g.probe_card_orientation` (VA:589-612).
5. Expected orientations are read from the project name. New form `Notch<E|W|N|S>_Arrow<E|W|N|S>`. Old form: the word East, West, North or South anywhere in the name (VA:496-528). No orientation in the name: a warning is printed, pass (VA:624-628).
6. Wafer orientation and probe card orientation must be equal to the expected ones, case-insensitive (VA:639-662).

It runs for every level, also Developer: step 6 comes after the level check (VA:89-102).

### 0.10 Developer mode

`UserLogIn` of a Developer forces the state `UsedByDeveloper` (LA:77-78). In that state `can_execute` is true for every command (SM:289-290) and `transition` keeps the state (SM:235-237). An error in a handler still enters `Error` (rule 0.5). In `Error` the developer mode is off, because it depends on the state, not on the user (SM:209-211).

"dev mode only" in a command section means: the command is in no transition table of a normal state, so only `UsedByDeveloper` allows it.

---

# Commands, in the order of `COMMAND_ROUTER`

## 1. ListProbers

1. **Handler:** `list_probers` (DA:57-78). Router: CM:42.
2. **Parameters:** `timeout`, float, optional, default 15.0 (DA:57). Help JSON: no parameters (HL:500-506). Contract: no parameters, only `waferAgentName` (KY:1155-1164, 2415-2426). No validator schema.
3. **Checks:** no decorator (DA:57). In `BYPASS_COMMANDS` (CC:22), so no state check (CM:277). No login, no level, no lock. `user` and `waferAgentName` are accepted and not used (DA:57). The contract tags it "3. DEVELOPER LEVEL" (KY:1157); the code checks no level. No state change.
4. **DB:** one read. `_get_db_client().get_all_wafer_probe_machines(timeout)` (DA:61). DB agent message `GetAllWaferProbeMachines`, data `{}`, reply `GetAllWaferProbeMachinesReply` (DB:201-206). The list is returned to the caller. No answer or an empty list: the client returns `[]` (DB:204-206), the command replies 404 `No wafer probe machines found or database agent not responding` (DA:63-68). An exception (for example no DB client, DB:39-43) gives 500 (DA:77-78).
5. **Kafka:** nothing more than the reply.
6. **Globals:** reads none, writes none.
7. **Prober:** none.
8. **Files:** none.
9. **Duration:** fast. Up to `timeout` seconds when the DB agent is silent (DB:150). Help JSON: 1-3 s (HL:505).
10. **Reply:** type `ListProbersReply`, text `Found N prober(s)`. Extra data: `probers` (the DB records) and `count` (DA:70-73).
11. **Without DB and Kafka:** the command is only a DB read. Without a DB it has no data. A tool could list the machines of its own config file, or leave the command out.

## 2. ListChipTypes

1. **Handler:** `list_chip_types` (DA:81-83). Router: CM:43.
2. **Parameters:** `timeout`, float, default 15.0, not used (DA:81-83). Help JSON: none (HL:508-514). Contract: none (KY:1196-1205).
3. **Checks:** no decorator. In `BYPASS_COMMANDS` (CC:23). No login, level, lock or state rule. Contract tag "3. DEVELOPER LEVEL" (KY:1198), not checked by the code.
4. **DB:** none. The handler is a stub. It always returns `Chip types retrieval not yet implemented` (DA:83). The contract example shows a list of chip types (KY:1220); the code does not produce it.
5. **Kafka:** none.
6. **Globals:** none.
7. **Prober:** none.
8. **Files:** none.
9. **Duration:** fast.
10. **Reply:** type `ListChipTypesReply`, standard data.
11. **Without DB and Kafka:** nothing.

## 3. UpdateLoadedWafer

1. **Handler:** `update_loaded_wafer` (DA:337-374). Router: CM:44.
2. **Parameters:**
   - `waferId`: number. Default `None` in the signature (DA:338), but it must be equal to `g.loaded_wafer_id` as a float, else 400 (DA:350-359). So it is required in effect.
   - `orientation`: one of `East`, `West`, `North`, `South`. Case does not matter, spaces are trimmed (DA:334, 361-367). Else 400.
   - No validator schema (VA:321-416 has no entry). Not in the help JSON (not found). Not in the contract (not found, 0 matches).
3. **Checks:** `@validate_command_with_name("UpdateLoadedWafer")` (DA:337). Full validator. Level Expert (CC:70). Testing lock applies. No ORI. State: allowed in `OpenedProject` (SM:52) and in dev mode. The handler never calls `transition`, so the state stays. Errors are returned as replies; the handler never enters `Error`.
4. **DB:** one write. `update_wp_machine_loaded_wafer(loaded_wafer_id=g.loaded_wafer_id, orientation=normalized)` (DA:369) calls `update_machine_loaded_wafer` (DA:313-316). DB agent message `UpdateWpMachineLoadedWafer` with `{wpMachineId, loadedWaferId, loadedWaferOrientation}`, reply `UpdateWpMachineLoadedWaferReply` (DB:223-233). It stores the corrected orientation in the machine record.
   - `g.wpMachineId` empty or 0: 400 `WP Machine ID not set. Initialize machine first.` (DA:307-310).
   - No answer or a non-success answer: 500 `Failed to update database` (DA:317-318).
   - Exception (for example no DB client): 500 `Error updating loaded wafer: ...` (DA:330-331).
   - The command passes the message and code on (DA:370-372).
5. **Kafka:** none more.
6. **Globals:** reads `g.loaded_wafer_id` (DA:347, 351, 369) and `g.wpMachineId` (DA:308). Writes `g.loaded_wafer_id` and `g.wafer_orientation` after a DB success only (DA:320-321, GP:306-315).
7. **Prober:** none in the handler ("Does not touch the hardware", DA:341). An error reply can trigger `local_mode()` by rule 0.1 step 5.
8. **Files:** none.
9. **Duration:** fast. Up to 15 s when the DB agent is silent (DA:302, DB:150).
10. **Reply:** type `UpdateLoadedWaferReply`, text `Loaded wafer orientation set to <X>` (DA:374). Standard data.
11. **Without DB and Kafka:** the DB write is the purpose of the command, and the new value reaches `g` only after the DB success. It also needs `g.loaded_wafer_id` and `g.wpMachineId`, which come from the DB. A tool would keep wafer id and orientation in its own config or state file. Also P1, P2, P3.

## 4. UpdateInstalledProbeCard

1. **Handler:** `update_installed_probe_card` (DA:419-458). Router: CM:45.
2. **Parameters:**
   - `probeCardId`: number, must be equal to `g.probe_card_id` as a float, else 400 (DA:432-441).
   - `orientation`: `East`, `West`, `North` or `South`, as for command 3 (DA:443-449).
   - No validator schema, not in the help JSON, not in the contract (not found).
3. **Checks:** `@validate_command_with_name("UpdateInstalledProbeCard")` (DA:419). Level Expert (CC:71). Lock applies. No ORI. State: `OpenedProject` (SM:53) or dev mode. No `transition` call, no `Error`.
4. **DB:** one write. `update_wp_machine_installed_probe_card(installed_probe_card_id=g.probe_card_id, orientation=normalized)` (DA:451-453) calls `update_machine_installed_probe_card` (DA:396-399). DB agent message `UpdateWpMachineInstalledProbeCard` with `{wpMachineId, installedProbeCardId, installedProbeCardOrientation}`, reply `UpdateWpMachineInstalledProbeCardReply` (DB:235-245). Failure cases as for command 3: 400 no machine id (DA:388-391), 500 no answer (DA:400-401), 500 exception (DA:415-416).
5. **Kafka:** none more.
6. **Globals:** reads `g.probe_card_id` (DA:429, 433, 452), `g.wpMachineId` (DA:389). Writes `g.probe_card_id`, `g.probe_card_orientation` after a DB success (DA:403-404, GP:317-326).
7. **Prober:** none.
8. **Files:** none.
9. **Duration:** fast, up to 15 s DB timeout.
10. **Reply:** type `UpdateInstalledProbeCardReply`, text `Installed probe card orientation set to <X>` (DA:458).
11. **Without DB and Kafka:** same as command 3: the DB write is the purpose, and `g.probe_card_id` comes only from the DB. A tool would keep probe card id and orientation in its config.

## 5. UserLogIn

Details in section D.

1. **Handler:** `UserLogIn` (LA:51-131). Router: CM:48.
2. **Parameters:**
   - `user`: string, required. It is a positional argument with no default (LA:53). Missing: `TypeError`, reply `UnhandledErrorReply` 500 (rule 0.1 step 6); no `Error` state because the command is a bypass command.
   - `address`, `machineType`: accepted, never used in the body (LA:53).
   - Contract: no data fields of its own (KY:1995-1999), plus `user` and `waferAgentName` of `RequestMessage` (KY:2400-2412). Help JSON: no entry (not found).
3. **Checks:** `@validate_command_with_name("UserLogIn")` (LA:51), but the command is in `BYPASS_COMMANDS` (CC:11), so the validator returns at once (VA:71-72). No agent name check, no state check (CM:277). The user must be in `configs/WPUserHierarchy.json`, else 403 (LA:67-72).
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** reads `g.userLogged`, `g.userLoggedHierarchy` (LA:63-64). Writes them with `g.set_user` (LA:76, 93). Writes the state: `UsedByDeveloper` for a Developer, `UserLogged` for others (LA:77-80, 94). Writes the UCI fields when a prober is connected.
7. **Prober:** `_prober_if_connected()` gives the current prober or `None` (LA:43-48, 65). Then UCI (LA:82, 90, 104, 115, 128). No `local_mode()` after it.
8. **Files:** reads `WPAgent/configs/WPUserHierarchy.json` (LA:14-15, 18-24) on every call (LA:35-40). Writes an `[AUDIT]` line to the log file (LA:27-32).
9. **Duration:** fast.
10. **Reply:** type `UserLogInReply`. Standard data.
11. **Without DB and Kafka:** nothing. Users and levels are in a local JSON file.

## 6. UserLogOut

Details in section D.

1. **Handler:** `UserLogOut` (LA:134-175). Router: CM:49.
2. **Parameters:** `user`, string, required (positional, LA:136). `address`, `machineType`: accepted, not used. Contract: no own fields (KY:2024-2028). Help JSON: not found.
3. **Checks:** decorator at LA:134, but bypass (CC:12). Rules in the handler: nobody logged in: 400 (LA:147-149). Another user is logged in: 400 (LA:152-161).
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** reads `g.userLogged`, `g.userLoggedHierarchy` (LA:143-144). Writes both to `None` (LA:166). `agentStateMachine.reset()` sets the state `ServiceOn` (LA:167, SM:300-313). It does not clear the testing lock, the project, the wafer or the prober connection.
7. **Prober:** none.
8. **Files:** an `[AUDIT]` log line (LA:168).
9. **Duration:** fast.
10. **Reply:** type `UserLogOutReply`, text `User '<user>' logged out successfully.` (LA:175).
11. **Without DB and Kafka:** nothing.

## 7. Initialize

Details in section C.

1. **Handler:** `initialize_machine` (PA:270-341). It calls `svt_initialise_wp` (PA:187-267). Router: CM:52.
2. **Parameters:** `force`, bool, optional, default `False` (PA:270). The strings "true", "1", "yes" also count as true (PA:300). Any other key gives 400 `Initialize takes only 'force'...` (PA:292-298). Help JSON agrees (HL:2-16). Contract agrees (KY:1404-1406, 2380-2397). The validator has a schema for it (VA:402-404) that is never used, because the handler has no decorator.
3. **Checks:** no decorator (PA:270). In `BYPASS_COMMANDS` (CC:14). No login, no level, no lock, no state rule. The state does not change (PA:84-88). `user` and `waferAgentName` are accepted and not used.
4. **DB:**
   - Read 1: `refresh_machine()` (PA:316). Message `GetAllWaferProbeMachines`, timeout 5 s (MR:13, 80). It refreshes `g.address`, `g.machineType`, `g.wpMachineId` from the record named `g.machine_record_name` (MR:107-109). It is skipped when `g.machine_record_name` is empty (mock config; MR:73-75). No answer, no record, or an exception: it returns `None` and the old values stay (MR:81-91).
   - Read 2: `_sync_from_db` (PA:231, 91-138). It uses the record of read 1 when there is one (PA:101). Otherwise it sends `GetAllWaferProbeMachines` again with timeout 15 s and looks for the id `g.wpMachineId` (PA:103-105). It reads `loadedWaferId`, `loadedWaferOrientation`, `installedProbeCardId`, `installedProbeCardOrientation` into `g` (PA:112-135). It is skipped when the machine id is empty or 0 (PA:97-98). A failure is printed and is not fatal (PA:137-138).
5. **Kafka:** `set_prober_connected` calls the connection listeners (CW:106-110). In the listener this publishes `WpConnectionStatusChanged` on `svt.wp-agent.connection-status` (KC:36-37, 326-347, 455). The heartbeat fields `proberConnected`, `proberInitialized`, `wpMachineId` change (HB:133-141).
6. **Globals:** reads `g.address`, `g.machineType`, `g.wpMachineId`, `g.wpAgentName`, `g.machine_record_name` (PA:317, 333-338). Writes: `prober_status` (PA:48), `prober_connected` (PA:51, 330), `address`, `machineType`, `wpMachineId`, `machine_name`, `initialization_mode`, `user` (the OS user), `wpag_state` (PA:62-88), `loaded_wafer_id`, `wafer_orientation`, `probe_card_id`, `probe_card_orientation` (PA:116-134), `chuck_z_position_state="Unknown"`, `current_working_area="LoadPosition"`, `camera_mount_point="Top"` (PA:237-239).
7. **Prober:** it only opens the connection: `factory.get_prober(...)` or, when already initialized, `factory.reconnect(...)` (PA:43-46). The agent code sends no command to the prober and does not call `local_mode()`. Before that: a TCP check `is_reachable` with a 2 s timeout, always true for a mock (PA:321, CW:40, 160-169).
8. **Files:** none. The address is not read from a file by this command (section C).
9. **Duration:** fast to medium. Help JSON: 1-10 s (HL:14). Worst case adds a 5 s and a 15 s DB timeout and a 2 s TCP timeout.
10. **Reply:** type `InitializeReply`, text `Initialized <name> at <address>` plus lines about the wafer and the probe card (PA:252-262). Standard data.
11. **Without DB and Kafka:** the handler does not stop when the DB is missing (both reads are tolerant). What stops it: `g.address` and `g.machineType` must be set before, else 500 `The machine of this agent is not known` (PA:317-320). Today `listen()` sets them from the DB record or a mock config (AG:301-308). From a config a tool needs: machine name, host and port, machine type, machine id, and the loaded wafer and probe card (id and orientation), which today come from the DB sync.

## 8. ShowStatus

1. **Handler:** `show_status` (PA:344-369). Router: CM:53.
2. **Parameters:** none (PA:344). Contract: none (KY:1899-1903). Help JSON: no `ShowStatus` entry (not found; there is `ShowProjectStatus`, HL:254-261, which is not a router key).
3. **Checks:** no decorator. In `BYPASS_COMMANDS` (CC:20). No login, level, lock or state rule.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** reads `g.wpAgentName`, `g.wpag_state`, `g.userLogged`, `g.projectName`, `g.loaded_wafer_id` (PA:357-364), `g.prober_connected` (PA:353, CW:47-51) and the factory state (PA:354, CW:54-58). Writes none.
7. **Prober:** none ("It reads only the agent's own state", PA:346-347).
8. **Files:** none.
9. **Duration:** fast.
10. **Reply:** type `ShowStatusReply`. Text: `Agent: <name> | Machine: <connected|not connected|not checked yet>, <initialized|not initialized> | State: <state> | User: <user> | Project: <project>` and ` | Wafer: <id>` when a wafer is loaded (PA:356-366). Standard data.
11. **Without DB and Kafka:** nothing. Note: only the connection watch of the listener keeps `g.prober_connected` fresh (KC:457-458). Without it the value is `None` ("not checked yet") until `Initialize` sets it (PA:51).

## 9. GetInfo

1. **Handler:** `get_info` (PA:372-400). Router: CM:54 (comment there: "!! irrelevant").
2. **Parameters:** none (PA:372). Help JSON: none (HL:263-269). Contract: not found.
3. **Checks:** no decorator. In `BYPASS_COMMANDS` (CC:19). No login, level, lock or state rule. No READY check: it calls `get_current_prober()` directly (PA:379). `ProberNotConnectedError` is raised again and becomes 503 (PA:397-398). Other errors become a 500 reply without `Error` state (PA:399-400).
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** writes `g.current_die_col`, `g.current_die_row`, `g.current_die_subsite=0` (PA:389).
7. **Prober:** `get_current_index()` (PA:380), `get_dies_number()` (PA:381). No `local_mode()`.
8. **Files:** none.
9. **Duration:** fast (HL:268).
10. **Reply:** type `GetInfoReply`, text `Current die: Count of selected dies N, Number n, Row r, Column c` (PA:391-395). Standard data.
11. **Without DB and Kafka:** nothing. It needs P4 only.

## 10. Help

1. **Handler:** `help` (PA:568-662). Router: CM:55.
2. **Parameters:** `command`, string, optional (PA:568). Help JSON agrees (HL:524-537). Contract: no field (KY:2349-2353).
3. **Checks:** no decorator. In `BYPASS_COMMANDS` (CC:17). No login, level, lock or state rule.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** none.
7. **Prober:** none.
8. **Files:** reads `utilities/WPCommandsHelpList.json`. It tries four paths: two relative to the working directory, two relative to `actions/` (PA:571-583). Not found: 404 (PA:585-590).
9. **Duration:** fast.
10. **Reply:** type `HelpReply`. For one command: the text and extra data `commandInfo` (PA:628-631). For all commands: the text and extra data `totalCommands` and `categories` (PA:657-662). The contract names a field `helpInfo` (KY:2355-2364); the code does not set it. An unknown name gives 404 (PA:595-601).
   - The handler prints the parameters from the key `parameters` (PA:610). The file uses the key `data` (for example HL:5, HL:53). So it always prints `Parameters: None` (PA:620-621).
   - The help file is keyed by old names. Examples: `Load` (HL:18), `Unload` (HL:26), `GoToDie` (HL:117), `GoToPreviousDie` (HL:141), `StepNextDie` (HL:149), `GoToContact` (HL:179), `GoToSeparation` (HL:187). These are not router keys. Router keys of this part with an entry: `Initialize`, `FindHome`, `AutoFocus`, `AlignWafer`, `RunPTPA`, `MoveChuckXY`, `MoveChuckZ`, `MoveChuckHome`, `MoveChuckToWorkArea`, `SwitchCamera`, `OpenProject`, `GetInfo`, `ListAvailableCommands`, `GetAgentState`, `ReconnectProber`, `ResetAgent`, `GetChuckPosition`, `LocalMode`, `ListProbers`, `ListChipTypes`, `Help` (HL:2, 34, 42, 50, 75, 83, 102, 157, 165, 195, 217, 263, 271, 279, 287, 296, 304, 491, 500, 508, 524). The other router keys of this part have no entry.
11. **Without DB and Kafka:** nothing.

## 11. LocalMode

1. **Handler:** `local_mode` (TA:1493-1516). Router: CM:56.
2. **Parameters:** none. Help JSON: none (HL:491-498). Contract: none (KY:2333-2337).
3. **Checks:** `@validate_command`, name `LocalMode` (TA:1493). Level Developer: the name is in neither `USER_COMMANDS` nor `EXPERT_COMMANDS` (CC:36-72, VA:236-261). Lock applies. No ORI. State: `UsedByDeveloper` only (SM:175). READY check (TA:1498-1500). ERR pattern (TA:1512-1516).
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** UCI fields.
7. **Prober:** UCI (TA:1506), then `local_mode()` (TA:1507).
8. **Files:** none.
9. **Duration:** fast (HL:496).
10. **Reply:** type `LocalModeReply`, text `Local mode` (TA:1511).
11. **Without DB and Kafka:** nothing. It needs P1 to P4.

## 12. LoadWafer

1. **Handler:** `load_wafer` (TA:969-1008). Router: CM:59.
2. **Parameters:**
   - `waferId`: validator schema says float, required (VA:331-332). Contract says string, required (KY:2212-2222). Over Kafka a numeric string is converted (rule 0.7), so both work there. A direct call needs a number, else 400 `Invalid type` (VA:299-304).
   - `orientation`: validator schema says string, optional (VA:333). The function has no default for it (TA:970). So a request without it raises `TypeError`: reply `UnhandledErrorReply` 500 and the `Error` state (rule 0.1 step 6). The handler does not check its value. Later checks compare it with East, West, North, South (rule 0.9 step 6).
   - Help JSON: entry `Load`, no parameters (HL:18-24).
3. **Checks:** `@validate_command`, name `LoadWafer` (TA:969). Level User (CC:40). Lock applies. ORI applies (VA:551). State: `Unloaded` to `UserLogged` (SM:83-86), or dev mode. READY check (TA:976-978). The handler refuses with 400 `Wafer already loaded` when `g.loaded_wafer_id` is set (TA:982-983). ERR pattern (TA:1003-1008).
   - By the code: the only normal state that allows `LoadWafer` is `Unloaded`, reached after `UnloadWafer`. `UnloadWafer` clears the wafer in `g` (TA:1037, GP:384-391) but not `g.projectName`. With a project name still set and no wafer orientation, ORI answers 400 before the handler runs: step 2 when there is no probe card orientation, else step 3 (VA:566-584). Only `ReconnectProber` clears the project name (PA:462). A Developer who has opened no project is not affected. This was read, not run.
4. **DB:** one write, after the hardware moves. `update_wp_machine_loaded_wafer(loaded_wafer_id=waferId, orientation=orientation)` (TA:995). Message `UpdateWpMachineLoadedWafer` (DB:223-233). The handler ignores the result (TA:995). `g.loaded_wafer_id` and `g.wafer_orientation` are set only inside the helper after a DB success (DA:320-321). So when the DB write fails (no machine id DA:309-310, no answer DA:317-318, exception DA:330-331) the command still replies `Success` and changes the state, but the agent does not know that a wafer is loaded.
5. **Kafka:** none more.
6. **Globals:** reads `g.loaded_wafer_id` (TA:982), `g.wpMachineId` (DA:308). Writes `g.chuck_z_position_state="Separation"`, `g.current_working_area="OffAxis"` (TA:999-1000), UCI fields, and the wafer fields on DB success.
7. **Prober:** `load_wafer()` (TA:988; SENTIO `move_chuck_load(LoadPosition.Center)`, SP:167-168), `move_chuck_offaxis_area()` (TA:989), UCI (TA:992), `local_mode()` (TA:993).
8. **Files:** none.
9. **Duration:** long (the chuck moves to the load position). Help JSON for `Load`: 30-60 s (HL:23).
10. **Reply:** type `LoadWaferReply` (derived, VD:56). The contract names `LoadedWaferReply` (KY:2226-2230). Text `Wafer has been loaded` (TA:1002).
11. **Without DB and Kafka:** the hardware part runs. But the wafer id and orientation reach `g` only through the DB write, so every later command that needs them fails (`UnloadWafer`, `MoveChuckUnloadWafer`, `MoveChuckAsic`, ORI). A tool must store `waferId` and `orientation` itself. Also P1 to P5.

## 13. UnloadWafer

1. **Handler:** `unload_wafer` (TA:1011-1049). Router: CM:60.
2. **Parameters:** none. Help JSON: entry `Unload` (HL:26-32). Contract: none (KY:2366-2370).
3. **Checks:** `@validate_command`, name `UnloadWafer`. Level User (CC:42). Lock applies. No ORI. State: `OpenedProject`, `Aligned` or `ChuckSafePosition` to `Unloaded` (SM:55, 61, 73), or dev mode. The contract says `UserLogged` or `OpenedProject` or `Aligned` (KY:264). READY check. 400 `No wafer loaded` when `g.loaded_wafer_id` is `None` (TA:1024-1025). ERR pattern.
4. **DB:** one write. `update_wp_machine_loaded_wafer(loaded_wafer_id=0, orientation=None)` (TA:1035). Message `UpdateWpMachineLoadedWafer` with `loadedWaferId: 0` (DB:227-232). Result ignored. A failure does not stop the command.
5. **Kafka:** none more.
6. **Globals:** reads `g.loaded_wafer_id` (TA:1024). Writes: `g.clear_wafer()` (TA:1037; wafer id, orientation, die counters, GP:384-391), `chuck_z_position_state="Separation"`, `current_working_area="LoadPosition"` (TA:1040-1041), UCI fields. On a DB success the helper first sets the wafer id to 0 (DA:320-321, because 0 is not `None`); `g.clear_wafer()` then clears it.
7. **Prober:** `unload_wafer()` (TA:1030; SENTIO `move_chuck_load(LoadPosition.Front)`, SP:161-162), UCI (TA:1032), `local_mode()` (TA:1033).
8. **Files:** none.
9. **Duration:** long. Help JSON for `Unload`: 30-60 s (HL:31).
10. **Reply:** type `UnloadWaferReply`. The contract names `UnloadedWaferReply` (KY:2372-2376). Text `Wafer unloaded` (TA:1043).
11. **Without DB and Kafka:** it needs `g.loaded_wafer_id`, which today comes only from the DB (section E). Without it the reply is 400 `No wafer loaded`. The DB write itself does not stop it. Also P1 to P4.

## 14. MoveChuckLoadedWafer

1. **Handler:** `move_chuck_loaded_wafer` (TA:1052-1087). Router: CM:61.
2. **Parameters:** none in the code (TA:1053). The contract requires `waferId` (KY:2054-2064). Sending `waferId` raises `TypeError` (rule 0.1 step 4). Help JSON: not found.
3. **Checks:** `@validate_command`, name `MoveChuckLoadedWafer`. Level User (CC:39). Lock applies. ORI applies (VA:552). State: `ChuckUnloaded` to `UserLogged` (SM:78-81), or dev mode. READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** writes `chuck_z_position_state="Separation"`, `current_working_area="OffAxis"` (TA:1076-1077), UCI fields.
7. **Prober:** `load_wafer()` (TA:1067), `move_chuck_offaxis_area()` (TA:1068), `local_mode()` (TA:1069), UCI (TA:1072). The queries of UCI come after `local_mode()`.
8. **Files:** none.
9. **Duration:** long (same moves as LoadWafer).
10. **Reply:** type `MoveChuckLoadedWaferReply`, text `Wafer has been loaded` (TA:1079-1081).
11. **Without DB and Kafka:** nothing in the handler. P1 to P5.

## 15. MoveChuckUnloadWafer

1. **Handler:** `move_chuck_unloaded_wafer` (TA:1090-1127). Router: CM:62.
2. **Parameters:** none. Contract: none (KY:2234-2238). Help JSON: not found.
3. **Checks:** `@validate_command_with_name("MoveChuckUnloadWafer", reply_type="MoveChuckUnloadedWaferReply")` (TA:1090). Level User (CC:41). Lock applies. No ORI. State: `OpenedProject`, `Aligned` or `ChuckSafePosition` to `ChuckUnloaded` (SM:56, 62, 74), or dev mode. The contract says `UserLogged` or `OpenedProject` or `Aligned` (KY:233). READY check. 400 `No wafer loaded` when `g.loaded_wafer_id` is `None` (TA:1102-1105). ERR pattern.
4. **DB:** none. The contract summary says "Unload wafer without DB update" (KY:230).
5. **Kafka:** none more.
6. **Globals:** reads `g.loaded_wafer_id` (TA:1102). Writes `chuck_z_position_state="Separation"`, `current_working_area="LoadPosition"` (TA:1118-1119), UCI fields. The wafer stays in `g`.
7. **Prober:** `unload_wafer()` (TA:1110), `local_mode()` (TA:1111), UCI (TA:1114).
8. **Files:** none.
9. **Duration:** long (move to the load position).
10. **Reply:** type `MoveChuckUnloadedWaferReply`. The contract names `MoveChuckunloadWaferReply` (KY:2240-2244). Text `Wafer unloaded` (TA:1121).
11. **Without DB and Kafka:** it needs `g.loaded_wafer_id` (today from the DB), else 400. P1 to P4.

## 16. OpenProject

1. **Handler:** `open_project` (TA:1179-1225). Router: CM:65.
2. **Parameters:** `projectName`, string, required (VA:323-325; contract KY:1844-1854). The help JSON lists a parameter `project_path` but its example uses `projectName` (HL:217-229).
3. **Checks:** `@validate_command`, name `OpenProject`. Level User (CC:37). Lock applies. No ORI. State: `UserLogged` to `OpenedProject` (SM:88-91), or dev mode. READY check (TA:1187-1189). ERR pattern (TA:1221-1225).
4. **DB:** one read. `get_project_id_by_name(projectName)` (TA:1205) calls `get_all_wafer_probe_projects` (DA:98). Message `GetAllWaferProbeProjects`, data `{}`, reply `GetAllWaferProbeProjectsReply` (DB:194-199). The id of the project with the same name (case-insensitive, DA:103) goes to `g.opened_project_id`. That value is used only in the reply data (`openedProjectId`, RB:59). No answer, no such project, or an exception: the helper returns `None` (DA:99-112) and the command continues.
5. **Kafka:** none more.
6. **Globals:** reads `g.projects_base_path` (TA:1196). Writes `g.projectName` (TA:1203-1204), `g.opened_project_id` (TA:1205), `g.contact_height` (TA:1209), UCI fields.
7. **Prober:** `open_project(projectName)` (TA:1200; SENTIO `open_project(path, restore_heights=True)`, SP:86-87), `get_contact_height()` (TA:1209), UCI (TA:1212), `local_mode()` (TA:1213).
8. **Files:** none on the agent side. The bare project name goes to SENTIO (TA:1200). The path `C:\ProgramData\MPI Corporation\SENTIO\projects\<name>` is built only for the reply text (GP:11, 77-78, TA:1196, 1217-1219).
9. **Duration:** fast to medium. Help JSON: 2-5 s (HL:228). Up to 15 s more when the DB agent is silent (DA:95).
10. **Reply:** type `OpenProjectReply`, text `Opened project: <path>` (TA:1217-1219).
11. **Without DB and Kafka:** nothing stops it. `openedProjectId` is `None` then. P1 to P4.

## 17. ChangeProject

1. **Handler:** `change_project` (TA:1130-1176). Router: CM:66.
2. **Parameters:** `projectName`, string, required (VA:387-389). Contract: not found. Help JSON: not found.
3. **Checks:** `@validate_command`, name `ChangeProject`. Level Expert (CC:58). Lock applies. No ORI. State: `OpenedProject` to `OpenedProject` (SM:50), or dev mode. READY check. ERR pattern.
4. **DB:** one read, same as OpenProject: `get_project_id_by_name` (TA:1156). Failure tolerated.
5. **Kafka:** none more.
6. **Globals:** same as OpenProject (TA:1147, 1154-1156, 1160).
7. **Prober:** `open_project(projectName)` (TA:1151), `get_contact_height()` (TA:1160), UCI (TA:1163), `local_mode()` (TA:1164).
8. **Files:** none.
9. **Duration:** as OpenProject.
10. **Reply:** type `ChangeProjectReply`, text `Project has been changed to: <path>` (TA:1168-1170).
11. **Without DB and Kafka:** nothing stops it. P1 to P4.

## 18. StressOpenProject

1. **Handler:** `stress_open_project` (TA:1228-1287). Router: CM:68.
2. **Parameters:** `projectNameFirst` (string), `projectNameSecond` (string), `iterations` (int): required by the signature (TA:1229-1232). `delay`: float, optional, default 0.0 (TA:1233). The contract agrees and adds `iterations` minimum 1 (KY:1681-1700). No validator schema. Help JSON: not found.
3. **Checks:** `@validate_command`, name `StressOpenProject`. Level Developer (in no list). Lock applies. No ORI. State: dev mode only (the name is in no transition table, SM:40-183). The contract says `OpenedProject` (KY:1131). READY check. ERR pattern. No `transition` call.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** writes `g.projectName` in every round (TA:1263-1264) and the UCI fields. It does not update `g.opened_project_id` or `g.contact_height`.
7. **Prober:** per round: `open_project(current)` (TA:1260), `go_to_separation()` (TA:1267), UCI (TA:1272). No `local_mode()` at the end.
8. **Files:** none.
9. **Duration:** long: a loop of `iterations` rounds, plus `delay` seconds per round (TA:1250, 1275-1276). Progress: `print` of the round number and the time of each round (TA:1257, 1278-1279), console only.
10. **Reply:** type `StressOpenProjectReply`, text `test is DONE` (TA:1281).
11. **Without DB and Kafka:** nothing. P1 to P4, Developer.

## 19. FindHome

1. **Handler:** `find_home` (TA:834-891). Router: CM:71.
2. **Parameters:** none. Help JSON: none (HL:34-40). Contract: none (KY:2277-2281).
3. **Checks:** `@validate_command`, name `FindHome`. Level Developer. Lock applies. No ORI. State: `UsedByDeveloper` only (SM:170). READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** UCI fields.
7. **Prober:** `get_chuck_xy()` (TA:847), `get_contact_height()` (TA:848), `find_home()` (TA:854), `get_chuck_xy()` (TA:857), `get_contact_height()` (TA:858), UCI (TA:874), `local_mode()` (TA:875).
8. **Files:** none.
9. **Duration:** medium. Help JSON: 10-20 s (HL:39).
10. **Reply:** type `FindHomeReply`. The text has x, y, z before and after and the correction (TA:879-885).
11. **Without DB and Kafka:** nothing. P1 to P4, Developer.

## 20. AutoFocus

1. **Handler:** `auto_focus` (TA:939-966). Router: CM:72.
2. **Parameters:** none. Help JSON: none (HL:42-48). Contract: none (KY:2291-2295).
3. **Checks:** `@validate_command`, name `AutoFocus` (TA:939). `AutoFocus` is in `BYPASS_COMMANDS` (CC:28). So the validator returns at once (VA:71-72): no agent name check, no login, no lock, no level, no ORI. `EXPERT_COMMANDS` lists it (CC:66) and the ORI list has it (VA:545), but neither is reached. No state check (CM:277). The contract says Expert and state `OnDie_OffAxis_withoutPTPA` (KY:935-939). READY check (TA:944-946). `transition("AutoFocus")` (TA:957) is a self-loop in `OnDie_OffAxis_withoutPTPA` and `OnDie_OffAxis_withPTPA` (SM:121, 131); in other states it changes nothing (SM:252-253). A prober error enters `Error` (TA:964-966).
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** UCI fields.
7. **Prober:** `auto_focus()` (TA:951), UCI (TA:954), `local_mode()` (TA:955).
8. **Files:** none.
9. **Duration:** medium. Help JSON: 12-18 s (HL:47).
10. **Reply:** type `AutoFocusReply`, text `Auto-focus command successfully executed` (TA:959-961).
11. **Without DB and Kafka:** nothing. It needs P4 only.

## 21. AlignWafer

1. **Handler:** `align_wafer` (TA:894-936). Router: CM:73.
2. **Parameters:**
   - `align_die_col`, `align_die_row`: int. The validator schema says optional (VA:396-398). The handler needs both, else 400 (TA:905-910). The help JSON says required (HL:54-63).
   - `subsite`: int, optional, default 0 (VA:399, TA:913-914).
   - The contract has no data fields for it (KY:2262-2266).
3. **Checks:** `@validate_command`, name `AlignWafer`. Level Developer. Lock applies. ORI applies (VA:546). State: dev mode only (in no transition table). READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** UCI fields.
7. **Prober:** `align_wafer(align_die_col, align_die_row, subsite)` (TA:919; SENTIO: `map.step_die(...)` then `vision.align_wafer()`, SP:173-177), UCI (TA:922), `local_mode()` (TA:923).
8. **Files:** none.
9. **Duration:** long. Help JSON: 20-60 s (HL:71).
10. **Reply:** type `AlignWaferReply`, text `Wafer aligned using die at Col c, Row r, Subsite s` (TA:927-930).
11. **Without DB and Kafka:** nothing in the handler. P1 to P5, Developer.

## 22. SwitchCamera

1. **Handler:** `switch_camera` (TA:1290-1321). Router: CM:74.
2. **Parameters:** `mountPoint`, string, required (VA:375-377; contract KY:1788-1798). Allowed values: the member names of the SENTIO enum `CameraMountPoint`; the driver uses `getattr(CameraMountPoint, mountPoint)` (SP:154-156). The help JSON lists `Vce, OffAxis, Scope, Chuck` (HL:199-203).
3. **Checks:** `@validate_command`, name `SwitchCamera`. Level Developer. Lock applies. No ORI. State: `UsedByDeveloper` only (SM:171). READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** UCI fields, then `g.camera_mount_point = mountPoint` (TA:1309).
7. **Prober:** `switch_camera(mountPoint)` (TA:1303), UCI (TA:1306), `local_mode()` (TA:1310).
8. **Files:** none.
9. **Duration:** fast. Help JSON: 1-2 s (HL:206).
10. **Reply:** type `SwitchCameraReply`, text `Switched camera to <mountPoint>` (TA:1314-1316).
11. **Without DB and Kafka:** nothing. P1 to P4, Developer.

## 23. MoveChuckCenter

1. **Handler:** `move_chuck_center` (TA:113-137). Router: CM:77.
2. **Parameters:** none. Contract: none (KY:2248-2252). Help JSON: not found.
3. **Checks:** `@validate_command`, name `MoveChuckCenter`. Level Developer. Lock applies. No ORI. State: `UsedByDeveloper` only (SM:167). READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** UCI fields.
7. **Prober:** `move_chuck_center()` (TA:124), UCI (TA:127), `local_mode()` (TA:129).
8. **Files:** none.
9. **Duration:** fast (one chuck move).
10. **Reply:** type `MoveChuckCenterReply`, text `Moved chuck to Center` (TA:132).
11. **Without DB and Kafka:** nothing. P1 to P4, Developer.

## 24. MoveChuckXY

1. **Handler:** `move_chuck_xy` (TA:50-84). Router: CM:78.
2. **Parameters:** `x`, `y`, `position`: all three required by the signature (TA:51). `x`, `y` in micrometer (TA:56-57). `position`: the SENTIO driver knows `"Zero"`, `"Relative"`, `"Center"`; any other value passes `None` as the reference (SP:89-97).
   - The validator has a schema `MoveChuckXY` (x float, y float, position string, all required; VA:353-357). It is not applied, because the validator name is `MoveChuckXy` (rule 0.2).
   - The contract has only `x` and `y` (KY:1766-1778). The help JSON has only `x` and `y` (HL:83-100). A request without `position` raises `TypeError`: 500 and `Error` state (rule 0.1 step 6).
3. **Checks:** `@validate_command`, derived name `MoveChuckXy` (TA:50). Level Developer (the name is in no list). Lock applies. ORI lists `MoveChuckXY` (VA:554) but does not match the derived name, so no ORI. State: `UsedByDeveloper` only (SM:165). READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** UCI fields.
7. **Prober:** `move_chuck_xy(x, y, position)` (TA:69), UCI (TA:72), `local_mode()` (TA:73).
8. **Files:** none.
9. **Duration:** fast. Help JSON: 2-5 s (HL:99).
10. **Reply:** type `MoveChuckXyReply` (derived, VD:56). The contract names `MoveChuckXYReply` (KY:1780-1784). Text `Moved chuck to x=<x>, y=<y>` (TA:76-78).
11. **Without DB and Kafka:** nothing. P1 to P4, Developer.

## 25. MoveChuckZ

1. **Handler:** `move_chuck_z` (TA:87-110). Router: CM:79.
2. **Parameters:** `z`, float, required (VA:359-361; contract KY:2147-2157; help HL:102-115). Micrometer, Zero reference (SP:127-128).
3. **Checks:** `@validate_command`, name `MoveChuckZ`. Level Developer. Lock applies. ORI applies (VA:553). State: `UsedByDeveloper` only (SM:166). READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** UCI fields.
7. **Prober:** `move_chuck_z(z)` (TA:98), UCI (TA:101), `local_mode()` (TA:102).
8. **Files:** none.
9. **Duration:** fast. Help JSON: 2-5 s (HL:114).
10. **Reply:** type `MoveChuckZReply`, text `Moved chuck to z=<z>` (TA:105). Standard data. The contract describes other data fields for this reply (KY:2159-2176); the code sends the standard data.
11. **Without DB and Kafka:** nothing in the handler. P1 to P5, Developer.

## 26. MoveChuckRowColumn

1. **Handler:** `move_chuck_die` (TA:404-547). Router: CM:80.
2. **Parameters** (signature TA:405-409, schema VA:336-347, all optional in the schema):
   - `col`, `row`: int. `label`: string. Exactly one of (`col` and `row`) or `label` must be given, else 400 (TA:464-479).
   - `subsite`: int, default 0. It is stored in `g` (TA:527) but not passed to the prober (TA:524).
   - `precise`: bool, default `False`. `reference`: string, default `None`. `precision_um`: float, default 0.5. `max_iterations`: int, default 10. `correction_settle_s`: float, default 0.1. `step_tolerance_um`: float, default 50.0.
   - `precise` together with a non-zero `subsite`: 400 (TA:505-506).
   - The contract lists `row`, `col` as required and `label` as optional, and has none of the precise parameters (KY:1657-1671). Help JSON: entry `GoToDie` with `col`, `row`, `subsite` (HL:117-139).
3. **Checks:** `@validate_command_with_name("MoveChuckRowColumn", reply_type="MoveChuckDieReply")` (TA:404). Level Expert (CC:67). Lock applies. ORI applies (VA:548). State: from `Aligned`, `OnDie_Wide`, `OnDie_OffAxis_withoutPTPA`, `OnDie_OffAxis_withPTPA`, `OnDie_Wide_withPTPA`, `OnDie_Wide_withoutPTPA` to `OnDie_OffAxis_withoutPTPA` (SM:67, 98, 120, 130, 142, 154), or dev mode. The label is converted before the READY check (TA:485-503). ERR pattern (TA:543-547).
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** reads `g.projectName` (TA:489, 515, 520). Writes `g.chuck_z_position_state="Separation"` (TA:401), `g.current_die_col/row/subsite` (TA:527), UCI fields.
7. **Prober:**
   - Normal: `move_chuck_offaxis_area()` (TA:510, 400), `go_to_die(col, row)` (TA:524), UCI (TA:531), `local_mode()` (TA:532).
   - Precise: `move_chuck_offaxis_area()`, then `read_reference`: `get_current_working_area()` (DG:47) and, without `reference`, `get_chuck_xy()` and `get_current_index()` (DG:58-59, 34-36). Then `precise_die_move` (DG:62-114): when the target die differs from the reference die: `get_die_size()`, `go_to_die(reference)`, `get_chuck_xy()`, `go_to_die(target)`, `get_chuck_xy()` (DG:78-83). Then `move_chuck_xy_precise(...)` of `WPImagingActions.py` (DG:108-109), a closed-loop move with up to `max_iterations` corrections. Then UCI and `local_mode()`.
8. **Files:**
   - With `label`: reads `WPAgent/configs/WPMapConversion_<wafer type>.json`. The wafer type is the part of `g.projectName` before the first `_` (DM:27-28, 34-44, 91-122). The file is cached in memory (DM:31, 56-71).
   - With `precise` and `reference`: reads `Contacting/<project>/positions.json` (DG:48-49; `WPAgent/utilities/WPContacting.py`:25-26, 39-41, 54-56).
   - With `precise`: reads and writes `Contacting/<project>/die_grid.json` (DG:87, 101; `WPAgent/utilities/WPDieGrid.py`:27-52).
   - `Contacting/` is relative to the working directory (`WPContacting.py`:4, 25).
9. **Duration:** fast in normal mode (help for `GoToDie`: 2-5 s, HL:138). The precise mode adds two die moves and a correction loop.
10. **Reply:** type `MoveChuckDieReply` (TA:404). The contract names `MoveChuckRowColumnReply` (KY:1673-1677). Text `Moved to die col=c, row=r` or `Moved to die '<label>' (col=c, row=r)`, plus the precise details (TA:535-541).
11. **Without DB and Kafka:** nothing in the handler. P1 to P5 (ORI needs the wafer and probe card orientation, today from the DB).

## 27. MoveChuckAsic

1. **Handler:** `move_chuck_asic` (TA:1519-1608). Router: CM:81.
2. **Parameters:**
   - `asicId`: validator schema says int, required (VA:349-351). The contract says string, required (KY:2505-2515). Over Kafka a numeric string is converted (rule 0.7).
   - `subsite`: int, default 0 (TA:1520). Not in the schema: the validator only prints a warning (VA:305-309). It is stored in `g` only (TA:1580).
   - Help JSON: not found.
3. **Checks:** `@validate_command`, name `MoveChuckAsic`. Level User (CC:43). Lock applies. ORI applies (VA:547). State: from `Aligned`, `OnDie_Wide`, `OnDie_OffAxis_withoutPTPA`, `OnDie_OffAxis_withPTPA`, `OnDie_Wide_withPTPA`, `OnDie_Wide_withoutPTPA` to `OnDie_Wide_withPTPA` (SM:64, 95, 115, 126, 136, 147), or dev mode. The contract list has no `OnDie_Wide` (KY:295). READY check (TA:1535-1537). ERR pattern (TA:1604-1608).
4. **DB:** one read, before any move. `get_asic_by_id(asicId)` (TA:1541) calls `get_all_asic_by_id` (DA:471). Message `GetAllAsics` with data `{"filter": {"ids": [asicId]}, "pager": {"limit": 1, "offset": 0}}`, reply `GetAllAsicsReply` (DB:208-221). Used fields: `serialNumber` (the die label, TA:1548) and `waferId` (must be equal to `g.loaded_wafer_id`, TA:1554-1558).
   - No answer: the client returns `None` (DB:219-221), the helper fails on `None.get` (DA:472), the command replies 400 `Failed to get ASIC from database: ...` (TA:1542-1545).
   - No record: 400 with `ASIC with ID <id> not found in database` (DA:474-475, TA:1542-1545).
   - No serial number: 400 (TA:1549-1552). Other wafer: 400 `ASIC ID <id> not found on loaded wafer` (TA:1555-1558).
5. **Kafka:** none more.
6. **Globals:** reads `g.loaded_wafer_id` (TA:1555), `g.projectName` (TA:1564). Writes `g.chuck_z_position_state="Separation"` (TA:1576, 1590), the current die (TA:1580), UCI fields.
7. **Prober:** `move_chuck_offaxis_area()` (TA:1575), `go_to_die(col, row)` (TA:1579), `auto_focus()` (TA:1583), `run_ptpa()` (TA:1586), `move_chuck_wide()` (TA:1589), UCI (TA:1593), `local_mode()` (TA:1594).
8. **Files:** reads `WPAgent/configs/WPMapConversion_<wafer type>.json` through `label_to_coordinates(serial_number, g.projectName)` (TA:1564, DM:91-122).
9. **Duration:** long. It contains an auto focus and a PTPA run. Help JSON: AutoFocus 12-18 s (HL:47), RunPTPA 90-180 s (HL:80).
10. **Reply:** type `MoveChuckAsicReply`. Text `Moved to ASIC ID <id> (serial: <sn>) at col=c, row=r ...` (TA:1598-1602).
11. **Without DB and Kafka:** stopped by the DB read: it turns the ASIC id into a serial number and a wafer id. It also needs `g.loaded_wafer_id` (DB) and P5. A tool would take the die label or serial number directly (the map file already turns a label into col and row), or a local table ASIC id to serial number. Also P1 to P4.

## 28. MoveChuckNextDie

1. **Handler:** `move_chuck_next_die` (TA:550-577). Router: CM:82.
2. **Parameters:** none. Contract: none (KY:1885-1889). Help JSON: entry `StepNextDie` (HL:149-155).
3. **Checks:** `@validate_command`, name `MoveChuckNextDie`. Level Expert (CC:59). Lock applies. ORI applies (VA:549). State: from `Aligned`, `OnDie_Wide`, `OnDie_OffAxis_withoutPTPA`, `OnDie_OffAxis_withPTPA`, `OnDie_Wide_withPTPA`, `OnDie_Wide_withoutPTPA` to `OnDie_OffAxis_withoutPTPA` (SM:65, 96, 118, 128, 140, 152), or dev mode. READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** writes `g.chuck_z_position_state="Separation"` (TA:401), UCI fields.
7. **Prober:** `move_chuck_offaxis_area()` (TA:561, 400), `step_next_die()` (TA:562), UCI (TA:565), `local_mode()` (TA:566).
8. **Files:** none.
9. **Duration:** fast. Help JSON: 2-5 s (HL:154).
10. **Reply:** type `MoveChuckNextDieReply`, text `Stepped to next die: <prober result>` (TA:570-572).
11. **Without DB and Kafka:** nothing in the handler. P1 to P5.

## 29. MoveChuckPreviousDie

1. **Handler:** `move_chuck_previous_die` (TA:580-609). Router: CM:83.
2. **Parameters:** none. Contract: none (KY:2198-2202). Help JSON: entry `GoToPreviousDie` (HL:141-147).
3. **Checks:** `@validate_command`, name `MoveChuckPreviousDie`. Level Expert (CC:62). Lock applies. ORI applies (VA:550). State: the same six states to `OnDie_OffAxis_withoutPTPA` (SM:66, 97, 119, 129, 141, 153), or dev mode. READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** as command 28.
7. **Prober:** `move_chuck_offaxis_area()` (TA:591), `step_prev_die()` (TA:593; SENTIO command `map:step_previous_die`, SP:148-149), UCI (TA:596), `local_mode()` (TA:597).
8. **Files:** none.
9. **Duration:** fast. Help JSON: 2-5 s (HL:146).
10. **Reply:** type `MoveChuckPreviousDieReply`, text `Moved to previous die` (TA:601-603).
11. **Without DB and Kafka:** nothing in the handler. P1 to P5.

## 30. MoveChuckHome

1. **Handler:** `move_chuck_home` (TA:140-164). Router: CM:84.
2. **Parameters:** none. Contract: none (KY:2305-2309). Help JSON: none (HL:157-163).
3. **Checks:** `@validate_command`, name `MoveChuckHome`. Level Developer. Lock applies. No ORI. State: `UsedByDeveloper` only (SM:168). READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** UCI fields.
7. **Prober:** `move_chuck_home()` (TA:151), UCI (TA:154), `local_mode()` (TA:155).
8. **Files:** none.
9. **Duration:** fast. Help JSON: 2-5 s (HL:162).
10. **Reply:** type `MoveChuckHomeReply`, text `Chuck moved home` (TA:158).
11. **Without DB and Kafka:** nothing. P1 to P4, Developer.

## 31. MoveChuckToWorkArea

1. **Handler:** `move_chuck_work_area` (TA:167-202). Router: CM:85.
2. **Parameters:** `work_area`, default `0` (TA:168).
   - The validator schema `MoveChuckToWorkArea` wants `workArea`, string, required (VA:379-381). It is not applied: the validator name is `MoveChuckWorkArea` (rule 0.2).
   - The contract names the field `workArea` (KY:2178-2188). The help JSON names it `work_area` (HL:165-177). Sending `workArea` raises `TypeError` (rule 0.1 step 4).
   - Values: the SENTIO driver needs the name of a member of the enum `WorkArea` (SP:197-205); the driver itself uses `Offaxis` and `Probing` (SP:208, 212). The mock driver needs a number 0, 1 or 2 (MP:164-169).
3. **Checks:** `@validate_command`, derived name `MoveChuckWorkArea`. Level Developer. Lock applies. No ORI. State: `UsedByDeveloper` only (SM:169). READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** writes `g.current_working_area` from a small table (`0: Probing`, `1: Offaxis`, else `Area<value>`; TA:185-186). UCI then overwrites it (TA:189).
7. **Prober:** `move_chuck_work_area(work_area)` (TA:182), UCI (TA:189), `local_mode()` (TA:190).
8. **Files:** none.
9. **Duration:** fast. Help JSON: 2-5 s (HL:176).
10. **Reply:** type `MoveChuckWorkAreaReply` (derived). The contract names `MoveChuckToWorkAreaReply` (KY:2190-2194). Text `Moved to <work_area> workarea` (TA:194-196).
11. **Without DB and Kafka:** nothing. P1 to P4, Developer.

## 32. MoveChuckContact

1. **Handler:** `move_chuck_contact` (TA:323-355). Router: CM:86.
2. **Parameters:** none. Contract: none (KY:1932-1936). Help JSON: entry `GoToContact` (HL:179-185).
3. **Checks:** `@validate_command`, name `MoveChuckContact`. Level User (CC:46). Lock applies. ORI applies (VA:542). State: from `OnDie_Wide`, `OnDie_Wide_withPTPA`, `OnDie_Wide_withoutPTPA` to `AtContact` (SM:94, 139, 150), or dev mode. READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** UCI fields, then `g.chuck_z_position_state="Contact"` (TA:345).
7. **Prober:** `go_to_contact()` (TA:338; SENTIO `move_chuck_contact()`, SP:182-183), UCI (TA:341), `local_mode()` (TA:342).
8. **Files:** none.
9. **Duration:** fast. Help JSON for `GoToContact`: 1-2 s (HL:184).
10. **Reply:** type `MoveChuckContactReply`, text `Probe station is in contact` (TA:348-350).
11. **Without DB and Kafka:** nothing in the handler. P1 to P5.

## 33. MoveChuckSeparation

1. **Handler:** `move_chuck_separation` (TA:358-389). Router: CM:87.
2. **Parameters:** none. Contract: none (KY:1917-1921). Help JSON: entry `GoToSeparation` (HL:187-193).
3. **Checks:** `@validate_command`, name `MoveChuckSeparation`. Level User (CC:44). Lock applies. No ORI. State: `AtContact` to `OnDie_Wide` (SM:105), or dev mode. READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** UCI fields, then `g.chuck_z_position_state="Separation"` (TA:379).
7. **Prober:** `go_to_separation()` (TA:372; SENTIO `move_chuck_separation()`, SP:185-186), UCI (TA:375), `local_mode()` (TA:376).
8. **Files:** none.
9. **Duration:** fast. Help JSON for `GoToSeparation`: 1-2 s (HL:192).
10. **Reply:** type `MoveChuckSeparationReply`, text `Probe station is in separation` (TA:382-384).
11. **Without DB and Kafka:** nothing. P1 to P4.

## 34. MoveChuckSafePosition

1. **Handler:** `move_chuck_safe_position` (TA:277-320). Router: CM:88.
2. **Parameters:** none. The contract names the message `MoveChuckSavePosition` (KY:2040-2044) under the path `MoveChuckSafePosition` (KY:353). Help JSON: not found.
3. **Checks:** `@validate_command`, name `MoveChuckSafePosition`. Level User (CC:45). Lock applies. No ORI. State: `OpenedProject` or `Aligned` to `ChuckSafePosition` (SM:54, 63), or dev mode. READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** writes `g.chuck_z_position_state="Separation"` (TA:310). No UCI.
7. **Prober:** `move_chuck_offaxis_area()` (TA:303), `move_chuck_xy(x=37500.0, y=160000.0, position="Center")` (TA:304), `move_chuck_z(z=10377.7)` (TA:305), `local_mode()` (TA:307). The numbers are constants in the code: wafer diameter 300000 um, margin 10000 um, z 10377.7 um (TA:284-290).
8. **Files:** none. No config file holds the safe position.
9. **Duration:** fast to medium (three moves).
10. **Reply:** type `MoveChuckSafePositionReply`. The contract names `MoveChuckSavePositionReply` (KY:2046-2050). Text `Probe station is in safe position` (TA:313-315).
11. **Without DB and Kafka:** nothing. P1 to P4.

## 35. InitProbing

1. **Handler:** `init_probing` (TA:705-831). Router: CM:89.
2. **Parameters:** none (TA:706). Contract: none (KY:1865-1872). Help JSON: not found.
3. **Checks:** `@validate_command`, name `InitProbing`. Level User (CC:38). Lock applies. ORI applies (VA:541). State: `OpenedProject` or `ChuckSafePosition` to `Aligned` (SM:49, 72), or dev mode. READY check (TA:721-723). 400 `No project is open. Run OpenProject first.` when `g.projectName` is empty (TA:726-730).
4. **DB:** one read, before any move. `get_project_family_by_name(user_project)` (TA:733) calls `get_all_wafer_probe_projects` (DA:118). Message `GetAllWaferProbeProjects` (DB:194-199). It takes `asicFamilyType` of the project with the same name (DA:123-128). The family selects the alignment project. No answer, no such project, no family, or an exception: the helper returns `None` (DA:119-132) and the command replies 404 `Cannot determine the ASIC family of project ...` (TA:734-740). Nothing has moved then.
5. **Kafka:** none more.
6. **Globals:** reads `g.projectName` (TA:726). Writes UCI fields. `g.projectName` keeps the user's project all the time (TA:714).
7. **Prober:** (TA:768-797, 816-817)
   1. `go_to_separation()` (TA:769)
   2. `move_chuck_offaxis_area()` (TA:770)
   3. `move_chuck_center()` (TA:771)
   4. `auto_focus()` (TA:772)
   5. `open_project(alignment_project)`, only when it differs from the user's project (TA:762, 774-777)
   6. `align_wafer(align_die_col=-1, align_die_row=1)` (TA:780). The die is fixed in the code; a TODO says it should come from the DB (TA:779).
   7. `open_project(user_project)`, only when step 5 ran (TA:785-790)
   8. `find_home()`, only when alignment and re-open had no error (TA:793-797)
   9. UCI (TA:816), `local_mode()` (TA:817)
   - An error in steps 1 to 8 enters `Error` and gives 500 with the list of what failed (TA:799-812).
8. **Files:** reads `WPAgent/configs/WPInitProbingConfig.json`: ASIC family (upper case) to alignment project name (`WPAgent/utilities/WPInitProbingConfig.py`:15, 18-37; TA:742). Current content: `BABYMOSAIX` and `MOSAIX` both map to `ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW` (`WPAgent/configs/WPInitProbingConfig.json`:2-3). A broken file gives 500 (TA:743-744). A family that is not in the file gives 400 (TA:745-751).
9. **Duration:** long: auto focus, up to two project switches, wafer alignment, find home. Help JSON for the parts: AutoFocus 12-18 s (HL:47), AlignWafer 20-60 s (HL:71), FindHome 10-20 s (HL:39), OpenProject 2-5 s (HL:228). Progress: `print` lines only (TA:775, 787).
10. **Reply:** type `InitProbingReply`, text `Initialization complete`, plus a sentence about the alignment project when it was switched (TA:820-826).
11. **Without DB and Kafka:** stopped by the DB read of the ASIC family (404). It also needs P5: wafer and probe card orientation from the DB. From a config a tool needs: project name to ASIC family (or directly project name to alignment project). The family to alignment project table is already a file. Also P1 to P4.

## 36. GetChuckPosition

1. **Handler:** `get_chuck_position` (TA:1324-1343). Router: CM:90.
2. **Parameters:** none. Help JSON: none (HL:304-310). Contract: not found.
3. **Checks:** `@validate_command`, name `GetChuckPosition`. Level Developer (in no list). Exempt from the testing lock (VA:31). No ORI. State: dev mode only (in no transition table). READY check. ERR pattern. No `transition` call.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** none.
7. **Prober:** `get_chuck_position()` (TA:1335), `local_mode()` (TA:1336).
8. **Files:** none.
9. **Duration:** fast (HL:309).
10. **Reply:** type `GetChuckPositionReply`, text `Chuck is <In Contact|In Separation|In ...>` (TA:1338, SP:276-319).
11. **Without DB and Kafka:** nothing. P1 to P4, Developer.

## 37. MoveChuckTopLeft

1. **Handler:** `move_chuck_top_left` (TA:1746-1770). Router: CM:93.
2. **Parameters:** none. Contract: none (KY:1710-1714). Help JSON: not found.
3. **Checks:** `@validate_command`, name `MoveChuckTopLeft`. Level Developer. Lock applies. No ORI. State: `UsedByDeveloper` only (SM:177). The contract says `OnDie_Wide_withPTPA` or `OnDie_Wide` or `OnDie_Wide_withoutPTPA` (KY:1008). READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** UCI fields.
7. **Prober:** `move_chuck_xy(15.0, -10.0, "Relative")` (TA:1755-1758), UCI (TA:1760), `local_mode()` (TA:1761). The offset is a constant in the code.
8. **Files:** none.
9. **Duration:** fast.
10. **Reply:** type `MoveChuckTopLeftReply`, text `Moved chuck to Top Left corner` (TA:1764).
11. **Without DB and Kafka:** nothing. P1 to P4, Developer.

## 38. MoveChuckTopRight

Same as command 37, with these differences:

1. **Handler:** `move_chuck_top_right` (TA:1773-1796). Router: CM:94.
3. **Checks:** name `MoveChuckTopRight`. State: `UsedByDeveloper` only (SM:178). Contract state as command 37 (KY:1039).
7. **Prober:** `move_chuck_xy(-15.0, -10.0, "Relative")` (TA:1782-1785), UCI (TA:1787), `local_mode()` (TA:1788).
10. **Reply:** type `MoveChuckTopRightReply`, text `Moved chuck to Top Right corner` (TA:1790).

## 39. MoveChuckBottomLeft

Same as command 37, with these differences:

1. **Handler:** `move_chuck_bottom_left` (TA:1799-1821). Router: CM:95.
3. **Checks:** name `MoveChuckBottomLeft`. State: `UsedByDeveloper` only (SM:179). Contract state as command 37 (KY:1070).
7. **Prober:** `move_chuck_xy(15.0, 10.0, "Relative")` (TA:1808-1811), UCI (TA:1813), `local_mode()` (TA:1814).
10. **Reply:** type `MoveChuckBottomLeftReply`, text `Chuck moved to bottom-left` (TA:1816).

## 40. MoveChuckBottomRight

Same as command 37, with these differences:

1. **Handler:** `move_chuck_bottom_right` (TA:1824-1847). Router: CM:96.
3. **Checks:** name `MoveChuckBottomRight`. State: `UsedByDeveloper` only (SM:180). Contract state as command 37 (KY:1101).
7. **Prober:** `move_chuck_xy(-15.0, 10.0, "Relative")` (TA:1834-1837), UCI (TA:1839), `local_mode()` (TA:1840).
10. **Reply:** type `MoveChuckBottomRightReply`, text `Chuck moved to bottom-right` (TA:1842).

## 41. RunPTPA

1. **Handler:** `run_ptpa` (TA:643-702). Router: CM:99.
2. **Parameters:** none. Contract: none (KY:2074-2078). Help JSON: none (HL:75-81).
3. **Checks:** `@validate_command_with_name("RunPTPA")` (TA:643). Level Expert (CC:60). Lock applies. ORI applies (VA:543). State: `OnDie_OffAxis_withoutPTPA` to `OnDie_OffAxis_withPTPA` (SM:116), or dev mode. READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** UCI fields.
7. **Prober:** `get_chuck_xy()` (TA:656), `get_contact_height()` (TA:657), `run_ptpa()` (TA:663; SENTIO `vis:compensation:start_execute OffAxis, BothWithProbeTips` and wait, SP:135-143), `local_mode()` (TA:664), `get_chuck_xy()` (TA:667), `get_contact_height()` (TA:668), UCI (TA:684). The queries come after `local_mode()`.
8. **Files:** none.
9. **Duration:** long. Help JSON: 90-180 s, "highly variable" (HL:80). The default reply timeout of the Kafka sender is 30 s (AG:63).
10. **Reply:** type `RunPTPAReply`. The text has x, y and contact height before and after, and the correction (TA:688-696).
11. **Without DB and Kafka:** nothing in the handler. P1 to P5.

## 42. SetPTPA

1. **Handler:** `set_ptpa` (TA:612-640). Router: CM:100.
2. **Parameters:** `enable`, bool, required (VA:363-365; contract KY:2080-2090). Help JSON: not found.
3. **Checks:** `@validate_command_with_name("SetPTPA")` (TA:612). Level Expert (CC:61). Lock applies. ORI applies (VA:544). State: `SetPTPA` is in no transition table (SM:40-183), so only dev mode allows it, or a step of a trusted built-in sequence (CM:277). The contract says Expert and state `OnDie_OffAxis_withoutPTPA` (KY:742-746). READY check. ERR pattern. No `transition` call.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** UCI fields.
7. **Prober:** `set_ptpa(enable)` (TA:629; SENTIO `vis:compensation:enable Both, <enable>`, SP:130-133), `local_mode()` (TA:630), UCI (TA:631).
8. **Files:** none.
9. **Duration:** fast.
10. **Reply:** type `SetPTPAReply`, text `PTPA enabled` or `PTPA disabled` (TA:633-634).
11. **Without DB and Kafka:** nothing in the handler. P1 to P5.

## 43. SetChuckOvertravel

1. **Handler:** `set_chuck_overtravel` (TA:1346-1378). Router: CM:101.
2. **Parameters:** `overtravelGap`, default `None` (TA:1347). Three sources disagree:
   - The contract names the field `overdrive`, number, required (KY:1808-1818). Sending `overdrive` raises `TypeError` (rule 0.1 step 4).
   - The validator schema is stored under the key `SetOvertravel` (`overtravelGap`, float, required; VA:367-369). The validator name is `SetChuckOvertravel`, so the schema is never applied.
   - With no value the driver sends `set_chuck_overtravel_gap None` (TA:1361, SP:259-261).
   - Help JSON: not found.
3. **Checks:** `@validate_command`, name `SetChuckOvertravel`. Level Expert (CC:63). Lock applies. No ORI. State: `OnDie_Wide_withPTPA` and `OnDie_Wide_withoutPTPA`, state stays (SM:137, 148), and `UsedByDeveloper` (SM:172). The contract also lists `OnDie_Wide` (KY:846). READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** writes `g.overdrive` (TA:1363, GP:181-183), UCI fields.
7. **Prober:** `enable_overtravel(overtravel=True)` (TA:1360), `set_overtravel(overtravelGap)` (TA:1361), UCI (TA:1366), `local_mode()` (TA:1367).
8. **Files:** none.
9. **Duration:** fast.
10. **Reply:** type `SetChuckOvertravelReply`, text `SetOvertravel command successfully executed` (TA:1371-1373).
11. **Without DB and Kafka:** nothing. P1 to P4.

## 44. SetContactHeight

1. **Handler:** `set_contact_height` (TA:1381-1455). Router: CM:102.
2. **Parameters:** `contactHeight`, float, optional (VA:371-373; contract KY:2099-2108), micrometer. Without it the command uses `g.contact_height` (TA:1400). No value at all: 400 (TA:1401-1407). The value must be a finite number above 0, else 400 (TA:1412-1422). Help JSON: not found.
3. **Checks:** `@validate_command`, name `SetContactHeight`. Level Expert (CC:64). Lock applies. No ORI. State: `OnDie_Wide_withPTPA`, `OnDie_Wide_withoutPTPA` (state stays; SM:138, 149) and `UsedByDeveloper` (SM:173). The contract agrees (KY:809). READY check. Refused with 400 when the working area has "OffAxis" in its name (TA:1429-1436). ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** reads `g.contact_height` (TA:1400). It is written by `OpenProject` (TA:1209), `ChangeProject` (TA:1160) and this command (TA:1440); `ReconnectProber` clears it (PA:464). Writes `g.contact_height` and UCI fields.
7. **Prober:** `get_current_working_area()` (TA:1429), `set_contact_height(target_height)` (TA:1438; SENTIO `set_chuck_site_heights Wafer,Contact,<height>`, SP:353-371), UCI (TA:1443), `local_mode()` (TA:1444).
8. **Files:** none.
9. **Duration:** fast. The chuck does not move (SP:365).
10. **Reply:** type `SetContactHeightReply`, text `Contact height set to <h> um` (TA:1448-1450).
11. **Without DB and Kafka:** nothing. The default value lives only in process memory (`g.contact_height`). P1 to P4.

## 45. DisableOvertravel

1. **Handler:** `disable_overtravel` (TA:1458-1490). Router: CM:103.
2. **Parameters:** `overtravelGap`, default `None` (TA:1459). It is not sent to the prober. It is only stored in `g.overdrive` (TA:1476). Contract: no data fields; it names the message `DisableOverdrive` (KY:1828-1832). Help JSON: not found.
3. **Checks:** `@validate_command`, name `DisableOvertravel`. Level Expert in the list (CC:65). Lock applies. No ORI. State: only `UsedByDeveloper` has it (SM:174), so in practice a Developer command. The contract has no state for it (KY:875-877). READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** writes `g.overdrive = overtravelGap` (TA:1476), UCI fields.
7. **Prober:** `set_overtravel(overtravelGap=0)` (TA:1473), `enable_overtravel(overtravel=True)` (TA:1474), UCI (TA:1479). No `local_mode()` in the handler.
8. **Files:** none.
9. **Duration:** fast.
10. **Reply:** type `DisableOvertravelReply`, text `DisableOvertravel command successfully executed` (TA:1483-1485).
11. **Without DB and Kafka:** nothing. P1 to P4.

## 46. MoveChuckWide

1. **Handler:** `move_chuck_wide` (TA:241-274). Router: CM:104.
2. **Parameters:** none. Contract: none (KY:1946-1950). Help JSON: not found.
3. **Checks:** `@validate_command`, name `MoveChuckWide`. Level Expert (CC:57). Lock applies. No ORI. State: `OnDie_OffAxis_withoutPTPA` to `OnDie_Wide_withoutPTPA` (SM:117); `OnDie_OffAxis_withPTPA` to `OnDie_Wide_withPTPA` (SM:127); or dev mode. READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** UCI fields, then `g.chuck_z_position_state="Separation"` (TA:264).
7. **Prober:** `move_chuck_wide()` (TA:256; SENTIO `move_chuck_work_area(WorkArea.Probing)`, SP:210-212), `local_mode()` (TA:258), UCI (TA:261).
8. **Files:** none.
9. **Duration:** fast (one move between work areas).
10. **Reply:** type `MoveChuckWideReply`, text `Probe station is in wide position` (TA:267-269).
11. **Without DB and Kafka:** nothing. P1 to P4.

## 47. MoveChuckOffAxis

1. **Handler:** `move_chuck_offaxis` (TA:205-238). Router: CM:105.
2. **Parameters:** none. Contract: none (KY:1960-1964). Help JSON: not found.
3. **Checks:** `@validate_command_with_name("MoveChuckOffAxis", reply_type="MoveChuckOffaxisReply")` (TA:205). Level User (CC:48). Lock applies. No ORI. State: `OnDie_Wide` to `Aligned` (SM:99); `OnDie_Wide_withoutPTPA` to `OnDie_OffAxis_withoutPTPA` (SM:151); or dev mode. The contract also lists `OnDie_Wide_withPTPA` (KY:461); the state machine does not allow it there (SM:135-144). READY check. ERR pattern.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** UCI fields, then `g.chuck_z_position_state="Separation"` (TA:228).
7. **Prober:** `move_chuck_offaxis_area()` (TA:220; SENTIO `move_chuck_work_area(WorkArea.Offaxis)`, SP:207-208), `local_mode()` (TA:222), UCI (TA:225).
8. **Files:** none.
9. **Duration:** fast.
10. **Reply:** type `MoveChuckOffaxisReply` (TA:205). The contract names `MoveChuckOffAxisReply` (KY:2030-2034). Text `Probe station is in off-axis position` (TA:231-233).
11. **Without DB and Kafka:** nothing. P1 to P4.

## 48. ResetAgent

1. **Handler:** `reset_agent` (PA:529-553). Router: CM:143.
2. **Parameters:** none. Contract: none (KY:2319-2323). Help JSON: none (HL:296-303).
3. **Checks:** no decorator (PA:529). In `BYPASS_COMMANDS` (CC:15). No login, no level, no lock, no state rule. The contract tags it "3. DEVELOPER LEVEL" (KY:1440); the code checks no level. `user` is used only as `requested_by` in the audit log (PA:544-547).
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** `agentStateMachine.transition("ResetAgent")` (PA:537), then `agentStateMachine.reset()` (PA:538). `reset()` sets the state `ServiceOn` and clears `g.userLogged` and `g.userLoggedHierarchy` (SM:300-313). So the current user is logged out. It does not clear the testing lock, the project, the wafer or the prober connection.
7. **Prober:** none.
8. **Files:** an `[AUDIT] RESET` log line (PA:541-549).
9. **Duration:** fast.
10. **Reply:** type `ResetAgentReply`, text `Agent state reset from '<old>' to '<new>'` (PA:551-553).
11. **Without DB and Kafka:** nothing.

## 49. ReconnectProber

1. **Handler:** `reconnect_prober` (PA:499-526). The work is in `reconnect_session` and `_reconnect_session` (PA:403-496). Router: CM:144.
2. **Parameters:** none. Help JSON: none (HL:287-294). Contract: not found.
3. **Checks:** `@validate_command_with_name("ReconnectProber")` (PA:499). Level Expert (CC:68). Lock applies. No ORI. State: every state except `ServiceOn` (SM:194-196), and dev mode. The handler sets the state itself: `UsedByDeveloper` for a Developer, `UserLogged` for others (PA:475-478).
   - 409 when another command runs (PA:516-522).
   - 400 when the agent was never initialized (PA:427-432) or has no address (PA:438-443).
   - 503 when the machine is not reachable; nothing changes then, except the status when the address moved (PA:445-456).
4. **DB:** one read. `refresh_machine()` (PA:436): `GetAllWaferProbeMachines`, timeout 5 s (MR:13, 80). It refreshes address, type and id. Skipped for a mock config. A failure keeps the old values (MR:73-91).
5. **Kafka:** the connection status event, through `set_prober_connected` (PA:459, CW:106-110, KC:326-347).
6. **Globals:** reads `g.address`, `g.machineType` (PA:435-437), `g.userLoggedHierarchy` (PA:475), `g.is_locked_for_testing` (PA:471). Writes `prober_status` (PA:458), `prober_connected` (PA:459), `projectName=None`, `opened_project_id=0`, `contact_height=None`, die 0/0/0, `chuck_z_position_state="Unknown"`, `current_working_area="LoadPosition"`, `camera_mount_point="Top"` (PA:462-470), the testing lock (PA:471-472), the state (PA:475-478). The loaded wafer and the probe card are kept (PA:508-509).
7. **Prober:** `factory.reconnect(machine_type, address)` (PA:446): a new connection is opened, then the old one is closed (FA:164-176, 74-79). The agent code sends no command.
8. **Files:** an `[AUDIT]` log line (PA:481-489).
9. **Duration:** fast. Help JSON: 1-5 s (HL:292).
10. **Reply:** type `ReconnectProberReply`, text `Reconnected to the prober at <address>. State '<old>' -> '<new>'. Open the project again (OpenProject), then run InitProbing.` (PA:491-496).
11. **Without DB and Kafka:** nothing stops it. It only has a meaning in a process that already holds a connection. P1 to P3.

## 50. GetAgentState

1. **Handler:** `get_agent_state` (PA:556-565). Router: CM:145 (comment there: "!! irrelevant").
2. **Parameters:** none. Help JSON: none (HL:279-285). Contract: not found.
3. **Checks:** no decorator. In `BYPASS_COMMANDS` (CC:18). No login, level, lock or state rule.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** reads the state machine only (PA:560-561).
7. **Prober:** none.
8. **Files:** none.
9. **Duration:** fast.
10. **Reply:** type `GetAgentStateReply`, text `Agent state: <state>` and `, Current command: <command>` when there is one (PA:562-565).
11. **Without DB and Kafka:** nothing.

## 51. TestingLock

1. **Handler:** `testing_lock` (TA:1611-1673). Router: CM:146.
2. **Parameters:**
   - `user`: needed by the handler, else 400 (TA:1637-1640).
   - `reason`: string, optional, default `"Testing in progress"` (TA:1613; VA:407).
   - `testSequenceId`: optional, default `None` (TA:1613). The validator schema names it `test_sequence_id`, string (VA:408). The contract names it `testSequanceId`, number (KY:1974-1984). Only `testSequenceId` is accepted by the function; the two other spellings raise `TypeError` (rule 0.1 step 4).
   - Help JSON: not found.
3. **Checks:** `@validate_command`, name `TestingLock`. Level User (CC:49). Exempt from the testing lock check (VA:25). No ORI. State: `AtContact` to `AtContact_Locked` (SM:104), or dev mode. The router comment calls it a bypass command (CM:142), but it is not in `BYPASS_COMMANDS` (CC:9-29). Already locked by another user: 423 (TA:1655-1663). Already locked by the same user: the lock is updated (TA:1649-1653).
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** reads and writes the lock fields through `g.lock_for_testing(user, reason, testSequenceId)`: `is_locked_for_testing`, `locked_by_user`, `locked_at_timestamp`, `lock_reason`, `test_sequence_id` (TA:1666, GP:87-101).
7. **Prober:** none.
8. **Files:** none.
9. **Duration:** fast.
10. **Reply:** type `TestingLockReply`, text `WP Agent locked for testing by '<user>'` (TA:1671-1673).
11. **Without DB and Kafka:** nothing. The lock is only process memory. P1 to P3.

## 52. TestingUnlock

1. **Handler:** `testing_unlock` (TA:1676-1743). Router: CM:147.
2. **Parameters:** `user`: needed by the handler, else 400 (TA:1701-1704). `force`: bool, optional, default `False` (TA:1677; VA:410-412). The contract path is spelled `TestingUnLock` (KY:517) and has no data fields (KY:2018-2022). Help JSON: not found.
3. **Checks:** `@validate_command`, name `TestingUnlock`. Level User (CC:50). Exempt from the testing lock check (VA:26). No ORI. State: `AtContact_Locked` to `AtContact` (SM:110), or dev mode. Not locked: success `WP Agent is not locked`, no state change (TA:1709-1710).
   - Who may unlock: the handler reads `g.user_logged_hierarchy` (TA:1713-1715). `g` has no such attribute; the real one is `userLoggedHierarchy` (GP:38). So the value is always `None`, and only the user who locked can unlock (TA:1718-1731). `force` has no effect for the same reason.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** reads `g.is_locked_for_testing`, `g.locked_by_user` (TA:1709, 1719). Clears the lock fields with `g.unlock_from_testing()` (TA:1738, GP:103-110).
7. **Prober:** none.
8. **Files:** none.
9. **Duration:** fast.
10. **Reply:** type `TestingUnlockReply`, text `WP Agent unlocked (was locked by '<user>')` (TA:1743).
11. **Without DB and Kafka:** nothing. P1 to P3.

## 53. ListAvailableCommands

1. **Handler:** a lambda in the router that calls `command_actions.list_available_commands(COMMAND_ROUTER, **kwargs)` (CM:173-175, CA:6-9).
2. **Parameters:** none. Extra keys are accepted and ignored (`**kwargs`, CA:6). Help JSON: none (HL:271-277). Contract: not found.
3. **Checks:** no decorator. In `BYPASS_COMMANDS` (CC:24). No login, level, lock or state rule.
4. **DB:** none.
5. **Kafka:** none more.
6. **Globals:** none.
7. **Prober:** none.
8. **Files:** none.
9. **Duration:** fast.
10. **Reply:** type `ListAvailableCommandsReply`. The text is a JSON string `{"available_commands": [...]}` with every router key (CA:7-9). It is not filtered by user level or state.
11. **Without DB and Kafka:** nothing.

---

# A. The validation path in full

Where: `validate_command` (VD:32-85) and `validate_command_with_name` (VD:88-138) wrap the handler. Both call `WPCommandValidator.validate_command` (VA:46-104). The state check of `execute_command` runs before them (rule 0.1 step 3).

In the decorator:

1. Command name. `@validate_command`: from the function name (VD:54-55). `@validate_command_with_name`: the given name (VD:119-120).
2. Reply type: `<name>Reply`, or the explicit `reply_type` (VD:56, 108).
3. `user` and `waferAgentName` are taken out of the keyword arguments (VD:58-59, 110-111). The other arguments, without those whose name starts with `_`, are the parameters to check (VD:61-65, 113-117).
4. The validator runs. An error reply is returned and the handler does not run (VD:75-76, 127-128).
5. The reply type is put into a context variable for `get_reply_type()` (VD:79-83, 130-134).

In the validator:

| Step | What it does | Lines | Touches |
|---|---|---|---|
| 0 | Command in `BYPASS_COMMANDS`: return, no check at all | VA:71-72, CC:9-29 | nothing |
| 1 | Agent name. `g.wpAgentName` empty: 500 `Agent not initialized. Please start with: python main.py listen <CONFIG_NAME>`. Names differ: 403 `Wrong agent`. A missing `waferAgentName` also gives 403. Names are compared in upper case, a `_DEV` suffix is ignored (`WPAgent/utilities/WPMachineName.py`:12-25) | VA:106-125 | reads `g.wpAgentName` |
| 2 | Login. `g.userLogged` empty: 401 `No user logged in. Please call UserLogIn first.` A `user` in the data that differs from `g.userLogged`: 401 `User mismatch`. No `user` in the data: pass | VA:127-146 | reads `g.userLogged` (global login state) |
| 3 | Testing lock. Skipped for `LOCK_EXEMPT_COMMANDS` (VA:23-41). Not locked: pass. Locked: only the lock owner or a user with level Developer passes; others get 423 | VA:148-209 | reads `g.is_locked_for_testing`, `g.locked_by_user`, `g.lock_reason`, `g.userLogged`, `g.userLoggedHierarchy` |
| 4 | Level. No level: 401. Developer: all. Step of a trusted built-in sequence: pass. Expert: `USER_COMMANDS` and `EXPERT_COMMANDS`. User: `USER_COMMANDS`. Else 403 | VA:211-266, CC:36-95 | reads `g.userLoggedHierarchy` (global login state) |
| 5 | Parameters, when the validator has a schema for the name (VA:321-416). Missing required parameter: 400. Wrong type: 400. `None` for an optional parameter: pass. Unknown parameter: a printed warning only. `bool` is never accepted as int or float; int is accepted as float (VA:420-440) | VA:268-311 | nothing |
| 6 | Orientation check (rule 0.9) | VA:530-665 | reads `g.projectName`, `g.probe_card_orientation`, `g.wafer_orientation` |

No step calls the DB or Kafka. Steps 1 to 4 and 6 read values in `g`:

- `g.wpAgentName` is set by `listen()` from the config name or the env var `SVT_WP_AGENT_MACHINE_NAME` (AG:193-202, 288-289, 302). `_DEV` is added for the DEV broker (AG:25, 28-36).
- `g.userLogged`, `g.userLoggedHierarchy` are set by `UserLogIn` (section D).
- `g.probe_card_orientation`, `g.wafer_orientation` come from the DB (section E).

Schemas that exist (VA:321-416): `OpenProject`, `OpenProjectWithAsicSerialNumber`, `LoadWafer`, `MoveChuckRowColumn`, `MoveChuckAsic`, `MoveChuckXY`, `MoveChuckZ`, `SetPTPA`, `SetOvertravel`, `SetContactHeight`, `SwitchCamera`, `MoveChuckToWorkArea`, `RunSequencer`, `ChangeProject`, `ConnectProbeMachine`, `AlignWafer`, `Initialize`, `TestingLock`, `TestingUnlock`, `GetLockStatus`.

Schemas that are never applied to a command of this part:

- `MoveChuckXY`, `MoveChuckToWorkArea`: the validator name differs (rule 0.2).
- `SetOvertravel`: the command is `SetChuckOvertravel` (VA:367 against CM:101).
- `Initialize`: the handler has no decorator and is a bypass command.
- `OpenProjectWithAsicSerialNumber`, `ConnectProbeMachine`, `GetLockStatus`: no such router key (CM:39-175).

Level of each command of this part, as the validator sees it:

- No check at all (bypass or no decorator): `ListProbers`, `ListChipTypes`, `UserLogIn`, `UserLogOut`, `Initialize`, `ShowStatus`, `GetInfo`, `Help`, `AutoFocus`, `ResetAgent`, `GetAgentState`, `ListAvailableCommands`.
- User: `OpenProject`, `InitProbing`, `MoveChuckLoadedWafer`, `LoadWafer`, `MoveChuckUnloadWafer`, `UnloadWafer`, `MoveChuckAsic`, `MoveChuckSeparation`, `MoveChuckSafePosition`, `MoveChuckContact`, `MoveChuckOffAxis`, `TestingLock`, `TestingUnlock` (CC:36-54).
- Expert: `MoveChuckWide`, `ChangeProject`, `MoveChuckNextDie`, `RunPTPA`, `SetPTPA`, `MoveChuckPreviousDie`, `SetChuckOvertravel`, `SetContactHeight`, `DisableOvertravel`, `MoveChuckRowColumn`, `ReconnectProber`, `UpdateLoadedWafer`, `UpdateInstalledProbeCard` (CC:56-72).
- Developer (in no list, CC:97-98): `LocalMode`, `StressOpenProject`, `FindHome`, `AlignWafer`, `SwitchCamera`, `MoveChuckCenter`, `MoveChuckXY`, `MoveChuckZ`, `MoveChuckHome`, `MoveChuckToWorkArea`, `GetChuckPosition`, `MoveChuckTopLeft`, `MoveChuckTopRight`, `MoveChuckBottomLeft`, `MoveChuckBottomRight`.

---

# B. The state machine

Class `WPAgentStateMachine` (SM:28-327). The commands use the instance `agentStateMachine` of `WPAgent/stateMachine/WpAgentStateMachineGlobals.py`:3. A second instance exists behind `get_state_machine()` (SM:331-339); only `WPAgent/stateMachine/StateHelpers.py` uses it, and no action file uses the decorators of `StateHelpers.py` (search found no user outside that file).

The state is process memory. Every change is copied to `g.wpag_state` (SM:198-203).

## States (SM:9-25)

`ServiceOn` (start state, SM:35), `OpenedProject`, `Aligned`, `ChuckSafePosition`, `ChuckUnloaded`, `Unloaded`, `OnDie_Wide_withPTPA`, `OnDie_OffAxis_withoutPTPA`, `OnDie_OffAxis_withPTPA`, `OnDie_Wide_withoutPTPA`, `OnDie_Wide`, `AtContact`, `AtContact_Locked`, `Error`, `UsedByDeveloper`, `UserLogged`.

## `BYPASS_COMMANDS` (CC:9-29)

`UserLogIn`, `UserLogOut`, `Initialize`, `ResetAgent`, `Help`, `GetAgentState`, `GetInfo`, `ShowStatus`, `ShowProjectStatus`, `ListProbers`, `ListChipTypes`, `ListAvailableCommands`, `GetDieSize`, `GetDieList`, `AutoFocus`.

Effect: no state check in `execute_command` (CM:277), `can_execute` is always true (SM:286-287), the validator is skipped (VA:71-72), and an unhandled exception does not enter `Error` (CM:323-324). `ShowProjectStatus` is not a router key (CM:39-175).

## Allowed commands per state (SM:40-196)

Bypass commands are allowed in every state and are not repeated here. Each transition table also has a key `Error`; no code calls `transition("Error")` (search found none).

| State | Command -> new state | Lines |
|---|---|---|
| `ServiceOn` | none | SM:44-46 |
| `UserLogged` | `OpenProject` -> `OpenedProject`; `ReconnectProber` | SM:88-91, 194-196 |
| `OpenedProject` | `InitProbing` -> `Aligned`; `ChangeProject` -> same; `UpdateLoadedWafer` -> same; `UpdateInstalledProbeCard` -> same; `MoveChuckSafePosition` -> `ChuckSafePosition`; `UnloadWafer` -> `Unloaded`; `MoveChuckUnloadWafer` -> `ChuckUnloaded`; `ReconnectProber` | SM:48-58 |
| `Aligned` | `UnloadWafer` -> `Unloaded`; `MoveChuckUnloadWafer` -> `ChuckUnloaded`; `MoveChuckSafePosition` -> `ChuckSafePosition`; `MoveChuckAsic` -> `OnDie_Wide_withPTPA`; `MoveChuckNextDie`, `MoveChuckPreviousDie`, `MoveChuckRowColumn` -> `OnDie_OffAxis_withoutPTPA`; the 16 built-in sequence commands -> same; `ReconnectProber` | SM:60-69, 188-189 |
| `ChuckSafePosition` | `InitProbing` -> `Aligned`; `UnloadWafer` -> `Unloaded`; `MoveChuckUnloadWafer` -> `ChuckUnloaded`; `ReconnectProber` | SM:71-76 |
| `ChuckUnloaded` | `MoveChuckLoadedWafer` -> `UserLogged`; `ReconnectProber` | SM:78-81 |
| `Unloaded` | `LoadWafer` -> `UserLogged`; `ReconnectProber` | SM:83-86 |
| `OnDie_Wide` | `MoveChuckContact` -> `AtContact`; `MoveChuckAsic` -> `OnDie_Wide_withPTPA`; `MoveChuckNextDie`, `MoveChuckPreviousDie`, `MoveChuckRowColumn` -> `OnDie_OffAxis_withoutPTPA`; `MoveChuckOffAxis` -> `Aligned`; `ReconnectProber` | SM:93-101 |
| `AtContact` | `TestingLock` -> `AtContact_Locked`; `MoveChuckSeparation` -> `OnDie_Wide`; `ReconnectProber` | SM:103-107 |
| `AtContact_Locked` | `TestingUnlock` -> `AtContact`; `ReconnectProber` | SM:109-112 |
| `OnDie_OffAxis_withoutPTPA` | `MoveChuckAsic` -> `OnDie_Wide_withPTPA`; `RunPTPA` -> `OnDie_OffAxis_withPTPA`; `MoveChuckWide` -> `OnDie_Wide_withoutPTPA`; `MoveChuckNextDie`, `MoveChuckPreviousDie`, `MoveChuckRowColumn` -> same; `AutoFocus` -> same; `ReconnectProber` | SM:114-123 |
| `OnDie_OffAxis_withPTPA` | `MoveChuckAsic` -> `OnDie_Wide_withPTPA`; `MoveChuckWide` -> `OnDie_Wide_withPTPA`; `MoveChuckNextDie`, `MoveChuckPreviousDie`, `MoveChuckRowColumn` -> `OnDie_OffAxis_withoutPTPA`; `AutoFocus` -> same; `ReconnectProber` | SM:125-133 |
| `OnDie_Wide_withPTPA` | `MoveChuckAsic` -> same; `SetChuckOvertravel` -> same; `SetContactHeight` -> same; `MoveChuckContact` -> `AtContact`; `MoveChuckNextDie`, `MoveChuckPreviousDie`, `MoveChuckRowColumn` -> `OnDie_OffAxis_withoutPTPA`; `ReconnectProber` | SM:135-144 |
| `OnDie_Wide_withoutPTPA` | `MoveChuckAsic` -> `OnDie_Wide_withPTPA`; `SetChuckOvertravel` -> same; `SetContactHeight` -> same; `MoveChuckContact` -> `AtContact`; `MoveChuckOffAxis` -> `OnDie_OffAxis_withoutPTPA`; `MoveChuckNextDie`, `MoveChuckPreviousDie`, `MoveChuckRowColumn` -> `OnDie_OffAxis_withoutPTPA`; `ReconnectProber` | SM:146-156 |
| `Error` | `ResetAgent`; `ReconnectProber` | SM:158-160, 194-196 |
| `UsedByDeveloper` | every command; the state stays | SM:161-182, 235-237, 289-290 |

`ReconnectProber` is added to every table except `ServiceOn` and `UsedByDeveloper`, with the target `UserLogged` (SM:194-196). Its handler then sets the state itself (PA:475-478).

Commands of this part that are in no table of a normal state, so only dev mode runs them: `LocalMode`, `StressOpenProject`, `FindHome`, `AlignWafer`, `SwitchCamera`, `MoveChuckCenter`, `MoveChuckXY`, `MoveChuckZ`, `MoveChuckHome`, `MoveChuckToWorkArea`, `GetChuckPosition`, the four corner moves, `SetPTPA`, `DisableOvertravel`. The last two are in `EXPERT_COMMANDS` (CC:61, 65), so an Expert has the level but never the state.

## How the state changes

- The handler calls `agentStateMachine.transition("<name>")` after its work (example TA:75). The return value is not used. In a normal state the table gives the new state (SM:241-248). A bypass command without a table entry changes nothing (SM:252-253). A step of a trusted sequence changes nothing (SM:231-232).
- `UserLogIn` and `ReconnectProber` use `force_state` (LA:78, 80, 94; PA:476, 478).
- `UserLogOut` and `ResetAgent` use `reset()`: state `ServiceOn`, user cleared (LA:167; PA:538; SM:300-313).

## The Error state

Entered by `enter_error_state` (SM:315-323):

- the `except Exception` branch of a handler (rule 0.5; for example TA:83, and the summary branch of `InitProbing`, TA:811);
- an unhandled exception of a command that is not a bypass command (CM:323-324). This includes a `TypeError` from a wrong or missing parameter (rule 0.1 step 4);
- the connection watch, when the prober stops answering and the state is not `ServiceOn` or `Error` (CW:252-275). The watch runs only inside the Kafka listener (KC:457-458).

`ProberNotConnectedError` never enters it (CM:309-312).

Left by:

- `ResetAgent`: the table says `UserLogged` (SM:159), but the handler calls `reset()` right after (PA:537-538). The result is `ServiceOn` and no user.
- `ReconnectProber`: needs level Expert and an initialized agent; sets `UserLogged` or `UsedByDeveloper` (PA:475-478).
- `UserLogOut` by the logged-in user: `ServiceOn` (LA:166-167). Then `UserLogIn`.
- `UserLogIn` when nobody is logged in, or a Developer who takes over: `force_state` (LA:75-80, 91-94).

In `Error` only bypass commands, `ResetAgent` and `ReconnectProber` run (SM:158-160). That is also true for a Developer (rule 0.10).

Note: `WpAgentStateMachine.py` ends in the middle of the function `reset_state_machine` (`global _s`, SM:342-344). The function is not used by the files of this part.

---

# C. `Initialize` step by step

## Before the command: what `listen()` prepares (AG:269-340)

`Initialize` has no address parameter. It uses values that the start of the listener put into `g`:

1. Start config: the `--config` file, else the env vars `SVT_WP_AGENT_MACHINE_NAME` and `SVT_WP_AGENT_KAFKA_BROKER` (AG:193-202). The real configs hold only `name` and `kafka_broker` (`WPAgent/configs/ProbeConfigCERN.json`:1-4).
2. A mock config (`"machineType": "mock"`) keeps the values of its file: `address`, `port`, `machineType`, `machineId` (AG:204-207, 227-229; `WPAgent/configs/ProbeConfigMOCK.json`:1-9).
3. Any other config: the machine comes from the DB. `_find_machine_in_db` creates the DB client and asks `GetAllWaferProbeMachines`, retrying for up to 60 s (AG:43-45, 237-260). The record with the same `name` is used (AG:262-267, MR:16-19). `machine_config` reads `hostName`, `connectionPort`, `software` (machine type, default `sentio`), `id`, `generalLocation` (MR:22-52). No answer or no record stops the process (AG:324-328).
4. `g.wpAgentName`, `g.address` (`host:port`, MR:55-57), `g.machineType`, `g.wpMachineId`, `g.machine_record_name` (`None` for a mock), `g.wpag_state` are set (AG:301-310).
5. The DB client singleton is created with the broker (AG:315-322). This is the only place that gives it a broker. Without it `DBKafkaClient.get_instance()` raises `ValueError` (DB:24-32, 39-43).

## The command: `initialize_machine` (PA:270-341)

1. Any key other than `force`, `user`, `waferAgentName`: 400 (PA:292-298).
2. `force` is made a bool (PA:300).
3. Under `factory.lock` (PA:302):
   - Already initialized and no force: `Success`, `Already initialized at <address>. Use force=true to initialize again.` (PA:303-307).
   - Initialized, force, and another command runs: 409 (PA:308-314). The count of running commands comes from the Kafka listener (rule 0.7).
4. `refresh_machine()` (PA:316): DB read 1, see command 7 point 4. It can change `g.address`, `g.machineType`, `g.wpMachineId` (MR:107-109) and writes an audit line when they changed (MR:94-105).
5. `g.address` or `g.machineType` empty: 500 `The machine of this agent is not known: start the listener with a config.` (PA:317-320).
6. TCP check `is_reachable(g.machineType, g.address)` (PA:321). Not reachable: 503. When the agent was initialized, the old connection stays (PA:322-329). Otherwise `set_prober_connected(False, ...)` (PA:330-331).
7. `svt_initialise_wp(address=g.address, machine_type=g.machineType, machine_id=g.wpMachineId, machine_name=g.wpAgentName, initialization_mode="database" or "manual", force=True, machine_record=...)` (PA:333-341).

## `svt_initialise_wp` (PA:187-267)

1. Guard: address and machine type must be there (PA:25-30). The "already initialized" branch is not taken, because `force` is `True` (PA:20-24, 339).
2. Connect, `_connect_prober` (PA:34-56). Initialized: `factory.reconnect` (new connection first, then the old one is closed). Else `factory.get_prober` (PA:43-46). For `sentio` this builds `SentioProberImpl(address)`: `SentioProber.create_prober("tcpip", address)` and TCP keepalive (SP:13-16, FA:64-72). The call `initialize_if_needed()` is commented out (SP:15). Then `g.prober_status="initialized"` and `set_prober_connected(True, "initialized")` (PA:48-51). A failure gives 500 `Failed to create prober: ...` (PA:53-56).
3. Store globals, `_store_globals` (PA:59-88): `g.address`, `g.machineType`, `g.wpMachineId`, `g.machine_name`, `g.initialization_mode`, `g.user` (OS user name), `g.wpag_state` (the current state name; the state does not change).
4. DB sync, `_sync_from_db` (PA:91-138): DB read 2, see command 7 point 4. It sets `g.loaded_wafer_id`, `g.wafer_orientation`, `g.probe_card_id`, `g.probe_card_orientation`. When the record has no wafer id, both wafer fields become `None`; the same for the probe card (PA:115-135).
5. Project, `_setup_project` (PA:141-180): it returns at once, because `Initialize` passes no project name (PA:145-146, 333-341).
6. `g.chuck_z_position_state="Unknown"`, `g.current_working_area="LoadPosition"`, `g.camera_mount_point="Top"` (PA:237-239).
7. Reply text (PA:252-262).

## What it asks from the prober

Only the TCP connection. The agent code sends no SENTIO command in `Initialize` and does not call `local_mode()` (PA:34-56, 187-267). What the SENTIO library does inside `create_prober` was not checked (the library is not in the export).

## What a process without DB and Kafka must supply

- `g.wpAgentName`, `g.address`, `g.machineType` (and `g.wpMachineId` if a machine id is still wanted): from a config file instead of `listen()`.
- `g.machine_record_name` left empty: then `refresh_machine()` does nothing (MR:73-75).
- Loaded wafer id and orientation, probe card id and orientation: from a config or state file instead of `_sync_from_db`. With a machine id set and no DB client, `_sync_from_db` only prints `DB sync failed (non-fatal)` (PA:137-138) and the four fields stay `None`.

---

# D. `UserLogIn` and `UserLogOut` in detail

## Where users and levels come from

The file `WPAgent/configs/WPUserHierarchy.json` (LA:14-15). Not the DB. It maps a level to a list of user names:
`{"Developer": ["user1", "user2"], "Expert": ["user3", "user4"], "User": ["user5", "user6"]}` (`WPAgent/configs/WPUserHierarchy.json`:1-5).

- It is read again on every `UserLogIn` (LA:18-24, 35-40). A missing file gives an empty table, so every user is refused (LA:22-24).
- There is no password. The level is the first level whose list has the name (LA:37-39).
- The level names must be `User`, `Expert`, `Developer` for the validator (VA:11-14, 226-266).

## `UserLogIn(user, ...)` (LA:51-131)

1. Read `g.userLogged`, `g.userLoggedHierarchy`; get the prober if connected (LA:62-65).
2. Unknown user: audit `LOGIN_REFUSED`, 403 (LA:67-72).
3. Nobody logged in (LA:75-86): `g.set_user(user, level)`; state `UsedByDeveloper` for a Developer, else `UserLogged`; audit `LOGIN`; UCI; success.
4. Another user logged in (LA:89-124): UCI first (LA:90).
   - A Developer over a non-Developer: takes over. `g.set_user`, state `UsedByDeveloper`, audit `TAKEOVER`, success (LA:91-102).
   - A Developer over a Developer: 409 (LA:103-113).
   - Anyone else: 409 (LA:114-124).
5. The same user again: UCI, success `already logged in` (LA:127-131). No state change.

Notes:

- UCI queries the prober when it is connected and does not call `local_mode()` after (rule 0.4).
- In case 3 the user and the state are set before UCI (LA:76-82). If UCI raises, the reply is an `UnhandledErrorReply` 500 (rule 0.1 step 6), but the user stays logged in.
- The parameters `address` and `machineType` are not used (LA:53).

## `UserLogOut(user, ...)` (LA:134-175)

1. Nobody logged in: 400 (LA:147-149).
2. Another user logged in: 400 (LA:152-161).
3. The same user: `g.set_user(None, None)`, `agentStateMachine.reset()` (state `ServiceOn`), audit `LOGOUT`, success (LA:164-175).

It keeps: the prober connection, the open project, the wafer and probe card data, the testing lock.

## What depends on the login state

- Validator step 2 (login) and step 4 (level) of every command that is not a bypass command (VA:127-146, 211-266).
- Validator step 3: a Developer passes a testing lock of another user (VA:179-190).
- The state machine: `ServiceOn` allows no normal command (SM:44-46). `UsedByDeveloper` allows all (SM:289-290).
- `ReconnectProber`: the state after it depends on the level (PA:475-478).
- `ResetAgent` logs the user out (PA:538, SM:309-310).
- The reply data fields `userLogged`, `userLoggedHierarchy` (RB:49-50), `ShowStatus` (PA:360), and the user label of every log line (`WPAgent/utilities/WPAgentLogger.py`:62-73).

Commands of this part that work with nobody logged in: the bypass commands and the undecorated handlers (list in section A).

---

# E. "DB data" that commands read from the globals

## Fields, who writes them, who reads them

| Field in `g` | Written from the DB by | Other writers | Read by (commands of this part) |
|---|---|---|---|
| `loaded_wafer_id` | `Initialize`: `_sync_from_db`, from `loadedWaferId` of the machine record (PA:112-121). `LoadWafer` and `UpdateLoadedWafer`: `update_wp_machine_loaded_wafer`, after a DB write success (DA:320-323) | `UnloadWafer`: `g.clear_wafer()` (TA:1037) | `LoadWafer` (TA:982), `UnloadWafer` (TA:1024), `MoveChuckUnloadWafer` (TA:1102), `MoveChuckAsic` (TA:1555), `UpdateLoadedWafer` (DA:347, 351, 369), `ShowStatus` (PA:363-364), `Initialize` reply text (PA:257-258), every reply (RB:30-35) |
| `wafer_orientation` | the same two places (PA:113-121; DA:321) | `g.clear_wafer()` (GP:384-387) | the orientation check (VA:564, 579-584, 639-652), every reply (RB:34) |
| `probe_card_id` | `Initialize`: `_sync_from_db`, from `installedProbeCardId` (PA:125-134). `UpdateInstalledProbeCard`: after a DB write success (DA:403-407) | none | `UpdateInstalledProbeCard` (DA:429, 433, 452), `Initialize` reply text (PA:259-260), every reply (RB:39-44) |
| `probe_card_orientation` | the same two places, from `installedProbeCardOrientation` (PA:126-134; DA:404) | none | the orientation check (VA:563, 571-576, 596-612, 640-662), every reply (RB:43) |
| `wpMachineId` | `listen()` from the DB record or the mock config (AG:307); `refresh_machine()` (MR:109); `_store_globals` (PA:65-67) | none | the DB write helpers (DA:308, 389), `Initialize` (PA:336), every reply (RB:52), heartbeat (HB:137), status event (KC:335) |
| `address`, `machineType` | `listen()` (AG:305-306); `refresh_machine()` (MR:107-108); `_store_globals` (PA:62-63) | none | READY check (HP:105-110), `Initialize` (PA:317-338), `ReconnectProber` (PA:435-446) |
| `machine_record_name` | `listen()` (AG:308) | none | `refresh_machine()` (MR:73), `Initialize` (PA:338) |
| `opened_project_id` | `OpenProject`, `ChangeProject`: `get_project_id_by_name` (TA:1205, 1156) | `ReconnectProber` sets 0 (PA:463) | only the reply data (RB:59) |

Not kept in the globals, read from the DB on each call:

- The ASIC family of the open project: `InitProbing` (TA:733, DA:115-132).
- The ASIC record (serial number, wafer id): `MoveChuckAsic` (TA:1541, DA:465-479).
- The list of machines: `ListProbers` (DA:61).

Not DB data, although the names suggest it:

- `g.projectName`: the `projectName` parameter of `OpenProject` or `ChangeProject` (TA:1203-1204, 1154-1155).
- The orientation that a project expects: parsed from the project name (VA:471-528).
- The die map (label to col and row): `WPAgent/configs/WPMapConversion_<wafer type>.json` (DM:27-28).
- The alignment project of an ASIC family: `WPAgent/configs/WPInitProbingConfig.json`.
- Users and levels: `WPAgent/configs/WPUserHierarchy.json`.
- `g.asicSerialNumber`: only `_store_globals` writes it, when `serialNumber` is given (PA:75-76). `Initialize` never passes it (PA:333-341). It stays 0 (GP:41) and is only reported (RB:51).
- `g.chip_name`, `g.orientation` (project orientation), the project metadata: no command of this part reads or writes them (search found no use outside GP, except the metadata setter at PA:248-249, which gets no data from `Initialize`).

## All DB agent messages used by this part

Topics: request `svt.db-agent.request`, reply `svt.db-agent.request.reply` (DB:46-47). One request at a time, matched by a correlation id (DB:176-188). A timeout returns `None` (DB:173-174).

| DB message | Client method | Kind | Used by |
|---|---|---|---|
| `GetAllWaferProbeMachines` | `get_all_wafer_probe_machines` (DB:201-206) | read | `ListProbers` (DA:61); `Initialize` (MR:80; PA:104); `ReconnectProber` (MR:80); the start of the listener (AG:251); the connection watch (CW:217-224, 299-301) |
| `GetAllWaferProbeProjects` | `get_all_wafer_probe_projects` (DB:194-199) | read | `OpenProject`, `ChangeProject` (project id; DA:98); `InitProbing` (ASIC family; DA:118) |
| `GetAllAsics` | `get_all_asic_by_id` (DB:208-221) | read | `MoveChuckAsic` (DA:471) |
| `UpdateWpMachineLoadedWafer` | `update_machine_loaded_wafer` (DB:223-233) | write | `LoadWafer` (TA:995), `UnloadWafer` (TA:1035), `UpdateLoadedWafer` (DA:369) |
| `UpdateWpMachineInstalledProbeCard` | `update_machine_installed_probe_card` (DB:235-245) | write | `UpdateInstalledProbeCard` (DA:451-453) |

Helpers in `WPDataBaseActions.py` that no command calls (search found no caller outside tests): `get_machine_by_location` (DA:38-50), `list_orientations` (DA:86-88), `get_loaded_wafer_info` (DA:139-168), `get_loaded_wafer_from_db` (DA:171-211), `get_installed_probe_card_info` (DA:218-247), `get_installed_probe_card_from_db` (DA:250-293), `_find_machine_by_name` (DA:25-31).

The "cache" and the DB interface:

- `WPAgent/utilities/WPAgentCache.py` is not a cache of DB data. It writes a snapshot of the reply data to `WPAgent.cache.json` (lines 42-49). Nothing reads it.
- `WPAgent/interfaces/WPDbService.py` declares the protocol `IDBService` (lines 5-26). No other file refers to it (search found none).

---

# Cross-cutting notes for a tool without DB and Kafka

1. **Everything is process memory.** Login, level, state machine, open project, saved contact height, testing lock, loaded wafer, probe card and the prober connection are singletons of one process (GP:138-142, SM:35, FA:50-56). A tool that runs one command per process starts each time in `ServiceOn` with no user and no connection. Then every command that is not a bypass command is refused with 409 (CM:277-287, SM:44-46).
2. **`confluent_kafka` is imported at module load.** `WPCmdMap.py` imports the action modules and the logger (CM:1-14). `WPProjectActions.py` imports `services.WPDbKafkaClient` (PA:5), which imports `confluent_kafka` (DB:5-6). `WPAgentLogger.py` imports it too (line 5). So the package must be installed, or the imports must change, even when no broker is used.
3. **The DB client has no broker without `listen()`.** `DBKafkaClient.get_instance()` raises `ValueError` then (DB:39-43). How each caller reacts: `ListProbers` 500 (DA:77-78); `OpenProject`, `ChangeProject` continue (DA:110-112); `InitProbing` 404 (TA:734-740); `MoveChuckAsic` 400 (TA:1542-1545); `LoadWafer`, `UnloadWafer` ignore it (TA:995, 1035); `UpdateLoadedWafer`, `UpdateInstalledProbeCard` 400 or 500 (DA:309-310, 330-331, 390-391, 415-416); `Initialize` continues (PA:137-138; MR:89-91).
4. **`g.prober_connected`.** Only the connection watch and `Initialize` or `ReconnectProber` set it (CW:79-110; PA:51, 330, 459). `None` passes the READY check (HP:97-98).
5. **Names differ between router, contract and help.** The differences are listed in each command section (point 2, 3 and 10). A tool that takes names from the contract would send parameters that raise `TypeError` for `MoveChuckLoadedWafer` (`waferId`), `SetChuckOvertravel` (`overdrive`), `MoveChuckToWorkArea` (`workArea`) and `TestingLock` (`testSequanceId`).
