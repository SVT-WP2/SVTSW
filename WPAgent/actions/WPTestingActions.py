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
        remainder = label[len("babyMOSAIX-"):]  # "1_1_ER2-W1"
        parts = remainder.split("_")  # ["1", "1", "ER2-W1"]
        return "babyMOSAIX", int(parts[0]), int(parts[1])

    elif label.startswith("MOSAIX-"):
        remainder = label[len("MOSAIX-"):]  # "1_ER2-W1"
        parts = remainder.split("_")  # ["1", "ER2-W1"]
        return "MOSAIX", int(parts[0]), 1  # column_svt always 1 for MOSAIX

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
        return "babyMOSAIX", int(label[3:])  # int("00") == 0, int("19") == 19

    elif label.startswith("SEG"):
        return "MOSAIX", int(label[3:])

    else:
        raise ValueError(f"Unknown ITS3 label format: '{label}'")


def _label_to_coordinates(label: str):
    """
    Auto-detect label type and convert to (col, row).

    Supports:
    - SVT labels: "babyMOSAIX-1_1_ER2-W1", "MOSAIX-1_ER2-W1"
    - ITS3 labels: "BAM00", "BAM19", "SEG0", "SEG4"

    Args:
        label: Label string

    Returns:
        (col, row) tuple or None if invalid
    """
    # Try SVT format first (contains '-' and '_')
    if '-' in label and '_' in label:
        try:
            sn_prefix, row_svt, column_svt = _parse_svt_label(label)

            # Convert SVT to local coordinates
            converter = get_converter()
            if not converter.conversion_map:
                converter.load_conversion_map("configs/WPMapConversion.json")

            result = converter.svt_to_local(row_svt, column_svt, sn_prefix)
            if result:
                row_local, col_local, _ = result
                print(f"   📍 SVT label '{label}' → SVT({row_svt},{column_svt}) → Local({row_local},{col_local})")
                return (col_local, row_local)
        except (ValueError, IndexError) as e:
            # Not SVT format, try ITS3
            pass

    # Try ITS3 format (starts with BAM or SEG)
    if label.startswith("BAM") or label.startswith("SEG"):
        try:
            sn_prefix, id_its3 = _parse_its3_label(label)

            # Convert ITS3 to local coordinates
            converter = get_converter()
            if not converter.conversion_map:
                converter.load_conversion_map("configs/WPMapConversion.json")

            result = converter.its3_to_local(id_its3, sn_prefix)
            if result:
                row_local, col_local, _ = result
                print(f"   📍 ITS3 label '{label}' → ID({id_its3}) → Local({row_local},{col_local})")
                return (col_local, row_local)
        except (ValueError, IndexError) as e:
            # Not ITS3 format either
            pass

    # Unknown format
    return None


def update_current_info(currentProber=None):
    """Update global parameters with current prober state"""
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


# ==============================================================================
# SCREENSHOT
# ==============================================================================

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


@validate_command
def move_chuck_xy(x, y, position, user=None, waferAgentName=None):
    """
    Move chuck XY

    Args:
        x: in micrometer
        y: in micrometer
        position: "Relative" or "Zero"
        user: current user
        waferAgentName: current WP Agent Name
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
        return ResponseBuilder.success("MoveChuckXYReply", f"Moved chuck to x={x}, y={y}")

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckXYReply", str(e), 500)


@validate_command
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


@validate_command
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

        prober.local_mode()

        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)
        return ResponseBuilder.success("MoveChuckCenterReply", f"Moved chuck to Center")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckCenterReply", str(e), 500)


@validate_command
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


@validate_command
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


@validate_command
def move_chuck_offaxis(user=None, waferAgentName=None):
    """Move chuck to off-axis area"""
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

        return ResponseBuilder.success("MoveChuckOffAxisReply", "Probe station is in off-axis position")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckOffAxisReply", str(e), 500)


@validate_command
def move_chuck_wide(user=None, waferAgentName=None):
    """Move chuck to wide position"""
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

        return ResponseBuilder.success("MoveChuckWideReply", "Probe station is in wide position")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckWideReply", str(e), 500)


@validate_command
def move_chuck_safe_position(user=None, waferAgentName=None):
    """Sequence MoveChuckOffAxis MoveChuckXY MoveChuckZ"""
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
        prober.move_chuck_xy(x=absolute_x, y=absolute_y, position='Zero')
        prober.move_chuck_z(z=absolute_z)

        prober.local_mode()

        # Update Z position
        g.chuck_z_position_state = "Separation"
        agentStateMachine.transition('MoveChuckSafePosition')

        return ResponseBuilder.success("MoveChuckSafePositionReply", "Probe station is in safe position")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckSafePositionReply", str(e), 500)


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


@validate_command
def move_chuck_separation(user=None, waferAgentName=None):
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


# ==============================================================================
# DIE MOVEMENT - COMBINED FUNCTION SUPPORTING ALL COORDINATE SYSTEMS
# ==============================================================================

@validate_command
def move_chuck_die(
        col=None,
        row=None,
        label=None,
        subsite=0,
        user=None,
        waferAgentName=None
):
    """
    Move to specific die using ANY coordinate system.

    Auto-detects input type:
    - Global coordinates: col + row (e.g., col=5, row=3)
    - SVT label: label="babyMOSAIX-1_1_ER2-W1" or "MOSAIX-1_ER2-W1"
    - ITS3 label: label="BAM00" or "SEG0"

    Args:
        col: Column index (for global coordinates)
        row: Row index (for global coordinates)
        label: SVT or ITS3 label string
        subsite: Subsite index (default 0)
        user: User performing action
        waferAgentName: Agent name

    Returns:
        Response dict

    Examples:
        # Global coordinates
        move_chuck_die(col=5, row=3, subsite=0)

        # SVT label
        move_chuck_die(label="babyMOSAIX-1_1_ER2-W1")

        # ITS3 label
        move_chuck_die(label="BAM00")
    """
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    g = SvtWPAagentGlobalParameters.getInstance()

    # ==============================================================
    # STEP 1: Validate input (must provide EITHER col+row OR label)
    # ==============================================================

    has_coordinates = (col is not None and row is not None)
    has_label = (label is not None and label.strip() != "")

    if not has_coordinates and not has_label:
        return ResponseBuilder.error(
            "MoveChuckRowColumnReply",
            "Must provide either (col, row) or label parameter",
            400
        )

    if has_coordinates and has_label:
        return ResponseBuilder.error(
            "MoveChuckRowColumnReply",
            "Cannot provide both coordinates (col, row) and label. Choose one.",
            400
        )

    # ==============================================================
    # STEP 2: If label provided, auto-detect type and convert to col/row
    # ==============================================================

    if has_label:

        # Auto-detect label type and convert to col/row
        result = _label_to_coordinates(label)

        if result is None:
            # List available label formats to help user
            return ResponseBuilder.error(
                "MoveChuckRowColumnReply",
                f"Invalid label format: '{label}'\n\n"
                f"Supported formats:\n"
                f"  SVT: 'babyMOSAIX-1_1_ER2-W1' or 'MOSAIX-1_ER2-W1'\n"
                f"  ITS3: 'BAM00', 'BAM19', 'SEG0', 'SEG4'",
                400
            )

        col, row = result
        print(f"   ✅ Converted to global coordinates: col={col}, row={row}")
    else:
        print(f"\n🎯 Using global coordinates: col={col}, row={row}")

    # ==============================================================
    # STEP 3: Move to die using col/row (same code for all input types!)
    # ==============================================================

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckRowColumnReply", error["output"], 400)

    try:
        prober = get_current_prober()
        prober.go_to_die(col, row)

        # Update die position
        g.set_current_die(col, row, subsite)
        agentStateMachine.transition('MoveChuckRowColumn')

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        # Build success message
        if has_label:
            message = f"Moved to die '{label}' (col={col}, row={row})"
        else:
            message = f"Moved to die col={col}, row={row}"

        return ResponseBuilder.success("MoveChuckRowColumnReply", message)

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckRowColumnReply", str(e), 500)


@validate_command
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


@validate_command
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

        agentStateMachine.transition('MoveChuckPreviousDie')

        return ResponseBuilder.success("MoveChuckPreviousDieReply", "Moved to previous die")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckPreviousDieReply", str(e), 500)


@validate_command
def set_ptpa(enable: bool, user=None, waferAgentName=None):
    """
    Enable or disable PTPA alignment

    Args:
        enable: True to enable PTPA, False to disable PTPA
        user: User performing action
        waferAgentName: Agent name
    """
    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("SetPTPAReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()
        prober.set_ptpa(enable)
        prober.local_mode()
        update_current_info(currentProber=prober)

        status = "enabled" if enable else "disabled"
        return ResponseBuilder.success("SetPTPAReply", f"PTPA {status}")

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("SetPTPAReply", str(e), 500)


@validate_command
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


@validate_command
def init_probing(user=None, waferAgentName=None):
    """Sequence of 'Go to off Axis area','Go to Center', 'AutoFocus', 'Align wafer', 'Find Home'"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("InitProbingReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()
        # Sequence
        prober.move_chuck_offaxis_area()
        prober.move_chuck_center()
        prober.auto_focus()

        # TODO: we need to get col and row for alignment from project that stored in DB
        prober.align_wafer(align_die_col=-1, align_die_row=1)
        prober.find_home()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition('InitProbing')
        return ResponseBuilder.success("InitProbingReply", f"Initialization complete")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("InitProbingReply", str(e), 500)


@validate_command
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


@validate_command
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


@validate_command
def load_wafer(waferId: float, orientation: str, user=None, waferAgentName=None):
    """Load wafer onto chuck"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    from actions.WPDataBaseActions import update_wp_machine_loaded_wafer

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

        return ResponseBuilder.success("LoadWaferReply", "Wafer has been loaded")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("LoadWaferReply", str(e), 500)


@validate_command
def unload_wafer(user=None, waferAgentName=None):
    """Unload wafer from chuck"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    from actions.WPDataBaseActions import update_wp_machine_loaded_wafer

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

        update_wp_machine_loaded_wafer(loaded_wafer_id=0, orientation=None)

        g.clear_wafer()
        agentStateMachine.transition('UnloadWafer')

        g.chuck_z_position_state = "Separation"
        g.current_working_area = "LoadPosition"

        return ResponseBuilder.success("UnloadWaferReply", "Wafer unloaded")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("UnloadWaferReply", str(e), 500)


@validate_command
def move_chuck_loaded_wafer(user=None, waferAgentName=None):
    """Load same wafer Load + MoveChuckOffAxis"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    from actions.WPDataBaseActions import get_loaded_wafer_from_db

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckLoadedWaferReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        prober.load_wafer()
        prober.move_chuck_offaxis_area()
        prober.local_mode()

        # Update info
        update_current_info(currentProber=prober)

        agentStateMachine.transition('MoveChuckLoadedWafer')

        g.chuck_z_position_state = "Separation"
        g.current_working_area = "OffAxis"

        return ResponseBuilder.success("MoveChuckLoadedWaferReply", "Wafer has been loaded")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckLoadedWaferReply", str(e), 500)


@validate_command
def move_chuck_unloaded_wafer(user=None, waferAgentName=None):
    """Unload wafer from chuck"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckUnloadWaferReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

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


@validate_command
def open_project(projectName: str, user=None, waferAgentName=None):
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
                                    projectName
                                    )

        print(projectName)

        prober.open_project(projectName)

        # Update project name (ID would need to come from DB)
        g.projectName = projectName
        g.set_project_name(projectName)
        g.opened_project_id = get_project_id_by_name(projectName)

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition('OpenProject')

        return ResponseBuilder.success("OpenProjectReply", f"Opened project: {project_path}")

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("OpenProjectReply", str(e), 500)


@validate_command
def change_project(projectName: str, user=None, waferAgentName=None):
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
                                    projectName
                                    )
        prober.open_project(projectName)

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        # Update project name (ID would need to come from DB)
        g.projectName = projectName
        g.set_project_name(projectName)

        g.opened_project_id = get_project_id_by_name(projectName)

        agentStateMachine.transition('ChangeProject')

        return ResponseBuilder.success("ChangeProjectReply", f"Changed project: {project_path}")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("ChangeProjectReply", str(e), 500)


@validate_command
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


@validate_command
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


@validate_command
def set_chuck_overtravel(overtravelGap=None, user=None, waferAgentName=None):
    """Set overtravel that includes setting actual gap and enable overtravel"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("SetOvertravelReply", error["output"], 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()
        prober.enable_overtravel(overtravel=True)
        prober.set_overtravel(overtravelGap)

        g.set_overdrive(overtravelGap)

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition('SetOverdrive')

        return ResponseBuilder.success("SetOvertravelReply", "SetOvertravel command successfully executed")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("SetOvertravelReply", str(e), 500)


@validate_command
def disable_chuck_overtravel(overtravelGap=None, user=None, waferAgentName=None):
    """Disable overtravel, set to 0"""
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


@validate_command
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


@validate_command
def move_chuck_asic(asicId: int, subsite: int = 0, user=None, waferAgentName=None):
    """
    Move to ASIC die using database ID

    Args:
        asicId: ASIC ID from database
    """
    from actions.WPDataBaseActions import get_asic_by_id
    g = SvtWPAagentGlobalParameters.getInstance()

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("MoveChuckAsicReply", error["output"], 400)

    # Get ASIC from database
    try:
        asic_data = get_asic_by_id(asicId)
    except Exception as e:
        return ResponseBuilder.error(
            "MoveChuckAsicReply",
            f"Failed to get ASIC from database: {e}",
            400
        )

    # Extract serial number
    serial_number = asic_data.get("serialNumber")
    if not serial_number:
        return ResponseBuilder.error(
            "MoveChuckAsicReply",
            f"ASIC ID {asicId} has no serial number",
            400
        )

    currentAsicWaferId = asic_data.get("waferId")
    if currentAsicWaferId != g.loaded_wafer_id:
        return ResponseBuilder.error(
            "MoveChuckAsicReply",
            f"ASIC ID {asicId} not found on loaded wafer",
            400
        )

    print(f"   Serial Number: {serial_number}")

    # Convert serial number to local coordinates
    # Reuse existing _label_to_coordinates helper!
    result = _label_to_coordinates(serial_number)

    if result is None:
        return ResponseBuilder.error(
            "MoveChuckAsicReply",
            f"Cannot parse ASIC serial number '{serial_number}'",
            400
        )

    col, row = result
    print(f"   ✅ Converted: col={col}, row={row}")

    # Move chuck
    try:
        prober = get_current_prober()
        prober.go_to_die(col, row)

        g.set_current_die(col, row, subsite)
        agentStateMachine.transition('MoveChuckAsic')

        update_current_info(currentProber=prober)
        prober.local_mode()

        return ResponseBuilder.success(
            "MoveChuckAsicReply",
            f"Moved to ASIC ID {asicId} (serial: {serial_number}) at col={col}, row={row}"
        )

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("MoveChuckAsicReply", str(e), 500)


@validate_command
def testing_lock(
        user=None,
        waferAgentName=None,
        reason="Testing in progress",
        test_sequence_id=None
):
    """
    Lock the WP Agent for testing to prevent interference from other users.

    Args:
        user: User who is locking the agent (REQUIRED)
        waferAgentName: Agent name
        reason: Reason for locking (default: "Testing in progress")
        test_sequence_id: ID of test sequence being run

    Returns:
        Success if locked, error if already locked by someone else

    Example:
        testing_lock(
            user="TestAgent_User1",
            reason="Running IV characterization test",
            test_sequence_id="TEST_SEQ_12345"
        )
    """
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    if user is None:
        return ResponseBuilder.error(
            "TestingLockReply",
            "User parameter is required for locking",
            400
        )

    g = SvtWPAagentGlobalParameters.getInstance()

    # Check if already locked
    if g.is_locked_for_testing:
        lock_info = g.get_lock_info()

        # If locked by same user, allow re-lock (update reason/test_id)
        if g.locked_by_user == user:
            g.lock_for_testing(user, reason, test_sequence_id)
            return ResponseBuilder.success(
                "TestingLockReply",
                f"Lock updated for user '{user}'"
            )

        # Locked by different user - DENY
        return ResponseBuilder.error(
            "TestingLockReply",
            f"Already locked by '{g.locked_by_user}'. "
            f"Reason: {g.lock_reason}. "
            f"Locked for {lock_info['locked_duration_seconds']:.0f} seconds. "
            f"Cannot lock again until unlocked.",
            423  # HTTP 423 Locked
        )

    # Lock the agent
    g.lock_for_testing(user, reason, test_sequence_id)

    # Update state machine
    agentStateMachine.force_state(WPAgentState.AtContact_Locked)

    return ResponseBuilder.success(
        "TestingLockReply",
        f"WP Agent locked for testing by '{user}'"
    )


@validate_command
def testing_unlock(user=None, waferAgentName=None, force=False):
    """
    Unlock the WP Agent after testing is complete.

    Authorization:
    - User who locked it can unlock
    - Developer can always unlock
    - force=True allows Developer to force unlock

    Args:
        user: User requesting unlock (REQUIRED)
        waferAgentName: Agent name
        force: Force unlock (only for Developers)

    Returns:
        Success if unlocked, error if not authorized

    Example:
        testing_unlock(user="TestAgent_User1")
        testing_unlock(user="DeveloperUser", force=True)
    """
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    if user is None:
        return ResponseBuilder.error(
            "TestingUnlockReply",
            "User parameter is required for unlocking",
            400
        )

    g = SvtWPAagentGlobalParameters.getInstance()

    # Check if locked
    if not g.is_locked_for_testing:
        return ResponseBuilder.success(
            "TestingUnlockReply",
            "WP Agent is not locked"
        )

    # Get user hierarchy
    user_hierarchy = g.user_logged_hierarchy if hasattr(g, 'user_logged_hierarchy') else None

    # Check authorization
    can_unlock = (
            user == g.locked_by_user or  # User who locked it
            user_hierarchy == "Developer" or  # Developer
            force and user_hierarchy == "Developer"  # Forced by Developer
    )

    if not can_unlock:
        return ResponseBuilder.error(
            "TestingUnlockReply",
            f"Not authorized to unlock. Locked by '{g.locked_by_user}'. "
            f"Only '{g.locked_by_user}' or a Developer can unlock.",
            403  # HTTP 403 Forbidden
        )

    # Get lock info before unlocking (for logging)
    lock_info = g.get_lock_info()
    locked_by = g.locked_by_user

    # Unlock the agent
    g.unlock_from_testing()

    # Update state machine
    agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

    unlock_message = f"WP Agent unlocked by '{user}' (was locked by '{locked_by}' for {lock_info['locked_duration_seconds']:.0f} seconds)"
    if force:
        unlock_message += " [FORCED UNLOCK]"

    return ResponseBuilder.success(
        "TestingUnlockReply",
        unlock_message
    )