import actions.WPProjectActions as project_actions
import actions.WPSequencerActions as sequencer_actions
import actions.WPDataBaseActions as database_actions
from utilities.WPAgentLogger import WPAgentLogger, Severity
from stateMachine.SvtWpAgentStateMachine import SvtWpAgentEvent
from stateMachine.SvtWpAgentStateMachineGlobals import agentStateMachine
import actions.WPTestingActions as testing_actions
import actions.WPCommandActions as command_actions

from services.listener_heartbeat import ListenerHealthCheck

COMMAND_ROUTER = {

    "MoveChuckXY": testing_actions.move_chuck_xy,
    "MoveChuckZ": testing_actions.move_chuck_z,
    "RunPTPA": testing_actions.run_ptpa,
    "StepNextDie": testing_actions.step_next_die,
    "GoToDie": testing_actions.go_to_die,
    "OpenProject": testing_actions.open_project,
    "FindHome": testing_actions.find_home,
    "SwitchCamera": testing_actions.switch_camera,
    "MoveChuckHome": testing_actions.move_chuck_home,
    "Unload": testing_actions.unload_wafer,
    "Cleaning": testing_actions.clean_probe_station,
    "AlignWafer": testing_actions.align_wafer,
    "GoToContact": testing_actions.go_to_contact,
    "GoToSeparation": testing_actions.go_to_separation,
    "AutoFocus": testing_actions.auto_focus,
    "Load": testing_actions.load_wafer,
    "MoveChuckToWorkArea": testing_actions.move_chuck_work_area,
    "LocalMode": testing_actions.local_state,

    #  Project Init
    "Initialize": project_actions.svt_initialise_wp,
    "ShowProjectStatus": project_actions.get_project_status,
    "GetInfo":project_actions.get_info,
    "help":project_actions.help_command,

    #  Sequencer
    "RunSequencer": lambda **params: sequencer_actions.run_sequence(
        filepath=get_filepath_param(params if params else None),
        executor=_exec_in_sequence
    ),

    #  Database Actions
    "ListProbers": database_actions.list_probers,
    "ListChipTypes": database_actions.list_chip_types,
    "ListOrientations": database_actions.list_orientations,

    # State management commands (bypass state check)
    "ResetAgent": project_actions.reset_agent_state,
    "GetAgentState": project_actions.get_agent_state,
}

COMMAND_ROUTER["ListAvailableCommands"] = lambda **kwargs: command_actions.list_available_commands(COMMAND_ROUTER,
                                                                                                   **kwargs)

# Instantiation of logger
logger = WPAgentLogger(
    kafka_enabled=True,
    kafka_servers='localhost:9092',
    severity_threshold=Severity.CRITICAL  # Only WARNING and above go to Kafka
)

health_check = ListenerHealthCheck(bootstrap_servers='localhost:9092')


def _exec_in_sequence(message_type, params=None):
    # if the agent is busy, nudge it to a ready/idle state
    if not agentStateMachine.isReadyToExecute():
        try:
            agentStateMachine.updateState(SvtWpAgentEvent.Success)
        except Exception:
            pass
    return execute_command(message_type, params)


def get_filepath_param(params):
    # If params is already a string (CLI/kafka sent just a path)
    if isinstance(params, str) and params.endswith(".json"):
        return params
    # If params is a dict
    if isinstance(params, dict):
        if "filepath" in params:
            return params["filepath"]
        for k in params:
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


def execute_command(message_type, params=None):
    # Normalize params
    if isinstance(params, str):
        if message_type == "RunSequencer" and params.endswith(".json"):
            params = {"filepath": params}
        elif "=" in params:
            k, v = params.split("=", 1)
            params = {k: v}
        else:
            params = {}
    elif params is None:
        params = {}
    elif not isinstance(params, dict):
        try:
            params = dict(params)
        except Exception:
            params = {}

    # Commands that bypass state check
    BYPASS_STATE_CHECK = ["ResetAgent", "GetAgentState"]

    if message_type not in COMMAND_ROUTER:
        result = {"status": "error", "output": f"Unknown command: {message_type}"}
        logger.log_command(f"Unknown command: {message_type}", Severity.ERROR, message_type, params, result)
        return result

    # Check if agent can execute (unless bypass command)
    if message_type not in BYPASS_STATE_CHECK:
        can_execute, reason = agentStateMachine.canExecute(message_type)
        if not can_execute:
            result = {
                "status": "error",
                "output": reason
            }
            logger.log_command(reason, Severity.WARNING, message_type, params, result)
            return result

    try:
        # Set current command and start execution (unless bypass)
        if message_type not in BYPASS_STATE_CHECK:
            agentStateMachine.setCurrentCommand(message_type)
            agentStateMachine.updateState(SvtWpAgentEvent.Start)

        action = COMMAND_ROUTER[message_type]
        result = action(**params)

        # Update state based on result (unless bypass)
        if message_type not in BYPASS_STATE_CHECK:
            if result.get("status") == "success":
                agentStateMachine.updateState(SvtWpAgentEvent.Success)
                severity = Severity.INFO
            else:
                # Check if parameter error (don't fail agent)
                error_msg = result.get("output", "").lower()
                if any(kw in error_msg for kw in ["missing", "invalid parameter", "required"]):
                    agentStateMachine._reset()  # Reset without failing
                    severity = Severity.WARNING
                else:
                    agentStateMachine.updateState(SvtWpAgentEvent.Error)
                    severity = Severity.ERROR
        else:
            severity = Severity.INFO

    except Exception as e:
        import traceback
        traceback.print_exc()
        result = {"status": "error", "output": str(e)}
        if message_type not in BYPASS_STATE_CHECK:
            agentStateMachine.updateState(SvtWpAgentEvent.Error)
        severity = Severity.ERROR

    logger.log_command(result.get("output", ""), severity, message_type, params, result)
    return result




