from drivers.WPFactory import get_prober
from utilities.WPHelpers import resolve_project_parameters
from utilities.WPResponseBuilder import ResponseBuilder
import os
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
from stateMachine.WpAgentStateMachine import WPAgentState


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


def move_chuck_xy(x, y, address=None, machine_type=None, user=None, waferAgentName=None):
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    error = _ensure_initialized()
    if error:
        return error
    g = SvtWPAagentGlobalParameters.getInstance()
    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.move_chuck_xy(x, y)
        prober.local_mode()
        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)
        return ResponseBuilder.success("MoveChuckXYReply", f"Moved chuck to Center")

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckXYReply", str(e), 500)


def init_probing(address=None, machine_type=None):
    """Sequance of 'Go to off Axis area','Go to Center', 'AutoFocus', 'Align wafer', 'Find Home'"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("InitProbingReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)

        # Sequance
        prober.move_chuck_offaxis_area()
        prober.move_chuck_center()
        prober.auto_focus()

        # TODO: we need to get col and row for aligment from project that stored in DB
        prober.align_wafer(alig_die_col=1, alig_die_row=1)
        prober.find_home()
        prober.local_mode()

        agentStateMachine.transition('InitProbing')
        return ResponseBuilder.success("InitProbingReply", f"Moved chuck to Center")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("InitProbingReply", str(e), 500)


def move_chuck_center(address=None, machine_type=None, user=None, waferAgentName=None):
    """Move chuck to Center"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckCenterReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.move_chuck_center()
        prober.local_mode()
        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)
        return ResponseBuilder.success("MoveChuckCenterReply", f"Moved chuck to Center")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckCenterReply", str(e), 500)


def move_chuck_z(z, address=None, machine_type=None, user=None, waferAgentName=None):
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

        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

        return ResponseBuilder.success("MoveChuckZReply", f"Moved chuck to z={z}")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckZReply", str(e), 500)


def run_ptpa(address=None, machine_type=None, user=None, waferAgentName=None):
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

        agentStateMachine.transition('RunPTPA')

        return ResponseBuilder.success("RunPTPAReply", "PTPA executed")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("RunPTPAReply", str(e), 500)


def step_next_die(address=None, machine_type=None, user=None, waferAgentName=None):
    """Step to next die"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckNextDieReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        result = prober.step_next_die()
        prober.local_mode()

        # TODO: Update die position if result contains die coordinates
        agentStateMachine.transition('MoveChuckNextDie')

        return ResponseBuilder.success("MoveChuckNextDieReply", f"Stepped to next die: {result}")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckNextDieReply", str(e), 500)


def go_to_die(col: int, row: int, subsite: int = 0, address=None, machine_type=None, user=None, waferAgentName=None):
    """Move to specific die"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckRowColReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        result = prober.go_to_die(col, row)
        prober.local_mode()

        # Update die position
        g.set_current_die(col, row, subsite)
        agentStateMachine.transition('MoveChuckRowCol')

        g.chuck_z_position_state = "Separation"

        return ResponseBuilder.success("MoveChuckRowColReply", f"Moved to die {col},{row}")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckRowColReply", str(e), 500)


def switch_camera(mount_point, address=None, machine_type=None, user=None, waferAgentName=None):
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

        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

        return ResponseBuilder.success("SwitchCameraReply", f"Switched camera to {mount_point}")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("SwitchCameraReply", str(e), 500)


def move_chuck_home(address=None, machine_type=None, user=None, waferAgentName=None):
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
        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

        return ResponseBuilder.success("MoveChuckHomeReply", "Chuck moved home")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckHomeReply", str(e), 500)


def unload_wafer(address=None, machine_type=None, user=None, waferAgentName=None):
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
        agentStateMachine.transition('Unload')

        g.chuck_z_position_state = "Separation"
        g.current_working_area = "LoadPosition"

        return ResponseBuilder.success("UnloadWaferReply", "Wafer unloaded")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("UnloadWaferReply", str(e), 500)


def clean_probe_station(address=None, machine_type=None, user=None, waferAgentName=None, **kwargs):
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

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("CleaningReply", str(e), 500)


def open_project(project_name: str, address=None, machine_type=None, user=None, waferAgentName=None):
    """Open project"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    from WPDataBaseActions import get_project_id_by_name

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("OpenProjectReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        project_path = os.path.join(str(g.projects_base_path),
                                    project_name
                                    )
        prober.open_project(project_name)
        prober.local_mode()

        # Update project name (ID would need to come from DB)
        g.projectName = project_name
        g.set_project_name(project_name)

        g.opened_project_id = get_project_id_by_name(project_name)

        agentStateMachine.transition('OpenProject')

        return ResponseBuilder.success("OpenProjectReply", f"Opened project: {project_path}")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("OpenProjectReply", str(e), 500)


def change_project(project_name: str, address=None, machine_type=None, user=None, waferAgentName=None):
    """Change project"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    from WPDataBaseActions import get_project_id_by_name

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("ChangeProjectReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        project_path = os.path.join(str(g.projects_base_path),
                                    project_name
                                    )
        prober.open_project(project_name)
        prober.local_mode()

        # Update project name (ID would need to come from DB)
        g.projectName = project_name
        g.set_project_name(project_name)

        g.opened_project_id = get_project_id_by_name(project_name)

        agentStateMachine.transition('ChangeProject')

        return ResponseBuilder.success("ChangeProjectReply", f"Opened project: {project_path}")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("ChangeProjectReply", str(e), 500)


def load_wafer(address=None, machine_type=None, user=None, waferAgentName=None):
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
        agentStateMachine.transition('Load')

        g.chuck_z_position_state = "Separation"
        g.current_working_area = "TestArea"

        return ResponseBuilder.success("LoadWaferReply", "Wafer has been loaded to center")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("LoadWaferReply", str(e), 500)


def find_home(address=None, machine_type=None, user=None, waferAgentName=None):
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

        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

        return ResponseBuilder.success("FindHomeReply", "Found home position")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("FindHomeReply", str(e), 500)


def align_wafer(align_die_col=None, align_die_row=None, subsite=None,
                address=None, machine_type=None, user=None, waferAgentName=None):
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

        agentStateMachine.transition('AlignWafer')

        g.wpag_state = "WP_Idle"

        return ResponseBuilder.success(
            "AlignWaferReply",
            f"Wafer aligned using die at Col {align_die_col}, Row {align_die_row}, Subsite {subsite}"
        )
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("AlignWaferReply", str(e), 500)


def go_to_contact(address=None, machine_type=None, user=None, waferAgentName=None):
    """Move probes to contact position"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckContactReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.go_to_contact()
        prober.local_mode()

        # Update Z position
        g.chuck_z_position_state = "Contact"
        agentStateMachine.transition('MoveChuckContact')

        return ResponseBuilder.success("MoveChuckContactReply", "Probe station is in contact")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckContactReply", str(e), 500)


def go_to_separation(address=None, machine_type=None, user=None, waferAgentName=None):
    """Move probes to separation position"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckSeparationReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.go_to_separation()
        prober.local_mode()

        # Update Z position
        g.chuck_z_position_state = "Separation"
        agentStateMachine.transition('MoveChuckSeparation')

        return ResponseBuilder.success("MoveChuckSeparationReply", "Probe station is in separation")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckSeparationReply", str(e), 500)


def auto_focus(address=None, machine_type=None, user=None, waferAgentName=None):
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

        agentStateMachine.transition('AutoFocus')

        return ResponseBuilder.success("AutoFocusReply", "Auto-focus command successfully executed")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("AutoFocusReply", str(e), 500)


def move_chuck_work_area(work_area=0, address=None, machine_type=None, user=None, waferAgentName=None):
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

        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

        return ResponseBuilder.success("MoveChuckToWorkAreaReply", f"Moved to {work_area} workarea")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckToWorkAreaReply", str(e), 500)


def local_state(address=None, machine_type=None, user=None, waferAgentName=None):
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
        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

        return ResponseBuilder.success("LocalModeReply", "Local mode")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("LocalModeReply", str(e), 500)


def go_to_previous_die(address=None, machine_type=None, user=None, waferAgentName=None):
    """Move to previous die"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckPreviousDieReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.step_prev_die()

        # TODO: Update die position if result contains coordinates
        # g.set_current_die(col, row, subsite)
        agentStateMachine.transition('MoveChuckPreviousDie')

        return ResponseBuilder.success("MoveChuckPreviousDieReply", "Moved to previous die")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckPreviousDieReply", str(e), 500)


def get_chuck_position(address=None, machine_type=None, user=None, waferAgentName=None):
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
        agentStateMachine.enter_error_state(str(e))
        try:
            prober.local_mode()
        except:
            pass
        return ResponseBuilder.error("GetChuckPositionReply", str(e), 500)


def set_chuck_overtravel(address=None, machine_type=None, overtravelGap=None, user=None, waferAgentName=None):
    """Set overtravel that includes seting actual gap and enable overtravel"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("SetOvertravelReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.set_overtravel(overtravelGap)
        prober.enable_overtravel(overtravel=True)

        g.set_overdrive(overtravelGap)

        agentStateMachine.transition('SetOverdrive')

        return ResponseBuilder.success("SetOvertravelReply", "SetOvertravel command successfully executed")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("SetOvertravelReply", str(e), 500)


def disable_chuck_overtravel(address=None, machine_type=None, overtravelGap=None, user=None, waferAgentName=None):
    """Disaable overtravel, set to 0"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("DisableOvertravelReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)
        prober.set_overtravel(overtravelGap=0)
        prober.enable_overtravel(overtravel=True)

        g.set_overdrive(overtravelGap)

        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

        return ResponseBuilder.success("DisableOvertravelReply", "DisableOvertravel command successfully executed")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("DisableOvertravelReply", str(e), 500)


def move_chuck_loaded_wafer(address=None, machine_type=None, user=None, waferAgentName=None):
    """Load same wafer Load + MoveChuckOffAxis """
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckLoadedWaferReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    if g.loaded_wafer_id is not None:
        return ResponseBuilder.error("MoveChuckLoadedWaferReply", "Wafer loaded", 400)

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)

        prober.load_wafer()
        prober.move_chuck_offaxis_area()
        prober.local_mode()

        # TODO: Get wafer info from DB
        # wafer_id = get_wafer_id_from_db()
        # orientation = get_wafer_orientation_from_db()
        # total_dies = get_total_dies_from_wafer_map()

        # For now, set placeholder values
        # g.set_wafer_loaded(wafer_id, orientation)
        # g.total_dies_number = total_dies
        agentStateMachine.transition('MoveChuckLoadedWafer')

        g.chuck_z_position_state = "Separation"
        g.current_working_area = "OffAxis"

        return ResponseBuilder.success("MoveChuckLoadedWaferReply", "Wafer has been loaded to center")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckLoadedWaferReply", str(e), 500)


def move_chuck_unloaded_wafer():
    pass


def move_chuck_asic():
    pass


def move_chuck_safe_position(address=None, machine_type=None, user=None, waferAgentName=None):
    "Sequence MoveChuckOffAxis MoveChuckXY MoveChuckZ"
    # TODO: Do we need to control angle as well ? for absolute  0.0025. Check if ChuckXYReference.Zero is correlated to absolute coordinates
    #
    absolute_x = 183672.8
    absolute_y = -33439.9
    absolute_z = 10377.7
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckSafePositionReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)

        prober.move_chuck_offaxis_area()
        prober.move_chuck_xy(x=absolute_x, y=absolute_y)
        prober.move_chuck_z(z=absolute_z)

        prober.local_mode()

        # Update Z position
        g.chuck_z_position_state = "Separation"
        agentStateMachine.transition('MoveChuckSafePosition')

        return ResponseBuilder.success("MoveChuckSafePositionReply", "Probe station is in safe position")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckSafePositionReply", str(e), 500)


def move_chuck_offaxis(address=None, machine_type=None, user=None, waferAgentName=None):
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckOffAxisReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)

        prober.move_chuck_offaxis_area()

        prober.local_mode()

        # Update Z position
        g.chuck_z_position_state = "Separation"
        agentStateMachine.transition('MoveChuckOffAxis')

        return ResponseBuilder.success("MoveChuckOffAxisReply", "Probe station is in safe position")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckOffAxisReply", str(e), 500)


def move_chuck_wide(address=None, machine_type=None, user=None, waferAgentName=None):
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckWideReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        address, _, machine_type = resolve_project_parameters(address, None, machine_type)
        prober = get_prober(machine_type, address)

        prober.move_chuck_wide()

        prober.local_mode()

        # Update Z position
        g.chuck_z_position_state = "Separation"
        agentStateMachine.transition('MoveChMoveChuckWide')

        return ResponseBuilder.success("MoveChuckWideReply", "Probe station is in safe position")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckWideReply", str(e), 500)


def testing_lock():
    pass


def testing_unlock():
    pass
