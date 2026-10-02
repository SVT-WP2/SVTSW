# Wafer Prober Agent (WP Agent)

> **A Kafka-based agent system for remote control and automation of wafer probing equipment**

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [State Machine](#-state-machine)
- [Available Commands](#-available-commands)
- [Configuration](#-configuration)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Overview

The **Wafer Prober Agent** is a distributed system that enables remote control and automation of wafer probing equipment (SENTIO probers) through Apache Kafka messaging. It provides a clean separation between command producers (users/scripts) and consumers (hardware controllers), enabling safe, scalable, and auditable hardware operations.

### Key Capabilities

- ✅ **Remote Control**: Command wafer probers from anywhere via Kafka
- ✅ **State Machine**: FSM enforces safe operation sequences and prevents conflicting commands
- ✅ **User Hierarchy**: Developer / Operator / User access levels with login/logout control
- ✅ **Database Integration**: Machine lookup and configuration via DB Kafka service
- ✅ **Health Monitoring**: Built-in heartbeat and health checks
- ✅ **Comprehensive Logging**: Full audit trail of operations
- ✅ **Project Management**: Open SENTIO project files
- ✅ **PTPA Support**: Pattern-to-pad alignment with state tracking

---

## 🏗 Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    PRODUCER (User Side)                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  CLI: python3.12 main.py send <Command> --data='{...}' │  │
│  └─────────────────────┬──────────────────────────────────┘  │
│                        │                                     │
│  ┌─────────────────────▼────────────────────────────────┐    │
│  │  WaferProberAgent                                    │    │
│  │  - Send commands with unique request IDs             │    │
│  │  - Check listener health via heartbeat               │    │
│  │  - Wait for responses with timeout                   │    │
│  └─────────────────────┬────────────────────────────────┘    │
└────────────────────────┼─────────────────────────────────────┘
                         │
                    ┌────▼──────────────────────┐
                    │  Kafka Topics             │
                    │  - svt.wp-agent.request   │
                    │  - svt.wp-agent.reply     │
                    │  - svt.wp-agent.heartbeat │
                    └────┬──────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────────┐
│                    CONSUMER (Hardware Side)                 │
│  ┌─────────────────────▼────────────────────────────────┐   │
│  │  Kafka Listener                                      │   │
│  │  - Receives commands, routes to handlers             │   │
│  │  - Publishes heartbeats every 5 seconds              │   │
│  └─────────────────────┬────────────────────────────────┘   │
│                        │                                    │
│  ┌─────────────────────▼────────────────────────────────┐   │
│  │  State Machine (FSM)                                 │   │
│  │  - Validates every command against current state     │   │
│  │  - Enforces safe operation sequences                 │   │
│  └─────────────────────┬────────────────────────────────┘   │
│                        │                                    │
│  ┌─────────────────────▼────────────────────────────────┐   │
│  │  Command Handlers (Actions)                          │   │
│  │  - Execute validated commands                        │   │
│  │  - Manage global state and parameters                │   │
│  │  - Control hardware via drivers                      │   │
│  └─────────────────────┬────────────────────────────────┘   │
│                        │                                    │
│  ┌─────────────────────▼────────────────────────────────┐   │
│  │  Hardware Drivers                                    │   │
│  │  - SENTIO prober interface                           │   │
│  │  - Direct hardware control                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
WPAgent/
├── main.py                          # CLI entry point (fire.Fire over WaferProberAgent)
├── WPAgent.py                       # WaferProberAgent — send/listen, config + DB resolution
├── WPKafkaClient.py                 # Kafka communication layer (command req/reply)
├── WPCmdMap.py                      # Command routing (COMMAND_ROUTER)
├── WPCommandHandler.py              # Command execution and dispatch
├── WPSender.py                      # Standalone Kafka sender CLI (alternative to main.py send)
│
├── stateMachine/
│   ├── WpAgentStateMachine.py       # FSM states, transitions, logic
│   ├── WpAgentStateMachineGlobals.py  # Singleton FSM instance
│   └── StateHelpers.py
│
├── actions/                         # Command handlers (Consumer side)
│   ├── WPLoginActions.py            # UserLogIn / UserLogOut
│   ├── WPProjectActions.py          # Initialize, OpenProject, Help, ResetAgent
│   ├── WPTestingActions.py          # Movement, probing, alignment, PTPA, FindHome
│   ├── WPCommandActions.py
│   ├── WPSequencerActions.py / WPSequencerActionsYAML.py
│   ├── WPImagingActions.py / WPMapConversionActions.py
│   └── WPDataBaseActions.py         # Database queries (machine/project lookups)
│
├── interfaces/
│   ├── WPProberInterface.py         # Abstract prober interface
│   └── WPDbService.py               # Abstract DB service interface
│
├── drivers/                         # Hardware drivers
│   ├── WPSentioProber.py            # SENTIO implementation
│   ├── WPMockProber.py              # Mock prober, used by MOCK configs / tests
│   └── WPFactory.py                 # Driver factory
│
├── services/
│   ├── WPDbKafkaClient.py           # Kafka client for DB Agent communication
│   ├── WPHeartbeat.py               # Listener heartbeat / health monitoring
│   └── WPInitializationService.py   # DB-driven + manual prober initialization
│
├── sequencer/
│   ├── WPSequencer.py
│   └── WPSequencerYAML.py
│
├── globals/
│   └── WPAagentGlobalParameters.py  # Global state: user, state, project, chuck, wpAgentName
│
├── utilities/
│   ├── WPResponseBuilder.py         # Standard response format builder
│   ├── WPAgentLogger.py             # Logging
│   ├── WPValidator.py / WPValidationDecorator.py
│   └── WPAgentTypes.py / WPCommandConstants.py / WPHelpers.py / WPMapConverter.py / ...
│
├── linters/                         # Static checks over the actions/ codebase
│   ├── CheckContracts.py            # Flags COMMAND_ROUTER functions with missing/invalid returns
│   └── CheckKafkaConventions.py
│
├── configs/
│   ├── ProbeConfig*.json            # Per-machine/env configs — {"name", "kafka_broker"}, see Configuration
│   ├── WPUserHierarchy.json         # User → hierarchy level mapping
│   ├── WPMapConversion.json
│   └── WPProbesConfigs.json         # Legacy, no longer read by the code (see Configuration)
│
└── tests/                           # pytest suite — FSM, login/testing actions, mock prober, etc.
    └── conftest.py
```

---

## 📦 Installation

### Prerequisites

- Python 3.12 or higher
- Apache Kafka cluster (accessible)
- SENTIO prober control software (for hardware control)
- Network access to prober equipment

## Install Dependencies

All required Python packages and their versions are listed in `requirements.txt`.

Use the setup script to automatically install all dependencies:

```bash
cd WPAgent
./WPAgent.sh
```

The script will:

* Create and configure the Python environment
* Install all required dependencies from `requirements.txt`

---
## 🚀 Quick Start

### 1. Start the Listener (Consumer side — runs on the hardware machine)

The listener takes a **path to a config file** that tells it which machine to connect to and which Kafka broker to use. Config files live in `configs/ProbeConfig*.json` (see [Configuration](#️-configuration) below).

```bash
# Command to run WPAgent 
python3.12 main.py listen  --config=<path to config file >

```
Example of config file:
```json
{
  "name": "WPMIT",
  "kafka_broker": "pcmitpx01:9096"
}
```
`name` is the machine name as registered in the database — the listener uses it to look up the rest of the machine's connection details (address, port, machine type, machine ID) from the DB Agent at startup. If the DB lookup fails, it falls back to whatever is in the config file.

Note: Depending on which Kafka broker is specified in the config file, WPAgent will run in either development or production mode (see the `_DEV` suffix note in [Configuration](#️-configuration)).

> **Note:** On the CERN side, the `WPMIT` machine's production listener (`ProbeConfigCERN.json`, broker `pcmitpx01:9092`) runs as a system service and does not need to be started manually. Only start the listener yourself for development/testing (e.g. against `ProbeConfigCERN_DEV.json` / MOCK configs).


### 2. Send Commands (Producer side — runs anywhere with Kafka access)

All commands follow this pattern:

```bash
python3.12 main.py send <CommandName> --data='{"user":"<user>","waferAgentName":"<agent>", ...}'
```

**Alternative: `WPSender.py`.** Instead of `main.py send`, you can also use the standalone `WPSender.py` script — same command/`--data` pattern, but it talks to Kafka directly rather than going through `WaferProberAgent`/the `configs/ProbeConfig*.json` files. It resolves the broker port itself from `waferAgentName` (`WPMIT` → `9092`, `WPMIT_DEV` → `9096`, host `pcmitpx01`), so it works without a local config file:

```bash
python3.12 WPSender.py <CommandName> --data='{"user":"<user>","waferAgentName":"<agent>", ...}'

# e.g.
python3.12 WPSender.py UserLogIn --data='{"user":"user1","waferAgentName":"WPMIT_DEV"}'
```

Use `--port` to override the auto-detected port, and `--no-reply` for fire-and-forget.

### 3. Minimal Happy Path

```bash
# 1. Log in
python3.12 main.py send UserLogIn --data='{"user":"user1","waferAgentName":"CERN"}'

# 2. Open project
python3.12 main.py send OpenProject --data='{"user":"user1","waferAgentName":"CERN","projectName":"MyProject"}'

# 3. Align wafer
python3.12 main.py send AlignWafer --data='{"user":"user1","waferAgentName":"CERN"}'

# 4. Move to first die and contact
python3.12 main.py send MoveChuckAsic --data='{"user":"user1","waferAgentName":"CERN","asicId":1}'
python3.12 main.py send MoveChuckContact --data='{"user":"user1","waferAgentName":"CERN"}'

# 5. Lock, test, unlock
python3.12 main.py send TestingLock --data='{"user":"user1","waferAgentName":"CERN","reason":"IV sweep"}'
python3.12 main.py send TestingUnlock --data='{"user":"user1","waferAgentName":"CERN"}'

# 6. Log out
python3.12 main.py send UserLogOut --data='{"user":"user1","waferAgentName":"CERN"}'
```

---

## 🔄 State Machine

Every command (except bypass commands) is validated against the current FSM state before execution. Invalid commands are rejected with an error response — the state does not change.

### States

| State | Description |
|-------|-------------|
| `ServiceOn` | Initial state, no user logged in |
| `UserLogged` | User authenticated, wafer loaded but no project open |
| `OpenedProject` | Project open, ready for alignment |
| `Aligned` | Wafer aligned, ready for die navigation |
| `ChuckSafePosition` | Chuck at safe position |
| `ChuckUnloaded` | Chuck in unloaded position |
| `Unloaded` | Wafer unloaded |
| `OnDie_OffAxis_withoutPTPA` | On die, off-axis view, no PTPA done |
| `OnDie_OffAxis_withPTPA` | On die, off-axis view, PTPA completed |
| `OnDie_Wide_withPTPA` | On die, wide view, PTPA valid |
| `OnDie_Wide_withoutPTPA` | On die, wide view, PTPA not valid |
| `OnDie_Wide` | On die, wide view (after separation) |
| `AtContact` | Probes in contact with die |
| `AtContact_Locked` | Contact + testing lock active |
| `Error` | Error state — only `ResetAgent` allowed |
| `UsedByDeveloper` | Developer mode — all commands allowed |

### Bypass Commands (work in any state)

`UserLogIn`, `UserLogOut`, `Help`, `AutoFocus`

### State Transition Map

```
ServiceOn ──[UserLogIn]──► UserLogged
                               │
                    [OpenProject]▼
                          OpenedProject
                               │
                    [AlignWafer / InitProbing]▼
                             Aligned
                          ┌────┴────┐
           [MoveChuckAsic]▼         ▼[MoveChuckNextDie/PreviousDie/RowColumn]
         OnDie_Wide_withPTPA    OnDie_OffAxis_withoutPTPA
                │                       │
  [MoveChuckNextDie]▼        [RunPTPA]  ▼
     OnDie_Wide_withoutPTPA  OnDie_OffAxis_withPTPA
                │
   [MoveChuckContact]▼
            AtContact
                │
    [TestingLock]▼
         AtContact_Locked
                │
   [TestingUnlock]▼
            AtContact
                │
  [MoveChuckSeparation]▼
            OnDie_Wide

Any state ──[Error command / exception]──► Error
Error ──[ResetAgent]──► UserLogged
```

---

## 📋 Available Commands

### Authentication

| Command | Key Parameters | Description |
|---------|---------------|-------------|
| `UserLogIn` | `user` | Log in; Developer → `UsedByDeveloper`, others → `UserLogged` |
| `UserLogOut` | `user` | Log out and reset FSM to `ServiceOn` |

```bash
python3.12 main.py send UserLogIn  --data='{"user":"user1","waferAgentName":"CERN"}'
python3.12 main.py send UserLogOut --data='{"user":"user1","waferAgentName":"CERN"}'
```

### Project & Initialization

| Command | Key Parameters | Description |
|---------|---------------|-------------|
| `ConnectProbeMachine` | `wpMachineId` | Connect to a prober by its DB machine ID |
| `Initialize` | `address`, `machineType` | Connect to prober manually (no DB) |
| `OpenProject` | `projectName` | Open a SENTIO project file |
| `ChangeProject` | `projectName` | Swap active project (stays in `OpenedProject`) |
| `ShowStatus` | — | Show connection and project status |
| `Help` | `command` (optional) | Show all commands or help for one command |
| `GetAgentState` | — | Return current FSM state name |

```bash
python3.12 main.py send ConnectProbeMachine --data='{"user":"dev1","waferAgentName":"CERN","wpMachineId":3}'
python3.12 main.py send OpenProject  --data='{"user":"user1","waferAgentName":"CERN","projectName":"NKF7_Test"}'
python3.12 main.py send Help
python3.12 main.py send Help --data='{"command":"MoveChuckContact"}'
```

### Wafer Handling

| Command | Key Parameters | Description |
|---------|---------------|-------------|
| `LoadWafer` | `waferId`, `orientation` | Load wafer; transitions to `UserLogged` |
| `UnloadWafer` | — | Unload wafer; transitions to `Unloaded` |
| `MoveChuckLoadedWafer` | — | Move chuck to loaded-wafer position |
| `MoveChuckUnloadWafer` | — | Move chuck to unload position |
| `AlignWafer` | `align_die_col`, `align_die_row` (optional) | Align wafer; transitions to `Aligned` |
| `InitProbing` | — | Initialize probing sequence; transitions to `Aligned` |

```bash
python3.12 main.py send LoadWafer   --data='{"user":"user1","waferAgentName":"CERN","waferId":42,"orientation":"flat_down"}'
python3.12 main.py send AlignWafer  --data='{"user":"user1","waferAgentName":"CERN"}'
python3.12 main.py send UnloadWafer --data='{"user":"user1","waferAgentName":"CERN"}'
```

### Chuck Movement

| Command | Key Parameters | Description |
|---------|---------------|-------------|
| `MoveChuckAsic` | `asicId`, `subsite` | Move to ASIC by ID → `OnDie_Wide_withPTPA` |
| `MoveChuckRowColumn` | `col`, `row`, `label`, `subsite` | Move to die by row/col or label |
| `MoveChuckNextDie` | — | Step to next die |
| `MoveChuckPreviousDie` | — | Step to previous die |
| `MoveChuckContact` | — | Move probes to contact → `AtContact` |
| `MoveChuckSeparation` | — | Lift probes → `OnDie_Wide` |
| `MoveChuckWide` | — | Move to wide view |
| `MoveChuckOffAxis` | — | Move to off-axis view |
| `MoveChuckSafePosition` | — | Move chuck to safe position |
| `MoveChuckCenter` | — | Center chuck (Developer only) |
| `MoveChuckHome` | — | Move to home position (Developer only) |
| `MoveChuckToWorkArea` | `work_area` | Move to work area (Developer only) |
| `MoveChuckXY` | `x`, `y`, `position` | Free XY movement (Developer only) |
| `MoveChuckZ` | `z` | Free Z movement (Developer only) |

```bash
python3.12 main.py send MoveChuckAsic       --data='{"user":"user1","waferAgentName":"CERN","asicId":1,"subsite":0}'
python3.12 main.py send MoveChuckRowColumn  --data='{"user":"user1","waferAgentName":"CERN","col":3,"row":2,"subsite":0}'
python3.12 main.py send MoveChuckNextDie    --data='{"user":"user1","waferAgentName":"CERN"}'
python3.12 main.py send MoveChuckContact    --data='{"user":"user1","waferAgentName":"CERN"}'
python3.12 main.py send MoveChuckSeparation --data='{"user":"user1","waferAgentName":"CERN"}'
```

### Alignment & Vision

| Command | Key Parameters | Description |
|---------|---------------|-------------|
| `RunPTPA` | — | Run Pattern-to-Pad Alignment → `OnDie_OffAxis_withPTPA` |
| `AutoFocus` | — | Auto-focus camera (bypass command — works in any state) |
| `FindHome` | — | Move to stored home die position |
| `SwitchCamera` | `mountPoint` | Switch active camera (Developer only) |
| `TakeScreenshot` | `fileName`, `snapshot_type`, `outputDir` | Save camera image (Developer only) |

```bash
python3.12 main.py send RunPTPA    --data='{"user":"user1","waferAgentName":"CERN"}'
python3.12 main.py send AutoFocus  --data='{"user":"user1","waferAgentName":"CERN"}'
python3.12 main.py send TakeScreenshot --data='{"user":"dev1","waferAgentName":"CERN","fileName":"before_test"}'
```

> **Position/correction logging:** `RunPTPA` and `FindHome` both read chuck X, Y, and contact height immediately before and after they run, and print the before/after values plus the resulting ΔX/ΔY/ΔContactHeight (or ΔZ for `FindHome`) to the console — useful for seeing exactly what correction a run applied. This is diagnostic console output only; it does not change the commands' reply message (`"PTPA executed"` / `"Found home position"`, matching the API contract in `svt.wp-agent.yaml`). If `RunPTPA` fails with `"PTPA failed: ...offset exceeds tolerance..."`, that's SENTIO's own PTPA Tolerance Gap check (configured on the SENTIO Setup page) rejecting a detected correction that's larger than the allowed limit — it's not a WPAgent error, and the before/after console output is the best way to see which axis and by how much it was over.

### Testing

| Command | Key Parameters | Description |
|---------|---------------|-------------|
| `TestingLock` | `reason`, `testSequenceId` | Lock agent for testing → `AtContact_Locked` |
| `TestingUnlock` | `force` | Unlock agent → `AtContact` |
| `SetOvertravel` | `overtravelGap` | Set chuck overtravel gap (Developer only) |
| `DisableOvertravel` | — | Disable overtravel (Developer only) |

```bash
python3.12 main.py send TestingLock   --data='{"user":"user1","waferAgentName":"CERN","reason":"IV sweep","testSequenceId":"seq_001"}'
python3.12 main.py send TestingUnlock --data='{"user":"user1","waferAgentName":"CERN"}'
```

### System & Recovery

| Command | Key Parameters | Description |
|---------|---------------|-------------|
| `ResetAgent` | — | Recover from `Error` state → `UserLogged` |
| `LocalMode` | — | Set prober to local mode (Developer only) |
| `ListAvailableCommands` | — | List all registered commands |
| `ListProbers` | — | List all probe machines from database |
| `ListChipTypes` | — | List chip types from database |

```bash
python3.12 main.py send ResetAgent --data='{"user":"user1","waferAgentName":"CERN"}'
python3.12 main.py send ListProbers
```

---

## ⚙️ Configuration

### Probe Configs — `configs/ProbeConfig*.json`

Each probe/environment has its own small config file under `configs/`, named `ProbeConfig<Something>.json`. A config file only needs two fields:

```json
{
  "name": "WPMIT",
  "kafka_broker": "pcmitpx01:9096"
}
```

* **`name`** — the machine name as registered in the database. It is *not* a free-form label: the listener passes it to the DB Agent (`GetAllWaferProbeMachines`) to resolve the machine's real `address`, `port`, `machineType` and `machineId`. The sender side also matches on this name (via the *effective* name — see below) to find the right config file and Kafka broker for `--waferAgentName=...`.
* **`kafka_broker`** — which Kafka broker/environment this config talks to.

Current configs on disk:

| File | `name` | `kafka_broker` | Purpose |
|------|--------|-----------------|---------|
| `ProbeConfigCERN.json` | `WPMIT` | `pcmitpx01:9092` | **Production** — runs as a system service on the CERN side |
| `ProbeConfigCERN_DEV.json` | `WPMIT` | `pcmitpx01:9096` | **Development / staging** — same machine, DEV broker |
| `ProbeConfigMOCK.json` | `MOCK` | `pcmitpx01:9096` | Mock prober, DEV broker |
| `ProbeConfigLocalMOCK.json` | `MOCK` | `localhost:9085` | Mock prober, fully local Kafka |

**`_DEV` suffix:** any config whose `kafka_broker` equals the DEV broker (`pcmitpx01:9096`) automatically gets `_DEV` appended to its effective agent name — e.g. `ProbeConfigCERN_DEV.json` (`name: "WPMIT"`, DEV broker) is addressed as `WPMIT_DEV` in commands, while `ProbeConfigCERN.json` (same `name`, production broker) is addressed as `WPMIT`. This is why `waferAgentName` in the examples above shows values like `CERN`/`CERN_DEV` — use whichever effective name matches the config you started the listener with. The DB lookup itself always uses the plain `name` field (e.g. `WPMIT`), not the `_DEV`-suffixed name.

> Note: an older `configs/WPProbesConfigs.json` file (a single JSON file with nested `machineId`/`address`/`port` per machine) still exists in the repo but is no longer read by the code — machine connection details now come from the database, keyed by the config file's `name` field.

### SSH Tunnel (remote Kafka access)

If you're sending commands from a machine outside the CERN network, create an SSH tunnel first:


```bash
ssh -L 9092:localhost:9096 -L 9096:localhost:9096 user@remote-server
```

### User Hierarchy

Edit `configs/WPUserHierarchy.json` to define which users are Developers, Operators, or Users:

```json
{
  "Developer": ["dev1", "dev2"],
  "Expert": ["operator1"],
  "User": ["user1", "user2"]
}
```

Developers enter `UsedByDeveloper` state on login — all commands are allowed and FSM restrictions are bypassed.

---

## 📡 Response Format

All commands return a standard response:

```json
{
  "status": "Success",
  "type": "CommandNameReply",
  "data": {
    "output": "Human readable message",
    "...": "additional fields depending on command"
  },
  "error": null
}
```

On error:

```json
{
  "status": "Error",
  "type": "CommandNameReply",
  "data": {},
  "error": {
    "code": 400,
    "message": "Description of what went wrong"
  }
}
```

---

## 🛠 Development

### Adding a New Command

**1. Implement the action function** (in the appropriate `actions/` file):

```python
# actions/WPTestingActions.py
@validate_command
def my_new_command(param1: str, param2: int = 0, user=None, waferAgentName=None) -> dict:
    """Brief description."""
    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MyNewCommandReply", error["output"], 400)

    try:
        prober = get_current_prober()
        # ... do work ...
        agentStateMachine.transition("MyNewCommand")
        return ResponseBuilder.success("MyNewCommandReply", f"Done: {param1}")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MyNewCommandReply", str(e), 500)
```

**2. Register in `WPCmdMap.py`:**

```python
COMMAND_ROUTER = {
    ...
    "MyNewCommand": testing_actions.my_new_command,
}
```

**3. Add FSM transition** (if the command changes state) in `WpAgentStateMachine.py`:

```python
WPAgentState.SomeState: {
    "MyNewCommand": WPAgentState.SomeOtherState,
    ...
}
```

**4. Add a test** in `tests/unit/test_fsm.py`.

### Running Tests

```bash
cd WPAgent
python3.12 -m pytest tests/unit/ -v
```

---

## 🔧 Troubleshooting

### Listener not responding

```
⚠️  WARNING: No listener detected!
```

Start the listener: `python3.12 main.py listen`

### Command rejected (FSM)

```
❌ Error: Command 'MoveChuckContact' not allowed in state 'Aligned'
```

You are calling a command that is not valid from the current FSM state. Check the State Transition Map above and make sure you follow the correct sequence (e.g. you must `MoveChuckAsic` or navigate to a die before `MoveChuckContact`).

### Kafka connection failed

- Verify Kafka is running: `systemctl status kafka` or check your Kafka cluster
- Check broker address in config
- If using remote Kafka, confirm your SSH tunnel is up

### DB reply timeout / "No projects found or database agent not responding"

If a DB-backed command (`OpenProject`, `ListProbers`, machine/project lookups, etc.) intermittently times out waiting on a reply from the DB Agent, this used to be caused by the DB reply consumer (`services/WPDbKafkaClient.py`) being a `subscribe()`-based Kafka consumer-group member that only got polled while a request was actively in flight. Any idle gap longer than `max.poll.interval.ms` between DB requests silently dropped it from its consumer group, and the next request would fail immediately with a Kafka `_MAX_POLL_EXCEEDED` error. Both `WPDbKafkaClient.py` and `WPKafkaClient.py`'s reply consumers now use `assign()` to a specific partition instead of `subscribe()`, so they never join a consumer group and can't be dropped for sitting idle. If you still see this, check that the listener log shows `"manual assign, offset=..."` at startup — if it instead shows the old subscribe-based init log, the listener needs restarting to pick up the fix.

### Prober not initializing

- Verify SENTIO software is running on the prober machine
- Check IP address and port: `ping <prober-host>` if needed 


### Error state recovery

If the agent enters `Error` state:

```bash
python3.12 main.py send ResetAgent --data='{"user":"user1","waferAgentName":"CERN"}'
```

This returns the FSM to `UserLogged` so normal operations can resume.

---


---

## 🙏 Acknowledgments

- SVT SW Core Team

---

**Organization**: SVT SW Core Team  
**Project**: SVT Wafer Prober Agent
