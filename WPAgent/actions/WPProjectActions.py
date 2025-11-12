from globals.svtWPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.factory import get_prober, ProberFactory
from WPAgentUtilities.WPHelpers import (resolve_project_parameters, ensure_prober_initialized, check_prober_ready)



def initialise_testing_project(address=None, machine_type=None, project_name=None):
    """
    Legacy initialization function - redirects to svt_initialise_wp
    """
    return svt_initialise_wp(address, machine_type, project_name)


def svt_initialise_wp(address=None, machine_type=None, project_name=None, force=False):
    """
    Initialize the WP agent with prober connection.
    This should be called once at startup or when reconfiguring.

    Args:
        address: Prober network address
        machine_type: Type of prober machine
        project_name: Name of the project
        force: Force re-initialization even if already initialized

    Returns:
        dict: Status result
    """
    try:
        globals_ = SvtWPAagentGlobalParameters.getInstance()
        factory = ProberFactory.get_instance()

        # Check if already initialized and not forcing
        if factory.is_initialized() and not force:
            return {
                "status": "success",
                "output": f"Already initialized at {globals_.address}. Use force=True to reinitialize."
            }

        # Reset if forcing re-initialization
        if force:
            factory.reset()

        # Check prober status
        if globals_.prober_status == "inuse" and not force:
            return {
                "status": "error",
                "output": "Prober is currently in use by another session. Use force=True to override."
            }

        # Ensure prober is initialized
        result = ensure_prober_initialized(address, machine_type, project_name)

        if result["status"] == "success":
            globals_.set_prober_status("initialized")
            info = globals_.get_info()
            return {
                "status": "success",
                "output": f"Initialized WP at {info.get('address')} with project '{info.get('project_name')}'"
            }
        else:
            return result

    except Exception as e:
        return {
            "status": "error",
            "output": f"Initialization failed: {str(e)}"
        }


def get_project_status():
    """
    Get current project and initialization status
    """
    globals_ = SvtWPAagentGlobalParameters.getInstance()
    factory = ProberFactory.get_instance()

    info = globals_.get_info()
    is_ready, ready_msg = check_prober_ready()

    status_info = {
        **info,
        "prober_initialized": factory.is_initialized(),
        "ready_for_commands": is_ready,
        "ready_message": ready_msg
    }

    if not info["project_name"]:
        return {
            "status": "uninitialized",
            "output": "Global parameters not set. Run 'Initialize' command.",
            "data": status_info
        }

    return {
        "status": "success",
        "output": status_info,
        "data": status_info
    }