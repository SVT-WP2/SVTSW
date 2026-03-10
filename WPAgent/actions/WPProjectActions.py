from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.WPFactory import get_prober, ProberFactory
from utilities.WPHelpers import (resolve_project_parameters, ensure_prober_initialized, check_prober_ready)
from utilities.WPResponseBuilder import ResponseBuilder
from services.WPKafkaDbService import KafkaDBService
import json
import os


def _parse_die_position(die_string):
    """Parse die position string like '5,10,0' into dict"""
    try:
        parts = die_string.split(",")
        return {
            "col": int(parts[0]),
            "row": int(parts[1]),
            "subsite": int(parts[2]) if len(parts) > 2 else 0
        }
    except:
        return None


def svt_initialise_wp(address=None, machine_type=None, project_name=None,
                      alignment_die=None, home_die=None, force=False,
                      machine_id=None, machine_name=None,
                      project_id=None, asic_family=None, orientation=None,
                      initialization_mode=None, serialNumber=None):
    """Initialize the WP agent with prober connection"""
    from drivers.WPFactory import ProberFactory

    globals_ = SvtWPAagentGlobalParameters.getInstance()
    factory = ProberFactory.get_instance()

    # Check if already initialized and not forcing
    if factory.is_initialized() and not force:
        return ResponseBuilder.success(
            "InitializeReply",
            f"Already initialized at {globals_.address}. Use force=True to reinitialize."
        )

    # Validate required parameters
    if not address or not machine_type:
        return ResponseBuilder.error(
            "InitializeReply",
            "Initialization requires 'address' and 'machine_type' parameters.",
            400
        )

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

            # UPDATE ALL PAYLOAD FIELDS
            if machine_id:
                globals_.set_machine_id(machine_id)
                globals_.wp_machine_id = machine_id

            if machine_name:
                globals_.machine_name = machine_name

            if initialization_mode:
                globals_.initialization_mode = initialization_mode

            # Set user (from environment or default)
            import getpass
            try:
                globals_.user = getpass.getuser()
            except:
                globals_.user = "default_user"

            # Set ASIC serial number if provided
            if serialNumber:
                globals_.asic_serial_number = serialNumber

            # Set agent state
            globals_.wpag_state = "ServiceOn"

            # Set project
            if project_name:
                globals_.set_project_name(project_name)
                if project_id:
                    globals_.opened_project_id = project_id
                else:
                    globals_.opened_project_id = 0  # TODO: Get from DB

                try:
                    prober = get_prober(machine_type, address)
                    project_path = os.path.join(
                        "C:\\ProgramData\\MPI Corporation\\SENTIO\\projects\\",
                        project_name
                    )
                    prober.open_project(project_path)
                except Exception as e:
                    print(f"   ⚠️  Warning: Could not open project: {str(e)}")

            # Parse and store die positions
            if alignment_die:
                parsed_alignment = _parse_die_position(alignment_die)
                if parsed_alignment:
                    globals_.set_alignment_die(parsed_alignment)

            if home_die:
                parsed_home = _parse_die_position(home_die)
                if parsed_home:
                    globals_.set_home_die(parsed_home)

            # Store project metadata
            metadata = {}
            if project_id:
                metadata["project_id"] = project_id
            if asic_family:
                metadata["asic_family"] = asic_family
            if orientation:
                metadata["orientation"] = orientation
            if metadata:
                globals_.set_project_metadata(metadata)

            # Set initial physical state
            globals_.chuck_z_position_state = "Unknown"
            globals_.current_working_area = "LoadPosition"
            globals_.camera_mount_point = "Top"

            # TODO: Get wafer info from DB if available
            # if wafer_id:
            #     globals_.set_wafer_loaded(wafer_id, wafer_orientation)
            #     globals_.total_dies_number = get_total_dies()

            # Build output message
            if machine_name:
                output_msg = f"Initialized {machine_name} at {address}"
            else:
                output_msg = f"Initialized WP at {address}"

            if project_name:
                output_msg += f" with project '{project_name}'"

            return ResponseBuilder.success("InitializeReply", output_msg)
        else:
            return ResponseBuilder.error("InitializeReply", result.get("output", "Initialization failed"), 500)

    except Exception as e:
        import traceback
        traceback.print_exc()
        globals_.wpag_state = "WP_Error"
        return ResponseBuilder.error("InitializeReply", f"Initialization failed: {str(e)}", 500)


def get_project_status():
    """Get current project status"""
    try:
        factory = ProberFactory.get_instance()
        globals_ = SvtWPAagentGlobalParameters.getInstance()

        if not factory.is_initialized():
            return ResponseBuilder.error("ShowProjectStatusReply", "Not initialized", 400)

        # Get prober info
        prober = factory.get_prober(globals_.machineType, globals_.address)

        # Build status message
        status_info = {
            "address": globals_.address,
            "machine_type": globals_.machineType,
            "project_name": globals_.projectName,
            "prober_status": globals_.prober_status,
            "machine_id": globals_.machine_id,
            "machine_name": globals_.machine_name,
            "initialization_mode": globals_.initialization_mode
        }

        # Add die positions if set
        alignment_die = globals_.get_alignment_die()
        home_die = globals_.get_home_die()

        if alignment_die:
            status_info["alignment_die"] = alignment_die
        if home_die:
            status_info["home_die"] = home_die

        # Add project metadata
        metadata = globals_.get_project_metadata()
        if metadata:
            status_info["project_metadata"] = metadata

        # Format output message
        output_lines = []
        output_lines.append("=" * 50)
        output_lines.append("WP Agent Status")
        output_lines.append("=" * 50)

        if status_info.get("machine_name"):
            output_lines.append(f"Machine: {status_info['machine_name']} (ID: {status_info.get('machine_id', 'N/A')})")

        output_lines.append(f"Address: {status_info['address']}")
        output_lines.append(f"Type: {status_info['machine_type']}")
        output_lines.append(f"Project: {status_info['project_name'] or 'None'}")
        output_lines.append(f"Status: {status_info['prober_status']}")

        if alignment_die:
            output_lines.append(
                f"Alignment Die: Col {alignment_die['col']}, Row {alignment_die['row']}, Subsite {alignment_die['subsite']}")

        if home_die:
            output_lines.append(
                f"Home Die: Col {home_die['col']}, Row {home_die['row']}, Subsite {home_die['subsite']}")

        output_lines.append("=" * 50)

        output_message = "\n".join(output_lines)

        return ResponseBuilder.success("ShowProjectStatusReply", output_message)

    except Exception as e:
        return ResponseBuilder.error("ShowProjectStatusReply", str(e), 500)


def get_info():
    """Get current die info"""
    try:
        factory = ProberFactory.get_instance()
        globals_ = SvtWPAagentGlobalParameters.getInstance()

        if not factory.is_initialized():
            return ResponseBuilder.error("GetInfoReply", "Not initialized", 400)

        prober = factory.get_prober(globals_.machineType, globals_.address)

        # Get current index from prober (format: "number,col,row")
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

        # Update globals with current die position
        globals_.set_current_die(die_info["col"], die_info["row"], 0)

        message = f"Current die: Count of selected dies {die_info['Count']}, Number {die_info['Number']}, Row {die_info['row']}, Column {die_info['col']}"

        return ResponseBuilder.success("GetInfoReply", message)

    except Exception as e:
        return ResponseBuilder.error("GetInfoReply", str(e), 500)


def reset_agent_state():
    """Reset the agent state machine to Idle"""
    from stateMachine.WpAgentStateMachineGlobals import agentStateMachine

    old_state = agentStateMachine.getState().name

    # Reset the state machine
    agentStateMachine.reset()

    new_state = agentStateMachine.getState().name

    print(f"🔄 Agent state reset: {old_state} → {new_state}")

    return ResponseBuilder.success(
        "ResetAgentReply",
        f"✅ Agent state reset from '{old_state}' to '{new_state}'"
    )


def get_agent_state():
    """Get current agent state"""
    from stateMachine.WpAgentStateMachineGlobals import agentStateMachine

    state = agentStateMachine.getState()
    current_command = agentStateMachine.getCurrentCommand()

    message = f"Agent state: {state.name}"
    if current_command:
        message += f", Current command: {current_command}"

    return ResponseBuilder.success("GetAgentStateReply", message)


def help_command(command=None):
    """
    Display help information for commands.

    Usage:
        python main.py send help              # List all commands
        python main.py send help MoveChuckXY  # Help for specific command

    Args:
        command (optional): Specific command name

    Returns:
        Standardized response with help information
    """

    # Load help data from JSON
    try:
        possible_paths = [
            "utilities/WPCommandsHelpList.json",
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
            return ResponseBuilder.error(
                "HelpReply",
                "Help file not found. Expected: utilities/WPCommandsHelpList.json",
                404
            )

    except Exception as e:
        return ResponseBuilder.error(
            "HelpReply",
            f"Failed to load help data: {str(e)}",
            500
        )

    # Specific command help
    if command:
        if command not in COMMAND_HELP:
            return ResponseBuilder.error(
                "HelpReply",
                f"Command '{command}' not found. Use 'help' to see all commands.",
                404
            )

        cmd_info = COMMAND_HELP[command]

        output_lines = []
        output_lines.append("=" * 70)
        output_lines.append(f"Command: {command}")
        output_lines.append("=" * 70)
        output_lines.append("")
        output_lines.append(f"Description: {cmd_info.get('description', 'No description')}")
        output_lines.append(f"Category: {cmd_info.get('category', 'Unknown')}")
        output_lines.append(f"Execution Time: {cmd_info.get('execution_time', 'Unknown')}")
        output_lines.append("")

        # Check if parameters exist (some commands might not have this key)
        if 'parameters' in cmd_info and cmd_info['parameters']:
            output_lines.append("Parameters:")
            for param_name, param_info in cmd_info['parameters'].items():
                req = "REQUIRED" if param_info.get('required') == True else (
                    "CONDITIONAL" if param_info.get('required') == "conditional" else "optional")
                output_lines.append(f"  • {param_name} ({param_info.get('type', 'unknown')}, {req})")
                output_lines.append(f"    {param_info.get('description', '')}")
        else:
            output_lines.append("Parameters: None")

        output_lines.append("")
        output_lines.append("Example:")
        output_lines.append(f"  {cmd_info.get('example', 'No example')}")

        for key, value in cmd_info.items():
            if key.startswith('example_') and key != 'example':
                output_lines.append(f"  {value}")

        output_lines.append("")
        output_lines.append("=" * 70)

        # Build message
        help_message = "\n".join(output_lines)

        response = ResponseBuilder.success("HelpReply", help_message)
        response["data"]["commandInfo"] = cmd_info

        return response

    # Show all commands
    output_lines = []
    output_lines.append("=" * 70)
    output_lines.append("WPAgent - Available Commands")
    output_lines.append("=" * 70)
    output_lines.append("")
    output_lines.append("Usage:")
    output_lines.append("  python main.py send <Command> [param1=value1] [param2=value2]")
    output_lines.append("")
    output_lines.append("Get help for specific command:")
    output_lines.append("  python main.py send help <CommandName>")
    output_lines.append("  Example: python main.py send help MoveChuckXY")
    output_lines.append("")
    output_lines.append("=" * 70)
    output_lines.append("")

    # Group by category
    categories = {}
    for cmd_name, cmd_info in COMMAND_HELP.items():
        category = cmd_info.get('category', 'Other')
        if category not in categories:
            categories[category] = []
        categories[category].append((cmd_name, cmd_info))

    for category in sorted(categories.keys()):
        output_lines.append(f"{category}:")
        output_lines.append("-" * 70)
        for cmd_name, cmd_info in sorted(categories[category], key=lambda x: x[0]):
            output_lines.append(f"• {cmd_name}")
            output_lines.append(f"  {cmd_info.get('example', 'No example')}")
            output_lines.append("")

    output_lines.append("=" * 70)
    output_lines.append("For detailed help: python main.py send help <CommandName>")
    output_lines.append("=" * 70)

    # Build the message
    help_message = "\n".join(output_lines)

    response = ResponseBuilder.success("HelpReply", help_message)
    response["data"]["totalCommands"] = len(COMMAND_HELP)
    response["data"]["categories"] = {cat: [cmd[0] for cmd in cmds] for cat, cmds in categories.items()}

    return response