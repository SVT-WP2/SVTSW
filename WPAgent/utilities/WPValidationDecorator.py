import contextvars
from functools import wraps
from utilities.WPValidator import get_validator
from typing import Callable

# ── reply-type context ────────────────────────────────────────────────────────
# The decorator sets this before calling the function; the function reads it
# with get_reply_type() instead of hardcoding the string.

_reply_type_ctx: contextvars.ContextVar[str] = contextvars.ContextVar(
    "current_reply_type", default=""
)


def get_reply_type() -> str:
    """Return the reply type for the currently executing command.

    Call this at the top of any @validate_command function:

        reply = get_reply_type()   # e.g. "LoadWaferReply"
        return ResponseBuilder.success(reply, "done")

    The value is set automatically by @validate_command from the function name:
        load_wafer  →  LoadWaferReply
        move_chuck_contact  →  MoveChuckContactReply
    """
    return _reply_type_ctx.get()


# ── decorators ────────────────────────────────────────────────────────────────

def validate_command(func: Callable) -> Callable:
    """
    Decorator that automatically validates command execution and injects
    the reply type into the execution context.

    The reply type is derived from the function name:
        open_project  →  OpenProject  →  OpenProjectReply

    Inside the decorated function call get_reply_type() instead of
    hardcoding the reply type string:

        @validate_command
        def load_wafer(waferId=None, user=None, waferAgentName=None):
            reply = get_reply_type()          # "LoadWaferReply"
            return ResponseBuilder.success(reply, "Wafer loaded")
    """

    @wraps(func)
    def wrapper(*args, **kwargs):
        validator = get_validator()

        # Derive command name and reply type from the function name
        func_name = func.__name__
        command_name = "".join(word.capitalize() for word in func_name.split("_"))
        reply_type = f"{command_name}Reply"

        payload_user = kwargs.get("user")
        payload_agent_name = kwargs.get("waferAgentName")

        params = {
            k: v
            for k, v in kwargs.items()
            if k not in ["user", "waferAgentName"] and not k.startswith("_")
        }

        validation_error = validator.validate_command(
            command=command_name,
            params=params,
            payload_user=payload_user,
            payload_agent_name=payload_agent_name,
            reply_type=reply_type,
        )

        if validation_error:
            return validation_error

        # Inject reply type into context so the function body can read it
        token = _reply_type_ctx.set(reply_type)
        try:
            return func(*args, **kwargs)
        finally:
            _reply_type_ctx.reset(token)

    return wrapper


def validate_command_with_name(command_name: str):
    """
    Decorator that validates with an explicit command name.

    Use when the function name does not match the command name:

        @validate_command_with_name("Initialize")
        def svt_initialise_wp(address=None, ...):
            reply = get_reply_type()   # "InitializeReply"
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            validator = get_validator()
            reply_type = f"{command_name}Reply"

            payload_user = kwargs.get("user")
            payload_agent_name = kwargs.get("waferAgentName")

            params = {
                k: v
                for k, v in kwargs.items()
                if k not in ["user", "waferAgentName"] and not k.startswith("_")
            }

            validation_error = validator.validate_command(
                command=command_name,
                params=params,
                payload_user=payload_user,
                payload_agent_name=payload_agent_name,
                reply_type=reply_type,
            )

            if validation_error:
                return validation_error

            token = _reply_type_ctx.set(reply_type)
            try:
                return func(*args, **kwargs)
            finally:
                _reply_type_ctx.reset(token)

        return wrapper

    return decorator
