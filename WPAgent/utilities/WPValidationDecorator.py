from functools import wraps
from utilities.WPValidator import get_validator
from typing import Callable


def validate_command(func: Callable) -> Callable:
    """
    Decorator that automatically validates command execution

    Extracts:
    - Command name from function name (converts snake_case to PascalCase)
    - Parameters from function arguments
    - user and waferAgentName from kwargs

    Example:
        @validate_command
        def open_project(asicSerialNumber: str, user=None, waferAgentName=None, **kwargs):
            # Validation happens automatically before this code runs!
            return ResponseBuilder.success("OpenProjectReply", "Success")
    """

    @wraps(func)
    def wrapper(*args, **kwargs):
        # Get validator instance
        validator = get_validator()

        # Extract command name from function name
        # Example: open_project -> OpenProject
        func_name = func.__name__
        command_name = "".join(word.capitalize() for word in func_name.split("_"))

        # Extract user and waferAgentName from kwargs
        payload_user = kwargs.get("user")
        payload_agent_name = kwargs.get("waferAgentName")

        # Build params dict (exclude user, waferAgentName, and other special kwargs)
        params = {
            k: v
            for k, v in kwargs.items()
            if k not in ["user", "waferAgentName"] and not k.startswith("_")
        }

        # Determine reply type
        reply_type = f"{command_name}Reply"

        # Validate!
        validation_error = validator.validate_command(
            command=command_name,
            params=params,
            payload_user=payload_user,
            payload_agent_name=payload_agent_name,
            reply_type=reply_type,
        )

        if validation_error:
            return validation_error

        # Validation passed - execute the function
        return func(*args, **kwargs)

    return wrapper


def validate_command_with_name(command_name: str):
    """
    Decorator that validates with explicit command name

    Use when function name doesn't match command name

    Example:
        @validate_command_with_name("OpenProject")
        def svt_open_project(asicSerialNumber: str, user=None, waferAgentName=None, **kwargs):
            # Validation happens automatically!
            return ResponseBuilder.success("OpenProjectReply", "Success")
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            validator = get_validator()

            payload_user = kwargs.get("user")
            payload_agent_name = kwargs.get("waferAgentName")

            params = {
                k: v
                for k, v in kwargs.items()
                if k not in ["user", "waferAgentName"] and not k.startswith("_")
            }

            reply_type = f"{command_name}Reply"

            validation_error = validator.validate_command(
                command=command_name,
                params=params,
                payload_user=payload_user,
                payload_agent_name=payload_agent_name,
                reply_type=reply_type,
            )

            if validation_error:
                return validation_error

            return func(*args, **kwargs)

        return wrapper

    return decorator
