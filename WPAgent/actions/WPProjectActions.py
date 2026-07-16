from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.WPFactory import get_prober, ProberFactory
from utilities.WPResponseBuilder import ResponseBuilder
from services.WPDbKafkaClient import DBKafkaClient
import actions.WPDataBaseActions
import json
import os


def _parse_die_position(die_string):
    """Parse die position string like '5,10,0' into dict"""
    try:
        parts = die_string.split(",")
        return {
            "col": int(parts[0]),
            "row": int(parts[1]),
            "subsite": int(parts[2]) if len(parts) > 2 else 0,
        }
    except Exception:
        return None


# =============================================================================
# Private helpers — each does exactly one thing
# =============================================================================

def _validate_init_params(factory, globals_, address, machine_type, force):
    """
    Check pre-conditions before touching any hardware or globals.
    Returns ResponseBuilder error on failure, None if OK.
    """
    if factory.is_initialized() and not force:
        return ResponseBuilder.success(
            "InitializeReply",
            f"Already initialized at {globals_.address}. Use force=True to reinitialize.",
        )
    if not address or not machine_type:
        return ResponseBuilder.error(
            "InitializeReply",
            "Initialization requires 'address' and 'machine_type' parameters.",
            400,
        )
    return None


def _connect_prober(factory, globals_, machine_type, address, force):
    """
    Create prober via factory and mark globals as initialized.
    Returns (prober, error_response). On success error_response is None.
    """
    if force:
        factory.reset()

    try:
        prober = factory.get_prober(machine_type, address)
        print(f"✅ Prober created successfully: {type(prober).__name__}")
        globals_.set_prober_status("initialized")
        return prober, None
    except Exception as e:
        error_msg = f"Failed to create prober: {str(e)}"
        print(f"❌ {error_msg}")
        return None, ResponseBuilder.error("InitializeReply", error_msg, 500)


def _store_globals(globals_, address, machine_type, machine_id, machine_name,
                   initialization_mode, serialNumber):
    """Store all basic globals after a successful prober connection."""
    globals_.set_address(address)
    globals_.set_machine_type(machine_type)

    if machine_id is not None:
        globals_.set_machine_id(machine_id)
        globals_.wpMachineId = machine_id

    if machine_name:
        globals_.machine_name = machine_name

    if initialization_mode:
        globals_.initialization_mode = initialization_mode

    if serialNumber:
        globals_.asicSerialNumber = serialNumber

    import getpass
    try:
        globals_.user = getpass.getuser()
    except Exception:
        globals_.user = "default_user"

    globals_.wpag_state = "ServiceOn"

def _sync_from_db(globals_, machine_id, is_mock):
    """
    Sync loaded wafer and probe card state from the database.
    Skipped silently for mock probers or when machine_id is missing.
    """
    if not machine_id or machine_id == 0:
        return

    try:
        db_client = DBKafkaClient.get_instance()
        machines = db_client.get_all_wafer_probe_machines(timeout=15.0)
        our_machine = next((m for m in machines if m.get("id") == machine_id), None)

        if not our_machine:
            print(f"⚠️  Machine ID {machine_id} not found in database")
            return

        # Sync wafer
        wafer_id = our_machine.get("loadedWaferId")
        if wafer_id:
            globals_.loaded_wafer_id = wafer_id
            # TODO: replace hardcoded "West" once DB provides orientation
            globals_.wafer_orientation = "West"
            print(f"✓ Synced loaded wafer: ID={wafer_id}, orientation={globals_.wafer_orientation}")
        else:
            globals_.loaded_wafer_id = None
            globals_.wafer_orientation = None
            print("ℹ️  No wafer loaded in DB")

        # Sync probe card
        card_id = our_machine.get("installedProbeCardId")
        if card_id:
            globals_.probe_card_id = card_id
            # TODO: replace hardcoded "West" once DB provides orientation
            globals_.probe_card_orientation = "West"
            print(f"✓ Synced probe card: ID={card_id}, orientation={globals_.probe_card_orientation}")
        else:
            globals_.probe_card_id = None
            globals_.probe_card_orientation = None
            print("ℹ️  No probe card installed in DB")

    except Exception as e:
        print(f"⚠️  DB sync failed (non-fatal): {str(e)}")


def _setup_project(globals_, prober, project_name, project_id, machine_id, is_mock,
                   alignment_die, home_die):
    """
    Set project name, resolve project ID from DB if needed, open project on prober,
    and store alignment/home die positions.
    """
    if not project_name:
        return

    globals_.set_project_name(project_name)

    # Resolve project ID
    if project_id:
        globals_.opened_project_id = project_id
    elif machine_id and machine_id != 0:
        try:
            result = actions.WPDataBaseActions.get_project_id_by_name(
                project_name, timeout=15.0
            )
            if result and result.get("status") == "Success":
                proj_id = result.get("data", {}).get("projectId")
                if proj_id:
                    globals_.opened_project_id = proj_id
                    print(f"✓ Got project ID from DB: {proj_id}")
            else:
                globals_.opened_project_id = 0
        except Exception:
            globals_.opened_project_id = 0
    else:
        globals_.opened_project_id = 0

    # Open project on prober
    try:
        if is_mock:
            prober.open_project(project_name)
            print(f"MOCK: Opened project '{project_name}'")
        else:
            project_path = os.path.join(str(globals_.projects_base_path), project_name)
            prober.open_project(project_path)
            print(f"✓ Opened project '{project_name}'")
    except Exception as e:
        print(f"⚠️  Warning: Could not open project: {str(e)}")

    # Store die positions
    if alignment_die:
        parsed = _parse_die_position(alignment_die)
        if parsed:
            globals_.set_alignment_die(parsed)

    if home_die:
        parsed = _parse_die_position(home_die)
        if parsed:
            globals_.set_home_die(parsed)


# =============================================================================
# Public entry point
# =============================================================================

def svt_initialise_wp(
        address=None,
        machine_type=None,
        project_name=None,
        alignment_die=None,
        home_die=None,
        force=False,
        machine_id=None,
        machine_name=None,
        project_id=None,
        asic_family=None,
        orientation=None,
        initialization_mode=None,
        serialNumber=None,
        user=None,
        waferAgentName=None,
):
    """
    Initialize the WP agent with prober connection and DB sync.
    Works with both real probers (sentio) and mock probers (mock).
    """
    globals_ = SvtWPAagentGlobalParameters.getInstance()
    factory = ProberFactory.get_instance()

    # 1. Guard checks
    early = _validate_init_params(factory, globals_, address, machine_type, force)
    if early:
        return early

    is_mock = machine_type.lower() == "mock"
    if is_mock:
        print("🔧 Mock mode detected - simulated prober")

    try:
        # 2. Connect prober
        prober, err = _connect_prober(factory, globals_, machine_type, address, force)
        if err:
            return err

        # 3. Store globals
        _store_globals(globals_, address, machine_type, machine_id, machine_name,
                       initialization_mode, serialNumber)

        # 4. Sync state from DB
        _sync_from_db(globals_, machine_id, is_mock)

        # 5. Setup project
        _setup_project(globals_, prober, project_name, project_id, machine_id, is_mock,
                       alignment_die, home_die)

        # Store extra metadata
        globals_.chuck_z_position_state = "Unknown"
        globals_.current_working_area = "LoadPosition"
        globals_.camera_mount_point = "Top"

        metadata = {}
        if project_id:
            metadata["project_id"] = project_id
        if asic_family:
            metadata["asic_family"] = asic_family
        if orientation:
            metadata["orientation"] = orientation
        if metadata:
            globals_.set_project_metadata(metadata)

        # Build output message
        output_msg = f"Initialized {machine_name or 'WP'} at {address}"
        if is_mock:
            output_msg += " (MOCK)"
        if project_name:
            output_msg += f" with project '{project_name}'"
        if machine_id and machine_id != 0 and globals_.loaded_wafer_id:
            output_msg += f"\n✓ Loaded wafer ID {globals_.loaded_wafer_id} ({globals_.wafer_orientation})"
        if machine_id and machine_id != 0 and globals_.probe_card_id:
            output_msg += f"\n✓ Probe card ID {globals_.probe_card_id} ({globals_.probe_card_orientation})"

        return ResponseBuilder.success("InitializeReply", output_msg)

    except Exception as e:
        import traceback
        traceback.print_exc()
        globals_.wpag_state = "WP_Error"
        return ResponseBuilder.error("InitializeReply", f"Initialization failed: {str(e)}", 500)


def reconnect_prober(user=None, waferAgentName=None):
    """
    Reconnect to the prober using the existing global parameters.
    Use when the connection was lost without restarting the listener.
    """
    globals_ = SvtWPAagentGlobalParameters.getInstance()
    factory = ProberFactory.get_instance()

    address = globals_.address
    machine_type = globals_.machineType
    machine_id = globals_.wpMachineId

    if not address or not machine_type:
        return ResponseBuilder.error(
            "ReconnectReply",
            "No previous connection found. Run Initialize first.",
            400,
        )

    print(f"\n🔄 Reconnecting to prober at {address} (type: {machine_type})...")

    try:
        # Force-reset the factory so a fresh connection is established
        factory.reset()

        prober, err = _connect_prober(factory, globals_, machine_type, address, force=True)
        if err:
            err["type"] = "ReconnectReply"
            return err

        # Restore state
        globals_.set_prober_status("initialized")
        globals_.wpag_state = "ServiceOn"

        # Re-sync wafer/probe-card state from DB
        is_mock = machine_type.lower() == "mock"
        _sync_from_db(globals_, machine_id, is_mock)

        print(f"✅ Reconnected to {address}")
        return ResponseBuilder.success(
            "ReconnectReply",
            f"Reconnected to {address} ({machine_type})",
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        globals_.wpag_state = "WP_Error"
        return ResponseBuilder.error("ReconnectReply", f"Reconnect failed: {str(e)}", 500)


def show_status(user=None, waferAgentName=None):
    """Get current project status"""
    try:
        factory = ProberFactory.get_instance()
        g = SvtWPAagentGlobalParameters.getInstance()

        if not factory.is_initialized():
            return ResponseBuilder.error("ShowStatusReply", "Not initialized", 400)

        parts = [
            f"Agent: {g.wpAgentName or 'Unknown'}",
            f"State: {g.wpag_state}",
            f"User: {g.userLogged or 'None'}",
            f"Project: {g.projectName or 'None'}",
        ]
        if g.loaded_wafer_id:
            parts.append(f"Wafer: {g.loaded_wafer_id}")

        return ResponseBuilder.success("ShowStatusReply", " | ".join(parts))

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
        current_index = prober.get_current_index()
        counts = prober.get_dies_number().split(",")
        parts = current_index.split(",")
        die_info = {
            "Number": int(parts[0]),
            "col": int(parts[1]),
            "row": int(parts[2]),
            "Count": int(counts[0]),
        }
        globals_.set_current_die(die_info["col"], die_info["row"], 0)

        message = (
            f"Current die: Count of selected dies {die_info['Count']}, "
            f"Number {die_info['Number']}, Row {die_info['row']}, Column {die_info['col']}"
        )
        return ResponseBuilder.success("GetInfoReply", message)

    except Exception as e:
        return ResponseBuilder.error("GetInfoReply", str(e), 500)


def reset_agent(user=None, waferAgentName=None):
    """Reset the agent state machine to Idle"""
    from stateMachine.WpAgentStateMachineGlobals import agentStateMachine

    old_state = agentStateMachine.get_state_name()
    agentStateMachine.transition("ResetAgent")
    agentStateMachine.reset()
    new_state = agentStateMachine.get_state_name()
    print(f"🔄 Agent state reset: {old_state} → {new_state}")

    return ResponseBuilder.success(
        "ResetAgentReply", f"✅ Agent state reset from '{old_state}' to '{new_state}'"
    )


def get_agent_state():
    """Get current agent state"""
    from stateMachine.WpAgentStateMachineGlobals import agentStateMachine

    state = agentStateMachine.get_state()
    current_command = agentStateMachine.get_current_command()
    message = f"Agent state: {state.name}"
    if current_command:
        message += f", Current command: {current_command}"
    return ResponseBuilder.success("GetAgentStateReply", message)


def help(command=None, user=None, waferAgentName=None):
    """Display help information for commands."""
    try:
        possible_paths = [
            "utilities/WPCommandsHelpList.json",
            "WPCommandsHelpList.json",
            os.path.join(os.path.dirname(__file__), "WPCommandsHelpList.json"),
            os.path.join(os.path.dirname(__file__), "..", "utilities", "WPCommandsHelpList.json"),
        ]

        COMMAND_HELP = None
        for path in possible_paths:
            if os.path.exists(path):
                with open(path, "r") as f:
                    COMMAND_HELP = json.load(f)
                break

        if COMMAND_HELP is None:
            return ResponseBuilder.error(
                "HelpReply",
                "Help file not found. Expected: utilities/WPCommandsHelpList.json",
                404,
            )

    except Exception as e:
        return ResponseBuilder.error("HelpReply", f"Failed to load help data: {str(e)}", 500)

    if command:
        if command not in COMMAND_HELP:
            return ResponseBuilder.error(
                "HelpReply",
                f"Command '{command}' not found. Use 'help' to see all commands.",
                404,
            )

        cmd_info = COMMAND_HELP[command]
        lines = [
            "=" * 70, f"Command: {command}", "=" * 70, "",
            f"Description: {cmd_info.get('description', 'No description')}",
            f"Category: {cmd_info.get('category', 'Unknown')}", "",
        ]

        if cmd_info.get("parameters"):
            lines.append("Parameters:")
            for param_name, param_info in cmd_info["parameters"].items():
                req = (
                    "REQUIRED" if param_info.get("required") is True
                    else "CONDITIONAL" if param_info.get("required") == "conditional"
                    else "optional"
                )
                lines.append(f"  • {param_name} ({param_info.get('type', 'unknown')}, {req})")
                lines.append(f"    {param_info.get('description', '')}")
        else:
            lines.append("Parameters: None")

        lines += ["", f"Example:", f"  {cmd_info.get('example', 'No example')}", "", "=" * 70]
        for key, value in cmd_info.items():
            if key.startswith("example_") and key != "example":
                lines.append(f"  {value}")

        response = ResponseBuilder.success("HelpReply", "\n".join(lines))
        _name = "commandInfo"
        response["data"][_name] = cmd_info  # type: ignore[index]
        return response

    # All commands
    lines = [
        "=" * 70, "WPAgent - Available Commands", "=" * 70, "",
        "Usage:", "  python main.py send <Command> [param1=value1]", "",
        "Get help for specific command:",
        "  python main.py send help <CommandName>", "",
        "=" * 70, "",
    ]

    categories: dict = {}
    for cmd_name, cmd_info in COMMAND_HELP.items():
        category = cmd_info.get("category", "Other")
        categories.setdefault(category, []).append((cmd_name, cmd_info))

    for category in sorted(categories):
        lines.append(f"{category}:")
        lines.append("-" * 70)
        for cmd_name, cmd_info in sorted(categories[category], key=lambda x: x[0]):
            lines.append(f"• {cmd_name}")
            lines.append(f"  {cmd_info.get('example', 'No example')}")
            lines.append("")

    lines += ["=" * 70, "For detailed help: python main.py send help <CommandName>", "=" * 70]

    response = ResponseBuilder.success("HelpReply", "\n".join(lines))
    response["data"]["totalCommands"] = len(COMMAND_HELP)  # type: ignore[index]
    response["data"]["categories"] = {  # type: ignore[index]
        cat: [cmd[0] for cmd in cmds] for cat, cmds in categories.items()
    }
    return response
