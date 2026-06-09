from functools import wraps
from stateMachine.WpAgentStateMachine import get_state_machine, WPAgentState
from utilities.WPResponseBuilder import ResponseBuilder


def requires_state(*required_states):
    """
    Decorator to check if command can execute in current state

    Usage:
        @requires_state(WPAgentState.OpenedProject, WPAgentState.Aligned)
        def my_command():
            # This only runs if in OpenedProject or Aligned state
            ...
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            sm = get_state_machine()
            current = sm.get_state()

            if current not in required_states:
                required_names = [s.name for s in required_states]
                return ResponseBuilder.error(
                    f"{func.__name__.title()}Reply",
                    f"Command requires state {', '.join(required_names)}. Current state: {current.name}",
                    400,
                )

            return func(*args, **kwargs)

        return wrapper

    return decorator


def transitions_to(target_state: WPAgentState):
    """
    Decorator!! to automatically transition to target state on success

    Usage:
        @transitions_to(WPAgentState.Aligned)
        def alignment():
            # Do alignment work
            return ResponseBuilder.success("AlignmentReply", "Aligned!")
            # State automatically transitions to Aligned
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)

            # Only transition if command succeeded
            if result.get("status") == "Success":
                sm = get_state_machine()
                sm.force_state(target_state)

            return result

        return wrapper

    return decorator


def with_state_transition(command_name: str):
    """
    Decorator that handles state transition based on command name

    Usage:
        @with_state_transition('OpenProject')
        def open_project():
            # Do work
            return ResponseBuilder.success("OpenProjectReply", "Opened!")
            # State transitions according to state machine rules
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            sm = get_state_machine()

            # Check if transition is valid
            if not sm.can_execute(command_name):
                available = sm.get_available_commands()
                return ResponseBuilder.error(
                    f"{command_name}Reply",
                    f"Cannot execute {command_name} in state {sm.get_state_name()}. "
                    + f"Available commands: {', '.join(available)}",
                    400,
                )

            # Execute command
            result = func(*args, **kwargs)

            # Transition state if successful
            if result.get("status") == "Success":
                sm.transition(command_name)
            else:
                # Enter error state on failure
                sm.enter_error_state(result.get("error", {}).get("message"))

            return result

        return wrapper

    return decorator


def get_current_state_info():
    """Get current state"""
    sm = get_state_machine()
    return {
        "current_state": sm.get_state_name(),
        "previous_state": sm.previous_state.name if sm.previous_state else None,
        "available_commands": sm.get_available_commands(),
        "current_command": sm.get_current_command(),
    }


def check_state_allows(command: str) -> tuple[bool, str]:
    """
    Check if current state allows the command

    Returns:
        (allowed, error_message)
    """
    sm = get_state_machine()

    if sm.can_execute(command):
        return (True, "")
    else:
        available = sm.get_available_commands()
        error_msg = (
            f"Cannot execute '{command}' in state '{sm.get_state_name()}'. "
            + f"Available: {', '.join(available)}"
        )
        return (False, error_msg)
