import actions.WPTestingActions as testing_actions
import actions.WPProjectActions as project_actions
import actions.WPSequencerActions as sequencer_actions
import actions.WPCommandActions as command_actions
from WPAgentUtilities.WPAgentLogger import WPAgentLogger, Severity
from SVTWpAgentStateMachine.SvtWpAgentStateMachine import SvtWpAgentEvent
from SVTWpAgentStateMachine.SvtWpAgentStateMachineGlobals import agentStateMachine

from services.listener_heartbeat import ListenerHealthCheck


COMMAND_ROUTER = {
    #  Testing Actions
    "MoveChuckXY": testing_actions.move_chuck_xy,
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

    #  Project Init
    "InitializeTestingProject": project_actions.initialise_testing_project,
    "Initialize": project_actions.svt_initialise_wp,
    "ShowProjectStatus": project_actions.get_project_status,

    #  Sequencer Actions
    "RunSequencer": lambda **params: sequencer_actions.run_sequence(
        filepath=get_filepath_param(params if params else None),
        executor=_exec_in_sequence
    )
}

COMMAND_ROUTER["ListAvailableCommands"] = lambda **kwargs: command_actions.list_available_commands(COMMAND_ROUTER, **kwargs)

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


def execute_command(message_type, params=None):
    # --- Normalize params so we never try ** on a string ---
    if isinstance(params, str):
        # common cases:
        # RunSequencer "sequencer/TestSequance.json"
        if message_type == "RunSequencer" and params.endswith(".json"):
            params = {"filepath": params}
        # also tolerate "key=value" form
        elif "=" in params:
            k, v = params.split("=", 1)
            params = {k: v}
        else:
            params = {}
    elif params is None:
        params = {}
    elif not isinstance(params, dict):
        # last-resort normalization
        try:
            params = dict(params)
        except Exception:
            params = {}

    if message_type not in COMMAND_ROUTER:
        result = {"status": "error", "output": f"Unknown command: {message_type}"}
        logger.log_command(f"Unknown command: {message_type}", Severity.ERROR, message_type, params, result)
        return result

    # ✅ CHECK IF AGENT IS BUSY (NEW!)
    can_execute, reason = agentStateMachine.canExecute(message_type)
    if not can_execute:
        result = {
            "status": "error",
            "output": reason
        }
        logger.log_command(reason, Severity.WARNING, message_type, params, result)
        return result

    try:
        # Set current command and start execution
        agentStateMachine.setCurrentCommand(message_type)
        agentStateMachine.updateState(SvtWpAgentEvent.Start)

        action = COMMAND_ROUTER[message_type]
        result = action(**params)

        if result.get("status") == "success":
            agentStateMachine.updateState(SvtWpAgentEvent.Success)
            severity = Severity.INFO
        else:
            agentStateMachine.updateState(SvtWpAgentEvent.Error)
            severity = Severity.ERROR

    except Exception as e:
        result = {"status": "error", "output": str(e)}
        agentStateMachine.updateState(SvtWpAgentEvent.Error)
        severity = Severity.ERROR

    logger.log_command(result.get("output", ""), severity, message_type, params, result)
    return result