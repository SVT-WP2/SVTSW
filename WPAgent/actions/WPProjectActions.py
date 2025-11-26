from globals.svtWPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.factory import get_prober, ProberFactory
from utilities.WPHelpers import (resolve_project_parameters, ensure_prober_initialized, check_prober_ready)
from services.kafka_db_service import KafkaDBService
import json
import os


# Database initialization removed - now handled by services/WPInitializationService.py on producer side
# This keeps the listener non-interactive

def _initialize_manual(address=None, machine_type=None, project_name=None, force=False, machine_id=None,
                       machine_name=None, initialization_mode=None):
    """
    Initialize prober with manually provided parameters (original behavior).

    Args:
        address: Prober network address
        machine_type: Type of prober machine
        project_name: Optional project name
        force: Force re-initialization
        machine_id: Optional database machine ID (for tracking)
        machine_name: Optional database machine name (for tracking)
        initialization_mode: Optional initialization mode ("manual" or "database")

    Returns:
        dict: Status result
    """
    try:
        globals_ = SvtWPAagentGlobalParameters.getInstance()
        factory = ProberFactory.get_instance()

        # Check if already initialized and not forcing
        if factory.is_initialized() and not force:
            return {
                "status": "success",
                "output": f"Already initialized at {globals_.address}. Use force=True to reinitialize."
            }

        # Reset if forcing re-initialization
        if force:
            factory.reset()

        # Check prober status
        if globals_.prober_status == "inuse" and not force:
            return {
                "status": "error",
                "output": "Prober is currently in use by another session. Use force=True to override."
            }

        # Ensure prober is initialized
        result = ensure_prober_initialized(address, machine_type, project_name)

        if result["status"] == "success":
            globals_.set_prober_status("initialized")

            # Store database metadata if provided (from producer-side selection)
            if machine_id:
                globals_.machine_id = machine_id
            if machine_name:
                globals_.machine_name = machine_name
            if initialization_mode:
                globals_.initialization_mode = initialization_mode
            else:
                # Default to manual if not specified
                globals_.initialization_mode = "manual"

            info = globals_.get_info()

            # Build output message
            if machine_name:
                output_msg = f"Initialized {machine_name} at {info.get('address')}"
            else:
                output_msg = f"Initialized WP at {info.get('address')}"

            if project_name:
                output_msg += f" with project '{project_name}'"

            return {
                "status": "success",
                "output": output_msg,
                "data": {
                    "address": address,
                    "machine_type": machine_type,
                    "project_name": project_name,
                    "machine_id": machine_id,
                    "machine_name": machine_name,
                    "initialization_mode": initialization_mode or "manual"
                }
            }
        else:
            return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "output": f"Initialization failed: {str(e)}"
        }


# Updated svt_initialise_wp Function

def svt_initialise_wp(address=None, machine_type=None, project_name=None,
                      alignment_die=None, home_die=None, force=False,
                      machine_id=None, machine_name=None,
                      project_id=None, asic_family=None, orientation=None,
                      initialization_mode=None):
    """
    Initialize the WP agent with prober connection.

    Args:
        address: Prober network address (REQUIRED for manual mode)
        machine_type: Type of prober machine (REQUIRED for manual mode, e.g., "sentio")
        project_name: Name of the project (optional)
        alignment_die: Alignment die position as "col,row,subsite" (optional)
        home_die: Home die position as "col,row,subsite" (optional)
        force: Force re-initialization even if already initialized (default: False)
        machine_id: Database machine ID (optional, for metadata)
        machine_name: Database machine name (optional, for metadata)
        project_id: Database project ID (optional, for metadata)
        asic_family: ASIC family type (optional, for metadata)
        orientation: Wafer orientation (optional, for metadata)
        initialization_mode: "manual" or "database" (optional, for tracking)

    Returns:
        dict: Status result with initialization details

    Examples:
        # Manual initialization (basic)
        Initialize(address="wpmit01.cern.ch:35555", machine_type="sentio")

        # Manual initialization (with project and die positions)
        Initialize(
            address="wpmit01.cern.ch:35555",
            machine_type="sentio",
            project_name="RD53B_Test",
            alignment_die="5,10,0",
            home_die="1,1,0"
        )

        # Database initialization (called by WPInitializationService)
        Initialize(
            address="wpmit01.cern.ch:35555",
            machine_type="sentio",
            project_name="RD53B_Wafer_Test_v1",
            alignment_die="5,10,0",
            home_die="1,1,0",
            machine_id=1,
            machine_name="SENTIO Prober 1",
            project_id=15,
            asic_family="RD53B",
            orientation="0",
            initialization_mode="database"
        )
    """
    from drivers.factory import ProberFactory

    globals_ = SvtWPAagentGlobalParameters.getInstance()
    factory = ProberFactory.get_instance()

    # Check if already initialized and not forcing
    if factory.is_initialized() and not force:
        return {
            "status": "success",
            "output": f"Already initialized at {globals_.address}. Use force=True to reinitialize.",
            "data": {
                "already_initialized": True,
                "current_address": globals_.address,
                "current_machine_type": globals_.machine_type
            }
        }

    # Validate required parameters
    if not address or not machine_type:
        return {
            "status": "error",
            "output": "Initialization requires 'address' and 'machine_type' parameters."
        }

    # Reset if forcing re-initialization
    if force:
        factory.reset()

    try:
        # Initialize prober
        result = ensure_prober_initialized(address, machine_type, project_name)

        if result["status"] == "success":
            globals_.set_prober_status("initialized")

            # Store basic info
            globals_.set_address(address)
            globals_.set_machine_type(machine_type)
            if project_name:
                globals_.set_project_name(project_name)

            # Store machine metadata (from database)
            if machine_id:
                globals_.machine_id = machine_id
            if machine_name:
                globals_.machine_name = machine_name
            if initialization_mode:
                globals_.initialization_mode = initialization_mode

            # Parse and store die positions
            if alignment_die:
                parsed_alignment = _parse_die_position(alignment_die)
                if parsed_alignment:
                    globals_.set_alignment_die(parsed_alignment)
                    print(
                        f"   📍 Alignment die: Col {parsed_alignment['col']}, Row {parsed_alignment['row']}, Subsite {parsed_alignment['subsite']}")
                else:
                    print(f"   ⚠️  Invalid alignment die format: '{alignment_die}'")

            if home_die:
                parsed_home = _parse_die_position(home_die)
                if parsed_home:
                    globals_.set_home_die(parsed_home)
                    print(
                        f"   🏠 Home die: Col {parsed_home['col']}, Row {parsed_home['row']}, Subsite {parsed_home['subsite']}")
                else:
                    print(f"   ⚠️  Invalid home die format: '{home_die}'")

            # Store project metadata (from database)
            if project_id or asic_family or orientation:
                metadata = {}
                if project_id:
                    metadata['project_id'] = project_id
                if asic_family:
                    metadata['asic_family'] = asic_family
                if orientation:
                    metadata['orientation'] = orientation

                globals_.set_project_metadata(metadata)

            # Build output message
            output_msg = f"Initialized WP at {address}"
            if project_name:
                output_msg += f" with project '{project_name}'"

            return {
                "status": "success",
                "output": output_msg,
                "data": {
                    "address": address,
                    "machine_type": machine_type,
                    "project_name": project_name,
                    "alignment_die": alignment_die,
                    "home_die": home_die,
                    "machine_id": machine_id,
                    "machine_name": machine_name,
                    "project_id": project_id,
                    "asic_family": asic_family,
                    "orientation": orientation,
                    "initialization_mode": initialization_mode
                }
            }
        else:
            return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "output": f"Initialization failed: {str(e)}"
        }


def _parse_die_position(die_str):
    """
    Parse die position string "col,row" or "col,row,subsite".

    Args:
        die_str: String like "5,10" or "5,10,0"

    Returns:
        dict: {"col": int, "row": int, "subsite": int} or None if invalid

    Examples:
        _parse_die_position("5,10") → {"col": 5, "row": 10, "subsite": 0}
        _parse_die_position("5,10,0") → {"col": 5, "row": 10, "subsite": 0}
        _parse_die_position("invalid") → None
    """
    if not die_str or not isinstance(die_str, str):
        return None

    try:
        parts = die_str.split(",")
        if len(parts) >= 2:
            return {
                "col": int(parts[0].strip()),
                "row": int(parts[1].strip()),
                "subsite": int(parts[2].strip()) if len(parts) > 2 else 0
            }
    except (ValueError, IndexError):
        return None

    return None

def get_project_status():
    """
    Get current project and initialization status including:
    - Prober station (PS) connection information
    - Current die position
    - Total number of dies on wafer map
    - Agent state
    """
    from drivers.factory import ProberFactory
    from stateMachine.SvtWpAgentStateMachineGlobals import agentStateMachine

    globals_ = SvtWPAagentGlobalParameters.getInstance()
    factory = ProberFactory.get_instance()

    info = globals_.get_info()
    is_ready, ready_msg = check_prober_ready()

    # Basic status info
    status_info = {
        **info,
        "prober_initialized": factory.is_initialized(),
        "ready_for_commands": is_ready,
        "ready_message": ready_msg
    }

    # Add machine ID and name if available (from database initialization)
    if hasattr(globals_, 'machine_id'):
        status_info["machine_id"] = globals_.machine_id
    if hasattr(globals_, 'machine_name'):
        status_info["machine_name"] = globals_.machine_name

    # Get agent state
    try:
        agent_state = agentStateMachine.getState().name
        status_info["agent_state"] = agent_state
    except Exception as e:
        status_info["agent_state"] = "Unknown"
        status_info["agent_state_error"] = str(e)

    # Get die information if prober is initialized
    die_info = None
    if factory.is_initialized():
        try:
            prober = factory.get_prober(globals_.machine_type, globals_.address)

            # Get die information using your new method
            try:
                current_index = prober.get_current_index()
                counts = prober.get_dies_number().split(",")

                # Parse it
                parts = current_index.split(",")
                die_info = {
                    "number": int(parts[0]),
                    "col": int(parts[1]),
                    "row": int(parts[2]),
                    "total_count": int(counts[0])
                }

                status_info["die_info"] = die_info

            except Exception as e:
                status_info["die_info"] = None
                status_info["die_info_error"] = str(e)

        except Exception as e:
            status_info["die_error"] = f"Could not get die information: {str(e)}"

    # Check if not initialized
    if not factory.is_initialized():
        return {
            "status": "uninitialized",
            "output": "Prober not initialized. Run 'Initialize' command.",
            "data": status_info
        }

    # Format output message
    output_lines = []

    # Machine connection info
    output_lines.append(f"Connected to: {info.get('address', 'N/A')}")

    if status_info.get("machine_name"):
        output_lines.append(f"Machine: {status_info['machine_name']}")

    output_lines.append(f"Machine Type: {info.get('machine_type', 'N/A')}")

    # Project info
    if info.get('project_name'):
        output_lines.append(f"Project: {info.get('project_name')}")

    # Agent state
    output_lines.append(f"Agent State: {status_info.get('agent_state', 'Unknown')}")

    # Die information
    if die_info:
        output_lines.append(
            f"Current Die: Number {die_info['number']}, Column {die_info['col']}, Row {die_info['row']}")
        output_lines.append(f"Total Dies: {die_info['total_count']}")
    elif status_info.get("die_info_error"):
        output_lines.append(f"Die Info: Not available ({status_info.get('die_info_error')})")

    # Status
    output_lines.append(f"Status: {ready_msg}")

    output_message = "\n".join(output_lines)

    return {
        "status": "success",
        "output": output_message,
        "data": status_info
    }


def get_info():
    factory = ProberFactory.get_instance()
    globals_ = SvtWPAagentGlobalParameters.getInstance()
    prober = factory.get_prober(globals_.machine_type, globals_.address)

    # This returns a string like "2,3,0"
    current_index = prober.get_current_index()
    counts = prober.get_dies_number().split(",")

    # Parse it
    parts = current_index.split(",")
    die_info = {
        "Number": int(parts[0]),
        "col": int(parts[1]),
        "row": int(parts[2]),
        "Count": int(counts[0])
    }

    return {
        "status": "success",
        "output": f"Current die: Count of selected dies {die_info['Count']}, Number {die_info['Number']}, Row {die_info['row']}, Column {die_info['col']}",
        "data": die_info
    }


def reset_agent_state():
    """
    Reset the agent state machine to Idle.
    This command ALWAYS works, even when agent is in Failed state.

    Use this to recover from Failed state.
    """
    from stateMachine.SvtWpAgentStateMachineGlobals import agentStateMachine

    old_state = agentStateMachine.getState().name

    # Reset the state machine
    agentStateMachine.reset()

    new_state = agentStateMachine.getState().name

    print(f"🔄 Agent state reset: {old_state} → {new_state}")

    return {
        "status": "success",
        "output": f"✅ Agent state reset from '{old_state}' to '{new_state}'",
        "data": {
            "old_state": old_state,
            "new_state": new_state
        }
    }


def get_agent_state():
    """
    Get current agent state.
    This command ALWAYS works, even when agent is in Failed state.
    """
    from stateMachine.SvtWpAgentStateMachineGlobals import agentStateMachine

    state = agentStateMachine.getState()
    current_command = agentStateMachine.getCurrentCommand()
    retry_count = agentStateMachine.retryCount
    max_retries = agentStateMachine.maxRetries

    return {
        "status": "success",
        "output": f"Agent state: {state.name}",
        "data": {
            "state": state.name,
            "current_command": current_command,
            "retry_count": retry_count,
            "max_retries": max_retries,
            "is_ready": agentStateMachine.isReadyToExecute(),
            "is_busy": agentStateMachine.isBusy()
        }
    }


def help_command(command=None):
    """
    Display help information for commands.
    Loads command help data from utilities/WPCommandsHelpList.json

    Usage:
        python main.py send Help              # List all commands
        python main.py send Help MoveChuckXY  # Help for specific command

    Args:
        command (optional): Specific command to get help for

    Returns:
        dict: Help information
    """

    # Load help data from JSON file
    try:
        possible_paths = [
            "/utilities/WPCommandsHelpList.json",
            "WPCommandsHelpList.json",
            os.path.join(os.path.dirname(__file__), "WPCommandsHelpList.json"),
            os.path.join(os.path.dirname(__file__), "..", "utilities", "WPCommandsHelpList.json")
        ]

        COMMAND_HELP = None
        for path in possible_paths:
            if os.path.exists(path):
                with open(path, 'r') as f:
                    COMMAND_HELP = json.load(f)
                break

        if COMMAND_HELP is None:
            return {
                "status": "error",
                "output": "Help file not found. Expected location: utilities/WPCommandsHelpLis.json"
            }

    except Exception as e:
        return {
            "status": "error",
            "output": f"Failed to load help data: {str(e)}"
        }

    # If specific command requested
    if command:
        if command not in COMMAND_HELP:
            return {
                "status": "error",
                "output": f"Command '{command}' not found. Use 'Help' without parameters to see all commands."
            }

        cmd_info = COMMAND_HELP[command]

        # Format detailed help for specific command
        output_lines = []
        output_lines.append("=" * 70)
        output_lines.append(f"Command: {command}")
        output_lines.append("=" * 70)
        output_lines.append("")
        output_lines.append(f"Description: {cmd_info['description']}")
        output_lines.append(f"Category: {cmd_info['category']}")
        output_lines.append(f"Execution Time: {cmd_info['execution_time']}")
        output_lines.append("")

        if cmd_info['parameters']:
            output_lines.append("Parameters:")
            for param_name, param_info in cmd_info['parameters'].items():
                req = "REQUIRED" if param_info['required'] == True else (
                    "CONDITIONAL" if param_info['required'] == "conditional" else "optional")
                output_lines.append(f"  • {param_name} ({param_info['type']}, {req})")
                output_lines.append(f"    {param_info['description']}")
        else:
            output_lines.append("Parameters: None")

        output_lines.append("")
        output_lines.append("Example:")
        output_lines.append(f"  {cmd_info['example']}")

        # Additional examples if present
        if 'example_db' in cmd_info:
            output_lines.append("")
            output_lines.append("Database mode:")
            output_lines.append(f"  {cmd_info['example_db']}")

        if 'example_specific' in cmd_info:
            output_lines.append("")
            output_lines.append("Get help for specific command:")
            output_lines.append(f"  {cmd_info['example_specific']}")

        if 'notes' in cmd_info:
            output_lines.append("")
            output_lines.append("Notes:")
            output_lines.append(f"  {cmd_info['notes']}")

        output_lines.append("")
        output_lines.append("=" * 70)

        return {
            "status": "success",
            "output": "\n".join(output_lines),
            "data": cmd_info
        }

    # Show all commands as simple list
    output_lines = []
    output_lines.append("=" * 70)
    output_lines.append("WPAgent - Available Commands")
    output_lines.append("=" * 70)
    output_lines.append("")
    output_lines.append("Usage:")
    output_lines.append("  python main.py send <Command> [--params='{\"key\":\"value\"}']")
    output_lines.append("")
    output_lines.append("Get help for specific command:")
    output_lines.append("  python main.py send Help <CommandName>")
    output_lines.append("  Example: python main.py send Help MoveChuckXY")
    output_lines.append("")
    output_lines.append("=" * 70)
    output_lines.append("")

    # Group by category
    categories = {}
    for cmd_name, cmd_info in COMMAND_HELP.items():
        category = cmd_info['category']
        if category not in categories:
            categories[category] = []
        categories[category].append((cmd_name, cmd_info))

    for category in sorted(categories.keys()):
        output_lines.append(f"{category}:")
        output_lines.append("-" * 70)
        for cmd_name, cmd_info in sorted(categories[category], key=lambda x: x[0]):
            output_lines.append(f"• {cmd_name}")
            output_lines.append(f"  {cmd_info['example']}")
            output_lines.append("")

    output_lines.append("=" * 70)
    output_lines.append("For detailed help: python main.py send Help <CommandName>")
    output_lines.append("=" * 70)

    return {
        "status": "success",
        "output": "\n".join(output_lines),
        "data": {
            "total_commands": len(COMMAND_HELP),
            "categories": {cat: [cmd[0] for cmd in cmds] for cat, cmds in categories.items()}
        }
    }