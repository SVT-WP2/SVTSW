from globals.svtWPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.factory import get_prober
from WPAgentUtilities.WPHelpers import resolve_project_parameters

def initialise_testing_project(address= None, machine_type=None, project_name = None):
    address, project_name, machine_type = resolve_project_parameters(address, project_name, machine_type)
    
    globals_ = SvtWPAagentGlobalParameters.getInstance()

    if globals_.prober_status == "inuse":
        return {
            "status": "error",
            "output": "Prober is currently in use by another session.",
        }

    globals_.set_prober_status("initialized")

    info = globals_.get_info()
    return {
        "status": "success",
        "output": f"Initialized project '{info.get('project_name')}' for chip '{info.get('chip_name')}' at {info.get('address')}'"
    }

def get_project_status():
    globals_ = SvtWPAagentGlobalParameters.getInstance()
    info = globals_.get_info()
    if not info["project_name"]:
        return {"status": "uninitialized", "output": "Global parameters not set."}
    return {"status": "success", "output": info}


def svt_initialise_wp(address=None, project_name=None, machine_type=None):
    try:
        address, project_name, machine_type = resolve_project_parameters(address, project_name, machine_type)

        return {
            "status": "success",
            "output": f"Initialised WP at {address} with project {project_name}"
        }

    except Exception as e:
        return {
            "status": "error",
            "output": f"Initialisation failed: {str(e)}"
        }
