'''

'''

import json
from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
from stateMachine.WpAgentStateMachine import WPAgentState
from utilities.WPResponseBuilder import ResponseBuilder
import actions.WPTestingActions as testingActions
from drivers.WPFactory import get_current_prober

HIERARCHY_CONFIG_PATH = "configs/WPUserHierarchy.json"


def _load_user_hierarchy() -> dict:
    try:
        with open(HIERARCHY_CONFIG_PATH, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Warning: {HIERARCHY_CONFIG_PATH} not found.  Make sure that config file exists.")


def _get_user_hierarchy(user: str) -> str:
    hierarchy = _load_user_hierarchy()
    for level, users in hierarchy.items():
        if user in users:
            return level
    return None


def UserLogIn(user: str, waferAgentName: str = None, address: str = None, machineType: str = None) -> dict:
    """
    User login - sets state based on hierarchy

    Developer → UsedByDeveloper state (ALL commands allowed, bypass restrictions)
    Other users → UserLogged state (normal workflow)

    Args:
        user: Username to log in
        waferAgentName: Name of wafer agent TODO: have to be implemented in future
        address: Machine address (optional) TODO: have to be deleted after we implement connection to prober from listener
        machineType: Machine type (optional)

    Returns:
        Response dict with status and message
    """
    g = SvtWPAagentGlobalParameters.getInstance()
    g_userLogged = g.userLogged
    g_userLoggedHierarchy = g.userLoggedHierarchy
    prober = get_current_prober()

    # Get user's hierarchy
    user_hierarchy = _get_user_hierarchy(user)
    if user_hierarchy is None:
        return ResponseBuilder.error(
            "UserLogInReply",
            f"User '{user}' is not recognized. Access denied.",
            403
        )

    # CASE 1: No one logged in - allow login
    if not g_userLogged:
        g.set_user(user, user_hierarchy)

        # Set state based on hierarchy
        if user_hierarchy == "Developer":
            # Developer gets special state with ALL commands enabled
            agentStateMachine.force_state(WPAgentState.UsedByDeveloper)
        else:
            # Normal users go to UserLogged state
            agentStateMachine.force_state(WPAgentState.UserLogged)

            # update reply payload
        testingActions.update_current_info(currentProber=prober)

        return ResponseBuilder.success(
            "UserLogInReply",
            f"User '{user}' logged in successfully. Hierarchy: {user_hierarchy}"
        )

    # CASE 2: Different user trying to log in
    elif g_userLogged != user:
        # update reply payload
        testingActions.update_current_info(currentProber=prober)
        # Developer can take control from non-Developer
        if user_hierarchy == "Developer" and g_userLoggedHierarchy != "Developer":
            print(f"🔓 Developer '{user}' taking control from user '{g_userLogged}'")
            g.set_user(user, user_hierarchy)
            agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

            return ResponseBuilder.success(
                "UserLogInReply",
                f"Developer '{user}' has taken control from '{g_userLogged}'."
            )

        # Developer cannot take control from another Developer
        elif user_hierarchy == "Developer" and g_userLoggedHierarchy == "Developer":
            # update reply payload
            testingActions.update_current_info(currentProber=prober)
            return ResponseBuilder.error(
                "UserLogInReply",
                f"Cannot take control: Developer '{g_userLogged}' is currently logged in.",
                409
            )

        # Non-Developer cannot take control
        else:
            # update reply payload
            testingActions.update_current_info(currentProber=prober)
            return ResponseBuilder.error(
                "UserLogInReply",
                f"Another user is currently logged in: {g_userLogged}.",
                409
            )

    # CASE 3: Same user trying to log in again
    else:
        # update reply payload
        testingActions.update_current_info(currentProber=prober)
        return ResponseBuilder.success(
            "UserLogInReply",
            f"User '{user}' is already logged in."
        )




def UserLogOut(user: str, waferAgentName: str = None, address: str = None, machineType: str = None) -> dict:
    """
    User logout - clears user and resets state

    Args:
        user: Username to log out
        waferAgentName: Name of wafer agent TODO: have to be implemented in future
        address: Machine address (optional) TODO: have to be deleted after we implement connection to prober from listener
        machineType: Machine type (optional)

    Returns:
        Response dict with status and message
    """
    g = SvtWPAagentGlobalParameters.getInstance()
    g_userLogged = g.userLogged
    g_userLoggedHierarchy = g.userLoggedHierarchy

    # CASE 1: No one logged in
    if not g_userLogged:
        return ResponseBuilder.error(
            "UserLogOutReply",
            "No user is currently logged in.",
            400
        )

    # CASE 2: Wrong user trying to log out
    elif g_userLogged != user:
        return ResponseBuilder.error(
            "UserLogOutReply",
            f"Cannot log out: another user is currently logged in: {g_userLogged}.",
            403
        )

    # CASE 3: log out
    else:
        was_developer = (g_userLoggedHierarchy == "Developer")

        # Clear user
        g.set_user(None, None)

        # Reset state machine to ServiceOn
        agentStateMachine.reset()
        # wpag_state is auto-synced by state machine

        if was_developer:
            print(f"🔒 Developer '{user}' logged out - restrictions re-enabled")
        else:
            print(f"👤 User '{user}' logged out")

        return ResponseBuilder.success(
            "UserLogOutReply",
            f"User '{user}' logged out successfully."
        )
