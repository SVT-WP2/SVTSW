import json
from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters


HIERARCHY_CONFIG_PATH = "configs/WPUserHierarchy.json"

def _load_user_hierarchy() -> dict:
    with open(HIERARCHY_CONFIG_PATH, "r") as f:
        return json.load(f)

def _get_user_hierarchy(user: str) -> str:
    hierarchy = _load_user_hierarchy()
    for level, users in hierarchy.items():
        if user in users:
            return level
    return None


def UserLogIn(user: str, waferAgentName: str, address: str = None, machineType: str = None) -> dict:

    g = SvtWPAagentGlobalParameters.getInstance()
    g_userLogged = g.userLogged
    g_userLoggedHierarchy = g.userLoggedHierarchy

    user_hierarchy = _get_user_hierarchy(user)
    if user_hierarchy is None:
        return {
            "status": "error",
            "output": f"User '{user}' is not recognized. Access denied."
        }

    if not g_userLogged:
        g.set_user(user, user_hierarchy)
    elif g_userLogged != user:
        if (user_hierarchy == "Developer" and g_userLoggedHierarchy != "Developer"):
            g.set_user(user, user_hierarchy)
        elif (user_hierarchy == "Developer"
                and g_userLoggedHierarchy == "Developer"):
            return {
                "status": "error",
                "output": f"Cannot take control: Developer '{g_userLogged}' is currently logged in."
            }
        else:
            return {
                "status": "error",
                "output": f"Another User is currently Logged: {g_userLogged}."
            }

    return {
        "status": "success",
        "output": f"User '{user}' Logged in Successfully."
    }




def UserLogOut(user: str, waferAgentName: str, address: str = None, machineType: str = None) -> dict:

    g = SvtWPAagentGlobalParameters.getInstance()
    g_userLogged = g.userLogged
    g_userLoggedHierarchy = g.userLoggedHierarchy

    if not g_userLogged:
        return {
            "status": "error",
            "output": "No User is currently Logged."
        }
    elif g_userLogged != user:
        return {
            "status": "error",
            "output": f"Cannot LogOut: another User is currently Logged: {g_userLogged}."
        }
    else:
        g.set_user(None, None)
        return {
            "status": "success",
            "output": f"User '{user}' Logged out Successfully."
        }

