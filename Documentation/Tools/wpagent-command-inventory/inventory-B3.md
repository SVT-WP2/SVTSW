# WPAgent inventory, part B3: ITS3 script, prober driver, packages

Source: `master` at commit `a862772f` (27 Nov 2026). Paths are relative to the repository root. Read-only analysis. Nothing was run against a prober, Kafka or a DB.
Every statement has a file and line. A statement marked "by the code" is a conclusion from reading the code; it was not run.
Per-command facts (checks, DB use, prober calls of each handler) are in `inventory-A.md` and `inventory-B.md` and are not repeated here.

## Short names of files

| Short | File |
|---|---|
| IT | `ITS3TestAgent/its3_test_agent.py` |
| CM | `WPAgent/WPCmdMap.py` |
| KC | `WPAgent/WPKafkaClient.py` |
| AG | `WPAgent/WPAgent.py` |
| TA | `WPAgent/actions/WPTestingActions.py` |
| PA | `WPAgent/actions/WPProjectActions.py` |
| LA | `WPAgent/actions/WPLoginActions.py` |
| IA | `WPAgent/actions/WPImagingActions.py` |
| DG | `WPAgent/actions/WPDieGridActions.py` |
| VA | `WPAgent/utilities/WPValidator.py` |
| CC | `WPAgent/utilities/WPCommandConstants.py` |
| RB | `WPAgent/utilities/WPResponseBuilder.py` |
| SM | `WPAgent/stateMachine/WpAgentStateMachine.py` |
| HB | `WPAgent/services/WPHeartbeat.py` |
| CW | `WPAgent/services/WPProberConnectionWatch.py` |
| MR | `WPAgent/services/WPMachineRecord.py` |
| IF | `WPAgent/interfaces/WPProberInterface.py` |
| SP | `WPAgent/drivers/WPSentioProber.py` |
| MP | `WPAgent/drivers/WPMockProber.py` |
| FA | `WPAgent/drivers/WPFactory.py` |
| UH | `WPAgent/configs/WPUserHierarchy.json` |

Config files of the ITS3 script are named by their suffix: `base` = `its3_test_agent_config.json`, `er2b` = `..._er2b.json`, `ER2B_Pad`, `hsch`, `nj`, `prim_only`, `scope`, `thinned`, `thinned_impedance`, `tile_min`.

---

# C. The production script `ITS3TestAgent/its3_test_agent.py`

## C.1 How it sends a WPAgent command

- **Library.** `confluent_kafka`: `Producer`, `Consumer`, `TopicPartition`, `AdminClient`, imported at module level (IT:45-46). It is in `ITS3TestAgent/requirements.txt`:1. The script has its own client class `WPAgentClient` (IT:111-370). It does not import any WPAgent module (IT:18-47).
- **Broker.** `kafka_broker` of the config, default `localhost:9095`; `kafka_ip_family`, default `v4` (IT:435-436). The configs use `pcmitpx01:9092`, except `tile_min`: `svmithi02:9093` (C.4). `pcmitpx01:9092` with the name `WPMIT` is the production listener of `WPMIT`, which runs as a system service (`WPAgent/README.md`:224, 496; `WPAgent/configs/ProbeConfigCERN.json`:2-3; `WPAgent/WPagent.service`:12). It is not the DEV broker `pcmitpx01:9096`, so no `_DEV` suffix applies (AG:25, 28-36). The client is created once per run, lazily, on the first WPAgent call (IT:432-443).
- **Broker check.** At creation: `AdminClient.list_topics(timeout=5)`. A failure raises `ConnectionError` (IT:134-145). Nothing catches it in the script (IT:497-501, 1136-1159), so the run ends with a traceback (by the code).
- **Topics.** Request `svt.wp-agent.request`, reply `svt.wp-agent.request.reply`, heartbeat `svt.wp-agent.heartbeat` (IT:117-119). These are the same names as in WPAgent (KC:91-92; HB:207).
- **Message.** `{"type": <command>, "data": {"user": <wp_user>, "waferAgentName": <wp_agent_name>, ...params}}` as JSON (IT:176-180). Headers: `kafka_correlationId` (a new UUID per call), `kafka_replyTopic` = the reply topic, `kafka_replyPartition` = `0` (IT:175, 181-185). Then `producer.flush(timeout=5)` (IT:186-187).
- **Waiting for the reply.** One consumer for the whole run, assigned by hand to partition 0 of the reply topic and moved to the high watermark at creation, so old replies are skipped (IT:149-165). `_wait_reply` polls every 0.5 s until the deadline and keeps only the message whose `kafka_correlationId` header equals the one sent (IT:191-204). WPAgent sends the reply to the topic and partition of the request headers (KC:573-590, 628-642).
- **Timeout.** Default 30 s (IT:174). Longer for some commands: `AutoFocus` 90 s (IT:222), `RunPTPA` 600 s (IT:228), `InitProbing` 600 s (IT:240, never called, see C.3), `FindHome` 90 s (IT:243), `AlignWafer` 90 s (IT:247), `MoveChuckCenter` 90 s (IT:253), `MoveChuckXYPrecise` 60 s (IT:293), `MoveChuckSeparation` 600 s at the final cleanup only (IT:1110). After the deadline `send` returns `{"status": "timeout", "output": "No reply within <t>s"}` (IT:205-206).
- **Retries.** `send` never retries (IT:174-206). The script retries one thing: a failed project switch runs the full init sequence again and tries the switch once more (IT:1044-1054). See C.5.
- **Listener check.** Before the first command `_wp_initialize` reads the heartbeat topic from the beginning for 2 s. A heartbeat younger than 6 s means "alive" (IT:120, 325-369, 503-510). It does not look at `waferAgentName` of the heartbeat (IT:350-358), although each heartbeat carries it (HB:133-141). So a heartbeat of the listener of another machine also counts as alive (by the code).
- **Routing on the WPAgent side.** A listener runs only requests whose `waferAgentName` names its machine and sends no reply for the others (KC:319-324, 566-568). A wrong `wp_agent_name` therefore gives a timeout in the script, not an error reply (by the code).
- **Concurrency on the WPAgent side.** The listener runs up to 4 requests at the same time (KC:441). Nothing in `execute_command` serializes them (CM:237-332; the only locks in WPAgent are the factory lock for connection changes, the DB client lock and counters: FA:56, `WPAgent/services/WPDbKafkaClient.py`:50, `WPAgent/utilities/WPCommandActivity.py`:19). After a timeout in the script the next command can start while the late one still runs (by the code).

## C.2 User name, log-in, lock, Initialize

- **User.** `wp_user` of the config, default `user1` (IT:437). Every config has `"wp_user": "user1"` (C.4). It is put into every request (IT:177).
- **Level of `user1`.** `user1` is in the list `Developer` of UH:2. `UserLogIn` of a Developer forces the state `UsedByDeveloper` (LA:76-78). In that state the state machine allows every command (`inventory-A.md` rule 0.10), and the validator lets a Developer run every command and pass a testing lock of another user (VA:186-190, 226-227).
  Many commands of the script are Developer-only by state or level: `MoveChuckCenter`, `FindHome`, `AlignWafer`, `MoveChuckHome`, `MoveChuckXY`, `SetPTPA`, `MoveChuckXYPrecise` (`inventory-A.md` sections A and B; `inventory-B.md`:102). So the script works only with a Developer user (by the code).
- **`UserLogIn`.** Yes. Sent at init, twice (IT:513, 523), after a `ResetAgent` on a PTPA failure (IT:869), and again in every re-init (IT:1047).
- **`UserLogOut`.** Yes, once, at the end of `run()` (IT:1124). Not sent when the init fails, because `run()` returns before its `try`/`finally` (IT:1099-1100). The user then stays logged in on the agent (by the code).
- **`ResetAgent`.** Yes, between the two log-ins of the init (IT:518) and after a failed `RunPTPA` when `reset_on_ptpa_failure` is true (IT:866-869). `ResetAgent` sets `ServiceOn` and logs the user out (`inventory-A.md` command 48). It does not close the prober connection.
- **`TestingLock` / `TestingUnlock`.** Never sent (search for `TestingLock` in IT: not found).
- **`Initialize`.** Never sent (search for `Initialize"` in IT: not found; the method list IT:212-323 has none). In `master` the agent opens the prober connection only on `Initialize`, never by itself (AG:8-9, 269-274; CW:8-10). Without it every prober command gets the 503 reply `... is not initialized` (FA:156-160; CW:74-76). So the script needs that someone else sent `Initialize` to the running listener before it starts; `ResetAgent` and `UserLogOut` keep that connection (`inventory-A.md` commands 6 and 48). Who sends it today: not found in the code.
- **`InitProbing`.** A method exists (IT:239-240), but the call is commented out (IT:560-564). It is replaced by five single commands, marked "Temporary replacement until DB entries are fixed" (IT:566-586).

## C.3 The commands of one run, in order

`[w]` = a failure is only logged as a warning; the run goes on. `[skip]` = the chip is skipped. `[abort]` = the init returns `False` and the run ends with code 1 (IT:1099-1100). Each entry gives the parameters and their source.

### C.3.1 Init: `_wp_initialize` (IT:497-587), called by `run_initialization` (IT:968)

0. Heartbeat check, no command (IT:504-510). Not alive: `[abort]`.
1. `UserLogIn` `{}` (IT:513). `[abort]`.
2. `ResetAgent` `{}` (IT:518). `[abort]`.
3. `UserLogIn` `{}` (IT:523). `[abort]`.
4. With `--dry-run` the init stops here and returns `True` (IT:528-529).
5. Only when `thinned_layer` is true (`thinned`, `thinned_impedance`): `OpenProject {projectName: wp_project_seg}` (IT:533-538), then `MoveChuckOffAxis` (IT:540-543). Both `[abort]`. The init ends here (IT:544).
6. `OpenProject {projectName: wp_project_bam}`, when `wp_project_bam` is not empty (IT:550-556). `[abort]`.
7. `MoveChuckOffAxis` `{}` (IT:567). `[abort]`. The helper first undoes a pending precise offset; at init there is none, so no extra command (IT:255-261, 301-307).
8. `MoveChuckCenter` `{}`, 90 s (IT:571). `[abort]`.
9. `AutoFocus` `{}`, 90 s (IT:575). `[abort]`.
10. `AlignWafer {align_die_col: -1, align_die_row: 1}`, 90 s. The values are the defaults of the method, hard-coded (IT:246-247, 579). `[abort]`.
11. `FindHome` `{}`, 90 s (IT:583). `[abort]`.

Then, not WPAgent: FPGA programming and the mosaix `Initialization` commands (IT:971-985).

### C.3.2 Per chip (`run_sequence`, IT:1000-1094)

Chips come from the CSV of `run_list` (IT:388-392, 1001), rows with `TEST` = yes/1/true (IT:98, 1019). The chip type is `SEG` when the die name starts with `SEG`, `S3G` or `S6G`, else `BAM` (IT:1039).

A. **Project switch**, only when the chip type differs from the type of the open project, the project name is set and it is not a dry run (IT:1040-1055). `_change_wp_project` (IT:914-943):
   1. `MoveChuckSeparation` (IT:918) `[w]`
   2. Undo of a pending precise offset (D below), then `MoveChuckOffAxis` (IT:921) `[w]`
   3. Offset still pending: switch fails (IT:924-926)
   4. `OpenProject {projectName: wp_project_bam | wp_project_seg}` (IT:929) - fails the switch
   5. `MoveChuckCenter`, 90 s (IT:933) `[w]`
   6. `AutoFocus`, 90 s (IT:936) `[w]`
   7. `FindHome`, 90 s (IT:939) - fails the switch
   A failed switch: wait 0.5 s, run the whole of C.3.1 again (IT:1046-1047), then the switch once more (IT:1051). A second failure: `[skip]` (IT:1048-1054).

B. **Move to the die**, `_wp_move_to_die` (IT:808-912). The die coordinate is the CSV column `WP[col,row]`, parsed with `json.loads` (IT:97, 814-815), or the one of `die_overrides` (`via_die` or `wp`, IT:466-493, 1061). A parse error: `[skip]` (IT:816-818). With `--dry-run` it returns at once, nothing is sent (IT:820-822).
   1. `MoveChuckSeparation` (IT:826) `[w]`
   2. Undo of a pending offset, then `MoveChuckOffAxis` (IT:830) `[w]`
   3. Offset still pending: `[skip]` (IT:834-836)
   4. `OpenProject {projectName}` for the chip type, on every chip (IT:838-843) `[skip]`
   5. `FindHome`, 90 s (IT:845) `[skip]`
   6. `MoveChuckRowColumn {col, row}` (IT:850, 322-323) `[skip]`
   7. Only when PTPA is selected for this chip (`run_ptpa_<type>` and `ptpa_chips_<type>`, IT:445-464, 1060):
      - when `re_enable_ptpa`: `SetPTPA {enable: false}` then `SetPTPA {enable: true}` (IT:856-862, 230-234) `[w]`
      - `RunPTPA`, 600 s (IT:863). A failure: when `reset_on_ptpa_failure`, `ResetAgent` and `UserLogIn` (IT:866-872); then `[skip]` (IT:873)
   8. `MoveChuckWide` (IT:875) `[w]`
   9. `MoveChuckXY {x: 15.0, y: 0.0, position: "Relative"}`. The offset is a constant in the code for both chip types (IT:884-890) `[w]`
   10. Only for a die in `die_overrides` with `precise_offset_um`: `MoveChuckXYPrecise {x: dx, y: dy, position: "Relative"}`, 60 s (IT:899-905, 292-299) `[skip]`. The offset is stored before the call, because the chuck may have moved even when the reply is an error (IT:297-298). WPAgent indeed replies 500 after the move when the loop does not converge (IA:168-169, 243-248).
   11. `MoveChuckContact` (IT:907) `[skip]`

C. Not WPAgent: `set_daq` and the `Sequence` commands (IT:1066-1091).

D. **Undo of a precise offset** (`revert_precise_offset`, IT:301-317), run inside every `MoveChuckOffAxis` of the script (IT:255-261): when an offset is pending, `MoveChuckSeparation`, then `MoveChuckXYPrecise {x: -dx, y: -dy, position: "Relative"}`. A failure keeps the offset pending, and `MoveChuckOffAxis` is not sent (IT:257-260).

### C.3.3 Cleanup (`run`, `finally`, IT:1101-1129)

1. `MoveChuckSeparation`, 600 s (IT:1110) `[w]`
2. Undo of a pending offset, then `MoveChuckOffAxis` (IT:1113) `[w]`
3. `MoveChuckHome` (IT:1119) `[w]`, not sent while an offset is pending (IT:1116-1117)
4. `UserLogOut` (IT:1124) `[w]`

The cleanup has no dry-run check (IT:1098-1130). A `--dry-run` therefore sends `UserLogIn`, `ResetAgent`, `UserLogIn`, then the cleanup moves `MoveChuckSeparation`, `MoveChuckOffAxis`, `MoveChuckHome` and `UserLogOut` to the real agent (IT:513-529, 1107-1124). The README says a dry run "skips prober moves" (`ITS3TestAgent/README.md`:32-33). Also `_run_cmd` has no dry-run check, so the mosaix commands run in a dry run too (IT:624-663; by the code).

### C.3.4 The set of WPAgent commands the script can send

`UserLogIn`, `ResetAgent`, `OpenProject`, `MoveChuckOffAxis`, `MoveChuckCenter`, `AutoFocus`, `AlignWafer`, `FindHome`, `MoveChuckSeparation`, `MoveChuckRowColumn`, `SetPTPA`, `RunPTPA`, `MoveChuckWide`, `MoveChuckXY`, `MoveChuckXYPrecise`, `MoveChuckContact`, `MoveChuckHome`, `UserLogOut`. 18 commands.

Client methods that exist but are never called: `init_probing` (IT:239-240; its only call is commented out, IT:561), `set_ptpa` (IT:236-237), `move_chuck_top_left`, `move_chuck_top_right`, `move_chuck_bottom_right` (IT:277-284) and `move_chuck_bottom_left` (IT:274-275; only called in a commented-out block, IT:895). Search for each name in IT: no other caller. So `InitProbing`, `MoveChuckTopLeft`, `MoveChuckTopRight`, `MoveChuckBottomLeft`, `MoveChuckBottomRight` are not sent in `master`.

## C.4 Config files: where each value comes from, and what differs

Keys that reach WPAgent:

| Config key | WPAgent field | Lines |
|---|---|---|
| `wp_user` | `data.user` of every command | IT:177, 437 |
| `wp_agent_name` | `data.waferAgentName` of every command | IT:177, 438 |
| `kafka_broker`, `kafka_ip_family` | broker of the client | IT:435-436 |
| `wp_project_bam`, `wp_project_seg` | `OpenProject.projectName` | IT:533, 550, 838, 1041-1042 |
| `run_list` (CSV) | `MoveChuckRowColumn.col`, `.row` | IT:388-392, 96-98, 814-815 |
| `die_overrides.<die>.via_die` / `.wp` | `MoveChuckRowColumn.col`, `.row` | IT:474-485 |
| `die_overrides.<die>.precise_offset_um` | `MoveChuckXYPrecise.x`, `.y` | IT:487-489, 899-902 |
| `run_ptpa_bam`, `run_ptpa_seg`, `ptpa_chips_bam`, `ptpa_chips_seg` | whether `RunPTPA` is sent. A missing `ptpa_chips_*` means `ALL` | IT:445-464 |
| `re_enable_ptpa` | whether the two `SetPTPA` are sent | IT:856 |
| `reset_on_ptpa_failure` | whether `ResetAgent` + `UserLogIn` follow a failed `RunPTPA` | IT:866 |
| `thinned_layer` | the short init of C.3.1 step 5 | IT:531 |

Values hard-coded in the script: `AlignWafer` die (-1, 1) (IT:246), `MoveChuckXY` offset (15.0, 0.0) Relative (IT:884), the `SetPTPA` values (IT:230-234), all timeouts (C.1).

Keys in the configs that the script never reads: `reset_agent_at_login` (`thinned`:12, `thinned_impedance`:12; search in IT: not found).

Differences between the ten configs, WPAgent-relevant keys only (read with a JSON diff script; the same in all ten: `wp_user = "user1"`, `kafka_ip_family = "v4"`, `run_ptpa_bam = true`, `reset_on_ptpa_failure = true`):

| Key | Value | Configs |
|---|---|---|
| `kafka_broker` | `pcmitpx01:9092` | all except `tile_min` |
| | `svmithi02:9093` | `tile_min` (line 5) |
| `wp_agent_name` | `WPMIT` | all except `nj`, `tile_min` |
| | `CERN` | `nj` (line 8), `tile_min` (line 8) |
| `wp_project_bam` | `ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW` | `base`, `hsch`, `nj`, `prim_only`, `scope`, `tile_min` |
| | `ER2B_babyMOSAIX_Vertical_V0_NotchW_ArrowW` | `er2b` (line 9) |
| | `ER2B_Pad_babyMOSAIX_Vertical_V0_NotchW_ArrowW` | `ER2B_Pad` (line 9) |
| | `none` (a non-empty string) | `thinned`, `thinned_impedance` (line 9) |
| `wp_project_seg` | `ER2_MOSAIX_Vertical_V0_NotchW_ArrowW` | `base`, `hsch`, `nj`, `prim_only`, `scope`, `tile_min` |
| | `ER2B_MOSAIX_Vertical_V0_NotchW_ArrowW` | `er2b` (line 10) |
| | `ER2B_Pad_MOSAIX_Vertical_V0_NotchW_ArrowW` | `ER2B_Pad` (line 10) |
| | `ER2_MOSAIX_Thinned_L2_Vertical_V0_NotchW_ArrowW` | `thinned`, `thinned_impedance` (line 10) |
| `run_ptpa_seg` | `true` | all except the three below |
| | `false` | `hsch` (line 12), `thinned` (line 14), `thinned_impedance` (line 14) |
| `ptpa_chips_bam`, `ptpa_chips_seg` | `["ALL"]` | all except `tile_min` |
| | absent (means `ALL`, IT:450) | `tile_min` |
| `re_enable_ptpa` | `false` | `base`, `er2b`, `ER2B_Pad`, `hsch`, `thinned`, `thinned_impedance` |
| | `true` | `nj` (16), `prim_only` (16), `scope` (16), `tile_min` (14) |
| `thinned_layer` | `true` | `thinned` (11), `thinned_impedance` (11); absent elsewhere |
| `die_overrides` | `BAM12` via `BAM09`, `BAM13` via `BAM10`, both `precise_offset_um [0, 23474.965]` | `ER2B_Pad` (12-15) only |
| `run_list` | `run_list_SEGs.csv` | `base`, `hsch` |
| | `run_list.csv` | `nj`, `prim_only`, `tile_min` |
| | `run_list_er2b.csv` | `er2b`, `ER2B_Pad` |
| | `run_list_scope_test.csv` | `scope` |
| | `run_list_L2_thinned.csv` | `thinned`, `thinned_impedance` |

Facts that follow from the table and the CSV files:

- `MoveChuckXYPrecise` is sent only with `ER2B_Pad`, and only for `BAM12` and `BAM13` (`ER2B_Pad`:12-15; `run_list_er2b.csv` has `BAM12`, `BAM13`).
- `ER2B_Pad` has empty `Initialization` and `Sequence` (lines 39, 41): a run with it only moves the prober.
- The thinned run lists hold only `SEG0` to `SEG4` (`ITS3TestAgent/run_list_L2_thinned.csv`), so the project `none` is never opened (by the code).
- `base` and `hsch` use a list with only SEG dies (`run_list_SEGs.csv`). The init opens the BAM project (C.3.1 step 6), so the first chip switches to the SEG project at once (IT:1040-1044; by the code).
- The non-WPAgent keys that differ (`fpga_*`, `setup_config`, `power_profile`, `output`, `daq_status_file`, `Initialization`, `Sequence`, `scope_capture`) do not reach WPAgent.

## C.5 How it reacts to an error reply and to a timeout

- **What counts as success.** `status.lower()` in (`success`, `ok`) (for example IT:514). WPAgent sends `Success` on success and `UnexpectedError` on error (RB:70-87; `WPAgent/utilities/WPMessagesStatus.py`:5, 8). A timeout is `status: "timeout"` (IT:206). So an error reply and a timeout are handled the same way: as a failure (by the code).
- **Logging.** Most failures log `resp.get("output", resp)` (for example IT:828). A WPAgent reply has no top-level `output` (RB:73-87), so the whole reply dict is logged; the text is in `error.message`.
- **Per call.** The effect of a failure is in C.3 (`[w]`, `[skip]`, `[abort]`). Summary:
  - Init: every failure ends the run, without cleanup and without `UserLogOut` (IT:1099-1100).
  - Per chip: `OpenProject`, `FindHome`, `MoveChuckRowColumn`, `RunPTPA`, `MoveChuckXYPrecise`, `MoveChuckContact` skip the chip; `MoveChuckSeparation`, `MoveChuckOffAxis`, `SetPTPA`, `MoveChuckWide`, `MoveChuckXY` only warn.
  - Project switch: one retry after a full init (IT:1044-1054).
  - `RunPTPA`: optional `ResetAgent` + `UserLogIn`, then skip (IT:864-873).
  - Cleanup: every failure only warns (IT:1111-1129).
- **A timeout is not a stop.** On a timeout the script sends the next command. The late reply is dropped because its correlation id does not match (IT:199-200). WPAgent may still be running the first command (C.1, concurrency).
- **Exceptions.** `send` catches nothing (IT:174-189). A Kafka exception or a bad JSON reply (IT:201) goes up. During the chip loop the `finally` cleanup still runs (IT:1101-1103); `main` does not catch it (IT:1157-1159), so the process ends with a traceback (by the code).

## C.6 What else it talks to

| Peer | Channel | Lines |
|---|---|---|
| Kafka broker | `AdminClient` (topic list), producer, two consumers (reply, heartbeat) | IT:134-165, 331-340 |
| WPAgent | only through the Kafka topics of C.1 | IT:117-119 |
| DB / DB agent | none. No DB topic, no DB client (search for `db-agent` in IT: not found) | - |
| mosaix_test software | `subprocess` with `/bin/bash`: `source <mosaix_root>/setup.sh load && env -0` once, then each command with that environment | IT:595-605, 642-647 |
| FPGA | `./program_mts.py <setup> <bitfile>` in `fpga_program_dir`, through `_run_cmd` | IT:782-804 |
| DAQ status file | `os.remove(<mosaix_root>/<daq_status_file>)` | IT:945-956 |
| Oscilloscope | package `ITS3TestAgent/oscilloscope/` (imported lazily, IT:36-43). VISA over TCP/IP with PyVISA (`oscilloscope/scopes/instrument.py`:36, 74; address form `TCPIP0::<ip>::inst0::INSTR`, `oscilloscope/scopes/labmaster_mcm_utils.py`:10). Handshake with mosaix_test through the files `/tmp/mosaix_scope_mode.json` and `/tmp/mosaix_scope_mode.stop` (`oscilloscope/scope_mode_watcher.py`:60-61). Network setup with `sudo ip addr add <cidr> dev <iface>` (`oscilloscope/scope_network.py`:171-176) | as given |

The scope is used only when `scope_capture.enabled` is true (IT:411-416); only `scope` has it (`scope`:33-51).

The script needs Linux: `/bin/bash`, `env -0`, `/tmp` paths, `ip` and `sudo`, and `/home/...` paths in every config (IT:600-605, 643-645; `oscilloscope/scope_network.py`:171-173; `base`:2, 21-24). SENTIO runs on Windows (`C:\ProgramData\MPI Corporation\SENTIO\projects`, `WPAgent/globals/WPAagentGlobalParameters.py`:11). So by the code the script and a tool "on the Windows computer next to SENTIO" run on different computers. A plain local subprocess call from the script to the tool is then not possible without a remote channel (by the code; how the two computers are linked is not in the code).

## C.7 Which calls would behave the same through a local tool

"Same" means: the handler needs only the prober connection and the state that SENTIO itself keeps (open project, chuck position, alignment, PTPA setting). Per-command details are in `inventory-A.md` (point 11 of each command) and `inventory-B.md`:102.

| Command | Agent state it needs from earlier calls | Same without Kafka, DB, log-in? |
|---|---|---|
| `UserLogIn`, `UserLogOut`, `ResetAgent` | none; they only change the login and the state machine in process memory (LA:51-175; `inventory-A.md` command 48) | Nothing to do in a tool without users. They exist only to make the later checks pass |
| `MoveChuckSeparation`, `MoveChuckOffAxis`, `MoveChuckWide`, `MoveChuckCenter`, `MoveChuckHome`, `FindHome`, `AutoFocus`, `MoveChuckXY` | login (Developer for `MoveChuckCenter`, `MoveChuckHome`, `FindHome`, `MoveChuckXY`; none for `AutoFocus`, a bypass command, CC:28) and the prober connection | yes: no DB, no orientation check (`inventory-A.md` commands 19, 20, 23, 24, 30, 33, 46, 47) |
| `MoveChuckXYPrecise` | state `UsedByDeveloper`; no validator at all (`inventory-B.md`:102) | yes. Needs the SENTIO library object `prober.prober` (D.2) |
| `OpenProject` | login; it writes `g.projectName`, which the orientation check of later commands reads (VA:566-568) | yes for the move. The DB read of the project id fails softly (`inventory-A.md` command 16) |
| `AlignWafer`, `MoveChuckRowColumn`, `RunPTPA`, `SetPTPA`, `MoveChuckContact` | login, and the orientation check: with a project open they need `g.probe_card_orientation` and `g.wafer_orientation` (VA:540-584), which only `Initialize` fills from the DB (`inventory-A.md` section E) | no, as long as the orientation check runs: the values must come from a config or the check must be skipped |

State that the script itself keeps between calls: the pending precise offset (IT:169, 295-320) and the type of the open project (IT:428, 1040-1055). Both are in the script, not in WPAgent, and stay valid with any transport.

State that WPAgent keeps between calls and that the script relies on (process memory, lost when the process ends; `inventory-A.md` cross-cutting note 1):

1. The prober connection, opened by an `Initialize` that the script does not send (C.2).
2. `g.wpAgentName`, set by `listen()` (AG:302); the validator compares it with `waferAgentName` (VA:106-125).
3. The login `user1` and the state `UsedByDeveloper` (LA:76-78).
4. `g.projectName` from `OpenProject`, for the orientation check.
5. The wafer and probe card orientation from the DB sync of `Initialize`.

A tool that starts a new process per command keeps none of these. Each such process starts in `ServiceOn` with no user and no connection, and refuses every command that is not a bypass command (CM:277-287; SM:44-46).

Local mode between commands: every prober handler that the script uses calls `local_mode()` (`inventory-A.md`, point 7 of the commands above), except `MoveChuckXYPrecise` on success (IA:168-253 has no `local_mode`; on an error reply `_try_local_mode` runs, CM:296-307). In some handlers SENTIO queries come after `local_mode()`: `MoveChuckOffAxis` (TA:220-224), `MoveChuckWide` (TA:256-260), `SetPTPA` (TA:629-631), `RunPTPA` (TA:663-684). The driver says that any command switches the station back to remote mode (SP:44-45). So today SENTIO is not always in local mode between two commands (by the code; what SENTIO does is not in the export).

---

# D. The prober driver

The method list below was made with an AST scan of every call `prober.<m>(...)`, `currentProber.<m>(...)`, `_pr.<m>(...)` and `prober.prober.<m>(...)` in `WPAgent/actions/`, `WPAgent/utilities/`, `WPAgent/services/`, `WPAgent/sequencer/`, `WPAgent/stateMachine/`, `WPAgent/globals/` and the top-level modules (a scan script, not kept). `WPAgent/utilities/` has no call on a prober object (the scan found none there).

Columns: **Mock** = what `MockProberImpl` (MP) does: `state` (keeps and changes its own fields), `fixed` (a constant answer), `missing` (no such method). **SENTIO** = what `SentioProberImpl` (SP) does: a method of the SENTIO library object `self.prober` (`sentio_prober_control`, not in the export), or `send_cmd("<raw command>")`. What a library method sends on the wire is not in the export.

## D.1 Methods declared by the interface (IF)

`AbstractProber` (IF:4-110). All methods are `@abstractmethod`, except `disconnect` (IF:10-15), which has an empty default. `SentioProberImpl` subclasses it (SP:12). `MockProberImpl` does not (MP:11), so nothing checks that the mock has every method (by the code).

| Method | Callers (action code) | Mock | SENTIO |
|---|---|---|---|
| `initialize()` | none (search: no `.initialize()` call outside the drivers) | fixed: sleeps 0.2 s, returns `"0,OK"` (MP:60-64) | `initialize_if_needed()` (SP:18-19). Not called at connect: the call in `__init__` is commented out (SP:15) |
| `disconnect()` | `ProberFactory._disconnect` (FA:24-32) | state: `_connected = False` (MP:70-71) | sends nothing: `socket.shutdown`, `comm.disconnect()`, `socket.close()` (SP:60-84) |
| `open_project(path)` | TA:777, 788, 1151, 1200, 1260; PA:173, 177 | state: `_project`, resets the die (MP:80-86) | `open_project(path, restore_heights=True)` (SP:86-87) |
| `move_chuck_xy(x, y, position)` | TA:69, 304, 1758, 1785, 1811, 1837; IA:164, 169, 909, 910, 929, 934; `WPAgent/actions/WPTopographyActions.py`:112, 128 | state, but always stores `(x, y)` as the new position, also for `Relative` (MP:126-129) | `move_chuck_xy(ref, x, y)` with `ChuckXYReference.Zero/Relative/Center`; any other `position` passes `None` (SP:89-97) |
| `move_chuck_center()` | TA:124, 771 | state (MP:143-148) | `send_cmd("move_chuck_center")`; the `wait_complete` line is commented out (SP:123-125) |
| `move_chuck_offaxis_area()` | TA:220, 303, 400, 770, 989, 1068, 1575 | state: area `OffAxisCamera` (MP:150-155) | `move_chuck_work_area(WorkArea.Offaxis)` (SP:207-208) |
| `move_chuck_wide()` | TA:256, 1589 | state: area `WideFieldCamera` (MP:157-162) | `move_chuck_work_area(WorkArea.Probing)` (SP:210-212). The mock and SENTIO name different areas |
| `run_ptpa()` | TA:663, 1586 | state: shifts x, y and z a little (MP:356-367) | `send_cmd("vis:compensation:start_execute OffAxis, BothWithProbeTips")`, raises when not `ok()`, then `wait_complete(cmd_id)` (SP:135-143) |
| `step_next_die()` | TA:562 | state (MP:231-241) | `map.step_next_die()` (SP:145-146) |
| `go_to_die(col, row)` | TA:524, 1579; DG:80, 82; IA:908; `WPTopographyActions.py`:107 | state (MP:255-260) | `map.step_die(col, row)` (SP:151-152) |
| `switch_camera(mountPoint)` | TA:1303 | state (MP:293-296) | `vision.switch_camera(getattr(CameraMountPoint, mountPoint))` (SP:154-156) |
| `move_chuck_home()` | TA:151 | state (MP:136-141) | `move_chuck_home()` (SP:158-159) |
| `unload_wafer()` | TA:1030, 1110 | state (MP:100-109) | `move_chuck_load(LoadPosition.Front)` (SP:161-162) |
| `local_mode()` | almost every handler (40 call sites in TA, `WPContactingActions.py`, DG, `WPTopographyActions.py`), CM:202, CW:149 | fixed: returns `"0,LocalMode"`, does nothing (MP:379-380) | `local_mode()` of the library (SP:164-165). The repo says this is `*LOCAL` (CW:131; `WPAgent/README.md`:567, 586) |
| `load_wafer()` | TA:988, 1067 | state (MP:92-98) | `move_chuck_load(LoadPosition.Center)` (SP:167-168) |
| `get_chuck_position()` | TA:40, 41, 1335 | state: `In Contact` / `In Separation` (MP:191-197) | `status.get_prop("Z_Position_Hint", "chuck")`, mapped to `In Contact`, `In Separation` or `In <value>`; an exception is returned as the text `Error: ...` (SP:276-319) |
| `get_chuck_xy()` | TA:656, 667, 847, 857; DG:58, 81, 83; `WPAgent/actions/WPContactingActions.py`:54; `WPTopographyActions.py`:109, 115 | state (MP:206-211) | `get_chuck_xy(ChuckSite.Wafer, ChuckXYReference.Zero)` (SP:321-334) |
| `get_contact_height()` | TA:657, 668, 848, 858, 1160, 1209; `WPContactingActions.py`:55 | state, but it returns the mock chuck z, not a contact height (MP:213-218) | first value of `get_chuck_site_height(ChuckSite.Wafer)` (SP:336-351) |
| `set_contact_height(height)` | TA:1438 | state: sets the mock chuck z (MP:220-225) | `send_cmd("set_chuck_site_heights Wafer,Contact,<height>")` (SP:353-371) |
| `set_overtravel(gap)` | TA:1361, 1473 | state (MP:339-341) | `send_cmd("set_chuck_overtravel_gap <gap>")` (SP:259-261) |
| `enable_overtravel(on)` | TA:1360, 1474 | state (MP:343-345) | `enable_chuck_overtravel(on)` (SP:263-265) |

## D.2 Methods the action code calls but the interface does not declare

| Method | Callers | Mock | SENTIO |
|---|---|---|---|
| `is_alive()` | CW:237 | state: `_connected` (MP:73-74) | sends nothing: `select` on the socket and `recv(1, MSG_PEEK)`; no socket found means "alive" (SP:42-58) |
| `move_chuck_z(z)` | TA:98, 305 | state (MP:131-134) | `move_chuck_z(ChuckZReference.Zero, z)` (SP:127-128) |
| `set_ptpa(enable)` | TA:629 | state (MP:351-354) | `send_cmd("vis:compensation:enable Both, <enable>")`; a Python bool prints as `True` / `False` (SP:130-133) |
| `step_prev_die()` | TA:593 | state (MP:243-253) | `send_cmd("map:step_previous_die")` (SP:148-149) |
| `find_home()` | TA:795, 854; IA:907 | state: x, y, z to 0 (MP:373-377) | `vision.find_home()` (SP:170-171) |
| `align_wafer(col, row, subsite)` | TA:780, 919 | state (MP:111-120) | `map.step_die(col, row, subsite)`, then `vision.align_wafer()`; comment "Have to be tested" (SP:173-177) |
| `go_to_contact()` | TA:338 | state (MP:175-179) | `move_chuck_contact()` (SP:182-183) |
| `go_to_separation()` | TA:372, 769, 1267 | state (MP:181-185) | `move_chuck_separation()` (SP:185-186) |
| `auto_focus()` | TA:772, 951, 1583; `WPTopographyActions.py`:117 | fixed: `15300.0`, or `_focus_um` when a test sets it (MP:301-304) | `float(vision.auto_focus())` (SP:188-191) |
| `get_chuck_z()` | `WPTopographyActions.py`:118 | state (MP:306-308) | `get_chuck_z(ChuckZReference.Zero)` (SP:193-195) |
| `move_chuck_work_area(area)` | TA:182 | state, but `area` must be a number 0, 1 or 2 (`int(area)`, MP:164-169) | `move_chuck_work_area(getattr(WorkArea, area))`: `area` must be an enum member name (SP:197-205). The two drivers need different values |
| `get_current_index()` | TA:32; PA:380; DG:35 | state: `"index,col,row"` (MP:272-279) | `send_cmd("map:die:get_current_index")`, then `message()`, `data()`, `value()` or `str()` (SP:214-225) |
| `get_dies_number()` | TA:37; PA:381 | fixed: `"100,100,0"` from the constructor values (MP:39-40, 281-287) | `map.get_num_dies(DieNumber.Selected)`, then as above (SP:241-253) |
| `get_current_working_area()` | TA:44, 47, 1429; DG:47 | state (MP:199-204) | `send_cmd("get_chuck_position_hint")`, first comma part (SP:267-274) |
| `get_die_size()` | DG:30 | fixed: `(3000.0, 2500.0)`, or `_die_size` when set (MP:262-264) | `map.get_index_size()` (SP:227-231) |
| `get_map_axis_orient()` | DG:131 | fixed: `"UR"` (MP:266-267) | `map.get_axis_orient().toSentioAbbr()` (SP:233-235) |
| `get_grid_origin()` | DG:132 | fixed: `(0, 0)` (MP:269-270) | `map.get_grid_origin()` (SP:237-239) |
| `take_screenshot(...)` | IA:919, 990 | creates an empty file (MP:310-333) | `vision.snap_image(file, what, where)` (SP:388-441) |
| attribute `.prober` (the library object itself) | `prober.prober.get_chuck_xy(...)`: IA:40 (`GetChuckXY`), IA:137 (`MoveChuckXYPrecise`), IA:504 (`GenerateRasterSteps`); `prober.prober.move_chuck_xy(ChuckXYReference.Relative, cx, cy)`: IA:232 (`MoveChuckXYPrecise`) | missing: the mock has no attribute `prober` (MP:20-54), so these calls raise `AttributeError` on the mock (by the code; `inventory-B.md`:217 reports the same for `MoveChuckXYPrecise`) | direct library calls, bypassing the driver. Each also imports `sentio_prober_control.Sentio.Enumerations` inside the function (IA:36, 127, 502) |

Driver methods that no action calls (search for each name outside the drivers: not found): SP `move_chuck_top_left`, `move_chuck_top_right`, `move_chuck_bottom_left`, `move_chuck_bottom_right` (SP:99-121; the commands with these names call `move_chuck_xy` with constants, TA:1755-1837), `get_camera_status` (SP:255-257), `take_image` (SP:373-386; it calls `self.prober.take_image`, whether the library has it is not in the export), `get_chuck_stage` (SP:443-469); MP `connect` (MP:66-68), `get_camera_status` (MP:298-299), `clean_probe_station` (MP:382-384).

For the ITS3 script (C.3.4) the prober methods used are: `go_to_separation`, `move_chuck_offaxis_area`, `open_project`, `get_contact_height`, `move_chuck_center`, `auto_focus`, `align_wafer`, `find_home`, `get_chuck_xy`, `go_to_die`, `set_ptpa`, `run_ptpa`, `move_chuck_wide`, `move_chuck_xy`, `go_to_contact`, `move_chuck_home`, `local_mode`, the UCI queries `get_current_index`, `get_dies_number`, `get_chuck_position`, `get_current_working_area` (TA:26-47), and for `MoveChuckXYPrecise` the library object `prober.prober` (IA:137, 232). Source: point 7 of each command in `inventory-A.md` and IA:125-253.

## D.3 `WPFactory.py`: choice, creation, address, open and close

- **Choice.** `prober_classes = {"sentio": SentioProberImpl, "mock": MockProberImpl}` (FA:6). `_open` takes `machineType.lower()` from this table; another type raises `ValueError("Unsupported machine type ...")` (FA:64-69). `services/WPMachineRecord.machine_config` checks the DB field `software` against the same table (MR:28-36).
- **Creation.** `prober_class(address)` (FA:72). For `sentio`: `SentioProber.create_prober("tcpip", address)`, then TCP keepalive on the library's private socket `comm._CommunicatorTcpIp__socket` (SP:13-16, 21-40). The keepalive has a Windows branch, `sock.ioctl(socket.SIO_KEEPALIVE_VALS, ...)` (SP:32-33). For `mock`: no connection, only a print (MP:20-54).
- **Singleton.** `ProberFactory` keeps one prober, its `(type, address)` and an `initialized` flag as class attributes (FA:35-56). `get_prober(type, address)` returns the current prober when the pair is the same, else opens a new one and closes the old one (FA:91-117, 74-85). `reconnect` always opens a new one first (FA:164-176). `get_current_prober()` never opens a connection: it raises `ProberNotConnectedError` when `is_prober_connected()` is `False` or when nothing is initialized (FA:132-162). `peek_prober()` returns the prober without checks (FA:87-89). The `RLock` `lock` serializes connection changes (FA:56, 104, 172, 189).
- **Where the address comes from.** The factory gets it from its callers. The callers are `Initialize` (`_connect_prober`, PA:34-56), `ReconnectProber` (PA:446), the connection watch (CW:305) and the unused helper `ensure_prober_initialized` (`WPAgent/utilities/WPHelpers.py`:36-82; search: no caller). All pass `g.address` and `g.machineType`. `listen()` sets them (AG:290, 305-306): `address` is `"host:port"` (MR:55-57; port 35555 when the config has none), from the DB record fields `hostName`, `connectionPort`, `software` (MR:38-51), or from `address`, `port`, `machineType` of a mock config (AG:227-229; `WPAgent/configs/ProbeConfigMOCK.json`:4-6). `refresh_machine` can change them from the DB later (MR:60-110).
- **Close.** `_disconnect(prober)` calls `prober.disconnect()` and never raises (FA:24-32). It runs when the factory lets a prober go: replacement (FA:79), `close()` (FA:178-197). `close(final=True)` also refuses every later connect (FA:70-71, 187-188). The only caller of `close` outside tests is `close_prober_connection` (CW:127-157), which first sends `local_mode()` when no command runs (CW:147-151). Its only caller is the stop of the Kafka listener (KC:540-543). So in any other process the code never closes the connection; it ends with the process (by the code).
- **`local_mode()`.** SP:164-165 calls the library method `local_mode()`; the library is not in the export. The repo's own comments say it is the SENTIO command `*LOCAL` (CW:131; `WPAgent/README.md`:567, 586). The mock does nothing (MP:379-380). Callers: almost every handler after its work (D.1), `_try_local_mode` after an error reply or an exception (CM:188-205, 296-326), and the listener stop (CW:147-151).

## D.4 `services/WPProberConnectionWatch.py`

What it does (CW:1-30):

| Part | Lines | What | Needs Kafka? | Needs the DB? |
|---|---|---|---|---|
| `is_prober_connected`, `is_prober_initialized` | CW:47-58 | read `g.prober_connected` and `ProberFactory.is_initialized()` | no | no |
| `not_connected_message`, `not_initialized_message` | CW:67-76 | error texts | no | no |
| `set_prober_connected` | CW:79-110 | writes `g.prober_connected`, an audit log line, and calls the listeners. The Kafka listener registers one that publishes `WpConnectionStatusChanged` (KC:326-347, 455) | only through that listener | no |
| `close_prober_connection` | CW:127-157 | `local_mode()`, then `ProberFactory.close(final=True)` | no | no |
| `is_reachable(type, "host:port")` | CW:160-169 | TCP connect with a 2 s timeout, sends nothing; a mock is always reachable | no | no |
| `ProberConnectionWatch` thread | CW:172-336 | every 5 s (CW:38): skips while a command runs (CW:190-191); when initialized, `prober.is_alive()`, and after 3 failures (CW:39) one reconnect, else `g.prober_connected = False` and the state `Error` for an agent in a session (CW:234-275); when not initialized, `refresh_machine()` every 30 s (CW:41, 217-224) and `is_reachable` (CW:226-232); when the connection was lost, a reconnect (CW:205-213, 277-315) | no | yes: `refresh_machine()` reads `GetAllWaferProbeMachines` through the DB client (MR:77-80); it does nothing when `g.machine_record_name` is empty (MR:73-75). A reconnect in a session calls `WPProjectActions.reconnect_session` (CW:311-313), and `WPProjectActions` imports the DB client at module level (PA:5) |

- The watch is started only by the Kafka listener (KC:457-458). `is_busy` comes from the listener's command count (KC:457; `WPAgent/utilities/WPCommandActivity.py`:25-43).
- At import, CW loads `utilities.WPAgentLogger` (CW:36), and that loads `confluent_kafka` (`WPAgent/utilities/WPAgentLogger.py`:5), although the logger's Kafka output is off by default (`WPAgentLogger.py`:30, 41-44). Checked with stub packages: `ProberFactory.get_current_prober()` on a mock prober requests `confluent_kafka` through `drivers.WPFactory:152 -> services.WPProberConnectionWatch:36 -> utilities.WPAgentLogger:5` (script a scan script (not kept), step `factory`).
- What a local tool still needs: `is_reachable` (CW:160-169) as the check that the machine is on before it connects; the driver's `is_alive()` (SP:42-58) only if the tool keeps a connection open across commands; and the close order of `close_prober_connection`: `local_mode()`, then close (CW:147-153). The thread, the DB refresh, the listeners and the `Error` state only have a meaning in a long-running agent. Without the watch `g.prober_connected` stays `None`, which passes both `get_current_prober()` (FA:156) and the READY check (`inventory-A.md` rule 0.3).

## D.5 What the drivers import

Static scan of every import (a scan script, not kept), checked by importing each module with stub third-party packages (a scan script, not kept):

| Module | Imports at module level | Inside functions | Kafka / DB client / logger / globals? |
|---|---|---|---|
| `interfaces/WPProberInterface.py` | `abc` (IF:1) | - | none |
| `drivers/WPSentioProber.py` | `select`, `socket`, `sys`, `sentio_prober_control` (`ProberSentio.SentioProber`, `Enumerations`, `Response`), `interfaces.WPProberInterface` (SP:1-9) | `sentio_prober_control.Sentio.Enumerations` (SP:331, 346), `datetime`, `os` (SP:407-408) | none |
| `drivers/WPMockProber.py` | `time`, `os`, `datetime` (MP:1-3) | - | none |
| `drivers/WPFactory.py` | `threading`, `drivers.WPSentioProber`, `drivers.WPMockProber` (FA:1-4) | `services.WPProberConnectionWatch` in `get_current_prober` (FA:152-154) | not at import. At call time, through CW: the logger (and with it `confluent_kafka`), the globals, the state machine, and through `reconnect_session` the DB client (D.4) |

Consequences:

- `drivers.WPMockProber` imports with the standard library only (stub run: no third-party request).
- `drivers.WPSentioProber` needs only `sentio_prober_control` (stub run: that one request).
- `drivers.WPFactory` imports `WPSentioProber` at module level (FA:3), so even a mock-only use needs `sentio_prober_control` installed (stub run: `drivers.WPFactory:3 -> drivers.WPSentioProber:4`).
- The two drivers can be reused as they are. The factory can be reused to open and close a connection, but `get_current_prober()` pulls in CW and with it `confluent_kafka` (D.4).

---


# E. Python packages and imports

How this was made: an AST scan of every `import` in every `.py` file under `WPAgent/` except `tests/` and `linters/` (a scan script, not kept), and import runs with stub modules for every third-party package, so nothing can reach a network (a scan script (not kept), a scan script (not kept)). The runs used Python 3.15.2 and 3.9.0 on a Windows PC, with a temporary folder as the working directory (importing `WPCmdMap` creates `WPAgentLogger.log` there, `WPAgent/WPCmdMap.py`:178 and `WPAgent/utilities/WPAgentLogger.py`:28, 51).

"Module level" includes imports inside a top-level `try`. "Inside a function" means the import runs only when that function runs. Internal names are as the code writes them; the code imports its own packages as top-level names (`from drivers.WPFactory import ...`), so `WPAgent/` must be on `sys.path` (it is, when `main.py` runs from there).

## E.1 `requirements.txt`

| Package (`WPAgent/requirements.txt` line) | Imported by (file:line) | Level |
|---|---|---|
| `confluent-kafka==2.12.0` (2) | `WPKafkaClient.py`:1-2, 146, 364; `WPSender.py`:18; `services/WPDbKafkaClient.py`:5-6; `services/WPHeartbeat.py`:26-27; `utilities/WPAgentCache.py`:4; `utilities/WPAgentLogger.py`:5 | module (and two in functions in `WPKafkaClient.py`) |
| `sentio-prober-control==24.4.0` (6) | `drivers/WPSentioProber.py`:4, 7, 9, 331, 346; `actions/WPImagingActions.py`:36, 127, 502 | module in the driver; function in the imaging actions |
| `pyyaml==6.0.2` (17) | `actions/WPSequencerActionsYAML.py`:2; `sequencer/WPSequencerYAML.py`:2; `WPAgent.py`:75 | module; function in `WPAgent.py` |
| `fire==0.7.1` (4) | `main.py`:2 | module |
| `numpy==2.0.2` (18) | `actions/WPImagingActions.py`:671; `utilities/WPImageStitching.py`:25; `utilities/WPImageStitchingFull.py`:44; `utilities/needle_mark/` `analysis.py`:16, `image.py`:9, `marks.py`:37, `pads.py`:22, `report.py`:11 | function in the action; module in the utilities |
| `opencv-python==4.11.0.86` (19) | `utilities/WPImageStitching.py`:24; `utilities/WPImageStitchingFull.py`:43; `utilities/needle_mark/` `image.py`:8, `marks.py`:36, `pads.py`:21, `report.py`:10 | module |
| `tifffile==2024.8.30` (20) | `actions/WPImagingActions.py`:670; `utilities/WPImageStitchingFull.py`:316; `utilities/needle_mark/image.py`:51 | function |
| `imagecodecs==2024.12.30` (21) | `utilities/WPImageStitchingFull.py`:319 | function |
| `scipy==1.14.1` (22) | `utilities/WPImageStitchingFull.py`:166 | function |
| `Pillow==11.2.1` (23) | `actions/WPImagingActions.py`:722 (`PIL`) | function |
| `PyVISA==1.15.0` (5) | no WPAgent module imports `pyvisa` (scan: not found). The Dockerfile comment says the agent talks to SENTIO "over PyVISA/TCP" (`WPAgent/Dockerfile`:3-4); the driver opens `"tcpip"` (SP:14). Whether the SENTIO library needs PyVISA is not in the export | - |
| `argcomplete` (1), `Deprecated` (3), `termcolor` (7), `tomli` (8), `typing_extensions` (9), `wrapt` (10) | no WPAgent module imports them (scan: not found) | - |
| `pytest` (11), `pytest-cov` (12), `flake8` (13), `pylint` (14), `mypy` (15), `black` (16) | tests and linters only (outside the scan) | - |

`ITS3TestAgent/requirements.txt`: `confluent-kafka` (1), `tqdm` (2), `json5` (3), `pyvisa` (5), `pyvisa-py` (6). The script imports `confluent_kafka` and `tqdm` (IT:45-47); `json5` is imported nowhere in `ITS3TestAgent/` (search: not found; the `.json5` names in the configs are mosaix file names).

## E.2 Imports of every module

Line numbers are of the module in the first column.

| Module | Third-party, module level (line) | Third-party, inside a function (line) | Internal, module level (line) | Internal, inside a function (line) |
|---|---|---|---|---|
| `WPAgent/WPAgent.py` | - | `yaml` (75) | `WPKafkaClient` (13); `globals.WPAagentGlobalParameters` (19); `services.WPHeartbeat` (14); `utilities.WPResponseBuilder` (20) | `services.WPDbKafkaClient` (243, 315); `services.WPMachineRecord` (244, 277); `stateMachine.WpAgentStateMachineGlobals` (278) |
| `WPAgent/WPCmdMap.py` | - | - | `actions.WPCommandActions` (9); `actions.WPContactingActions` (12); `actions.WPDataBaseActions` (5); `actions.WPDieGridActions` (13); `actions.WPImagingActions` (11); `actions.WPLoginActions` (10); `actions.WPProjectActions` (1); `actions.WPSequencerActions` (3); `actions.WPSequencerActionsYAML` (4); `actions.WPTestingActions` (8); `actions.WPTopographyActions` (14); `drivers.WPFactory` (16); `services.WPProberConnectionWatch` (17); `stateMachine.WpAgentStateMachineGlobals` (7); `utilities.WPAgentLogger` (6); `utilities.WPCommandConstants` (18); `utilities.WPResponseBuilder` (2); `utilities.WPSequenceContext` (20); `utilities.WPValidationDecorator` (19) | `drivers.WPFactory` (197) |
| `WPAgent/WPCommandHandler.py` | - | - | `utilities.WPAgentLogger` (1) | `WPCmdMap` (23) |
| `WPAgent/WPKafkaClient.py` | `confluent_kafka` (1, 2) | `confluent_kafka` (146, 364) | `WPCmdMap` (14); `services.WPHeartbeat` (17); `services.WPProberConnectionWatch` (18); `utilities.WPAgentCache` (16); `utilities.WPAgentLogger` (15); `utilities.WPAgentTypes` (12); `utilities.WPCommandActivity` (21); `utilities.WPMachineName` (22); `utilities.WPMessagesStatus` (23) | `globals.WPAagentGlobalParameters` (328) |
| `WPAgent/WPSender.py` | `confluent_kafka` (18) | - | - | - |
| `WPAgent/actions/WPCommandActions.py` | - | - | `WPCommandHandler` (2); `utilities.WPResponseBuilder` (3) | - |
| `WPAgent/actions/WPContactingActions.py` | - | - | `actions.WPTestingActions` (21); `drivers.WPFactory` (20); `globals.WPAagentGlobalParameters` (19); `stateMachine.WpAgentStateMachineGlobals` (17); `utilities.WPContacting` (14); `utilities.WPMessagesStatus` (16); `utilities.WPResponseBuilder` (12); `utilities.WPValidationDecorator` (13) | `actions.WPImagingActions` (169); `utilities.needle_mark` (213) |
| `WPAgent/actions/WPDataBaseActions.py` | - | - | `globals.WPAagentGlobalParameters` (9); `services.WPDbKafkaClient` (10); `utilities.WPAgentTypes` (8); `utilities.WPResponseBuilder` (6); `utilities.WPValidationDecorator` (11) | - |
| `WPAgent/actions/WPDieGridActions.py` | - | - | `drivers.WPFactory` (26); `globals.WPAagentGlobalParameters` (25); `utilities.WPContacting` (22); `utilities.WPDieGrid` (21); `utilities.WPMessagesStatus` (23); `utilities.WPResponseBuilder` (19); `utilities.WPValidationDecorator` (20) | `actions.WPImagingActions` (72); `actions.WPTestingActions` (121) |
| `WPAgent/actions/WPImagingActions.py` | - | `PIL` (722); `numpy` (671); `sentio_prober_control` (36, 127, 502); `tifffile` (670) | `actions.WPTestingActions` (11, 12); `drivers.WPFactory` (1, 10); `globals.WPAagentGlobalParameters` (9); `stateMachine.WpAgentStateMachine` (6); `stateMachine.WpAgentStateMachineGlobals` (5); `utilities.WPHelpers` (2); `utilities.WPResponseBuilder` (3); `utilities.WPValidationDecorator` (7) | `utilities.WPImageStitching` (900); `utilities.WPImageStitchingFull` (617, 741); `utilities.WPImagingConfig` (435) |
| `WPAgent/actions/WPLoginActions.py` | - | - | `actions.WPTestingActions` (10); `drivers.WPFactory` (11); `globals.WPAagentGlobalParameters` (4); `stateMachine.WpAgentStateMachine` (6); `stateMachine.WpAgentStateMachineGlobals` (5); `utilities.WPAgentLogger` (9); `utilities.WPResponseBuilder` (7); `utilities.WPValidationDecorator` (8) | - |
| `WPAgent/actions/WPMapConversionActions.py` | - | - | `utilities.WPMapConverter` (1) | - |
| `WPAgent/actions/WPProjectActions.py` | - | - | `actions.WPDataBaseActions` (6); `drivers.WPFactory` (2); `globals.WPAagentGlobalParameters` (1); `services.WPDbKafkaClient` (5); `utilities.WPResponseBuilder` (4); `utilities.WPValidationDecorator` (3) | `services.WPMachineRecord` (284, 422); `services.WPProberConnectionWatch` (49, 285, 350, 423); `stateMachine.WpAgentStateMachine` (420); `stateMachine.WpAgentStateMachineGlobals` (86, 419, 531, 558); `utilities.WPAgentLogger` (482, 542); `utilities.WPCommandActivity` (286, 512) |
| `WPAgent/actions/WPSequencerActions.py` | - | - | `utilities.WPResponseBuilder` (1); `utilities.WPValidationDecorator` (2) | `WPCmdMap` (10) |
| `WPAgent/actions/WPSequencerActionsYAML.py` | `yaml` (2) | - | `utilities.WPResponseBuilder` (4); `utilities.WPValidationDecorator` (5) | - |
| `WPAgent/actions/WPTestingActions.py` | - | - | `drivers.WPFactory` (8); `globals.WPAagentGlobalParameters` (7); `stateMachine.WpAgentStateMachineGlobals` (3); `utilities.WPDieMaps` (5); `utilities.WPResponseBuilder` (1); `utilities.WPValidationDecorator` (4) | `actions.WPDataBaseActions` (718, 974, 1016, 1136, 1185, 1531); `actions.WPDieGridActions` (513); `globals.WPAagentGlobalParameters` (171, 209, 245, 292, 327, 362, 456, 717, 973, 1015, 1056, 1094, 1135, 1184, 1239, 1350, 1391, 1462, 1635, 1699); `utilities.WPHelpers` (17); `utilities.WPInitProbingConfig` (719); `utilities.WPResponseBuilder` (21) |
| `WPAgent/actions/WPTopographyActions.py` | - | - | `actions.WPTestingActions` (25); `drivers.WPFactory` (24); `globals.WPAagentGlobalParameters` (23); `stateMachine.WpAgentStateMachineGlobals` (21); `utilities.WPDieMaps` (17); `utilities.WPImagingConfig` (18); `utilities.WPResponseBuilder` (15); `utilities.WPTopography` (19); `utilities.WPValidationDecorator` (16) | - |
| `WPAgent/drivers/WPFactory.py` | - | - | `drivers.WPMockProber` (4); `drivers.WPSentioProber` (3) | `services.WPProberConnectionWatch` (152) |
| `WPAgent/drivers/WPMockProber.py` | - | - | - | - |
| `WPAgent/drivers/WPSentioProber.py` | `sentio_prober_control` (4, 7, 9) | `sentio_prober_control` (331, 346) | `interfaces.WPProberInterface` (8) | - |
| `WPAgent/globals/WPAagentGlobalParameters.py` | - | - | - | - |
| `WPAgent/interfaces/WPDbService.py` | - | - | `utilities.WPAgentTypes` (2) | - |
| `WPAgent/interfaces/WPProberInterface.py` | - | - | - | - |
| `WPAgent/main.py` | `fire` (2) | - | `WPAgent` (1) | - |
| `WPAgent/sequencer/WPSequencer.py` | - | - | `utilities.WPAgentLogger` (3) | - |
| `WPAgent/sequencer/WPSequencerYAML.py` | `yaml` (2) | - | `WPSequencer` (4): a top-level name; `WPAgent/` has no such module, so the import fails unless `sequencer/` is on the path (by the code) | - |
| `WPAgent/services/WPDbKafkaClient.py` | `confluent_kafka` (5, 6) | - | `utilities.WPAgentTypes` (12) | - |
| `WPAgent/services/WPHeartbeat.py` | `confluent_kafka` (26, 27) | - | `utilities.WPMachineName` (29) | `globals.WPAagentGlobalParameters` (129); `services.WPProberConnectionWatch` (130); `utilities.WPAgentLogger` (229) |
| `WPAgent/services/WPMachineRecord.py` | - | - | `globals.WPAagentGlobalParameters` (11) | `drivers.WPFactory` (28); `services.WPDbKafkaClient` (78); `utilities.WPAgentLogger` (98) |
| `WPAgent/services/WPProberConnectionWatch.py` | - | - | `utilities.WPAgentLogger` (36) | `actions.WPProjectActions` (311); `drivers.WPFactory` (56, 141, 188); `globals.WPAagentGlobalParameters` (49, 62, 88, 229, 289); `services.WPMachineRecord` (222, 299); `stateMachine.WpAgentStateMachine` (254, 290); `stateMachine.WpAgentStateMachineGlobals` (255, 291) |
| `WPAgent/stateMachine/StateHelpers.py` | - | - | `stateMachine.WpAgentStateMachine` (2); `utilities.WPResponseBuilder` (3) | - |
| `WPAgent/stateMachine/WpAgentStateMachine.py` | - | - | `utilities.WPCommandConstants` (2); `utilities.WPSequenceContext` (3) | `globals.WPAagentGlobalParameters` (200, 306) |
| `WPAgent/stateMachine/WpAgentStateMachineGlobals.py` | - | - | `stateMachine.WpAgentStateMachine` (1) | - |
| `WPAgent/utilities/WPAgentCache.py` | `confluent_kafka` (4) | - | `utilities.WPResponseBuilder` (6) | - |
| `WPAgent/utilities/WPAgentLogger.py` | `confluent_kafka` (5) | - | - | `globals.WPAagentGlobalParameters` (66) |
| `WPAgent/utilities/WPAgentTypes.py` | - | - | - | - |
| `WPAgent/utilities/WPCommandActivity.py` | - | - | - | - |
| `WPAgent/utilities/WPContacting.py` | - | - | - | - |
| `WPAgent/utilities/WPDieGrid.py` | - | - | `utilities.WPContacting` (25) | - |
| `WPAgent/utilities/WPDieMaps.py` | - | - | - | - |
| `WPAgent/utilities/WPHelpers.py` | - | - | `globals.WPAagentGlobalParameters` (1) | `drivers.WPFactory` (49, 92); `services.WPProberConnectionWatch` (93) |
| `WPAgent/utilities/WPImageStitching.py` | `cv2` (24); `numpy` (25) | - | - | `utilities.WPImageStitchingFull` (44), fallback `WPImageStitchingFull` (46) |
| `WPAgent/utilities/WPImageStitchingFull.py` | `cv2` (43); `numpy` (44) | `imagecodecs` (319); `scipy` (166); `tifffile` (316) | `utilities.WPImageStitching` (55), fallback `WPImageStitching` on `ImportError` (73) | - |
| `WPAgent/utilities/WPImagingConfig.py` | - | - | - | - |
| `WPAgent/utilities/WPInitProbingConfig.py` | - | - | - | - |
| `WPAgent/utilities/WPMapConverter.py` | - | - | - | - |
| `WPAgent/utilities/WPMessagesStatus.py` | - | - | - | - |
| `WPAgent/utilities/WPResponseBuilder.py` | - | - | `utilities.WPAgentTypes` (8); `utilities.WPMessagesStatus` (7) | `globals.WPAagentGlobalParameters` (19); `services.WPProberConnectionWatch` (20) |
| `WPAgent/utilities/WPSequenceContext.py` | - | - | - | - |
| `WPAgent/utilities/WPStateMachineDiagram.py` | - | - | `stateMachine.WpAgentStateMachine` (23); `utilities.WPCommandConstants` (24) | - |
| `WPAgent/utilities/WPTopography.py` | - | - | `utilities.WPContacting` (37) | - |
| `WPAgent/utilities/WPValidationDecorator.py` | - | - | `utilities.WPValidator` (3) | - |
| `WPAgent/utilities/WPValidator.py` | - | - | `globals.WPAagentGlobalParameters` (1); `utilities.WPAgentTypes` (4); `utilities.WPCommandConstants` (5); `utilities.WPMachineName` (7); `utilities.WPResponseBuilder` (2); `utilities.WPSequenceContext` (6) | - |
| `WPAgent/utilities/needle_mark/__init__.py` | - | - | `utilities.needle_mark.analysis` (19); `utilities.needle_mark.api` (20); `utilities.needle_mark.config` (21); `utilities.needle_mark.image` (22); `utilities.needle_mark.marks` (23); `utilities.needle_mark.pads` (24); `utilities.needle_mark.report` (25) | - |
| `WPAgent/utilities/needle_mark/__main__.py` | - | - | `utilities.needle_mark.api` (18); `utilities.needle_mark.config` (19) | - |
| `WPAgent/utilities/needle_mark/analysis.py` | `numpy` (16) | - | `utilities.needle_mark.config` (18); `utilities.needle_mark.image` (19); `utilities.needle_mark.marks` (20); `utilities.needle_mark.pads` (21) | - |
| `WPAgent/utilities/needle_mark/api.py` | - | - | `utilities.needle_mark.analysis` (22); `utilities.needle_mark.config` (23); `utilities.needle_mark.image` (24); `utilities.needle_mark.report` (25) | - |
| `WPAgent/utilities/needle_mark/config.py` | - | - | - | - |
| `WPAgent/utilities/needle_mark/image.py` | `cv2` (8); `numpy` (9) | `tifffile` (51) | `utilities.needle_mark.config` (11) | - |
| `WPAgent/utilities/needle_mark/marks.py` | `cv2` (36); `numpy` (37) | - | `utilities.needle_mark.config` (39); `utilities.needle_mark.pads` (40) | - |
| `WPAgent/utilities/needle_mark/pads.py` | `cv2` (21); `numpy` (22) | - | `utilities.needle_mark.config` (24) | - |
| `WPAgent/utilities/needle_mark/report.py` | `cv2` (10); `numpy` (11) | - | `utilities.needle_mark.analysis` (13); `utilities.needle_mark.image` (14); `utilities.needle_mark.marks` (15) | - |

Modules with no import at all: `WPAgent/actions/__init__.py`, `WPAgent/drivers/__init__.py`, `WPAgent/globals/__init__.py`, `WPAgent/interfaces/__init__.py`, `WPAgent/sequencer/__init__.py`, `WPAgent/services/__init__.py`, `WPAgent/stateMachine/__init__.py`, `WPAgent/utilities/__init__.py`, `WPAgent/utilities/WPCommandConstants.py`, `WPAgent/utilities/WPMachineName.py`.

Not imported by any module outside `tests/` (search for each name: not found): `sequencer/WPSequencer.py`, `sequencer/WPSequencerYAML.py`, `stateMachine/StateHelpers.py`, `utilities/WPStateMachineDiagram.py`, `interfaces/WPDbService.py`, `actions/WPMapConversionActions.py` (the linter says "not in COMMAND_ROUTER, not imported - dead code", `WPAgent/linters/CheckKafkaConventions.py`:35), `utilities/WPHelpers.ensure_prober_initialized`.

## E.3 The chain to `confluent_kafka` when `WPCmdMap.py` is imported

Modules that import `confluent_kafka` at module level: `WPKafkaClient.py`, `WPSender.py`, `services/WPDbKafkaClient.py`, `services/WPHeartbeat.py`, `utilities/WPAgentCache.py`, `utilities/WPAgentLogger.py` (E.1). Importing `WPCmdMap` loads two of them: `services.WPDbKafkaClient` and `utilities.WPAgentLogger`. It does not load `WPKafkaClient`, `WPHeartbeat`, `WPAgentCache` (stub run: they are not in the list of the 44 internal modules loaded).

Chain 1, the DB client:

- `WPCmdMap` (CM:1) -> `actions.WPProjectActions` (PA:5) -> `services.WPDbKafkaClient` (`WPDbKafkaClient.py`:5-6) -> `confluent_kafka`. This is the first one Python runs (stub run, first request of `confluent_kafka`: `WPCmdMap:1 -> actions.WPProjectActions:5 -> services.WPDbKafkaClient:5`).
- Same target through `WPCmdMap` (CM:5) -> `actions.WPDataBaseActions` (`WPDataBaseActions.py`:10), and `actions.WPProjectActions` (PA:6) -> `actions.WPDataBaseActions`.

Chain 2, the logger:

- `WPCmdMap` (CM:6) -> `utilities.WPAgentLogger` (`WPAgentLogger.py`:5) -> `confluent_kafka`.
- Same target through `WPCmdMap` (CM:17) -> `services.WPProberConnectionWatch` (CW:36); `WPCmdMap` (CM:10) -> `actions.WPLoginActions` (LA:9); `WPCmdMap` (CM:9) -> `actions.WPCommandActions` (`WPCommandActions.py`:2) -> `WPCommandHandler` (`WPCommandHandler.py`:1).

So two module-level lines carry the package into the command map: `services/WPDbKafkaClient.py`:5-6 and `utilities/WPAgentLogger.py`:5. The logger uses its producer only when `kafka_enabled` (`WPAgentLogger.py`:41-44), and that is `False` by default (`WPAgentLogger.py`:30) and no constructor call passes `kafka_enabled` (search `WPAgentLogger(`: CM:178, KC:25, LA:30, PA:484, 544, MR:100, CW:100, HB:230, `WPCommandHandler.py`:4, `sequencer/WPSequencer.py`:6).

At call time more modules pull it in, also when `WPCmdMap` is not imported (stub runs, `run_after.py`):

- `ProberFactory.get_current_prober()`: `drivers.WPFactory:152 -> services.WPProberConnectionWatch:36 -> utilities.WPAgentLogger:5`.
- `actions.WPTestingActions._ensure_initialized()`: `actions.WPTestingActions:19 -> utilities.WPHelpers:93 -> services.WPProberConnectionWatch:36 -> utilities.WPAgentLogger:5`.
- `ResponseBuilder.success()` (every reply): `utilities.WPResponseBuilder:20 -> services.WPProberConnectionWatch:36 -> utilities.WPAgentLogger:5`, and also `utilities.WPResponseBuilder:20 -> services.WPProberConnectionWatch:56 -> drivers.WPFactory:3 -> drivers.WPSentioProber:4 -> sentio_prober_control`.

Other third-party packages needed to import `WPCmdMap` (stub run): `sentio_prober_control` (`WPCmdMap:1 -> actions.WPProjectActions:2 -> drivers.WPFactory:3 -> drivers.WPSentioProber:4`) and `yaml` (`WPCmdMap:4 -> actions.WPSequencerActionsYAML:2`). The image packages are not needed at import time; they are imported inside the handlers (E.1).

## E.4 What can be reused as it is

Criterion: the module, and every module it imports, at module level and inside its functions, imports none of `confluent_kafka`, `services.WPDbKafkaClient`, `globals.WPAagentGlobalParameters` (the singleton that holds `userLogged` and `userLoggedHierarchy`, `WPAgent/globals/WPAagentGlobalParameters.py`:37-38, 352-355). Computed from the scan (a scan script (not kept), mode `clean`; importing a submodule also counts its parent packages).

Clean, also at call time:

| Module | Third-party it needs | Used by commands |
|---|---|---|
| `drivers/WPSentioProber.py`, `interfaces/WPProberInterface.py` | `sentio_prober_control` | every prober command |
| `drivers/WPMockProber.py` | none | every prober command on a mock |
| `utilities/WPMessagesStatus.py`, `utilities/WPAgentTypes.py` | none | the reply envelope |
| `utilities/WPCommandConstants.py`, `utilities/WPSequenceContext.py`, `utilities/WPMachineName.py`, `utilities/WPCommandActivity.py` | none | checks and routing |
| `utilities/WPDieMaps.py` | none | `MoveChuckRowColumn` with `label` (TA:489), `MoveChuckAsic` (TA:1564), the topography commands (`WPTopographyActions.py`:94) |
| `utilities/WPInitProbingConfig.py` | none | `InitProbing` |
| `utilities/WPImagingConfig.py` | none | imaging commands |
| `utilities/WPContacting.py`, `utilities/WPDieGrid.py`, `utilities/WPTopography.py` | none | contacting, precise die moves, topography |
| `utilities/WPMapConverter.py` | none | none (only the dead `WPMapConversionActions.py`) |
| `utilities/WPImageStitching.py`, `utilities/WPImageStitchingFull.py` | `cv2`, `numpy`; in functions `scipy`, `tifffile`, `imagecodecs` | `TakeImage`, `StitchImagesFull`, `BuildFlatfield` |
| `utilities/needle_mark/` (all modules) | `cv2`, `numpy`; in a function `tifffile` | `AnalyzeNeedleMarks` |

Clean at import time, not at call time (the line that pulls the rest in):

| Module | Pulls in, inside a function |
|---|---|
| `drivers/WPFactory.py` | CW in `get_current_prober` (FA:152) -> logger -> `confluent_kafka`; CW also uses the globals |
| `utilities/WPResponseBuilder.py` | the globals and CW in `_build_data` (RB:19-20) |
| `stateMachine/WpAgentStateMachine.py`, `stateMachine/WpAgentStateMachineGlobals.py` | the globals in `_sync_to_global_params` and `reset` (SM:200, 306); `reset` clears the login (SM:309-310) |

Not reusable as they are (they import the globals at module level, or the DB client, or the logger): every `actions/*.py` that is routed, `WPCmdMap.py`, `utilities/WPValidator.py` and `utilities/WPValidationDecorator.py` (`WPValidator.py`:1), `utilities/WPHelpers.py` (`WPHelpers.py`:1), `utilities/WPAgentLogger.py`, `utilities/WPAgentCache.py`, all of `services/`, `WPKafkaClient.py`, `WPAgent.py`, `main.py`.

`actions/WPTestingActions.py` imports at module level `drivers.WPFactory`, the globals, the state machine, `WPDieMaps`, `WPResponseBuilder`, `WPValidationDecorator` (TA:1-8). With stubs it imports without `confluent_kafka` (stub run). But its READY check pulls the package in through `WPHelpers` (E.3), and its handlers read the globals.

## E.5 Heavy or platform-specific packages, and the commands that need them

| Package | Why heavy or special | Commands that need it |
|---|---|---|
| `sentio_prober_control` | The SENTIO library; not in the export. Imported at module level by the driver, and the factory imports the driver at module level (FA:3) | Every command, because importing `WPCmdMap` or any action module loads it (E.3). Directly: `GetChuckXY`, `MoveChuckXYPrecise`, `GenerateRasterSteps` (IA:36, 127, 502) |
| `confluent_kafka` | Binds the C library librdkafka (`WPAgent/Dockerfile`:13-14) | Every command at import time through `WPCmdMap` (E.3); used for real only by the listener, the DB client and the heartbeat |
| `opencv-python` (`cv2`) | Native library; the Docker image installs `libgl1` and `libglib2.0-0` for it (`WPAgent/Dockerfile`:11-19) | `TakeImage` (IA:900), `StitchImagesFull` (IA:617), `BuildFlatfield` (IA:741), `AnalyzeNeedleMarks` (`WPContactingActions.py`:213), and the built-in sequences whose steps call them (`inventory-B.md`) |
| `numpy`, `scipy`, `tifffile`, `imagecodecs`, `Pillow` | Native extensions | `CropImage` (IA:670-671, 722), `BuildFlatfield` (`WPImageStitchingFull.py`:166), stitching (`WPImageStitchingFull.py`:316-319), needle marks (`needle_mark/image.py`:51) |
| `pyyaml` | Small | Needed to import `WPCmdMap` (CM:4). Used by `RunSequencerYAML` and the 16 built-in sequences (CM:110-125, 153-157) |
| `PyVISA` | Listed, never imported by WPAgent (E.1) | none found. In `ITS3TestAgent/` it is the oscilloscope transport (`oscilloscope/scopes/instrument.py`:36, 74) |

None of the 18 commands of the ITS3 script needs an image package: their handlers are in `WPTestingActions.py`, `WPProjectActions.py`, `WPLoginActions.py` and, for `MoveChuckXYPrecise`, `WPImagingActions.py`:88-259, which imports only `sentio_prober_control` (IA:127). The image imports of `WPImagingActions.py` are all inside other functions (E.1).

## E.6 Python version

- Pinned to 3.12: `FROM python:3.12-slim` (`WPAgent/Dockerfile`:7), `python3.12` in the entry point and health check (`Dockerfile`:41, 43), `python3.12 -m venv` (`WPAgent/WPAgent.sh`:21). The README says "Python 3.12 or higher" (`WPAgent/README.md`:166).
- Lowest version by the syntax: 3.10. `int | None` in a `TypedDict` body is evaluated when the class is made (`WPAgent/utilities/WPAgentTypes.py`:92, 98). Test: importing `WPCmdMap` with Python 3.9.0 fails with `TypeError: unsupported operand type(s) for |: 'type' and 'NoneType'`; with 3.15.2 it works (`import_chain.py`).
- Nothing newer than 3.10 was found: `ast.parse(..., feature_version=(3, 10))` and `(3, 11)` accept every module, and no f-string reuses its own quote inside a field (a 3.12 feature) (a check script, not kept, run on `WPAgent/` and `ITS3TestAgent/`). `feature_version` is a best-effort check, so this is not a proof.
- Other 3.9 features in use: `str.removesuffix` (TA:44), `executor.shutdown(cancel_futures=True)` (KC:525).
- `ITS3TestAgent/its3_test_agent.py` uses `from __future__ import annotations` (IT:18), so its `X | None` annotations are not evaluated.

## E.7 Windows

Checks run on `WPAgent/` except `tests/` and `linters/`: search for `subprocess`, `os.system`, `shell=True`, `os.fork`, `os.geteuid`, `os.getuid`, `fcntl`, `termios`, `pwd`, `os.chmod`, `os.symlink`, `signal.`, and for string paths starting with `/home`, `/data`, `/tmp`, `/eos`, `/usr`, `/var`, `/opt`, `/mnt` or `C:\\`.

- **No POSIX-only call** in the modules a command needs. The only hits: `signal.signal(signal.SIGTERM, ...)` in the Kafka listener (KC:46-60). Python on Windows accepts a `SIGTERM` handler, and the code also catches `ValueError` (KC:56-57). A tool without the listener does not load it.
- **The SENTIO driver knows Windows.** TCP keepalive has a `win32` branch (SP:32-38). `select.select` on the socket and `MSG_PEEK` (SP:52-55) work with sockets on Windows.
- **Hard-coded paths.**
  - `C:\ProgramData\MPI Corporation\SENTIO\projects\` (`WPAgent/globals/WPAagentGlobalParameters.py`:11, 77-78). It is joined with `os.path.join` (PA:176; TA:1147, 1196). `OpenProject` sends only the bare name to SENTIO and uses the path for the reply text (`inventory-A.md` command 16). On Windows the join gives a normal path.
  - `/eos/project/a/aliceits3/ITS3-WP3/MOSAIX/prober_imaging`, the default target of `ArchiveImaging` (IA:757). Not used by the ITS3 commands.
- **No path built with `/` by hand** (search for f-strings and `+` with `/`: only display texts such as `{n}/{total}`).
- **Paths relative to the working directory.** `WPAgentLogger.log` (`WPAgentLogger.py`:28, 51), `WPAgent.cache.json` (`WPAgent/utilities/WPAgentCache.py`:21), `configs/ProbeConfig*.json` (AG:173), `sequencer/*.yaml` of the built-in sequences (CM:110-125), `Contacting/` (`WPAgent/utilities/WPContacting.py`:25), `Imaging/` (IA:66), `screenshotsSVT` (SP:393). A tool must run with `WPAgent/` as the working directory, or set these paths. Paths built from `__file__` work from anywhere: `WPUserHierarchy.json` (LA:14-15), `WPDieMaps.py`:27, `WPInitProbingConfig.py`:15, `WPImagingConfig.py`:15, `WPContacting.py`:114, the help list (PA:574-575), `needle_mark/api.py`:27.
- **File encodings.** The JSON files read without an `encoding` argument are pure ASCII (`configs/*.json`, `utilities/WPCommandsHelpList.json`: 0 bytes above 127). The YAML files with non-ASCII bytes (for example `sequencer/TakeImageWafer_ER2.yaml`: 780) are read as UTF-8 (`actions/WPSequencerActionsYAML.py`:14). So reading data files does not depend on the Windows code page.
- **Console output with emoji.** 15 modules print emoji on one line with `print(` (search): `drivers/WPFactory.py`, `WPCmdMap.py`, `actions/` `WPContactingActions.py`, `WPDataBaseActions.py`, `WPDieGridActions.py`, `WPImagingActions.py`, `WPProjectActions.py`, `WPSequencerActions.py`, `WPSequencerActionsYAML.py`, `WPTestingActions.py`, `WPTopographyActions.py`, and `services/WPDbKafkaClient.py`, `utilities/WPDieMaps.py`, `utilities/WPMapConverter.py`, `utilities/WPValidator.py`. Prints that span lines were not counted. Examples: `✅ Prober initialized` at every connect (FA:116), `🔓` after an error (CM:203), `📐` before the first move of `MoveChuckXYPrecise` (IA:157), `🔍` and `✅` in the orientation check (VA:630, 664). Test on this PC with Python 3.9.0: with stdout redirected to a file, `sys.stdout.encoding` is `cp1252` and `print('✅ ...')` raises `UnicodeEncodeError` (exit code 1). Python 3.15.2 runs in UTF-8 mode by default (`sys.flags.utf8_mode` = 1). Python 3.12 was not available to test. When the tool's output goes to a pipe or a file (for example when another program starts it, or over a remote shell), such a print would raise. Inside a handler the `except` turns it into an error reply and usually the `Error` state (`inventory-A.md` rule 0.5). The orientation check prints in the validator, before the handler (VA:630), so the exception reaches `execute_command`: `UnhandledErrorReply` 500 and the `Error` state (CM:314-326). Some prints come after a SENTIO action: FA:115 keeps the new connection before the print at FA:116, so `Initialize` would report `Failed to create prober` with the connection open (PA:53-56; by the code).
- **Deployment files are Linux-only**: `WPAgent/WPAgent.sh` (bash, `md5sum`, `venv/bin/python`, lines 1-41), `WPAgent/WPagent.service` (systemd, `/data/SVTSoftware/...`, lines 1-22), the Docker image (`Dockerfile`:7-19). The production listener of `WPMIT` runs as this system service (`WPAgent/README.md`:224; `WPagent.service`:12). So today WPAgent runs on Linux and reaches SENTIO over TCP (D.3).
- **Two clients of SENTIO.** A Windows tool next to SENTIO and the Linux service would each open their own TCP connection to the same SENTIO port (D.3, SP:14). Whether SENTIO accepts a second remote client while the first is connected is not in the code or the export.
