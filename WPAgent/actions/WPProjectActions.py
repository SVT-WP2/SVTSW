from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.WPFactory import get_prober, ProberFactory
from utilities.WPHelpers import (resolve_project_parameters, ensure_prober_initialized, check_prober_ready)
from utilities.WPResponseBuilder import ResponseBuilder
from services.WPDbKafkaClient import DBKafkaClient
import actions.WPDataBaseActions
import json
import os

from utilities.WPValidationDecorator import validate_command
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
                      initialization_mode=None, serialNumber=None, user=None, waferAgentName=None):
    """
    Initialize the WP agent with prober connection and DB sync

    Works with both real probers (sentio) and mock probers (mock)
    """
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
        # Detect mock mode
        is_mock = (machine_type.lower() == "mock")
        if is_mock:
            print(f"🎭 Mock mode detected - simulated prober")

        # ============================================================
        # INITIALIZE PROBER DIRECTLY VIA FACTORY
        # (Bypass ensure_prober_initialized helper)
        # ============================================================
        try:
            # Create prober via factory
            prober = factory.get_prober(machine_type, address)
            print(f"✅ Prober created successfully: {type(prober).__name__}")

            # Mark as initialized
            globals_.set_prober_status("initialized")

        except Exception as e:
            error_msg = f"Failed to create prober: {str(e)}"
            print(f"❌ {error_msg}")
            return ResponseBuilder.error("InitializeReply", error_msg, 500)
        # ============================================================

        # Store basic info
        globals_.set_address(address)
        globals_.set_machine_type(machine_type)

        # Update all payload fields
        if machine_id is not None:
            globals_.set_machine_id(machine_id)
            globals_.wp_machine_id = machine_id

        if machine_name:
            globals_.machine_name = machine_name

        if initialization_mode:
            globals_.initialization_mode = initialization_mode

        # Set user
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

        # ============================================================
        # DB INTEGRATION: Sync wafer and probe card from database
        # Skip for mock TODO: will be very good to reuse it and initialize with machineId from DB
        # ============================================================
        if machine_id and machine_id != 0 and is_mock == False:

                print("TEST")

                db_client = DBKafkaClient.get_instance()
                machines = db_client.get_all_wafer_probe_machines(timeout=15.0)

                # Find our machine
                our_machine = None
                for machine in machines:
                    if machine.get('id') == machine_id:
                        our_machine = machine
                        break

                if our_machine:
                    # Sync loaded wafer
                    wafer_id = our_machine.get('loadedWaferId')
                    wafer_orientation = our_machine.get('loadedWaferOrientation')

                    if wafer_id:
                        globals_.loaded_wafer_id = wafer_id
                        globals_.wafer_orientation = wafer_orientation
                        print(f"✓ Synced loaded wafer: ID={wafer_id}, orientation={wafer_orientation}")
                    else:
                        globals_.loaded_wafer_id = None
                        globals_.wafer_orientation = None
                        print(f"ℹ️  No wafer loaded in DB")

                    # Sync installed probe card
                    card_id = our_machine.get('installedProbeCardId')
                    card_orientation = our_machine.get('installedProbeCardOrientation')

                    if card_id:
                        globals_.probe_card_id = card_id
                        globals_.probe_card_orientation = card_orientation
                        print(f"✓ Synced probe card: ID={card_id}, orientation={card_orientation}")
                    else:
                        globals_.probe_card_id = None
                        globals_.probe_card_orientation = None
                        print(f"ℹ️  No probe card installed in DB")
        else:
            print(f"⚠️  Machine ID {machine_id} not found in database")


        # Set project
        if project_name:
            globals_.set_project_name(project_name)

            # Get project ID from DB if not provided
            if project_id:
                globals_.opened_project_id = project_id
            elif machine_id and machine_id != 0:
                # Try to get project ID from database by name
                try:
                    result = actions.WPDataBaseActions.get_project_id_by_name(project_name, timeout=15.0)
                    if result and result.get('status') == 'Success':
                        proj_id = result.get('data', {}).get('projectId')
                        if proj_id:
                            globals_.opened_project_id = proj_id
                            print(f"✓ Got project ID from DB: {proj_id}")
                    else:
                        globals_.opened_project_id = 0
                except:
                    globals_.opened_project_id = 0
            else:
                globals_.opened_project_id = 0

            # Open project on prober
            try:
                if is_mock:
                    # Mock prober - just use project name
                    prober.open_project(project_name)
                    print(f"MOCK: Opened project '{project_name}'")
                else:

                    project_path = os.path.join(str(globals_.projects_base_path)
                                                ,
                                                project_name
                                                )
                    prober.open_project(project_path)
                    print(f" Opened project '{project_name}'")

            except Exception as e:
                print(f"    Warning: Could not open project: {str(e)}")

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

        # Build output message
        if machine_name:
            output_msg = f"Initialized {machine_name} at {address}"
        else:
            output_msg = f"Initialized WP at {address}"

        if is_mock:
            output_msg += " (MOCK)"

        if project_name:
            output_msg += f" with project '{project_name}'"

        # Add DB sync info to message
        if machine_id and machine_id != 0 and globals_.loaded_wafer_id:
            output_msg += f"\n✓ Loaded wafer ID {globals_.loaded_wafer_id} ({globals_.wafer_orientation})"
        if machine_id and machine_id != 0 and globals_.probe_card_id:
            output_msg += f"\n✓ Probe card ID {globals_.probe_card_id} ({globals_.probe_card_orientation})"

        return ResponseBuilder.success("InitializeReply", output_msg)

    except Exception as e:
        import traceback
        traceback.print_exc()
        globals_.wpag_state = "WP_Error"
        error_msg = f"Initialization failed: {str(e)}"
        print(f"❌ {error_msg}")
        return ResponseBuilder.error("InitializeReply", error_msg, 500)


def get_project_status():
    """Get current project status"""
    try:
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
        from drivers.WPFactory import ProberFactory

        factory = ProberFactory.get_instance()
        g = SvtWPAagentGlobalParameters.getInstance()

        if not factory.is_initialized():
            return ResponseBuilder.error("ShowStatusReply", "Not initialized", 400)

        # Build readable summary
        parts = [
            f"Agent: {g.wpAgentName or 'Unknown'}",
            f"State: {g.wpag_state}",
            f"User: {g.user or 'None'}",
            f"Project: {g.projectName or 'None'}"
        ]

        if g.loaded_wafer_id:
            parts.append(f"Wafer: {g.loaded_wafer_id}")

        message = " | ".join(parts)

        return ResponseBuilder.success("ShowStatusReply", message)

    except Exception as e:
        return ResponseBuilder.error("ShowStatusReply", str(e), 500)


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


def reset_agent_state(user=None, waferAgentName=None):
    """Reset the agent state machine to Idle"""
    from stateMachine.WpAgentStateMachineGlobals import agentStateMachine

    old_state = agentStateMachine.get_state_name()

    agentStateMachine.transition('ResetAgent')

    agentStateMachine.reset()

    new_state = agentStateMachine.get_state_name()

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


def help_command(command=None, user=None, waferAgentName=None):
    """Displ   Display help information for commands.

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


def connect_probe_machine():
    pass
