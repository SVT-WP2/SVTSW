import actions.WPProjectActions as project_actions
from utilities.WPResponseBuilder import ResponseBuilder
import actions.WPSequencerActions as sequencer_actions
from actions.WPSequencerActionsYAML import run_sequencer_yaml
import actions.WPDataBaseActions as database_actions
from utilities.WPAgentLogger import WPAgentLogger, Severity
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
import actions.WPTestingActions as testing_actions
import actions.WPCommandActions as command_actions
import actions.WPLoginActions as user_actions
import actions.WPImagingActions as imaging_actions

from utilities.WPCommandConstants import BYPASS_COMMANDS, VACUUM_SAFE_COMMANDS

def _yaml_command(yaml_path):
    """Returns a handler that runs a fixed YAML file via the sequencer."""
    def _handler(**data):
        return run_sequencer_yaml(
            filepath=yaml_path,
            executor=_exec_in_sequence,
            **{k: v for k, v in data.items() if k != "filepath"}
        )
    return _handler

COMMAND_ROUTER = {

    # Database
    "ListProbers": database_actions.list_probers,
    "ListChipTypes": database_actions.list_chip_types,

    # User Login/Logout
    "UserLogIn": user_actions.UserLogIn,
    "UserLogOut": user_actions.UserLogOut,

    # General
    "Initialize": project_actions.svt_initialise_wp,
    # "Reconnect": project_actions.reconnect_prober,
    "ShowStatus": project_actions.show_status,
    "GetInfo": project_actions.get_info,  # !! irrelevant
    "Help": project_actions.help,
    "LocalMode": testing_actions.local_mode,

    # Loading/Unloading
    "LoadWafer": testing_actions.load_wafer,
    "UnloadWafer": testing_actions.unload_wafer,
    "MoveChuckLoadedWafer": testing_actions.move_chuck_loaded_wafer,
    "MoveChuckUnloadWafer": testing_actions.move_chuck_unloaded_wafer,

    # Project
    "OpenProject": testing_actions.open_project,
    "StressOpenProject": testing_actions.stress_open_project,

    # Optical
    "FindHome": testing_actions.find_home,
    "AutoFocus": testing_actions.auto_focus,
    "AlignWafer": testing_actions.align_wafer,
    "SwitchCamera": testing_actions.switch_camera,

    # Movement
    "MoveChuckCenter": testing_actions.move_chuck_center,
    "MoveChuckXY": testing_actions.move_chuck_xy,
    "MoveChuckZ": testing_actions.move_chuck_z,
    "MoveChuckRowColumn": testing_actions.move_chuck_die,
    "MoveChuckAsic": testing_actions.move_chuck_asic,
    "MoveChuckNextDie": testing_actions.move_chuck_next_die,
    "MoveChuckPreviousDie": testing_actions.move_chuck_previous_die,
    "MoveChuckHome": testing_actions.move_chuck_home,
    "MoveChuckToWorkArea": testing_actions.move_chuck_work_area,
    "MoveChuckContact": testing_actions.move_chuck_contact,
    "MoveChuckSeparation": testing_actions.move_chuck_separation,
    "MoveChuckSafePosition": testing_actions.move_chuck_safe_position,
    "InitProbing": testing_actions.init_probing,
    "GetChuckPosition": testing_actions.get_chuck_position,

    # Pad Offset Movement
    "MoveChuckTopLeft": testing_actions.move_chuck_top_left,
    "MoveChuckTopRight": testing_actions.move_chuck_top_right,
    "MoveChuckBottomLeft": testing_actions.move_chuck_bottom_left,
    "MoveChuckBottomRight": testing_actions.move_chuck_bottom_right,

    # PTPA
    "RunPTPA": testing_actions.run_ptpa,
    "SetPTPA": testing_actions.set_ptpa,
    "SetChuckOvertravel": testing_actions.set_chuck_overtravel,
    "DisableOvertravel": testing_actions.disable_overtravel,
    "MoveChuckWide": testing_actions.move_chuck_wide,
    "MoveChuckOffAxis": testing_actions.move_chuck_offaxis,

    # Imaging
    "TakeScreenshot": imaging_actions.take_screenshot,
    "TakeImage": imaging_actions.take_image,
    "TakeImageWafer":  _yaml_command("sequencer/TakeImageWafer.yaml"),
    "TakeImageBAM":    _yaml_command("sequencer/TakeImageBAM.yaml"),
    "TakeImageSEG":    _yaml_command("sequencer/TakeImageSEG.yaml"),
    "TakeImageLEC":    _yaml_command("sequencer/TakeImageLEC.yaml"),
    "TakeImageL2":    _yaml_command("sequencer/TakeImageL2.yaml"),
    "TakeImageL1_0-3":    _yaml_command("sequencer/TakeImageL1_0-3.yaml"),
    "TakeImageL1_1-4":    _yaml_command("sequencer/TakeImageL1_1-4.yaml"),
    "TakeImageL0_0-2":    _yaml_command("sequencer/TakeImageL0_0-2.yaml"),
    "TakeImageL0_1-3":    _yaml_command("sequencer/TakeImageL0_1-3.yaml"),
    "TakeImageL0_2-4":    _yaml_command("sequencer/TakeImageL0_2-4.yaml"),
    "BrightnessCorrection": _yaml_command("sequencer/BrightnessCorrection.yaml"),

    # FSM State management commands (bypass state check)
    "ResetAgent": project_actions.reset_agent,
    "GetAgentState": project_actions.get_agent_state,  # !! irrelevant
    "TestingLock": testing_actions.testing_lock,
    "TestingUnlock": testing_actions.testing_unlock,

    # Sequencer
    "RunSequencer": lambda **data: sequencer_actions.run_sequencer(
        filepath=get_filepath_param(data if data else None), executor=_exec_in_sequence
    ),
    "RunSequencerYAML": lambda **data: run_sequencer_yaml(
        filepath=get_filepath_param(data if data else None),
        executor=_exec_in_sequence,
        **{k: v for k, v in data.items() if k != "filepath"}
    ),

    # Sequencer Specific
    "ComputeCouplingConstants": imaging_actions.compute_coupling_constants,
    "GetChuckXY": imaging_actions.get_chuck_xy,
    "BuildFlatfield": imaging_actions.build_flatfield_for_folder,
    "GenerateRasterSteps": imaging_actions.generate_raster_steps,
    "MoveChuckXYPrecise": imaging_actions.move_chuck_xy_precise,
    "Sleep": imaging_actions.sleep,
    "StitchImagesFull": imaging_actions.stitch_images_large_for_wafer,
    "CropImage": imaging_actions.crop_stitched_image,
    "CleanupRasterImages": imaging_actions.cleanup_raster_images,
    "ArchiveImaging": imaging_actions.archive_imaging,
    "DeleteImagingFolder": imaging_actions.delete_imaging_folder,
}

COMMAND_ROUTER["ListAvailableCommands"] = (
    lambda **kwargs: command_actions.list_available_commands(COMMAND_ROUTER, **kwargs)
)

# Instantiation of logger
logger = WPAgentLogger()

def _exec_in_sequence(message_type, data=None):
    """
    Execute command in sequence (for sequencer)
    No state management here - handled by individual commands
    """
    return execute_command(message_type, data)


def _check_vacuum() -> bool:
    """
    Returns True if vacuum is OK (or prober not yet initialized).
    Returns False if vacuum is confirmed lost — command should be blocked.
    Fails open: if the check itself errors, returns True to avoid false blocks.
    """
    try:
        from drivers.WPFactory import ProberFactory
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
        factory = ProberFactory.get_instance()
        if not factory.is_initialized():
            return True
        g = SvtWPAagentGlobalParameters.getInstance()
        prober = factory.get_prober(g.machineType, g.address)
        print(prober.get_vacuum_status())
        return prober.get_vacuum_status()
    except Exception:
        return True  # fail open


def _try_local_mode():
    """Try to set prober to local mode after error"""
    try:
        from drivers.WPFactory import ProberFactory
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

        factory = ProberFactory.get_instance()
        if factory.is_initialized():
            globals_ = SvtWPAagentGlobalParameters.getInstance()
            prober = factory.get_prober(globals_.machineType, globals_.address)
            prober.local_mode()
            print("   🔓 Switched to local mode after error")
    except Exception:
        pass


def get_filepath_param(data):
    """Extract filepath from data"""
    # If data is already a string (CLI/kafka sent just a path)
    if isinstance(data, str) and data.endswith(".json"):
        return data
    # If data is a dict
    if isinstance(data, dict):
        if "filepath" in data:
            return data["filepath"]
        for k in data:
            if isinstance(k, str) and k.endswith(".json"):
                return k
    return None


def _normalize_boolean_param(value):
    """
    Normalize various boolean representations to Python bool.
    Handles: "true"/"false", "True"/"False", "1"/"0", 1/0, True/False
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ("true", "1", "yes")
    if isinstance(value, int):
        return value != 0
    return False


def execute_command(message_type, data=None):
    """
    Execute command via router

    """
    # Normalize data
    if isinstance(data, str):
        if message_type == "RunSequencer" and data.endswith(".json"):
            data = {"filepath": data}
        elif "=" in data:
            k, v = data.split("=", 1)
            data = {k: v}
        else:
            data = {}
    elif data is None:
        data = {}
    elif not isinstance(data, dict):
        try:
            data = dict(data)
        except Exception:
            data = {}



    # Check if command exists
    if message_type not in COMMAND_ROUTER:
        msg = f"Unknown command: {message_type}"
        result = ResponseBuilder.error(f"{message_type}Reply", msg, 404)
        logger.log_command(msg, Severity.ERROR, message_type, data, result)
        return result

    # Check if command can be executed (unless bypass)
    if message_type not in BYPASS_COMMANDS:
        if not agentStateMachine.can_execute(message_type):
            available = agentStateMachine.get_available_commands()
            current_state = agentStateMachine.get_state_name()
            msg = (
                f"Command '{message_type}' not allowed in state '{current_state}'. "
                f"Available: {', '.join(available)}"
            )
            result = ResponseBuilder.error(f"{message_type}Reply", msg, 409)
            logger.log_command(msg, Severity.WARNING, message_type, data, result)
            return result

    # Vacuum safety check — block any physical operation if vacuum is lost
    if message_type not in VACUUM_SAFE_COMMANDS:
        if not _check_vacuum():
            msg = f"Vacuum lost — '{message_type}' blocked for safety. Restore vacuum before continuing."
            result = ResponseBuilder.error(f"{message_type}Reply", msg, 503)
            logger.log_command(msg, Severity.ERROR, message_type, data, result)
            return result

    try:
        # Execute the command
        # NOTE: State transitions are now handled INSIDE each command function
        action = COMMAND_ROUTER[message_type]
        result = action(**data)

        # Determine severity based on result
        if result.get("status", "") == "Success":
            severity = Severity.INFO
        else:
            # Check if it's a parameter error (less severe)
            error_msg = result.get("error", {}).get("message", "").lower()
            if any(
                kw in error_msg for kw in ["missing", "invalid parameter", "required"]
            ):
                severity = Severity.WARNING
            else:
                severity = Severity.ERROR
                _try_local_mode()  # Try to recover by going to local mode

    except Exception as e:
        import traceback

        traceback.print_exc()

        result = ResponseBuilder.error("UnhandledErrorReply", str(e), 500)
        severity = Severity.ERROR

        # If command threw exception, put state machine in error state
        if message_type not in BYPASS_COMMANDS:
            agentStateMachine.enter_error_state(str(e))

        _try_local_mode()  # Try to recover

    # Log the command execution — read message from standard ResponseBuilder envelope
    log_msg = result.get("error", {}).get("message", "")
    logger.log_command(log_msg, severity, message_type, data, result)

    return result
