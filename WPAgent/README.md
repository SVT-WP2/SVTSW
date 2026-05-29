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
├── main.py                          # CLI entry point
├── WPAgent.py                       # Main producer API
├── WPKafkaClient.py                 # Kafka communication layer
├── WPCmdMap.py                      # Command routing (COMMAND_ROUTER)
├── WPCommandHandler.py              # Command execution and dispatch
│
├── stateMachine/
│   ├── WpAgentStateMachine.py       # FSM states, transitions, logic
│   └── WpAgentStateMachineGlobals.py  # Singleton FSM instance
│
├── actions/                         # Command handlers (Consumer side)
│   ├── WPLoginActions.py            # UserLogIn / UserLogOut
│   ├── WPProjectActions.py          # Initialize, OpenProject, Help, ResetAgent
│   ├── WPTestingActions.py          # Movement, probing, alignment commands
│   ├── WPSequencerActions.py        # Sequencer commands
│   └── WPDataBaseActions.py         # Database queries
│
├── drivers/                         # Hardware drivers
│   ├── WPProberInterface.py         # Abstract interface
│   ├── WPSentioProber.py            # SENTIO implementation
│   └── WPFactory.py                 # Driver factory
│
├── services/
│   ├── WPKafkaDbService.py          # Database Kafka service
│   └── WPListenerHeartbeat.py       # Health monitoring
│
├── globals/
│   └── WPAagentGlobalParameters.py  # Global state: user, state, project, chuck
│
├── utilities/
│   ├── WPResponseBuilder.py         # Standard response format builder
│   └── WPAgentLogger.py             # Logging
│
├── configs/
│   └── WPUserHierarchy.json         # User → hierarchy level mapping
│
└── tests/
    └── unit/
        ├── conftest.py
        ├── test_fsm.py
        ├── test_login_actions.py
        └── test_testing_actions.py
```

---

## 📦 Installation

### Prerequisites

- Python 3.12 or higher
- Apache Kafka cluster (accessible)
- SENTIO prober control software (for hardware control)
- Network access to prober equipment

### Install Dependencies

```bash
cd WPAgent
pip install confluent-kafka fire sentio-prober-control
```
### Install Dependencies for DEV

```bash
cd WPAgent
pip install confluent-kafka fire sentio-prober-control pytest pytest-cov flake8 pylint mypy black
```
---

## 🚀 Quick Start

### 1. Start the Listener (Consumer side — runs on the hardware machine)

The listener takes a **config name** that tells it which Kafka broker and prober to connect to. Configs are defined in `configs/WPProbesConfigs.json`.

```bash
# Production (Kafka on svmithi02:9093)
python3.12 main.py listen CERN

# Developer / staging (Kafka on svmithi02:9096)
python3.12 main.py listen CERN_DEV

# Mock prober — for local testing without hardware
python3.12 main.py listen MOCK
```

> **Note:** The `CERN` production listener is normally run as a system service and does not need to be started manually. Use `CERN_DEV` for development and testing.


### 2. Send Commands (Producer side — runs anywhere with Kafka access)

All commands follow this pattern:

```bash
python3.12 main.py send <CommandName> --data='{"user":"<user>","waferAgentName":"<agent>", ...}'
```

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

### Named Probe Configs — `configs/WPProbesConfigs.json`

This is the primary config file. Each entry maps a config name to a Kafka broker, prober address, and machine type. The config name is passed as the argument to `python3.12 main.py listen <name>`.

```json
{
  "CERN": {
    "machineId": 1,
    "address": "wpmit01.cern.ch",
    "port": 35555,
    "machineType": "sentio",
    "description": "CERN DSF Probe Station",
    "kafka_broker": "svmithi02:9093"
  },
  "CERN_DEV": {
    "machineId": 1,
    "address": "wpmit01.cern.ch",
    "port": 35555,
    "machineType": "sentio",
    "description": "CERN DSF Probe Station",
    "kafka_broker": "svmithi02:9096"
  },
  "MOCK": {
    "machineId": 167,
    "address": "mock-prober",
    "port": 35555,
    "machineType": "mock",
    "description": "Mock Probe Station for Testing"
  }
}
```

| Config | Kafka Broker | Purpose |
|--------|-------------|---------|
| `CERN` | `svmithi02:9093` | **Production** — normally runs as a system service |
| `CERN_DEV` | `svmithi02:9096` | **Development / staging** — use for testing |
| `MOCK` | — | Local testing without real hardware |

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
- MPI Corporation for SENTIO prober platform
- Apache Kafka community

---

**Organization**: SVT SW Core Team  
**Project**: SVT Wafer Prober Agent
