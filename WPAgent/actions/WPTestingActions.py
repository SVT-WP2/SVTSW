
from drivers.WPFactory import get_prober
from utilities.WPHelpers import resolve_project_parameters
from utilities.WPResponseBuilder import ResponseBuilder
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


def move_chuck_xy(x, y, address=None, machine_type=None):
    """Move chuck to XY position"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckXYReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.move_chuck_xy(x, y)
        prober.local_mode()

        g.wpag_state = "WP_Idle"

        return ResponseBuilder.success("MoveChuckXYReply", f"Moved chuck to x={x}, y={y}")
    except Exception as e:
        g.wpag_state = "WP_Error"
        return ResponseBuilder.error("MoveChuckXYReply", str(e), 500)


def move_chuck_z(z, address=None, machine_type=None):
    """Move chuck to Z position"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckZReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.move_chuck_z(z)
        prober.local_mode()

        g.wpag_state = "WP_Idle"

        return ResponseBuilder.success("MoveChuckZReply", f"Moved chuck to z={z}")
    except Exception as e:
        g.wpag_state = "WP_Error"
        return ResponseBuilder.error("MoveChuckZReply", str(e), 500)


def run_ptpa(address=None, machine_type=None):
    """Run PTPA alignment"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("RunPTPAReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.run_ptpa()
        prober.local_mode()

        g.wpag_state = "WP_Idle"

        return ResponseBuilder.success("RunPTPAReply", "PTPA executed")
    except Exception as e:
        g.wpag_state = "WP_Error"
        return ResponseBuilder.error("RunPTPAReply", str(e), 500)


def step_next_die(address=None, machine_type=None):
    """Step to next die"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("StepNextDieReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        result = prober.step_next_die()
        prober.local_mode()

        # TODO: Update die position if result contains die coordinates
        # g.set_current_die(col, row, subsite)
        g.wpag_state = "WP_Idle"

        return ResponseBuilder.success("StepNextDieReply", f"Stepped to next die: {result}")
    except Exception as e:
        g.wpag_state = "WP_Error"
        return ResponseBuilder.error("StepNextDieReply", str(e), 500)


def go_to_die(col: int, row: int, subsite: int = 0, address=None, machine_type=None):
    """Move to specific die"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("GoToDieReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        result = prober.go_to_die(col, row)
        prober.local_mode()

        # Update die position
        g.set_current_die(col, row, subsite)
        g.wpag_state = "WP_Idle"
        g.chuck_z_position_state = "Separation"

        return ResponseBuilder.success("GoToDieReply", f"Moved to die {col},{row}")
    except Exception as e:
        g.wpag_state = "WP_Error"
        return ResponseBuilder.error("GoToDieReply", str(e), 500)


def switch_camera(mount_point, address=None, machine_type=None):
    """Switch camera mount point"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("SwitchCameraReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.switch_camera(mount_point)
        prober.local_mode()

        # Update camera
        g.camera_mount_point = mount_point

        return ResponseBuilder.success("SwitchCameraReply", f"Switched camera to {mount_point}")
    except Exception as e:
        return ResponseBuilder.error("SwitchCameraReply", str(e), 500)


def move_chuck_home(address=None, machine_type=None):
    """Move chuck to home position"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckHomeReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.move_chuck_home()
        prober.local_mode()

        g.wpag_state = "WP_Idle"

        return ResponseBuilder.success("MoveChuckHomeReply", "Chuck moved home")
    except Exception as e:
        g.wpag_state = "WP_Error"
        return ResponseBuilder.error("MoveChuckHomeReply", str(e), 500)


def unload_wafer(address=None, machine_type=None):
    """Unload wafer from chuck"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("UnloadWaferReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    if g.loaded_wafer_id is None:
        return ResponseBuilder.error("UnloadWaferReply", "No wafer loaded", 400)

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.unload_wafer()
        prober.local_mode()

        # Clear wafer
        g.clear_wafer()
        g.wpag_state = "WP_Idle"
        g.chuck_z_position_state = "Separation"
        g.current_working_area = "LoadPosition"

        return ResponseBuilder.success("UnloadWaferReply", "Wafer unloaded")
    except Exception as e:
        g.wpag_state = "WP_Error"
        return ResponseBuilder.error("UnloadWaferReply", str(e), 500)


def clean_probe_station(address=None, machine_type=None, **kwargs):
    """Clean probe station"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("CleaningReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.clean_probe_station(**kwargs)
        prober.local_mode()

        g.wpag_state = "WP_Idle"

        return ResponseBuilder.success("CleaningReply", "Cleaning completed")
    except Exception as e:
        g.wpag_state = "WP_Error"
        return ResponseBuilder.error("CleaningReply", str(e), 500)


def open_project(project_name: str, address=None, machine_type=None):
    """Open project"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("OpenProjectReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        project_path = os.path.join(
            "C:\\ProgramData\\MPI Corporation\\SENTIO\\projects\\",
            project_name
        )
        prober.open_project(project_name)
        prober.local_mode()

        # Update project name (ID would need to come from DB)
        g.project_name = project_name
        # g.opened_project_id = project_id  # TODO: Get from DB

        return ResponseBuilder.success("OpenProjectReply", f"Opened project: {project_path}")
    except Exception as e:
        return ResponseBuilder.error("OpenProjectReply", str(e), 500)


def load_wafer(address=None, machine_type=None):
    """Load wafer onto chuck"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("LoadWaferReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    if g.loaded_wafer_id is not None:
        return ResponseBuilder.error("LoadWaferReply", "Wafer already loaded", 400)

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.load_wafer()
        prober.local_mode()

        # TODO: Get wafer info from DB
        # wafer_id = get_wafer_id_from_db()
        # orientation = get_wafer_orientation_from_db()
        # total_dies = get_total_dies_from_wafer_map()

        # For now, set placeholder values
        # g.set_wafer_loaded(wafer_id, orientation)
        # g.total_dies_number = total_dies
        g.wpag_state = "WP_Idle"
        g.chuck_z_position_state = "Separation"
        g.current_working_area = "TestArea"

        return ResponseBuilder.success("LoadWaferReply", "Wafer has been loaded to center")
    except Exception as e:
        g.wpag_state = "WP_Error"
        return ResponseBuilder.error("LoadWaferReply", str(e), 500)


def find_home(address=None, machine_type=None):
    """Find home position"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("FindHomeReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.find_home()
        prober.local_mode()

        g.wpag_state = "WP_Idle"

        return ResponseBuilder.success("FindHomeReply", "Found home position")
    except Exception as e:
        g.wpag_state = "WP_Error"
        return ResponseBuilder.error("FindHomeReply", str(e), 500)


def align_wafer(align_die_col=None, align_die_row=None, subsite=None,
                address=None, machine_type=None):
    """Perform wafer alignment"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("AlignWaferReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    # Get die position from initialization if not provided
    if align_die_col is None or align_die_row is None:
        alignment_die = g.get_alignment_die()

        if alignment_die:
            align_die_col = alignment_die["col"]
            align_die_row = alignment_die["row"]
            subsite = subsite if subsite is not None else alignment_die["subsite"]
            print(
                f"   📍 Using alignment die from initialization: Col {align_die_col}, Row {align_die_row}, Subsite {subsite}")
        else:
            return ResponseBuilder.error(
                "AlignWaferReply",
                "Alignment die not specified. Please provide align_die_col and align_die_row parameters, "
                "or set alignment_die during initialization.",
                400
            )

    # Set default subsite if still None
    if subsite is None:
        subsite = 0

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.align_wafer(align_die_col, align_die_row, subsite)
        prober.local_mode()

        g.wpag_state = "WP_Idle"

        return ResponseBuilder.success(
            "AlignWaferReply",
            f"Wafer aligned using die at Col {align_die_col}, Row {align_die_row}, Subsite {subsite}"
        )
    except Exception as e:
        g.wpag_state = "WP_Error"
        return ResponseBuilder.error("AlignWaferReply", str(e), 500)


def go_to_contact(address=None, machine_type=None):
    """Move probes to contact position"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("GoToContactReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.go_to_contact()
        prober.local_mode()

        # Update Z position
        g.chuck_z_position_state = "Contact"
        g.wpag_state = "WP_Testing"

        return ResponseBuilder.success("GoToContactReply", "Probe station is in contact")
    except Exception as e:
        g.wpag_state = "WP_Error"
        return ResponseBuilder.error("GoToContactReply", str(e), 500)


def go_to_separation(address=None, machine_type=None):
    """Move probes to separation position"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("GoToSeparationReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.go_to_separation()
        prober.local_mode()

        # Update Z position
        g.chuck_z_position_state = "Separation"
        g.wpag_state = "WP_Idle"

        return ResponseBuilder.success("GoToSeparationReply", "Probe station is in separation")
    except Exception as e:
        g.wpag_state = "WP_Error"
        return ResponseBuilder.error("GoToSeparationReply", str(e), 500)


def auto_focus(address=None, machine_type=None):
    """Execute auto-focus"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("AutoFocusReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.auto_focus()
        prober.local_mode()

        g.wpag_state = "WP_Idle"

        return ResponseBuilder.success("AutoFocusReply", "Auto-focus command successfully executed")
    except Exception as e:
        return ResponseBuilder.error("AutoFocusReply", str(e), 500)


def move_chuck_work_area(work_area=0, address=None, machine_type=None):
    """Move chuck to specified work area"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckToWorkAreaReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.move_chuck_work_area(work_area)
        prober.local_mode()

        # Update working area
        area_names = {0: "Probing", 1: "Offaxis"}
        g.current_working_area = area_names.get(work_area, f"Area{work_area}")
        g.wpag_state = "WP_Idle"

        return ResponseBuilder.success("MoveChuckToWorkAreaReply", f"Moved to {work_area} workarea")
    except Exception as e:
        g.wpag_state = "WP_Error"
        return ResponseBuilder.error("MoveChuckToWorkAreaReply", str(e), 500)


def local_state(address=None, machine_type=None):
    """Set prober to local mode"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("LocalModeReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.local_mode()

        return ResponseBuilder.success("LocalModeReply", "Local mode")
    except Exception as e:
        return ResponseBuilder.error("LocalModeReply", str(e), 500)


def go_to_previous_die(address=None, machine_type=None):
    """Move to previous die"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("GoToPreviousDieReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.step_prev_die()

        # TODO: Update die position if result contains coordinates
        # g.set_current_die(col, row, subsite)
        g.wpag_state = "WP_Idle"

        return ResponseBuilder.success("GoToPreviousDieReply", "Moved to previous die")
    except Exception as e:
        g.wpag_state = "WP_Error"
        return ResponseBuilder.error("GoToPreviousDieReply", str(e), 500)


def get_chuck_position(address=None, machine_type=None):
    """Get current chuck position"""
    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("GetChuckPositionReply", error["output"], 400)

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        position = prober.get_chuck_position()
        prober.local_mode()

        return ResponseBuilder.success("GetChuckPositionReply", f"Chuck is {position}")
    except Exception as e:
        try:
            prober.local_mode()
        except:
            pass
        return ResponseBuilder.error("GetChuckPositionReply", str(e), 500)