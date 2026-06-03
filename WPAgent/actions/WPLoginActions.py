""" """

import json
from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
from stateMachine.WpAgentStateMachine import WPAgentState
from utilities.WPResponseBuilder import ResponseBuilder
from utilities.WPValidationDecorator import validate_command_with_name, get_reply_type
import actions.WPTestingActions as testingActions
from drivers.WPFactory import get_current_prober


def _safe_update_info(prober):
    """Update prober state — non-fatal if prober is still warming up after reconnect."""
    try:
        testingActions.update_current_info(currentProber=prober)
    except Exception as e:
        print(f"⚠️  Could not update prober info (non-fatal): {str(e)}")


import pathlib

_HERE = pathlib.Path(__file__).parent.parent  # WPAgent/
HIERARCHY_CONFIG_PATH = str(_HERE / "configs" / "WPUserHierarchy.json")


def _load_user_hierarchy() -> dict:
    try:
        with open(HIERARCHY_CONFIG_PATH, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Warning: {HIERARCHY_CONFIG_PATH} not found.")
        return {}


def _get_user_hierarchy(user: str) -> str:
    hierarchy = _load_user_hierarchy()
    for level, users in hierarchy.items():
        if user in users:
            return level
    return None


@validate_command_with_name("UserLogIn")
def UserLogIn(
    user: str, waferAgentName: str = None, address: str = None, machineType: str = None
) -> dict:
    """
    User login - sets state based on hierarchy.

    Developer -> UsedByDeveloper state (ALL commands allowed)
    Other users -> UserLogged state (normal workflow)
    """
    reply = get_reply_type()
    g = SvtWPAagentGlobalParameters.getInstance()
    g_userLogged = g.userLogged
    g_userLoggedHierarchy = g.userLoggedHierarchy
    prober = get_current_prober()

    user_hierarchy = _get_user_hierarchy(user)
    if user_hierarchy is None:
        return ResponseBuilder.error(
            reply, f"User '{user}' is not recognized. Access denied.", 403
        )

    # CASE 1: No one logged in
    if not g_userLogged:
        g.set_user(user, user_hierarchy)
        if user_hierarchy == "Developer":
            agentStateMachine.force_state(WPAgentState.UsedByDeveloper)
        else:
            agentStateMachine.force_state(WPAgentState.UserLogged)
        _safe_update_info(prober)
        return ResponseBuilder.success(
            reply,
            f"User '{user}' logged in successfully. Hierarchy: {user_hierarchy}",
        )

    # CASE 2: Different user trying to log in
    elif g_userLogged != user:
        _safe_update_info(prober)
        if user_hierarchy == "Developer" and g_userLoggedHierarchy != "Developer":
            print(f"Developer '{user}' taking control from user '{g_userLogged}'")
            g.set_user(user, user_hierarchy)
            agentStateMachine.force_state(WPAgentState.UsedByDeveloper)
            return ResponseBuilder.success(
                reply,
                f"Developer '{user}' has taken control from '{g_userLogged}'.",
            )
        elif user_hierarchy == "Developer" and g_userLoggedHierarchy == "Developer":
            _safe_update_info(prober)
            return ResponseBuilder.error(
                reply,
                f"Cannot take control: Developer '{g_userLogged}' is currently logged in.",
                409,
            )
        else:
            _safe_update_info(prober)
            return ResponseBuilder.error(
                reply,
                f"Another user is currently logged in: {g_userLogged}.",
                409,
            )

    # CASE 3: Same user already logged in
    else:
        _safe_update_info(prober)
        return ResponseBuilder.success(
            reply, f"User '{user}' is already logged in."
        )


@validate_command_with_name("UserLogOut")
def UserLogOut(
    user: str, waferAgentName: str = None, address: str = None, machineType: str = None
) -> dict:
    """
    User logout - clears user and resets state machine.
    """
    reply = get_reply_type()
    g = SvtWPAagentGlobalParameters.getInstance()
    g_userLogged = g.userLogged
    g_userLoggedHierarchy = g.userLoggedHierarchy

    # CASE 1: No one logged in
    if not g_userLogged:
        return ResponseBuilder.error(reply, "No user is currently logged in.", 400)

    # CASE 2: Wrong user trying to log out
    elif g_userLogged != user:
        return ResponseBuilder.error(
            reply,
            f"Cannot log out: another user is currently logged in: {g_userLogged}.",
            400,
        )

    # CASE 3: Log out
    else:
        was_developer = g_userLoggedHierarchy == "Developer"
        g.set_user(None, None)
        agentStateMachine.reset()

        if was_developer:
            print(f"Developer '{user}' logged out - restrictions re-enabled")
        else:
            print(f"User '{user}' logged out")

        return ResponseBuilder.success(reply, f"User '{user}' logged out successfully.")
