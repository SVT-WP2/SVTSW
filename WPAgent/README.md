# Wafer Prober Agent (WP Agent)

> **A Kafka-based agent system for remote control and automation of wafer probing equipment**

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
- [API Documentation](#-api-documentation)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

---

## 🎯 Overview

The **Wafer Prober Agent** is a distributed system that enables remote control and automation of wafer probing equipment (SENTIO probers) through Apache Kafka messaging. It provides a clean separation between command producers (users/scripts) and consumers (hardware controllers), enabling safe, scalable, and auditable hardware operations.

### Key Capabilities

- ✅ **Remote Control**: Command wafer probers from anywhere via Kafka
- ✅ **Producer-Consumer Pattern**: Clean separation of concerns
- ✅ **Database Integration**: Interactive machine selection and configuration
- ✅ **State Management**: Track agent and equipment status
- ✅ **Health Monitoring**: Built-in heartbeat and health checks
- ✅ **Comprehensive Logging**: Full audit trail of operations
- ✅ **Die Position Storage**: Automatic alignment and home die tracking
- ✅ **Project Management**: Open and manage SENTIO project files
- ✅ **Optimized Messaging**: Unique consumer groups for fast responses

### Use Cases

- Sensor testing and characterization
- Automated wafer probing workflows
- Remote equipment control and monitoring
- Multi-prober orchestration

---

## ✨ Features

### Core Features

- ✅ **Kafka-based Communication**: Reliable, asynchronous message passing
- ✅ **Multiple Prober Support**: SENTIO and other platforms
- ✅ **Database Integration**: PostgreSQL via Kafka DB service with interactive selection
- ✅ **State Machine**: Prevent conflicting operations
- ✅ **Heartbeat System**: Monitor listener health in real-time
- ✅ **Producer-Side Logic**: Interactive operations happen where the user is
- ✅ **Non-Interactive Listener**: Can run as daemon/service
- ✅ **Command Validation**: Type checking and parameter validation
- ✅ **Error Handling**: Comprehensive error reporting and recovery
- ✅ **Unique Consumer Groups**: Fast message delivery without rebalancing delays
- ✅ **Die Position Tracking**: Stores alignment_die and home_die for automated operations

### Command Categories

1. **Setup & Initialization**: Initialize connections with database or manual configuration
2. **Wafer Handling**: Load/unload wafers with automated positioning
3. **Movement**: Chuck positioning and navigation with micrometer precision
4. **Positioning**: Go to specific dies, step through die patterns
5. **Probe Control**: Contact/separation movements
6. **Vision**: Camera control and status monitoring
7. **Alignment**: Pattern-to-pad alignment (PTPA), wafer alignment
8. **Testing**: Execute test sequences and collect data
9. **Status**: Project status, camera status, listener health
10. **System**: Help, heartbeat monitoring
11. **Database**: Query prober configurations
12. **Automation**: Multi-step sequencing

---

## 🏗 Architecture


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
│  │  - Send commands with unique request IDs             │  │
│  │  - Check listener health via heartbeat               │  │
│  │  - Wait for responses with timeout                   │  │
│  │  - Handle consumer group management                  │  │
│  └─────────────────────┬────────────────────────────────┘  │
└────────────────────────┼────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │  Kafka  │
                    │  Topics │
                    │  - svt.wp-agent.request                │
                    │  - svt.wp-agent.reply                  │
                    │  - svt.wp-agent.heartbeat              │
                    └────┬────┘
                         │
┌────────────────────────┼────────────────────────────────────┐
│                    CONSUMER (Hardware Side)                 │
│  ┌─────────────────────▼────────────────────────────────┐   │
│  │  Kafka Client (Listener)                             │   │
│  │  - Receive commands with static consumer group       │   │
│  │  - Route to handlers                                 │   │
│  │  - Send replies with metadata                        │   │
│  │  - Publish heartbeats every 5 seconds               │   │
│  └─────────────────────┬────────────────────────────────┘   │
│                        │                                    │
│  ┌─────────────────────▼────────────────────────────────┐   │
│  │  Command Handlers (Actions)                          │   │
│  │  - Execute commands                                  │   │
│  │  - Manage state (Idle/Busy/Error/Failed)           │   │
│  │  - Store die positions and project info             │   │
│  │  - Control hardware via drivers                      │   │
│  └─────────────────────┬────────────────────────────────┘   │
│                        │                                    │
│  ┌─────────────────────▼────────────────────────────────┐   │
│  │  Hardware Drivers                                    │   │
│  │  - SENTIO prober interface                           │   │
│  │  - Direct hardware control                           │   │
│  │  - Vision system integration                         │   │
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
│   ├── WPProjectActions.py     # Initialization & project commands
│   ├── WPTestingActions.py     # Testing & movement commands
│   ├── WPSequencerActions.py   # Sequencer commands
│   └── WPDataBaseActions.py    # Database queries
│
├── drivers/                     # Hardware drivers
│   ├── prober_interface.py     # Abstract interface
│   ├── sentio_prober.py        # SENTIO implementation
│   └── factory.py              # Driver factory
│
├── services/                    # Services
│   ├── WPInitializationService.py  # Producer-side init with DB selection
│   ├── kafka_db_service.py     # Database service with unique consumer groups
│   └── listener_heartbeat.py   # Health monitoring
│
├── globals/                     # Global state
│   └── svtWPAagentGlobalParameters.py  # Stores die positions, state
│
└── WPAgentUtilities/           # Utilities
    ├── WPAgentLogger.py        # Logging with file and console output
    ├── WPHelpers.py            # Helper functions
    └── commands_help.json      # Command help documentation
```

---

## 📦 Installation

### Prerequisites

- Python 3.12 or higher
- Apache Kafka cluster (accessible)
- SENTIO prober control software (for hardware control)
- Network access to prober equipment
- PostgreSQL database (optional, for database features)

### Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd WPAgent

# Install Python dependencies
pip install confluent-kafka fire
```

### Configuration

#### 1. Kafka Configuration

Edit `kafka_client.py` or set environment variables:

```bash
export KAFKA_BOOTSTRAP_SERVERS="localhost:9092"
export KAFKA_REQUEST_TOPIC="svt.wp-agent.request"
export KAFKA_REPLY_TOPIC="svt.wp-agent.reply"
export KAFKA_HEARTBEAT_TOPIC="svt.wp-agent.heartbeat"
```

#### 2. Database Configuration (Optional)

For database-driven initialization:

```bash
export DB_KAFKA_BROKER="localhost:9095"
export DB_REQUEST_TOPIC="svt.db-agent.request"
export DB_REPLY_TOPIC="svt.db-agent.request.reply"
```

#### 3. Kafka SSH Tunnel (Optional)

For remote Kafka access:

```bash
# In a separate terminal, create SSH tunnel
ssh -L 9092:localhost:9092 -L 9095:localhost:9095 user@remote-server

# Then configure as localhost
export KAFKA_BOOTSTRAP_SERVERS="localhost:9092"
```

---

## 🚀 Quick Start

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
# Get help
python3.12 main.py send Help

# Initialize from database (interactive)
python3.12 main.py send Initialize with_db=true

# Initialize manually
python3.12 main.py send Initialize --params='{"address":"wpmit01.cern.ch:35555","machine_type":"sentio"}'

# Check status
python3.12 main.py send ShowProjectStatus

# Move chuck to position
python3.12 main.py send MoveChuckXY --params='{"x":155560.9,"y":-238764.7}'

# Find chuck home position
python3.12 main.py send FindHome
```

### 3. Using Python API

```python
from WPAgent import WaferProberAgent

# Create agent
agent = WaferProberAgent()

# Initialize prober from database (interactive)
from services.WPInitializationService import WPInitializationService

init_service = WPInitializationService(agent)
result = init_service.initialize_from_database()

# Or initialize manually
result = agent.send("Initialize", {
    "address": "WPMIT01.cern.ch:35555",
    "machine_type": "sentio",
    "project_name": "MyProject",
    "alignment_die": "2,2,0",
    "home_die": "5,2,0"
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

# Get help
python3.12 main.py send Help

# Initialize prober (database)
python3.12 main.py send Initialize with_db=true
# Initialize prober (manual)
python3.12 main.py send Initialize --params='{"address":"wpmit01.cern.ch:35555","machine_type":"sentio"}'

# Movement commands
python3.12 main.py send FindHome
python3.12 main.py send MoveChuckXY --params='{"x":155560.9,"y":-238764.7}'
python3.12 main.py send MoveChuckZ z=50
python3.12 main.py send MoveChuckContact
python3.12 main.py send MoveChuckSeparation

# Positioning commands
python3.12 main.py send GoToDie --params='{"col":2,"row":2}'
python3.12 main.py send StepNextDie
python3.12 main.py send StepFirstDie

# Testing commands
python3.12 main.py send Load
python3.12 main.py send RunPTPA
python3.12 main.py send AlignWafer
python3.12 main.py send Unload

# Vision commands
python3.12 main.py send SwitchCamera mount_point=scope
python3.12 main.py send GetCameraStatus

# Status commands
python3.12 main.py send ShowProjectStatus
```

### Python API

#### Basic Usage

```python
from WPAgent import WaferProberAgent

agent = WaferProberAgent()

# Send command and wait for response
result = agent.send("MoveChuckXY", {"x": 100, "y": 200})

# Check result
if result["status"] == "success":
    print(f"✅ {result['output']}")
else:
    print(f"❌ {result['output']}")
```

#### Advanced Usage with Error Handling

```python
from WPAgent import WaferProberAgent

agent = WaferProberAgent()

try:
    # Initialize
    result = agent.send("Initialize", {
        "address": "WPMIT01.cern.ch:35555",
        "machine_type": "sentio"
    })

    if result["status"] != "success":
        raise Exception(f"Initialization failed: {result['output']}")

    # Load wafer
    result = agent.send("Load")

    # Run alignment
    result = agent.send("RunPTPA")

    # Move to first die
    result = agent.send("StepFirstDie")

except Exception as e:
    print(f"Error: {e}")
```

#### Database Initialization

```python
from WPAgent import WaferProberAgent
from services.WPInitializationService import WPInitializationService

agent = WaferProberAgent()
init_service = WPInitializationService(agent)

# Interactive database initialization
# User will be prompted to select:
# 1. Prober machine
# 2. ASIC family
# 3. Orientation
# 4. Project file
result = init_service.initialize_from_database()

# Automated by machine ID
result = init_service.initialize_by_id(machine_id="123")

# Automated by machine name
result = init_service.initialize_by_name(machine_name="WPMIT01")
```

---

## 📋 Available Commands

### Setup & Initialization

| Command | Parameters | Description |
|---------|-----------|-------------|
| `Initialize` | `address`, `machine_type`, `with_db`, `project_name`, `alignment_die`, `home_die` | Initialize prober connection |
| `OpenProject` | `path`, `alignment_die`, `home_die` | Open a SENTIO project file |
| `ShowProjectStatus` | - | Show current connection and project status |
| `Help` | - | Display all available commands with parameters |

**Example:**
```bash
# Database-driven (interactive - prompts for prober/ASIC/orientation/project)
python main.py send Initialize with_db=true

# Manual with project and die positions
python main.py send Initialize address=WPMIT01.cern.ch:35555 machine_type=sentio project_name=NKF7_Test alignment_die=2,2,0 home_die=5,2,0

# Open project with die positions
python main.py send OpenProject path=NKF7_Test alignment_die=2,2,0 home_die=5,2,0
```

### Wafer Handling

| Command | Parameters | Description |
|---------|-----------|-------------|
| `Load` | - | Load wafer onto chuck |
| `Unload` | - | Unload wafer from chuck |

### Movement Commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `FindHome` | - | Move chuck to stored home_die position |
| `MoveChuckXY` | `x`, `y` | Move chuck to coordinates (µm) |
| `MoveChuckZ` | `z` | Move chuck Z-axis (µm) |
| `MoveChuckContact` | - | Move chuck to contact position |
| `MoveChuckSeparation` | - | Move chuck to separation position |

**Example:**
```bash
python3.12 main.py send MoveChuckXY x=1000 y=2000
python3.12 main.py send MoveChuckZ z=50
python3.12 main.py send FindHome  # Uses stored home_die position
```

### Positioning Commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `GoToDie` | `col`, `row`, `subsite` | Move to specific die coordinates |
| `StepNextDie` | - | Step to next die in pattern |
| `StepFirstDie` | - | Move to first die in pattern |

**Example:**
```bash
python3.12 main.py send GoToDie col=5 row=3 subsite=0
python3.12 main.py send StepNextDie
```

### Vision Commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `SwitchCamera` | `mount_point` | Switch active camera (scope/chuck/aux) |
| `GetCameraStatus` | - | Get current camera information and vision properties |

**Example:**
```bash
python3.12 main.py send SwitchCamera mount_point=scope
python3.12 main.py send GetCameraStatus
```

### Alignment & Testing Commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `RunPTPA` | - | Run Pattern to Pad Alignment |
| `AlignWafer` | - | Run wafer alignment using stored alignment_die |

**Example:**
```bash
python3.12 main.py send Load
python3.12 main.py send RunPTPA
python3.12 main.py send AlignWafer  # Uses stored alignment_die position
```

### Database Commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `ListProbers` | - | List all wafer probe machines from database |

**Example:**
```bash
python3.12 main.py send ListProbers
```

---

## ⚙️ Configuration

### Kafka Configuration

Edit `kafka_client.py` or set environment variables:

```python
# Default configuration
KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"
KAFKA_REQUEST_TOPIC = "svt.wp-agent.request"
KAFKA_REPLY_TOPIC = "svt.wp-agent.reply"
KAFKA_HEARTBEAT_TOPIC = "svt.wp-agent.heartbeat"
CONSUMER_GROUP_ID = "wp-agent-listener"  # Static for listener
```

### Database Kafka Configuration

Edit `kafka_db_service.py`:

```python
# Database Kafka broker
DB_BROKER = "localhost:9095"
DB_REQUEST_TOPIC = "svt.db-agent.request"
DB_RESPONSE_TOPIC = "svt.db-agent.request.reply"
# Consumer groups are unique (UUID) to avoid rebalancing delays
```

### Logging Configuration

Edit `WPAgentLogger.py`:

```python
# Log level
LOG_LEVEL = "INFO"  # DEBUG, INFO, WARNING, ERROR

# Log file
LOG_FILE = "wp_agent.log"

# Console output
CONSOLE_LOGGING = True
```

### Timeout Configuration

Edit `wafer_prober_agent.py`:

```python
# Command timeout (seconds)
DEFAULT_TIMEOUT = 30

# Listener check timeout
LISTENER_CHECK_TIMEOUT = 5

# Heartbeat interval
HEARTBEAT_INTERVAL = 5
```

---

## 📚 API Documentation

### Message Format

#### Request Format (What users send)

```json
{
  "type": "CommandName",
  "params": {
    "key": "value"
  }
}
```

The `kafka_client` automatically adds:
- `request_id`: Unique UUID for tracking
- `sent_at`: Timestamp
- `reply_to`: Reply topic

#### Response Format (What kafka_client returns)

```json
{
  "type": "CommandReply",
  "request_id": "abc-123-uuid",
  "command": "CommandName",
  "status": "success",
  "output": "Human readable message",
  "execution_time_ms": 123.45,
  "timestamp": 1733155200.123
}
```

Some commands also include:
```json
{
  "data": {
    "structured": "information"
  }
}
```

### Swagger/OpenAPI Documentation

A complete Swagger/OpenAPI 3.0 specification is available with:
- Full request/response examples for all 28 commands
- Error response examples
- Parameter descriptions
- Status codes

See `swagger_FINAL_CLEAN.yaml` for the complete API specification.

**Load in Swagger UI:**
1. Go to https://editor.swagger.io/
2. Import `swagger_FINAL_CLEAN.yaml`
3. Browse all commands and examples

---

## 🛠 Development

### Adding New Commands

1. **Define the action** in appropriate actions file:

```python
# actions/WPTestingActions.py
def my_new_command(param1: str, param2: int, address=None, machine_type=None):
    """
    My new command description.
    
    Args:
        param1: First parameter
        param2: Second parameter
        address: Prober address (auto-injected)
        machine_type: Machine type (auto-injected)
        
    Returns:
        dict: {"status": "success|error", "output": "message"}
    """
    try:
        # Implementation
        result = do_something(param1, param2)
        return {
            "status": "success",
            "output": f"Command executed: {result}"
        }
    except Exception as e:
        return {
            "status": "error",
            "output": f"Error: {str(e)}"
        }
```

2. **Register in cmd_map.py**:

```python
COMMAND_MAP = {
    # ... existing commands ...
    "MyNewCommand": ("WPTestingActions", "my_new_command"),
}
```

3. **Add to commands_help.json**:

```json
{
  "MyNewCommand": {
    "description": "My new command description",
    "parameters": {
      "param1": "string - First parameter",
      "param2": "int - Second parameter"
    },
    "example": "python main.py send MyNewCommand param1=value1 param2=42"
  }
}
```

4. **Use it**:

```bash
python main.py send MyNewCommand param1=value1 param2=42
```

### Testing

```bash
# Test initialization
python main.py send Initialize address=test:35555 machine_type=sentio

# Test movement
python main.py send MoveChuckXY x=0 y=0

# Test with debugging
export LOG_LEVEL=DEBUG
python main.py listen
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Listener Not Responding

**Symptoms:**
```
⚠️  WARNING: No listener detected!
```

**Solutions:**
- Start listener: `python3.12 main.py listen`
- Check Kafka connection
- Verify topics exist: `kafka-topics --list`
- Check heartbeat topic for activity

#### 2. Kafka Connection Failed

**Symptoms:**
```
❌ Failed to connect to Kafka broker
```

**Solutions:**
- Check Kafka is running: `systemctl status kafka`
- Verify broker address in configuration
- Check network connectivity: `telnet localhost 9092`
- Verify topics exist and are accessible

#### 3. Database Service Not Available

**Symptoms:**
```
❌ Database agent not responding
⏱️  Timeout waiting for database response
```

**Solutions:**
- Check DB agent is running
- Verify DB Kafka broker configuration (`localhost:9095`)
- Check consumer group conflicts
- Use manual initialization as fallback:
  ```bash
  python main.py send Initialize address=WPMIT01.cern.ch:35555 machine_type=sentio
  ```

#### 4. Slow Response Times / Timeouts

**Symptoms:**
```
⏱️  Waiting for response... (90+ seconds)
```

**Root Cause:** Consumer group rebalancing delays

**Solutions:**
- ✅ **Already Fixed**: Unique consumer group IDs implemented
- Verify `kafka_db_service.py` uses UUID consumer groups
- Check for orphaned consumer groups: `kafka-consumer-groups --list`
- Delete old consumer groups if needed

#### 5. Python Version Errors

**Symptoms:**
```
TypeError: unsupported operand type(s) for |
```

**Solution:**
- Use Python 3.12+: `python3.12 --version`
- Union types (`str | None`) require Python 3.10+

#### 6. Prober Not Initializing

**Symptoms:**
```
❌ Failed to initialize prober
```

**Solutions:**
- Verify prober address and port: `ping WPMIT01.cern.ch`
- Check SENTIO software is running on prober
- Check network connectivity and firewall rules
- Verify machine_type is correct (`sentio`)
- Try with force flag: `force=true`

#### 7. Die Position Not Found

**Symptoms:**
```
❌ No alignment die position stored
❌ No home die position stored
```

**Solutions:**
- Initialize with die positions:
  ```bash
  python main.py send Initialize address=... alignment_die=2,2,0 home_die=5,2,0
  ```
- Or open project with die positions:
  ```bash
  python main.py send OpenProject path=NKF7_Test alignment_die=2,2,0 home_die=5,2,0
  ```

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=DEBUG
python3.12 main.py listen
```

Or edit `WPAgentLogger.py`:
```python
LOG_LEVEL = "DEBUG"
```

### Checking Listener Health

```bash
# Check heartbeat messages
kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic svt.wp-agent.heartbeat --from-beginning

# Expected output:
{"status": "alive", "timestamp": 1733155200.123, "state": "Idle"}
```

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes following the coding standards
4. Add tests for new functionality
5. Update documentation (README, commands_help.json, Swagger)
6. Ensure all tests pass
7. Commit changes: `git commit -m "Add my feature"`
8. Push to branch: `git push origin feature/my-feature`
9. Open a Pull Request

### Development Guidelines

- Follow PEP 8 style guide
- Add docstrings to all functions (Google style)
- Write unit tests for new code
- Update `commands_help.json` for new commands
- Add Swagger documentation for new endpoints
- Keep commits atomic and well-described

### Code Style

```python
def example_function(param1: str, param2: int) -> dict:
    """
    Brief description of function.
    
    Longer description if needed.
    
    Args:
        param1: Description of param1
        param2: Description of param2
        
    Returns:
        dict: Description of return value
        
    Raises:
        ValueError: When param1 is invalid
    """
    pass
```

---

## 📄 License

[Add your license here]

---

## 🙏 Acknowledgments

- SVT SW Core Team 
- MPI Corporation for SENTIO prober platform
- Apache Kafka community

---

## 📞 Contact

- **Organization**:  SVT SW Core Team
- **Project**: Silicon Vertex Tracker Wafer Prober Agent
- **Support**: [CALL ME MAYBE]

---



### Version 2.0 (December 2025)


---

<div align="center">

**[⬆ Back to Top](#-wafer-prober-agent-wp-agent)**

Made with ❤️ at CERN | Powered by 

</div>