from drivers.WPFactory import get_prober
from utilities.WPHelpers import resolve_project_parameters
from utilities.WPResponseBuilder import ResponseBuilder
import os
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
from stateMachine.WpAgentStateMachine import WPAgentState
from utilities.WPValidationDecorator import validate_command
from utilities.WPMapConverter import get_converter

from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.WPFactory import get_current_prober


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


def take_screenshot(
        filename=None,
        snapshot_type="CameraRaw",
        save_locally=True,
        output_dir="screenshots",
        user=None,
        waferAgentName=None
):
    """
    Take a screenshot from prober camera

    Args:
        filename: Optional filename (auto-generated if not provided)
        snapshot_type: "CameraRaw", "Overlay", or "CameraProcessed"
        save_locally: True to save on WP Agent machine, False to save on prober
        output_dir: Directory to save screenshots
        user: User performing action
        waferAgentName: Agent name

    Returns:
        Response with screenshot path
# @validate_command
def move_chuck_xy(x, y, user=None, waferAgentName=None):
    """
    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("TakeScreenshotReply", error["output"], 400)

    try:
        prober = get_current_prober()

        filepath = prober.take_screenshot(
            filename=filename,
            snapshot_type=snapshot_type,
            save_locally=save_locally,
            output_dir=output_dir
        )

        # Get absolute path
        abs_path = os.path.abspath(filepath)

        return ResponseBuilder.success(
            "TakeScreenshotReply",
            f"Screenshot saved: {abs_path}"
        )

    except RuntimeError as e:
        return ResponseBuilder.error("TakeScreenshotReply", str(e), 400)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return ResponseBuilder.error("TakeScreenshotReply", str(e), 500)


# @validate_command
def move_chuck_xy(x, y, position, user=None, waferAgentName=None):
    """
    Args:
        x: in micrometer
        y: in micrometer
        position:
          - Relative : Use curent chuck position as reference
          - Zero : Use curent chuck position as reference
        user: current user
        waferAgentName: current WP Agent Name

    Returns:

    """
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    error = _ensure_initialized()
    if error:
        return error
    g = SvtWPAagentGlobalParameters.getInstance()
    try:
        prober = get_current_prober()
        prober.move_chuck_xy(x, y, position)

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)
        return ResponseBuilder.success("MoveChuckXYReply", f"Moved chuck to Center")

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckXYReply", str(e), 500)


## @validate_command
def init_probing(user=None, waferAgentName=None):
    """Sequance of 'Go to off Axis area','Go to Center', 'AutoFocus', 'Align wafer', 'Find Home'"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("InitProbingReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()
        # Sequance
        prober.move_chuck_offaxis_area()
        prober.move_chuck_center()
        prober.auto_focus()

        # TODO: we need to get col and row for aligment from project that stored in DB
        prober.align_wafer(align_die_col=-1, align_die_row=1)
        prober.find_home()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition('InitProbing')
        return ResponseBuilder.success("InitProbingReply", f"Moved chuck to Center")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("InitProbingReply", str(e), 500)


# @validate_command
def move_chuck_center(user=None, waferAgentName=None):
    """Move chuck to Center"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckCenterReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()
        prober.move_chuck_center()

        # Update info
        update_current_info(currentProber=prober)

        # TODO: would be nice to check of die is selected to return die if not selected just None
        g.current_die_col = None
        g.current_die_row = None

        prober.local_mode()

        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)
        return ResponseBuilder.success("MoveChuckCenterReply", f"Moved chuck to Center")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckCenterReply", str(e), 500)


# @validate_command
def move_chuck_z(z, user=None, waferAgentName=None):
    """Move chuck to Z position"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckZReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()
        prober.move_chuck_z(z)

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

        return ResponseBuilder.success("MoveChuckZReply", f"Moved chuck to z={z}")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckZReply", str(e), 500)


# @validate_command
def enable_ptpa(user=None, waferAgentName=None):
    """Enable PTPA alignment"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("EnablePTPAReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()
        prober.enable_ptpa()
        prober.local_mode()

        # Update info
        update_current_info(currentProber=prober)

        #agentStateMachine.transition('RunPTPA')

        return ResponseBuilder.success("EnablePTPAReply", "PTPA enabled")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("EnablePTPAReply", str(e), 500)

def disable_ptpa(user=None, waferAgentName=None):
    """Disable PTPA alignment"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("DisablePTPAReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()
        prober.disable_ptpa()
        prober.local_mode()

        # Update info
        update_current_info(currentProber=prober)

        #agentStateMachine.transition('RunPTPA')

        return ResponseBuilder.success("DisablePTPAReply", "PTPA disabled")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("DisablePTPAReply", str(e), 500)

@validate_command
# @validate_command
def run_ptpa(user=None, waferAgentName=None):
    """Run PTPA alignment"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("RunPTPAReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()
        prober.run_ptpa()
        prober.local_mode()

        # Update info
        update_current_info(currentProber=prober)

        agentStateMachine.transition('RunPTPA')

        return ResponseBuilder.success("RunPTPAReply", "PTPA executed")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("RunPTPAReply", str(e), 500)


# @validate_command
def move_chuck_next_die(user=None, waferAgentName=None):
    """Step to next die"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckNextDieReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()
        result = prober.step_next_die()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition('MoveChuckNextDie')

        return ResponseBuilder.success("MoveChuckNextDieReply", f"Stepped to next die: {result}")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckNextDieReply", str(e), 500)


def move_chuck_die(col: int, row: int, subsite: int = 0, user=None,
                   waferAgentName=None):
    """Move to specific die"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    g = SvtWPAagentGlobalParameters.getInstance()
    g.set_machine_id(4)
    g.machine_id = 4

    try:
        prober = get_current_prober()

        prober.go_to_die(col, row)

        # Update die position
        g.set_current_die(col, row, subsite)
        agentStateMachine.transition('MoveChuckRowColumn')
        # Update info
        update_current_info(currentProber=prober)

        prober.local_mode()

        return ResponseBuilder.success("MoveChuckRowColumnReply", f"Moved to die {col},{row}")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckRowColumnReply", str(e), 500)

def _parse_svt_label(label: str):
    """
    Parse an SVT label string into (sn_prefix, row_svt, column_svt).

    Format:
        MOSAIX    → "MOSAIX-{row_svt}_ER2-W{n}"         column_svt is always 1
        babyMOSAIX → "babyMOSAIX-{row_svt}_{col_svt}_ER2-W{n}"

    Examples:
        "MOSAIX-1_ER2-W1"         → ("MOSAIX",     1, 1)
        "babyMOSAIX-1_1_ER2-W1"   → ("babyMOSAIX", 1, 1)
        "babyMOSAIX-3_2_ER2-W5"   → ("babyMOSAIX", 3, 2)
    """
    if label.startswith("babyMOSAIX-"):
        remainder = label[len("babyMOSAIX-"):]   # "1_1_ER2-W1"
        parts = remainder.split("_")              # ["1", "1", "ER2-W1"]
        return "babyMOSAIX", int(parts[0]), int(parts[1])

    elif label.startswith("MOSAIX-"):
        remainder = label[len("MOSAIX-"):]        # "1_ER2-W1"
        parts = remainder.split("_")              # ["1", "ER2-W1"]
        return "MOSAIX", int(parts[0]), 1         # column_svt always 1 for MOSAIX

    else:
        raise ValueError(f"Unknown ASIC type in SVT label: '{label}'")


def _parse_its3_label(label: str):
    """
    Parse an ITS3 label string into (sn_prefix, id_its3).

    Format:
        BAM → babyMOSAIX, two-digit zero-padded index  e.g. "BAM00", "BAM19"
        SEG → MOSAIX,     single digit index            e.g. "SEG0",  "SEG4"

    Examples:
        "BAM00" → ("babyMOSAIX", 0)
        "BAM19" → ("babyMOSAIX", 19)
        "SEG0"  → ("MOSAIX", 0)
        "SEG4"  → ("MOSAIX", 4)
    """
    if label.startswith("BAM"):
        return "babyMOSAIX", int(label[3:])   # int("00") == 0, int("19") == 19

    elif label.startswith("SEG"):
        return "MOSAIX", int(label[3:])

    else:
        raise ValueError(f"Unknown ITS3 label format: '{label}'")

def move_chuck_die_svt(svt_label: str, subsite: int = 0, user=None, waferAgentName=None):
    """
    Move to a specific die using an SVT label string.

    Args:
        svt_label: SVT label string, e.g.:
                   "MOSAIX-1_ER2-W1"       → SVT row=1, col=1 on MOSAIX
                   "babyMOSAIX-1_1_ER2-W1" → SVT row=1, col=1 on babyMOSAIX
        subsite: Subsite index (default 0)
    """
    try:
        sn_prefix, row_svt, column_svt = _parse_svt_label(svt_label)
    except (ValueError, IndexError) as e:
        return ResponseBuilder.error(
            "MoveChuckRowColumnReply",
            f"Invalid SVT label '{svt_label}': {e}",
            400
        )

    converter = get_converter()
    if not converter.conversion_map:
        converter.load_conversion_map("configs/WPMapConversion.json")

    result = converter.svt_to_local(row_svt, column_svt, sn_prefix)

    if result is None:
        return ResponseBuilder.error(
            "MoveChuckRowColumnReply",
            f"No local mapping found for SVT ({row_svt},{column_svt}) on {sn_prefix}",
            400
        )

    row_local, col_local, _ = result
    return move_chuck_die(col=col_local, row=row_local, subsite=subsite,
                          user=user, waferAgentName=waferAgentName)

def move_chuck_die_its3(its3_label: str, subsite: int = 0, user=None, waferAgentName=None):
    """
    Move to a specific die using an ITS3 label string.

    Args:
        its3_label: ITS3 label string, e.g.:
                    "BAM00" → id=0  on babyMOSAIX
                    "BAM19" → id=19 on babyMOSAIX
                    "SEG0"  → id=0  on MOSAIX
        subsite: Subsite index (default 0)
    """
    try:
        sn_prefix, id_its3 = _parse_its3_label(its3_label)
    except (ValueError, IndexError) as e:
        return ResponseBuilder.error(
            "MoveChuckRowColumnReply",
            f"Invalid ITS3 label '{its3_label}': {e}",
            400
        )

    converter = get_converter()
    if not converter.conversion_map:
        converter.load_conversion_map("configs/WPMapConversion.json")

    result = converter.its3_to_local(id_its3, sn_prefix)

    if result is None:
        return ResponseBuilder.error(
            "MoveChuckRowColumnReply",
            f"No local mapping found for ITS3 '{its3_label}' (id={id_its3}) on {sn_prefix}",
            400
        )

    row_local, col_local, _ = result
    return move_chuck_die(col=col_local, row=row_local, subsite=subsite,
                          user=user, waferAgentName=waferAgentName)

def update_current_info(currentProber=None):
    g = SvtWPAagentGlobalParameters.getInstance()
    # Update position
    get_current_position = currentProber.get_current_index().split(",")
    g.current_die_col = int(get_current_position[1])
    g.current_die_row = int(get_current_position[2])

    # update total number
    g.total_dies_number = int(currentProber.get_dies_number().split(",")[0])

    # update Chuck position
    g.chuck_z_position_state = currentProber.get_chuck_position()
    g.set_chuck_position(currentProber.get_chuck_position())

    # update working area
    g.current_working_area = currentProber.get_current_working_area().removesuffix("Camera")
    g.camera_mount_point = currentProber.get_current_working_area()


# @validate_command

def switch_camera(mountPoint, user=None, waferAgentName=None):
    """Switch camera mount point"""

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("SwitchCameraReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()
        prober.switch_camera(mountPoint)

        # Update info
        update_current_info(currentProber=prober)

        # Update camera
        g.camera_mount_point = mountPoint
        prober.local_mode()

        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

        return ResponseBuilder.success("SwitchCameraReply", f"Switched camera to {mountPoint}")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("SwitchCameraReply", str(e), 500)


# @validate_command
def move_chuck_home(user=None, waferAgentName=None):
    """Move chuck to home position"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckHomeReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()
        prober.move_chuck_home()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()
        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

        return ResponseBuilder.success("MoveChuckHomeReply", "Chuck moved home")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckHomeReply", str(e), 500)


# @validate_command
def unload_wafer(user=None, waferAgentName=None):
    """Unload wafer from chuck"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    from WPDataBaseActions import update_wp_machine_loaded_wafer

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("UnloadWaferReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    if g.loaded_wafer_id is None:
        return ResponseBuilder.error("UnloadWaferReply", "No wafer loaded", 400)

    try:
        prober = get_current_prober()

        prober.unload_wafer()
        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()
        # TODO: We need to set empty probe machine
        update_wp_machine_loaded_wafer(loaded_wafer_id=0, orientation=None)

        g.clear_wafer()
        agentStateMachine.transition('UnloadWafer')

        g.chuck_z_position_state = "Separation"
        g.current_working_area = "LoadPosition"

        return ResponseBuilder.success("UnloadWaferReply", "Wafer unloaded")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("UnloadWaferReply", str(e), 500)


# # @validate_command
def open_project(project_name: str, user=None, waferAgentName=None):
    """Open project"""

    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    from actions.WPDataBaseActions import get_project_id_by_name

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("OpenProjectReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        project_path = os.path.join(str(g.projects_base_path),
                                    project_name
                                    )

        print(project_name)

        prober.open_project(project_name)

        # Update project name (ID would need to come from DB)
        g.projectName = project_name
        g.set_project_name(project_name)
        g.opened_project_id = get_project_id_by_name(project_name)

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition('OpenProject')

        return ResponseBuilder.success("OpenProjectReply", f"Opened project: {project_path}")

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("OpenProjectReply", str(e), 500)


# @validate_command
def change_project(project_name: str, user=None, waferAgentName=None):
    """Change project"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    from actions.WPDataBaseActions import get_project_id_by_name

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("ChangeProjectReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        project_path = os.path.join(str(g.projects_base_path),
                                    project_name
                                    )
        prober.open_project(project_name)

        # Update info
        update_current_info(currentProber=prober)
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


# @validate_command
def load_wafer(waferId: float, orientation: str, user=None, waferAgentName=None):
    """Load wafer onto chuck"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    from WPDataBaseActions import update_wp_machine_loaded_wafer

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("LoadWaferReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    if g.loaded_wafer_id is not None:
        return ResponseBuilder.error("LoadWaferReply", "Wafer already loaded", 400)

    try:
        prober = get_current_prober()

        prober.load_wafer()
        prober.move_chuck_offaxis_area()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        update_wp_machine_loaded_wafer(loaded_wafer_id=waferId, orientation=orientation)

        agentStateMachine.transition('LoadWafer')

        g.chuck_z_position_state = "Separation"
        g.current_working_area = "OffAxis"

        return ResponseBuilder.success("LoadWaferReply", "Wafer has been loaded to center")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("LoadWaferReply", str(e), 500)


# @validate_command
def find_home(user=None, waferAgentName=None):
    """Find home position"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("FindHomeReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        prober.find_home()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

        return ResponseBuilder.success("FindHomeReply", "Found home position")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("FindHomeReply", str(e), 500)


## @validate_command
def align_wafer(align_die_col=None, align_die_row=None, subsite=None,
                user=None, waferAgentName=None):
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
        prober = get_current_prober()

        prober.align_wafer(align_die_col, align_die_row, subsite)

        # Update info
        update_current_info(currentProber=prober)
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


@validate_command
def move_chuck_contact(user=None, waferAgentName=None):
    """Move probes to contact position"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckContactReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        prober.go_to_contact()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        # Update Z position
        g.chuck_z_position_state = "Contact"
        agentStateMachine.transition('MoveChuckContact')

        return ResponseBuilder.success("MoveChuckContactReply", "Probe station is in contact")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckContactReply", str(e), 500)


# @validate_command
def Move_chuck_separation(user=None, waferAgentName=None):
    """Move probes to separation position"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckSeparationReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()
        prober.go_to_separation()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        # Update Z position
        g.chuck_z_position_state = "Separation"
        agentStateMachine.transition('MoveChuckSeparation')

        return ResponseBuilder.success("MoveChuckSeparationReply", "Probe station is in separation")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckSeparationReply", str(e), 500)


# # @validate_command
def auto_focus(user=None, waferAgentName="CERN"):
    """Execute auto-focus"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("AutoFocusReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        prober.auto_focus()

        g.wpAgentName = waferAgentName

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition('AutoFocus')

        return ResponseBuilder.success("AutoFocusReply", "Auto-focus command successfully executed")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("AutoFocusReply", str(e), 500)


# @validate_command
def move_chuck_work_area(work_area=0, user=None, waferAgentName=None):
    """Move chuck to specified work area"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckToWorkAreaReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        prober.move_chuck_work_area(work_area)

        # Update working area
        area_names = {0: "Probing", 1: "Offaxis"}
        g.current_working_area = area_names.get(work_area, f"Area{work_area}")

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

        return ResponseBuilder.success("MoveChuckToWorkAreaReply", f"Moved to {work_area} workarea")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckToWorkAreaReply", str(e), 500)


# @validate_command
def local_mode(user=None, waferAgentName=None):
    """Set prober to local mode"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("LocalModeReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

        return ResponseBuilder.success("LocalModeReply", "Local mode")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("LocalModeReply", str(e), 500)


# @validate_command
def move_chuck_previous_die(user=None, waferAgentName=None):
    """Move to previous die"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckPreviousDieReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        prober.step_prev_die()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        # TODO: Update die position if result contains coordinates
        # g.set_current_die(col, row, subsite)
        agentStateMachine.transition('MoveChuckPreviousDie')

        return ResponseBuilder.success("MoveChuckPreviousDieReply", "Moved to previous die")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckPreviousDieReply", str(e), 500)


# @validate_command
def get_chuck_position(user=None, waferAgentName=None):
    """Get current chuck position"""
    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("GetChuckPositionReply", error["output"], 400)

    try:
        prober = get_current_prober()

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


# @validate_command
def set_chuck_overtravel(overtravelGap=None, user=None, waferAgentName=None):
    """Set overtravel that includes seting actual gap and enable overtravel"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("SetOvertravelReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        prober.set_overtravel(overtravelGap)
        prober.enable_overtravel(overtravel=True)

        g.set_overdrive(overtravelGap)

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition('SetOverdrive')

        return ResponseBuilder.success("SetOvertravelReply", "SetOvertravel command successfully executed")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("SetOvertravelReply", str(e), 500)


# @validate_command
def disable_chuck_overtravel(overtravelGap=None, user=None, waferAgentName=None):
    """Disaable overtravel, set to 0"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("DisableOvertravelReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        prober.set_overtravel(overtravelGap=0)
        prober.enable_overtravel(overtravel=True)

        g.set_overdrive(overtravelGap)

        # Update info
        update_current_info(currentProber=prober)

        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

        return ResponseBuilder.success("DisableOvertravelReply", "DisableOvertravel command successfully executed")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("DisableOvertravelReply", str(e), 500)


# @validate_command
def move_chuck_loaded_wafer(user=None, waferAgentName=None):
    """Load same wafer Load + MoveChuckOffAxis """
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    from actions.WPDataBaseActions import get_loaded_wafer_from_db

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckLoadedWaferReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    # if g.loaded_wafer_id is not None:
    #    return ResponseBuilder.error("MoveChuckLoadedWaferReply", "Wafer loaded", 400)

    try:
        prober = get_current_prober()

        prober.load_wafer()
        prober.move_chuck_offaxis_area()
        prober.local_mode()

        # Update info
        update_current_info(currentProber=prober)

        # get_loaded_wafer_from_db(g.wp_machine_id)

        agentStateMachine.transition('MoveChuckLoadedWafer')

        g.chuck_z_position_state = "Separation"
        g.current_working_area = "OffAxis"

        return ResponseBuilder.success("MoveChuckLoadedWaferReply", "Wafer has been loaded to center")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckLoadedWaferReply", str(e), 500)


# @validate_command
def move_chuck_unloaded_wafer(user=None, waferAgentName=None):
    """Unload wafer from chuck"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckUnloadWaferReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()
    g.loaded_wafer_id = 2

    if g.loaded_wafer_id is None:
        return ResponseBuilder.error("MoveChuckUnloadWaferReply", "No wafer loaded", 400)

    try:
        prober = get_current_prober()

        prober.unload_wafer()
        prober.local_mode()

        # Update info
        update_current_info(currentProber=prober)

        agentStateMachine.transition('MoveChuckUnloadWafer')

        g.chuck_z_position_state = "Separation"
        g.current_working_area = "LoadPosition"

        return ResponseBuilder.success("MoveChuckUnloadWaferReply", "Wafer unloaded")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckUnloadWaferReply", str(e), 500)


# @validate_command
def move_chuck_asic():
    pass


# @validate_command
def move_chuck_safe_position(user=None, waferAgentName=None):
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
        prober = get_current_prober()

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


# @validate_command
def move_chuck_offaxis(user=None, waferAgentName=None):
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckOffAxisReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        prober.move_chuck_offaxis_area()

        prober.local_mode()

        # Update info
        update_current_info(currentProber=prober)

        # Update Z position
        g.chuck_z_position_state = "Separation"
        agentStateMachine.transition('MoveChuckOffAxis')

        return ResponseBuilder.success("MoveChuckOffAxisReply", "Probe station is in safe position")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckOffAxisReply", str(e), 500)


# @validate_command
def move_chuck_wide(user=None, waferAgentName=None):
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckWideReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        prober.move_chuck_wide()

        prober.local_mode()

        # Update info
        update_current_info(currentProber=prober)

        # Update Z position
        g.chuck_z_position_state = "Separation"
        agentStateMachine.transition('MoveChMoveChuckWide')

        return ResponseBuilder.success("MoveChuckWideReply", "Probe station is in safe position")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckWideReply", str(e), 500)


# @validate_command
def testing_lock():
    pass


# @validate_command
def testing_unlock():
    pass
