from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.WPFactory import get_prober, ProberFactory
from utilities.WPHelpers import (resolve_project_parameters, ensure_prober_initialized, check_prober_ready)
from services.WPKafkaDbService import KafkaDBService
import json
import os


# Database initialization removed - now handled by services/WPInitializationService.py on producer side
# This keeps the listener non-interactive

def _initialize_manual(address=None, machineType=None, projectName=None, force=False, machineId=None,
                       machineName=None, initialization_mode=None):
    """
    Initialize prober with manually provided parameters (original behavior).

    Args:
        address: Prober network address
        machineType: Type of prober machine
        projectName: Optional project name
        force: Force re-initialization
        machineId: Optional database machine ID (for tracking)
        machineName: Optional database machine name (for tracking)
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
        result = ensure_prober_initialized(address, machineType, projectName)

        if result["status"] == "success":
            globals_.set_prober_status("initialized")

            # Store database metadata if provided (from producer-side selection)
            if machineId:
                globals_.machineId = machineId
            if machineName:
                globals_.machineName = machineName
            if initialization_mode:
                globals_.initialization_mode = initialization_mode
            else:
                # Default to manual if not specified
                globals_.initialization_mode = "manual"

            info = globals_.get_info()

            # Build output message
            if machineName:
                output_msg = f"Initialized {machineName} at {info.get('address')}"
            else:
                output_msg = f"Initialized WP at {info.get('address')}"

            if projectName:
                output_msg += f" with project '{projectName}'"

            return {
                "status": "success",
                "output": output_msg,
                "data": {
                    "address": address,
                    "machineType": machineType,
                    "projectName": projectName,
                    "machineId": machineId,
                    "machineName": machineName,
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

def svt_initialise_wp(address=None, machineType=None, projectName=None,
                      alignmentDie=None, homeDie=None, force=False,
                      machineId=None, machineName=None,
                      projectId=None, asicFamily=None, orientation=None,
                      initialization_mode=None):
    """
    Initialize the WP agent with prober connection.

    Args:
        address: Prober network address (REQUIRED for manual mode)
        machineType: Type of prober machine (REQUIRED for manual mode, e.g., "sentio")
        projectName: Name of the project (optional)
        alignmentDie: Alignment die position as "col,row,subsite" (optional)
        homeDie: Home die position as "col,row,subsite" (optional)
        force: Force re-initialization even if already initialized (default: False)
        machineId: Database machine ID (optional, for metadata)
        machineName: Database machine name (optional, for metadata)
        projectId: Database project ID (optional, for metadata)
        asicFamily: ASIC family type (optional, for metadata)
        orientation: Wafer orientation (optional, for metadata)
        initialization_mode: "manual" or "database" (optional, for tracking)

    Returns:
        dict: Status result with initialization details

    Examples:
        # Manual initialization (basic)
        Initialize(address="wpmit01.cern.ch:35555", machineType="sentio")

        # Manual initialization (with project and die positions)
        Initialize(
            address="wpmit01.cern.ch:35555",
            machineType="sentio",
            projectName="RD53B_Test",
            alignmentDie="5,10,0",
            homeDie="1,1,0"
        )

        # Database initialization (called by WPInitializationService)
        Initialize(
            address="wpmit01.cern.ch:35555",
            machineType="sentio",
            projectName="RD53B_Wafer_Test_v1",
            alignmentDie="5,10,0",
            homeDie="1,1,0",
            machineId=1,
            machineName="SENTIO Prober 1",
            projectId=15,
            asicFamily="RD53B",
            orientation="0",
            initialization_mode="database"
        )
    """
    from drivers.WPFactory import ProberFactory

    globals_ = SvtWPAagentGlobalParameters.getInstance()
    factory = ProberFactory.get_instance()

    # Check if already initialized and not forcing
    if factory.is_initialized() and not force:
        return {
            "status": "success",
            "output": f"Already initialized at {globals_.address}. Use force=True to reinitialize.",
            "data": {
                "already_initialized": True,
                "currentAddress": globals_.address,
                "currentMachineType": globals_.machineType
            }
        }

    # Validate required parameters
    if not address or not machineType:
        return {
            "status": "error",
            "output": "Initialization requires 'address' and 'machineType' parameters."
        }

    # Reset if forcing re-initialization
    if force:
        factory.reset()

    try:
        # Initialize prober
        result = ensure_prober_initialized(address, machineType, projectName)

        if result["status"] == "success":
            globals_.set_prober_status("initialized")

            # Store basic info
            globals_.set_address(address)
            globals_.set_machineType(machineType)
            if projectName:
                globals_.set_projectName(projectName)

                try:
                    prober = get_prober(machineType, address)
                    project_path = os.path.join(
                        "C:\\ProgramData\\MPI Corporation\\SENTIO\\projects\\",
                        projectName
                    )

                    prober.open_project(project_path)
                except Exception as e:
                    print(f"   ⚠️  Warning: Could not open project: {str(e)}")

            # Store machine metadata (from database)
            if machineId:
                globals_.machineId = machineId
            if machineName:
                globals_.machineName = machineName
            if initialization_mode:
                globals_.initialization_mode = initialization_mode

            # Parse and store die positions
            if alignmentDie:
                parsed_alignment = _parse_die_position(alignmentDie)
                if parsed_alignment:
                    globals_.set_alignmentDie(parsed_alignment)
                    print(
                        f"   📍 Alignment die: Col {parsed_alignment['col']}, Row {parsed_alignment['row']}, Subsite {parsed_alignment['subsite']}")
                else:
                    print(f"   ⚠️  Invalid alignment die format: '{alignmentDie}'")

            if homeDie:
                parsed_home = _parse_die_position(homeDie)
                if parsed_home:
                    globals_.set_homeDie(parsed_home)
                    print(
                        f"   🏠 Home die: Col {parsed_home['col']}, Row {parsed_home['row']}, Subsite {parsed_home['subsite']}")
                else:
                    print(f"   ⚠️  Invalid home die format: '{homeDie}'")

            # Store project metadata (from database)
            if projectId or asicFamily or orientation:
                metadata = {}
                if projectId:
                    metadata['projectId'] = projectId
                if asicFamily:
                    metadata['asicFamily'] = asicFamily
                if orientation:
                    metadata['orientation'] = orientation

                globals_.set_project_metadata(metadata)

            # Build output message
            output_msg = f"Initialized WP at {address}"
            if projectName:
                output_msg += f" with project '{projectName}'"

            return {
                "status": "success",
                "output": output_msg,
                "data": {
                    "address": address,
                    "machineType": machineType,
                    "projectName": projectName,
                    "alignmentDie": alignmentDie,
                    "homeDie": homeDie,
                    "machineId": machineId,
                    "machineName": machineName,
                    "projectId": projectId,
                    "asicFamily": asicFamily,
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
    Parse die position from string OR tuple.

    Args:
        die_str: Can be "5,10,0", "5,10", (5,10,0), (5,10), [5,10,0], etc.

    Returns:
        dict: {"col": int, "row": int, "subsite": int} or None
    """
    if not die_str:
        return None

    # If it's already a tuple or list
    if isinstance(die_str, (tuple, list)):
        try:
            if len(die_str) == 2:
                return {"col": int(die_str[0]), "row": int(die_str[1]), "subsite": 0}
            elif len(die_str) >= 3:
                return {"col": int(die_str[0]), "row": int(die_str[1]), "subsite": int(die_str[2])}
        except (ValueError, IndexError):
            return None

    # If it's a string
    if isinstance(die_str, str):
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
    from drivers.WPFactory import ProberFactory
    from stateMachine.WpAgentStateMachineGlobals import agentStateMachine

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
    if hasattr(globals_, 'machineId'):
        status_info["machineId"] = globals_.machineId
    if hasattr(globals_, 'machineName'):
        status_info["machineName"] = globals_.machineName

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
            prober = factory.get_prober(globals_.machineType, globals_.address)

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

    if status_info.get("machineName"):
        output_lines.append(f"Machine: {status_info['machineName']}")

    output_lines.append(f"Machine Type: {info.get('machineType', 'N/A')}")

    # Project info
    if info.get('projectName'):
        output_lines.append(f"Project: {info.get('projectName')}")

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
    prober = factory.get_prober(globals_.machineType, globals_.address)

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
    from stateMachine.WpAgentStateMachineGlobals import agentStateMachine

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
    from stateMachine.WpAgentStateMachineGlobals import agentStateMachine

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

        for key, value in cmd_info.items():
            if key.startswith('example_') and key != 'example':
                output_lines.append(f"  {value}")

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
