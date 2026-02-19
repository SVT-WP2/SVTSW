from drivers.WPFactory import get_prober
from utilities.WPHelpers import resolve_project_parameters
import os


def _ensure_initialized():
    """
    Helper function to check if prober is initialized before executing commands.
    Returns error dict if not ready, None if ready.
    """
    from utilities.WPHelpers import check_prober_ready

    is_ready, message = check_prober_ready()
    if not is_ready:
        return {
            "status": "error",
            "output": message
        }
    return None


def move_chuck_xy(x, y, address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    prober.move_chuck_xy(x, y)
    prober.local_mode()
    return {"status": "success", "output": f"Moved chuck to x={x}, y={y}"}


def move_chuck_z(z, address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    prober.move_chuck_z(z)
    prober.local_mode()
    return {"status": "success", "output": f"Moved chuck to z={z}"}


def run_ptpa(address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    prober.run_ptpa()

    prober.local_mode()
    return {"status": "success", "output": "PTPA executed"}


def step_next_die(address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    result = prober.step_next_die()
    prober.local_mode()
    return {"status": "success", "output": f"Stepped to next die: {result}"}


def go_to_die(col: int, row: int, subsite: int = 0, address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    result = prober.go_to_die(col, row)
    prober.local_mode()
    return {"status": "success", "output": f"Moved to die: {result}"}


def switch_camera(mountPoint, address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    prober.switch_camera(mountPoint)
    prober.local_mode()
    return {"status": "success", "output": f"Switched camera to {mountPoint}"}


def move_chuck_home(address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    prober.move_chuck_home()
    prober.local_mode()
    return {"status": "success", "output": "Chuck moved home"}


def unload_wafer(address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    prober.unload_wafer()
    prober.local_mode()
    return {"status": "success", "output": "Wafer unloaded"}


def clean_probe_station(address=None, machineType=None, **kwargs):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    prober.clean_probe_station(**kwargs)
    prober.local_mode()
    return {"status": "success", "output": "Cleaning completed"}


def open_project(projectName: str, address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    # To be updated in the future by this
    project_path = os.path.join(
        "C:\\ProgramData\\MPI Corporation\\SENTIO\\projects\\",
        projectName
    )
    prober.open_project(projectName)
    prober.local_mode()
    return {"status": "success", "output": f"Opened project: {project_path}"}


def load_wafer(address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    prober.load_wafer()
    prober.local_mode()
    return {"status": "success", "output": "Wafer has been loaded to center"}


def find_home(address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    prober.find_home()
    prober.local_mode()
    return {"status": "success", "output": f"Found home position"}


def align_wafer(align_die_col=None, align_die_row=None, subsite=None,
                address=None, machineType=None):
    """
    Perform wafer alignment.

    Uses alignment die from initialization if align_die_col/align_die_row not provided.

    Args:
        align_die_col: Column index (optional if set during initialization)
        align_die_row: Row index (optional if set during initialization)
        subsite: Subsite index (optional, default: 0)
        address: Prober address (optional)
        machineType: Machine type (optional)

    Returns:
        dict: Status and output message

    Examples:
        # Use stored alignment die (from initialization)
        AlignWafer()

        # Override with specific die
        AlignWafer(align_die_col=5, align_die_row=10)

        # With subsite
        AlignWafer(align_die_col=5, align_die_row=10, subsite=1)
    """
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    # Check if initialized
    error = _ensure_initialized()
    if error:
        return error

    # Get prober
    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)

    # Get die position from initialization if not provided
    if align_die_col is None or align_die_row is None:
        globals_ = SvtWPAagentGlobalParameters.getInstance()
        alignmentDie = globals_.get_alignmentDie()

        if alignmentDie:
            align_die_col = alignmentDie["col"]
            align_die_row = alignmentDie["row"]
            subsite = subsite if subsite is not None else alignmentDie["subsite"]
            print(
                f"   📍 Using alignment die from initialization: Col {align_die_col}, Row {align_die_row}, Subsite {subsite}")
        else:
            return {
                "status": "error",
                "output": "Alignment die not specified. Please provide align_die_col and align_die_row parameters, "
                          "or set alignmentDie during initialization."
            }

    # Set default subsite if still None
    if subsite is None:
        subsite = 0

    # Execute alignment
    try:
        prober.align_wafer(align_die_col, align_die_row, subsite)
        prober.local_mode()

        return {
            "status": "success",
            "output": f"Wafer aligned using die at Col {align_die_col}, Row {align_die_row}, Subsite {subsite}"
        }
    except Exception as e:
        return {
            "status": "error",
            "output": f"Wafer alignment failed: {str(e)}"
        }


def go_to_contact(address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    prober.go_to_contact()
    prober.local_mode()
    return {"status": "success", "output": f"Probe station is in contact"}


def go_to_separation(address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    prober.go_to_separation()
    prober.local_mode()
    return {"status": "success", "output": f"Probe station is in separation"}


def auto_focus(address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    prober.auto_focus()
    prober.local_mode()
    return {"status": "success", "output": f"Auto-focus command successfully executed"}


def move_chuck_work_area(work_area=0, address=None, machineType=None):
    """
    Move chuck to specified work area.

    An enumeration containing probe station work areas. The OffAxis work area is only
    present if the specific model of probe station supports it.

    Attributes:
        Probing (0): The probing work area is the area in which the chuck is under
                     the downward looking microscope. This is where the wafer is probed.
        Offaxis (1): The off axis work area is the area in which the chuck is under
                     the off axis camera. This is where off axis ptpa is performed.
                     The wafer cannot be probed here because there is no probe card.
    """
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    prober.move_chuck_work_area(work_area)
    prober.local_mode()
    return {"status": "success", "output": f"Moved to {work_area} workarea"}


def local_state(address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    prober.local_mode()
    return {"status": "success", "output": f"Local mode"}


def go_to_previous_die(address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)
    prober.step_prev_die()
    return {"status": "success", "output": f" Moved to previous die"}


def get_chuck_position(address=None, machineType=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machineType = resolve_project_parameters(address, None, machineType)
    prober = get_prober(machineType, address)

    try:
        position = prober.get_chuck_position()
        prober.local_mode()

        return {
            "status": "success",
            "output": f"Chuck is {position}",
            "data": {"position": position}
        }
    except Exception as e:
        try:
            prober.local_mode()
        except:
            pass
        return {
            "status": "error",
            "output": f"Failed to get chuck position: {str(e)}"
        }
