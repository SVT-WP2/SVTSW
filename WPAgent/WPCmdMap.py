import actions.WPProjectActions as project_actions
import actions.WPSequencerActions as sequencer_actions
import actions.WPDataBaseActions as database_actions
from utilities.WPAgentLogger import WPAgentLogger, Severity
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
import actions.WPTestingActions as testing_actions
import actions.WPCommandActions as command_actions
import actions.WPLoginActions as user_actions

from services.WPListenerHeartbeat import ListenerHealthCheck

COMMAND_ROUTER = {
    # Testing/Movement Commands
    "MoveChuckXY": testing_actions.move_chuck_xy,
    "MoveChuckZ": testing_actions.move_chuck_z,
    "RunPTPA": testing_actions.run_ptpa,
    "MoveChuckNextDie": testing_actions.move_chuck_next_die,
    "MoveChuckRowColumn": testing_actions.move_chuck_die,
    "OpenProject": testing_actions.open_project,
    "FindHome": testing_actions.find_home,
    "SwitchCamera": testing_actions.switch_camera,
    "MoveChuckHome": testing_actions.move_chuck_home,
    "UnloadWafer": testing_actions.unload_wafer,
    "AlignWafer": testing_actions.align_wafer,
    "MoveChuckContact": testing_actions.move_chuck_contact,
    "MoveChuckSeparation": testing_actions.Move_chuck_separation,
    "AutoFocus": testing_actions.auto_focus,
    "LoadWafer": testing_actions.load_wafer,
    "MoveChuckToWorkArea": testing_actions.move_chuck_work_area,
    "LocalMode": testing_actions.local_mode,
    "MoveChuckPreviousDie": testing_actions.move_chuck_previous_die,
    "SetOvertravel": testing_actions.set_chuck_overtravel,
    "DisableOvertravel": testing_actions.disable_chuck_overtravel,
    "GetChuckPosition": testing_actions.get_chuck_position,
    "MoveChuckCenter": testing_actions.move_chuck_center,

    # Project Init
    "Initialize": project_actions.svt_initialise_wp,
    "ShowStatus": project_actions.get_project_status,
    "GetInfo": project_actions.get_info,  # !! irrelevant
    "Help": project_actions.help_command,

    # Sequencer
    "RunSequencer": lambda **data: sequencer_actions.run_sequencer(
        filepath=get_filepath_param(data if data else None),
        executor=_exec_in_sequence
    ),

    # Database Actions
    "ListProbers": database_actions.list_probers,
    "ListChipTypes": database_actions.list_chip_types,

    # User Login/Logout Actions
    "UserLogIn": user_actions.UserLogIn,
    "UserLogOut": user_actions.UserLogOut,

    # State management commands (bypass state check)
    "ResetAgent": project_actions.reset_agent_state,
    "GetAgentState": project_actions.get_agent_state,  # !! irrelevant

    "MoveChuckLoadedWafer": testing_actions.move_chuck_loaded_wafer,
    "MoveChuckUnloadWafer": testing_actions.move_chuck_unloaded_wafer,
    "MoveChuckAsic": testing_actions.move_chuck_asic,
    "MoveChuckSafePosition": testing_actions.move_chuck_safe_position,
    "MoveChuckWide": testing_actions.move_chuck_wide,
    "TestingLock": testing_actions.testing_lock,
    "TestingUnLock": testing_actions.testing_unlock,
    "ChangeProject": testing_actions.change_project,
    "ConnectProbeMachine": project_actions.connect_probe_machine,

}

COMMAND_ROUTER["ListAvailableCommands"] = lambda **kwargs: command_actions.list_available_commands(
    COMMAND_ROUTER, **kwargs
)

# Instantiation of logger
logger = WPAgentLogger(
    kafka_enabled=True,
    kafka_servers='svmithi02:9096',
    severity_threshold=Severity.CRITICAL  # Only WARNING and above go to Kafka
)

health_check = ListenerHealthCheck(bootstrap_servers='svmithi02:9096')


def _exec_in_sequence(message_type, data=None):
    """
    Execute command in sequence (for sequencer)
    No state management here - handled by individual commands
    """
    return execute_command(message_type, data)


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
    except:
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
        return value.lower() in ('true', '1', 'yes')
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

    # Commands that bypass state check completely
    BYPASS_STATE_CHECK = [
        "ResetAgent",
        "GetAgentState",
        "UserLogIn",  # Login must work from any state
        "UserLogOut",  # Logout must work from any state
        "GetInfo",  # Info queries don't change state
        "ShowProjectStatus",
        "ListProbers",
        "ListChipTypes",
        "ListAvailableCommands",
        "help"
    ]

    # Check if command exists
    if message_type not in COMMAND_ROUTER:
        result = {"status": "error", "output": f"Unknown command: {message_type}"}
        logger.log_command(
            f"Unknown command: {message_type}",
            Severity.ERROR,
            message_type,
            data,
            result
        )
        return result

    # Check if command can be executed (unless bypass)
    if message_type not in BYPASS_STATE_CHECK:
        if not agentStateMachine.can_execute(message_type):
            available = agentStateMachine.get_available_commands()
            current_state = agentStateMachine.get_state_name()

            result = {
                "status": "error",
                "output": f"Command '{message_type}' not allowed in state '{current_state}'. Available: {', '.join(available)}"
            }
            logger.log_command(
                result["output"],
                Severity.WARNING,
                message_type,
                data,
                result
            )
            return result

    try:
        # Execute the command
        # NOTE: State transitions are now handled INSIDE each command function
        action = COMMAND_ROUTER[message_type]
        result = action(**data)

        # Determine severity based on result
        if result.get("status", "").lower() == "success":
            severity = Severity.INFO
        else:
            # Check if it's a parameter error (less severe)
            error_msg = result.get("output", "").lower()
            if any(kw in error_msg for kw in ["missing", "invalid parameter", "required"]):
                severity = Severity.WARNING
            else:
                severity = Severity.ERROR
                _try_local_mode()  # Try to recover by going to local mode

    except Exception as e:
        import traceback
        traceback.print_exc()

        result = {"status": "error", "output": str(e)}
        severity = Severity.ERROR

        # If command threw exception, put state machine in error state
        if message_type not in BYPASS_STATE_CHECK:
            agentStateMachine.enter_error_state(str(e))

        _try_local_mode()  # Try to recover

    # Log the command execution
    logger.log_command(
        result.get("output", ""),
        severity,
        message_type,
        data,
        result
    )

    return result
