from drivers.factory import get_prober
from utilities.WPHelpers import resolve_project_parameters


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


def move_chuck_xy(x, y, address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    prober.move_chuck_xy(x, y)
    prober.local_mode()
    return {"status": "success", "output": f"Moved chuck to x={x}, y={y}"}


def move_chuck_z(z, address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    prober.move_chuck_z(z)
    prober.local_mode()
    return {"status": "success", "output": f"Moved chuck to z={z}"}


def run_ptpa(address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    prober.run_ptpa()
    prober.local_mode()
    return {"status": "success", "output": "PTPA executed"}


def step_next_die(address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    result = prober.step_next_die()
    prober.local_mode()
    return {"status": "success", "output": f"Stepped to next die: {result}"}


def go_to_die(col: int, row: int, subsite: int = 0, address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    result = prober.go_to_die(col, row)
    prober.local_mode()
    return {"status": "success", "output": f"Moved to die: {result}"}


def switch_camera(mount_point, address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    prober.switch_camera(mount_point)
    prober.local_mode()
    return {"status": "success", "output": f"Switched camera to {mount_point}"}


def move_chuck_home(address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    prober.move_chuck_home()
    prober.local_mode()
    return {"status": "success", "output": "Chuck moved home"}


def unload_wafer(address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    prober.unload_wafer()
    prober.local_mode()
    return {"status": "success", "output": "Wafer unloaded"}


def clean_probe_station(address=None, machine_type=None, **kwargs):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    prober.clean_probe_station(**kwargs)
    prober.local_mode()
    return {"status": "success", "output": "Cleaning completed"}


def open_project(address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    # Open project should be done with extra arguments chipname and orientation
    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    # To be updated in the future by this
    # path = f"C:\\ProgramData\\MPI Corporation\\SENTIO\\projects\\{chipName}_{orientation}"
    path = f"C:\\ProgramData\\MPI Corporation\\SENTIO\\projects\\MOSAIX_FlatPad"
    prober.open_project(path)
    prober.local_mode()
    return {"status": "success", "output": f"Opened project: {path}"}


def load_wafer(address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    prober.load_wafer()
    prober.local_mode()
    return {"status": "success", "output": "Wafer has been loaded to center"}


def find_home(address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    prober.find_home()
    prober.local_mode()
    return {"status": "success", "output": f"Found home position"}


def align_wafer(col, row, address=None, machine_type=None, subsite=0):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    prober.align_wafer(col, row, subsite)
    prober.local_mode()
    return {"status": "success", "output": f"Wafer is aligned"}


def go_to_contact(address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    prober.go_to_contact()
    prober.local_mode()
    return {"status": "success", "output": f"Probe station is in contact"}


def go_to_separation(address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    prober.go_to_separation()
    prober.local_mode()
    return {"status": "success", "output": f"Probe station is in separation"}


def auto_focus(address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    prober.auto_focus()
    prober.local_mode()
    return {"status": "success", "output": f"Auto-focus command successfully executed"}


def move_chuck_work_area(work_area=0, address=None, machine_type=None):
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

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    prober.move_chuck_work_area(work_area)
    prober.local_mode()
    return {"status": "success", "output": f"Moved to {work_area} workarea"}


def local_state(address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    prober.local_mode()
    return {"status": "success", "output": f"Auto-focus command successfully executed"}


# TODO: need to be tested
def get_camera_status(address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    resp = prober.send_cmd(f"vis:get_prop")
    return {"status": "success", "output": f"{resp}"}


# TODO: need to be tested
def go_to_previous_die(address=None, machine_type=None):
    error = _ensure_initialized()
    if error:
        return error

    address, _, machine_type = resolve_project_parameters(address, None, machine_type)
    prober = get_prober(machine_type, address)
    prober.send_cmd(f"map:step_previous_die")
    return {"status": "success", "output": f" Moved to previous die"}