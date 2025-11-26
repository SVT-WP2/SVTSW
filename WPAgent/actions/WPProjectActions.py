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

# TODO: check if its absolutly the same with normal init and make a move :)
def initialise_testing_project(address=None, machine_type=None, project_name=None, force=False, machine_id=None,
                               machine_name=None, initialization_mode=None):
    """
    Legacy initialization function - redirects to svt_initialise_wp with same parameters.
    """
    return svt_initialise_wp(
        address=address,
        machine_type=machine_type,
        project_name=project_name,
        force=force,
        machine_id=machine_id,
        machine_name=machine_name,
        initialization_mode=initialization_mode
    )


def svt_initialise_wp(address=None, machine_type=None, project_name=None, force=False, machine_id=None,
                      machine_name=None, initialization_mode=None):
    """
    Initialize the WP agent with prober connection.

    This is called by the listener when it receives an Initialize command.
    All parameters should be provided (no interactive prompts here).

    For database-driven initialization, use WPInitializationService on the producer side.

    Args:
        address: Prober network address (required)
        machine_type: Type of prober machine (required)
        project_name: Name of the project (optional)
        force: Force re-initialization even if already initialized
        machine_id: Database machine ID (optional, for tracking)
        machine_name: Database machine name (optional, for tracking)
        initialization_mode: "manual" or "database" (optional, for tracking)

    Returns:
        dict: Status result with initialization details

    Examples:
        # Manual initialization
        svt_initialise_wp(address="wpmit01.cern.ch:35555", machine_type="sentio")

        # With database metadata (sent from producer-side WPInitializationService)
        svt_initialise_wp(
            address="wpmit01.cern.ch:35555",
            machine_type="sentio",
            machine_id="123",
            machine_name="SENTIO Prober 1",
            initialization_mode="database"
        )
    """
    try:
        factory = ProberFactory.get_instance()

        # Check if already initialized
        if factory.is_initialized() and not force:
            globals_ = SvtWPAagentGlobalParameters.getInstance()
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
                "output": "Initialization requires 'address' and 'machine_type' parameters. "
                          "For database-driven initialization, use WPInitializationService on the producer side."
            }

        # Route to manual initialization (the only mode for listener)
        print("\n🔧 Listener: Initializing prober...")
        return _initialize_manual(
            address=address,
            machine_type=machine_type,
            project_name=project_name,
            force=force,
            machine_id=machine_id,
            machine_name=machine_name,
            initialization_mode=initialization_mode
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "output": f"Initialization failed: {str(e)}"
        }


def get_project_status():
    """
    Get current project and initialization status including:
    - Prober station (PS) connection information
    - Current die position
    - Total number of dies on wafer map
    - Wafer map dimensions
    """
    from drivers.factory import ProberFactory

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

    # Get die information if prober is initialized
    if factory.is_initialized():
        try:
            prober = factory.get_prober(globals_.machine_type, globals_.address)

            # Get current die position
            try:

                current_die = prober.get_current_index()
                status_info["current_die"] = {
                    "col": current_die[0],
                    "row": current_die[1],
                    "subsite": current_die[2] if len(current_die) > 2 else 0
                }
            except Exception as e:
                status_info["current_die"] = None
                status_info["current_die_error"] = str(e)

            # Get wafer map information
            try:
                # Get map dimensions
                num_cols = prober.prober.map.get_num_cols()
                num_rows = prober.prober.map.get_num_rows()

                status_info["wafer_map"] = {
                    "num_cols": num_cols,
                    "num_rows": num_rows,
                    "total_dies": num_cols * num_rows
                }

                # Try to get die count (tested dies vs total)
                try:

                    die_count = prober.prober.map.get_num_dies()
                    status_info["wafer_map"]["num_dies"] = die_count
                except:
                    pass

            except Exception as e:
                status_info["wafer_map"] = None
                status_info["wafer_map_error"] = str(e)

            # Get chuck position
            try:
                from sentio_prober_control.Sentio.Enumerations import ChuckSite
                from sentio_prober_control.Sentio.ProberBase import ChuckXYReference

                chuck_x, chuck_y = prober.prober.get_chuck_xy(ChuckSite.Wafer, ChuckXYReference.Zero)
                status_info["chuck_position"] = {
                    "x": chuck_x,
                    "y": chuck_y,
                    "unit": "micrometers"
                }
            except Exception as e:
                status_info["chuck_position"] = None
                status_info["chuck_position_error"] = str(e)

        except Exception as e:
            status_info["die_info_error"] = f"Could not get die information: {str(e)}"

    # Check if not initialized
    if not info["project_name"] and not factory.is_initialized():
        return {
            "status": "uninitialized",
            "output": "Global parameters not set. Run 'Initialize' command.",
            "data": status_info
        }

    # Format output message
    output_lines = []
    output_lines.append(f"Connected to: {info.get('address', 'N/A')}")

    if status_info.get("machine_name"):
        output_lines.append(f"Machine: {status_info['machine_name']}")

    output_lines.append(f"Machine Type: {info.get('machine_type', 'N/A')}")

    if info.get('project_name'):
        output_lines.append(f"Project: {info.get('project_name')}")

    # Add die information to output
    if status_info.get("current_die"):
        die = status_info["current_die"]
        output_lines.append(f"Current Die: Col {die['col']}, Row {die['row']}, Subsite {die['subsite']}")

    if status_info.get("wafer_map"):
        wmap = status_info["wafer_map"]
        output_lines.append(
            f"Wafer Map: {wmap['num_cols']} cols × {wmap['num_rows']} rows ({wmap['total_dies']} total dies)")

    if status_info.get("chuck_position"):
        pos = status_info["chuck_position"]
        output_lines.append(f"Chuck Position: X={pos['x']:.2f}µm, Y={pos['y']:.2f}µm")

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
        "output": f"Current die: Count {die_info['Count']}, Number {die_info['Number']}, Row {die_info['row']}, Column {die_info['col']}",
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