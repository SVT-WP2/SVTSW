# Wafer Prober Agent (WP Agent)

> **A Kafka-based agent system for remote control and automation of wafer probing equipment **

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Usage](#-usage)
- [Available Commands](#-available-commands)
- [Configuration](#-configuration)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

---

## 🎯 Overview

The **Wafer Prober Agent** is a distributed system that enables remote control and automation of wafer probing equipment (SENTIO probers) through Apache Kafka messaging. It provides a clean separation between command producers (users/scripts) and consumers (hardware controllers), enabling safe, scalable, and auditable hardware operations.

### Key Capabilities

-  **Remote Control**: Command wafer probers from anywhere via Kafka
-  **Producer-Consumer Pattern**: Clean separation of concerns
-  **Database Integration**: Query and manage prober configurations
-  **State Management**: Track agent and equipment status
-  **Health Monitoring**: Built-in heartbeat and health checks
-  **Comprehensive Logging**: Full audit trail of operations


### Use Cases

- Sensor testing and characterization
- Automated wafer probing workflows
- Remote equipment control and monitoring

---

## Features

### Core Features

- ✅ **Kafka-based Communication**: Reliable, asynchronous message passing
- ✅ **Multiple Prober Support**: SENTIO and other platforms
- ✅ **Database Integration**: PostgreSQL via Kafka DB service
- ✅ **State Machine**: Prevent conflicting operations
- ✅ **Heartbeat System**: Monitor listener health in real-time
- ✅ **Producer-Side Logic**: Interactive operations happen where the user is
- ✅ **Non-Interactive Listener**: Can run as daemon/service
- ✅ **Command Validation**: Type checking and parameter validation
- ✅ **Error Handling**: Comprehensive error reporting and recovery

### Command Categories

1. **Initialization**: Setup and configure prober connections
2. **Movement**: Chuck positioning and navigation
3. **Testing**: Execute test sequences and collect data
4. **Project Management**: Load and manage test projects
5. **Database**: Query and manage equipment configurations
6. **Sequencer**: Automated multi-step operations

---

## Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    PRODUCER (User Side)                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  CLI / Python API / Web Interface                      │  │
│  │  - Parse commands                                      │  │
│  │  - Interactive prompts (database selection, etc.)     │  │
│  │  - Validate parameters                                 │  │
│  └─────────────────────┬────────────────────────────────┘  │
│                        │                                     │
│  ┌─────────────────────▼────────────────────────────────┐  │
│  │  WaferProberAgent                                     │  │
│  │  - Send commands                                      │  │
│  │  - Check listener health                              │  │
│  │  - Wait for responses                                 │  │
│  └─────────────────────┬────────────────────────────────┘  │
└────────────────────────┼────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │  Kafka  │
                    │         │
                    └────┬────┘
                         │
┌────────────────────────┼────────────────────────────────────┐
│                    CONSUMER (Hardware Side)                 │
│  ┌─────────────────────▼────────────────────────────────┐   │
│  │  Kafka Client (Listener)                             │   │
│  │  - Receive commands                                  │   │
│  │  - Route to handlers                                 │   │
│  │  - Send replies                                      │   │
│  └─────────────────────┬────────────────────────────────┘   │
│                        │                                    │
│  ┌─────────────────────▼────────────────────────────────┐   │
│  │  Command Handlers (Actions)                          │   │
│  │  - Execute commands                                  │   │
│  │  - Manage state                                      │   │
│  │  - Control hardware                                  │   │
│  └─────────────────────┬────────────────────────────────┘   │
│                        │                                    │
│  ┌─────────────────────▼────────────────────────────────┐   │
│  │  Hardware Drivers                                    │   │
│  │  - SENTIO prober interface                           │   │
│  │  - Direct hardware control                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Overview

```
WPAgent/
├── wafer_prober_agent.py       # Main API - Producer side
├── kafka_client.py              # Kafka communication layer
├── cmd_map.py                   # Command routing
├── command_handler.py           # Command execution
│
├── actions/                     # Command handlers (Consumer side)
│   ├── WPProjectActions.py     # Initialization commands
│   ├── WPTestingActions.py     # Testing commands
│   ├── WPSequencerActions.py   # Sequencer commands
│   └── WPDataBaseActions.py    # Database queries
│
├── drivers/                     # Hardware drivers
│   ├── prober_interface.py     # Abstract interface
│   ├── sentio_prober.py        # SENTIO implementation
│   └── factory.py              # Driver factory
│
├── services/                    # Services
│   ├── WPInitializationService.py  # Producer-side init logic
│   ├── kafka_db_service.py     # Database service
│   └── listener_heartbeat.py   # Health monitoring
│
├── globals/                     # Global state
│   └── svtWPAagentGlobalParameters.py
│
└── WPAgentUtilities/           # Utilities
    ├── WPAgentLogger.py        # Logging
    └── WPHelpers.py            # Helper functions
```

---

## Installation

### Prerequisites

- Python 3.12 or higher
- Apache Kafka cluster (accessible)
- SENTIO prober control software (for hardware control)
- Network access to prober equipment

### Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd WPAgent
```

### Configuration

1. **Kafka Configuration**

Edit `kafka_client.py` or set environment variables:

```bash
export KAFKA_BOOTSTRAP_SERVERS="localhost:9092"
export KAFKA_REQUEST_TOPIC="wp.agent.requests"
export KAFKA_RESPONSE_TOPIC="wp.agent.responses"
```

2. **Database Configuration** (if using database features For now its DE version)

```bash
export DB_KAFKA_BROKER="localhost:9095"
```

---

## Quick Start

### 1. Start the Listener (Consumer)

In one terminal, start the listener that will execute commands:

```bash
python3.12 main.py listen
```

Output:
```
🎧 Starting WP Agent Listener...
📡 Connected to Kafka at localhost:9092
✅ Listener is running and waiting for commands...
💓 Sending heartbeat every 5 seconds
```

### 2. Send Commands (Producer)

In another terminal, send commands to the listener:

```bash

# Initialize from database (interactive)
python3.12 main.py send Initialize with_db=true

# Initialize manually
python3.12 main.py send Initialize address=wpmit01.cern.ch:35555 machine_type=sentio

# Move chuck to position
python3.12 main.py send MoveChuckXY x=1000 y=2000

# Find chuck home position
python3.12 main.py send FindHome
```

### 3. Using Python API

```python
from wafer_prober_agent import WaferProberAgent

# Create agent
agent = WaferProberAgent()

# Initialize prober from database (interactive)
from services.WPInitializationService import WPInitializationService
init_service = WPInitializationService(agent)
result = init_service.initialize_from_database()

# Or initialize manually
result = agent.send("Initialize", {
    "address": "wpmit01.cern.ch:35555",
    "machine_type": "sentio"
})

# Move chuck
result = agent.send("MoveChuckXY", {"x": 1000, "y": 2000})
print(result["output"])

# Check status
if result["status"] == "success":
    print("✅ Command succeeded!")
else:
    print(f"❌ Command failed: {result['output']}")
```

---

## 📖 Usage

### Command Line Interface

```bash
python3.12 main.py <action> [options]
```

**Actions:**

- `listen` - Start the listener (consumer)
- `send <command> [params]` - Send a command to listener


**Examples:**

```bash
# Start listener
python3.12 main.py listen

# Initialize prober
python3.12 main.py send Initialize with_db=true
python3.12 main.py send Initialize address=host:port machine_type=sentio

# Movement commands
python3.12 main.py send FindHome
python3.12 main.py send MoveChuckXY x=100 y=200
python3.12 main.py send MoveChuckContact

# Testing commands
python3.12 main.py send RunPTPA
python3.12 main.py send StepNextDie
python3.12 main.py send Load

```

### Python API

#### Basic Usage

```python
from wafer_prober_agent import WaferProberAgent

agent = WaferProberAgent()

# Send command and wait for response
result = agent.send("MoveChuckXY", {"x": 100, "y": 200})

# Send without waiting (fire and forget)
agent.send_async("LogMessage", {"message": "Test"})

# Send with custom timeout
result = agent.send("LongCommand", params={}, timeout=60.0)

# Check listener health
is_alive = agent.check_listener_health()
```

#### Advanced Usage

```python
# Wait for listener to come online
agent.wait_for_listener(max_wait=30.0)

# Send command without health check (faster)
result = agent.send_force("QuickCommand")

# Repeat command multiple times
result = agent.send("Test", params={}, repeat=5, delay=1.0)
```

#### Using Initialization Service

```python
from wafer_prober_agent import WaferProberAgent
from initialization_service import WPInitializationService

agent = WaferProberAgent()
init_service = WPInitializationService(agent)

# Interactive database initialization
result = init_service.initialize_from_database()

# Automated by machine ID
result = init_service.initialize_by_id(machine_id="123")

# Automated by machine name
result = init_service.initialize_by_name(machine_name="SENTIO Prober 1")

# Manual initialization
result = init_service.initialize_manual(
    address="wpmit01.cern.ch:35555",
    machine_type="sentio"
)

```

---

## Available Commands

### Initialization Commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `Initialize` | `address`, `machine_type`, `with_db` | Initialize prober connection |
| `InitializeTestingProject` | Same as Initialize | Alias for Initialize |

**Example:**
```bash
# Database-driven (interactive)
python main.py send Initialize with_db=true

# Manual
python main.py send Initialize address=wpmit01.cern.ch:35555 machine_type=sentio
```

### Movement Commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `FindHome` | - | Move chuck to home position |
| `MoveChuckXY` | `x`, `y` | Move chuck to coordinates (µm) |
| `MoveChuckContact` | - | Move chuck to contact position |
| `MoveChuckSeparation` | - | Move chuck to separation position |

**Example:**
```bash
python3.12 main.py send MoveChuckXY x=1000 y=2000
python3.12 main.py send FindHome
```

### Testing Commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `RunPTPA` | - | Run Pattern to Pad Alignment |
| `StepNextDie` | - | Step to next die |
| `StepFirstDie` | - | Step to first die |
| `Load` | - | Load wafer |
| `Unload` | - | Unload wafer |

**Example:**
```bash
python3.12 main.py send Load
python3.12 main.py send RunPTPA
python3.12 main.py send StepNextDie
```

### Project Commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `LoadProject` | `project_path` | Load a test project |
| `GetProjectInfo` | - | Get current project information |

### Database Commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `ListProbers` | - | List all wafer probe machines |

**Example:**
```bash
python3.12 main.py send ListProbers
```

### Sequencer Commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `RunSequence` | `sequence_name` | Execute a test sequence |
| `StopSequence` | - | Stop current sequence |

---

##  Configuration

### Kafka Configuration

Edit `kafka_client.py` or set environment variables:

```python
# Default configuration
KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"
KAFKA_REQUEST_TOPIC = "svt.wp-agent.request"
KAFKA_RESPONSE_TOPIC = "svt.wp-agent.reply"
KAFKA_HEARTBEAT_TOPIC = "svt.wp-agent.heartbeat"
```

### Database Configuration

Edit `kafka_db_service.py`:

```python
# Database Kafka broker
DB_BROKER = "localhost:9095"
DB_REQUEST_TOPIC = "svt.db-agent.request"
DB_RESPONSE_TOPIC = "svt.db-agent.request.reply"
```

### Logging Configuration

Edit `WPAgentLogger.py`:

```python
# Log level
LOG_LEVEL = "INFO"  # DEBUG, INFO, WARNING, ERROR

# Log file
LOG_FILE = "wp_agent.log"
```

---

## Development

### Adding New Commands

1. **Define the action** in appropriate actions file:

```python
# actions/WPTestingActions.py
def my_new_command(param1, param2):
    """
    My new command description.
    
    Args:
        param1: First parameter
        param2: Second parameter
        
    Returns:
        dict: Status result
    """
    # Implementation
    return {"status": "success", "output": "Command executed"}
```

2. **Register in cmd_map.py**:

```python
COMMAND_MAP = {
    # ... existing commands ...
    "MyNewCommand": ("WPTestingActions", "my_new_command"),
}
```

3. **Use it**:

```bash
python main.py send MyNewCommand param1=value1 param2=value2
```


---

## Troubleshooting

### Common Issues

#### 1. Listener Not Responding

**Symptoms:**
```
⚠️  WARNING: No listener detected!
```

**Solutions:**
- Start listener: `python3.12 main.py listen`
- Check Kafka connection
- Verify topics exist

#### 2. Kafka Connection Failed

**Symptoms:**
```
❌ Failed to connect to Kafka broker
```

**Solutions:**
- Check Kafka is running
- Verify broker address
- Check network connectivity
- Verify topics exist

#### 3. Database Service Not Available

**Symptoms:**
```
❌ Database agent not responding
```

**Solutions:**
- Check DB agent is running
- Verify DB Kafka broker configuration
- Use manual initialization as fallback

#### 4. Python Import Errors (Python 3.12)

**Symptoms:**
```
TypeError: unsupported operand type(s) for |
```

**Solution:**
- Use Python 3.12+: `python3.12 --version`
- Use updated `cmd_map.py` with Python 3.12 compatibility

#### 5. Prober Not Initializing

**Symptoms:**
```
❌ Failed to initialize prober
```

**Solutions:**
- Verify prober address and port
- Check SENTIO software is running
- Check network connectivity
- Verify machine_type is correct

### Debug Mode

Enable debug logging in `WPAgentLogger.py`:

```python
LOG_LEVEL = "DEBUG"
```

---

## Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Commit changes: `git commit -m "Add my feature"`
7. Push to branch: `git push origin feature/my-feature`
8. Open a Pull Request

### Development Guidelines

- Follow PEP 8 style guide
- Add docstrings to all functions
- Write unit tests for new code
- Update documentation

---

## License



---

## Acknowledgments

- SVT SW Core Team

---

## Contact

- **Organization**: SVT
- **Project**: 

---

<div align="center">

**[⬆ Back to Top](#-wafer-prober-agent-wp-agent)**

Made with ❤️ at CERN | Powered by ...

</div>