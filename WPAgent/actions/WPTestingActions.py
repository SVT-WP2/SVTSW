from utilities.WPResponseBuilder import ResponseBuilder
import os
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
from utilities.WPValidationDecorator import validate_command, validate_command_with_name, get_reply_type
from utilities.WPMapConverter import get_converter

from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.WPFactory import get_current_prober
import time


def _ensure_initialized():
    """
    Helper function to check if prober is initialized before executing commands.
    Returns error dict if not ready, None if ready.
    """
    from utilities.WPHelpers import check_prober_ready

    is_ready, message = check_prober_ready()
    if not is_ready:
        from utilities.WPResponseBuilder import ResponseBuilder
        return ResponseBuilder.error("NotInitializedReply", message, 503)
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
        remainder = label[len("babyMOSAIX-") :]  # "1_1_ER2-W1"
        parts = remainder.split("_")  # ["1", "1", "ER2-W1"]
        return "babyMOSAIX", int(parts[0]), int(parts[1])

    elif label.startswith("MOSAIX-"):
        remainder = label[len("MOSAIX-") :]  # "1_ER2-W1"
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
    if "-" in label and "_" in label:
        try:
            sn_prefix, row_svt, column_svt = _parse_svt_label(label)

            # Convert SVT to local coordinates
            converter = get_converter()
            if not converter.conversion_map:
                import pathlib

                _HERE = pathlib.Path(__file__).parent.parent  # WPAgent/
                MAP_CONVERSION_PATH = str(_HERE / "configs" / "WPMapConversion.json")
                converter.load_conversion_map(MAP_CONVERSION_PATH)

            result = converter.svt_to_local(row_svt, column_svt, sn_prefix)
            if result:
                row_local, col_local, _ = result
                print(
                    f"   📍 SVT label '{label}' → SVT({row_svt}, {column_svt}) → Local({row_local}, {col_local})"
                )
                return col_local, row_local
        except (ValueError, IndexError):
            # Not SVT format, try ITS3
            pass

    # Try ITS3 format (starts with BAM or SEG)
    if label.startswith("BAM") or label.startswith("SEG"):
        try:
            sn_prefix, id_its3 = _parse_its3_label(label)

            # Convert ITS3 to local coordinates
            converter = get_converter()
            if not converter.conversion_map:
                import pathlib

                _HERE = pathlib.Path(__file__).parent.parent  # WPAgent/
                MAP_CONVERSION_PATH = str(_HERE / "configs" / "WPMapConversion.json")
                converter.load_conversion_map(MAP_CONVERSION_PATH)

            result = converter.its3_to_local(id_its3, sn_prefix)
            if result:
                row_local, col_local, _ = result
                print(
                    f"   📍 ITS3 label '{label}' → ID({id_its3}) → Local({row_local}, {col_local})"
                )
                return col_local, row_local
        except (ValueError, IndexError):
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
    g.current_working_area = currentProber.get_current_working_area().removesuffix(
        "Camera"
    )
    g.camera_mount_point = currentProber.get_current_working_area()


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
    reply = get_reply_type()

    error = _ensure_initialized()
    if error:
        return error
    try:
        prober = get_current_prober()
        prober.move_chuck_xy(x, y, position)

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition("MoveChuckXY")
        return ResponseBuilder.success(
            reply, f"Moved chuck to x={x}, y={y}"
        )

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def move_chuck_z(z, user=None, waferAgentName=None):
    """Move chuck to Z position"""
    reply = get_reply_type()

    error = _ensure_initialized()
    if error:
        return error

    try:
        prober = get_current_prober()
        prober.move_chuck_z(z)

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition("MoveChuckZ")
        return ResponseBuilder.success(reply, f"Moved chuck to z={z}")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def move_chuck_center(user=None, waferAgentName=None):
    """Move chuck to Center"""
    reply = get_reply_type()

    error = _ensure_initialized()
    if error:
        return error

    try:
        prober = get_current_prober()
        prober.move_chuck_center()

        # Update info
        update_current_info(currentProber=prober)

        prober.local_mode()

        agentStateMachine.transition("MoveChuckCenter")
        return ResponseBuilder.success(reply, f"Moved chuck to Center")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def move_chuck_home(user=None, waferAgentName=None):
    """Move chuck to home position"""
    reply = get_reply_type()

    error = _ensure_initialized()
    if error:
        return error

    try:
        prober = get_current_prober()
        prober.move_chuck_home()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()
        agentStateMachine.transition("MoveChuckHome")

        return ResponseBuilder.success(reply, "Chuck moved home")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def move_chuck_work_area(work_area=0, user=None, waferAgentName=None):
    """Move chuck to specified work area"""
    reply = get_reply_type()
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return error

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

        agentStateMachine.transition("MoveChuckToWorkArea")

        return ResponseBuilder.success(
            reply, f"Moved to {work_area} workarea"
        )
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def move_chuck_offaxis(user=None, waferAgentName=None):
    """Move chuck to off-axis area"""
    reply = get_reply_type()
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        prober.move_chuck_offaxis_area()

        prober.local_mode()

        # Update info
        update_current_info(currentProber=prober)

        # Update Z position
        g.chuck_z_position_state = "Separation"
        agentStateMachine.transition("MoveChuckOffAxis")

        return ResponseBuilder.success(
            reply, "Probe station is in off-axis position"
        )
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def move_chuck_wide(user=None, waferAgentName=None):
    """Move chuck to wide position"""
    reply = get_reply_type()
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        prober.move_chuck_wide()

        prober.local_mode()

        # Update info
        update_current_info(currentProber=prober)

        # Update Z position
        g.chuck_z_position_state = "Separation"
        agentStateMachine.transition("MoveChuckWide")

        return ResponseBuilder.success(
            reply, "Probe station is in wide position"
        )
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def move_chuck_safe_position(user=None, waferAgentName=None):
    """Sequence MoveChuckOffAxis MoveChuckXY MoveChuckZ"""
    reply = get_reply_type()
    # absolute_x = 183672.8
    # absolute_y = -33439.9
    # absolute_z = 10377.7
    WAFER_DIAMETER_UM = 300000
    MARGIN_UM = 10000
    RADIUS_UM = WAFER_DIAMETER_UM / 2

    safe_x_um = RADIUS_UM * 0.25
    safe_y_um = RADIUS_UM + MARGIN_UM
    safe_z_um = 10377.7

    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        prober.move_chuck_offaxis_area()
        prober.move_chuck_xy(x=safe_x_um, y=safe_y_um, position="Center")
        prober.move_chuck_z(z=safe_z_um)

        prober.local_mode()

        # Update Z position
        g.chuck_z_position_state = "Separation"
        agentStateMachine.transition("MoveChuckSafePosition")

        return ResponseBuilder.success(
            reply, "Probe station is in safe position"
        )
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def move_chuck_contact(user=None, waferAgentName=None):
    """Move probes to contact position"""
    reply = get_reply_type()
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        prober.go_to_contact()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        # Update Z position
        g.chuck_z_position_state = "Contact"
        agentStateMachine.transition("MoveChuckContact")

        return ResponseBuilder.success(
            reply, "Probe station is in contact"
        )
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def move_chuck_separation(user=None, waferAgentName=None):
    """Move probes to separation position"""
    reply = get_reply_type()
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()
        prober.go_to_separation()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        # Update Z position
        g.chuck_z_position_state = "Separation"
        agentStateMachine.transition("MoveChuckSeparation")

        return ResponseBuilder.success(
            reply, "Probe station is in separation"
        )
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


# ==============================================================================
# DIE MOVEMENT - COMBINED FUNCTION SUPPORTING ALL COORDINATE SYSTEMS
# ==============================================================================


@validate_command
def move_chuck_die(
    col=None, row=None, label=None, subsite=0, user=None, waferAgentName=None
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
    reply = get_reply_type()
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    g = SvtWPAagentGlobalParameters.getInstance()

    # ==============================================================
    # STEP 1: Validate input (must provide EITHER col+row OR label)
    # ==============================================================

    has_coordinates = col is not None and row is not None
    has_label = label is not None and label.strip() != ""

    if not has_coordinates and not has_label:
        return ResponseBuilder.error(
            reply,
            "Must provide either (col, row) or label parameter",
            400,
        )

    if has_coordinates and has_label:
        return ResponseBuilder.error(
            reply,
            "Cannot provide both coordinates (col, row) and label. Choose one.",
            400,
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
                reply,
                f"Invalid label format: '{label}'\n\n"
                "Supported formats:\n"
                f"  SVT: 'babyMOSAIX-1_1_ER2-W1' or 'MOSAIX-1_ER2-W1'\n"
                f"  ITS3: 'BAM00', 'BAM19', 'SEG0', 'SEG4'",
                400,
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
        return error

    try:
        prober = get_current_prober()
        prober.go_to_die(col, row)

        # Update die position
        g.set_current_die(col, row, subsite)
        agentStateMachine.transition("MoveChuckRowColumn")

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        # Build success message
        if has_label:
            message = f"Moved to die '{label}' (col={col}, row={row})"
        else:
            message = f"Moved to die col={col}, row={row}"

        return ResponseBuilder.success(reply, message)

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def move_chuck_next_die(user=None, waferAgentName=None):
    """Step to next die"""
    reply = get_reply_type()

    error = _ensure_initialized()
    if error:
        return error

    try:
        prober = get_current_prober()
        result = prober.step_next_die()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition("MoveChuckNextDie")

        return ResponseBuilder.success(
            reply, f"Stepped to next die: {result}"
        )
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def move_chuck_previous_die(user=None, waferAgentName=None):
    """Move to previous die"""
    reply = get_reply_type()

    error = _ensure_initialized()
    if error:
        return error

    try:
        prober = get_current_prober()

        prober.step_prev_die()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition("MoveChuckPreviousDie")

        return ResponseBuilder.success(
            reply, "Moved to previous die"
        )
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command_with_name("TestPTPA")
def test_ptpa(
    screenshot_interval: float = 2.0,
    output_dir: str = "ptpa_test_screenshots",
    capture_screenshots: bool = True,
    user=None,
    waferAgentName=None,
):
    """
    Run PTPA alignment, optionally capturing periodic screenshots from the
    PROBER'S OWN CAMERA (via Sentio's `vision.snap_image` remote command) —
    not a capture of this host's local screen.

    PTPA is an async Sentio command. The library's `wait_complete()` blocks
    our single TCP socket with a blocking read until PTPA finishes, so
    nothing else can be sent on that connection in the meantime. Sentio's
    protocol does, however, support polling an async command's status with
    `query_command_status()` while sending other commands in between — see
    `SentioProberImpl.run_ptpa_with_screenshots()`. So instead of blocking,
    we poll for completion and grab a real camera snapshot at each poll.

    Because the screenshot comes from the prober over the network (not a
    local screen grab), this works fine from a headless host / plain SSH
    session with no $DISPLAY — there's no local-display dependency at all
    anymore.

    Args:
        screenshot_interval: Seconds between screenshots / status polls (default 2.0)
        output_dir: Folder to save screenshots
        capture_screenshots: Set False to run PTPA without taking screenshots
        user: Current user
        waferAgentName: Agent name

    Returns:
        Success with screenshot count, paths, and PTPA duration.
    """
    reply = get_reply_type()

    error = _ensure_initialized()
    if error:
        return error

    prober = get_current_prober()
    t_start = time.time()
    saved_files = []
    screenshot_errors = []

    try:
        if hasattr(prober, "run_ptpa_with_screenshots"):
            _status, saved_files, screenshot_errors = prober.run_ptpa_with_screenshots(
                poll_interval=screenshot_interval,
                capture_screenshots=capture_screenshots,
                output_dir=output_dir,
            )
        else:
            # Driver doesn't support polling + screenshots (e.g. MockProber)
            # — just run PTPA normally without screenshots.
            prober.run_ptpa()

        prober.local_mode()
        update_current_info(currentProber=prober)
        agentStateMachine.transition("RunPTPA")

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)

    duration = round(time.time() - t_start, 1)

    if capture_screenshots and saved_files:
        message = (
            f"PTPA completed in {duration}s. "
            f"Captured {len(saved_files)} screenshots → {output_dir}"
        )
    elif capture_screenshots and screenshot_errors:
        # PTPA itself succeeded, but every screenshot attempt failed — surface
        # why instead of silently reporting success with an empty folder.
        message = (
            f"PTPA completed in {duration}s. "
            f"0 screenshots saved — every snap_image attempt failed: "
            f"{'; '.join(screenshot_errors[:3])}"
        )
    else:
        message = f"PTPA completed in {duration}s."

    return ResponseBuilder.success(reply, message)


@validate_command_with_name("SetPTPA")
def set_ptpa(enable: bool, user=None, waferAgentName=None):
    """
    Enable or disable PTPA alignment

    Args:
        enable: True to enable PTPA, False to disable PTPA
        user: User performing action
        waferAgentName: Agent name
    """
    reply = get_reply_type()
    error = _ensure_initialized()
    if error:
        return error

    try:
        prober = get_current_prober()
        prober.set_ptpa(enable)
        prober.local_mode()
        update_current_info(currentProber=prober)

        status = "enabled" if enable else "disabled"
        return ResponseBuilder.success(reply, f"PTPA {status}")

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command_with_name("RunPTPA")
def run_ptpa(user=None, waferAgentName=None):
    """Run PTPA alignment"""
    reply = get_reply_type()

    error = _ensure_initialized()
    if error:
        return error

    try:
        prober = get_current_prober()
        prober.run_ptpa()
        prober.local_mode()

        # Update info
        update_current_info(currentProber=prober)

        agentStateMachine.transition("RunPTPA")

        return ResponseBuilder.success(reply, "PTPA executed")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def init_probing(user=None, waferAgentName=None):
    """Sequence of 'Go to off Axis area','Go to Center', 'AutoFocus', 'Align wafer', 'Find Home'"""
    reply = get_reply_type()

    error = _ensure_initialized()
    if error:
        return error

    try:
        prober = get_current_prober()
        # Sequence
        prober.go_to_separation()
        prober.move_chuck_offaxis_area()
        prober.move_chuck_center()
        prober.auto_focus()

        # TODO: we need to get col and row for alignment from project that stored in DB
        prober.align_wafer(align_die_col=-1, align_die_row=1)
        prober.find_home()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition("InitProbing")
        return ResponseBuilder.success(reply, f"Initialization complete")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def find_home(user=None, waferAgentName=None):
    """Find home position"""
    reply = get_reply_type()

    error = _ensure_initialized()
    if error:
        return error

    try:
        prober = get_current_prober()

        prober.find_home()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition("FindHome")
        return ResponseBuilder.success(reply, "Found home position")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def align_wafer(
    align_die_col=None, align_die_row=None, subsite=None, user=None, waferAgentName=None
):
    """Perform wafer alignment"""
    reply = get_reply_type()
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()

    # Get die position from initialization if not provided
    if align_die_col is None or align_die_row is None:
        alignment_die = g.get_alignment_die()

        if alignment_die:
            align_die_col = alignment_die["col"]
            align_die_row = alignment_die["row"]
            subsite = subsite if subsite is not None else alignment_die["subsite"]
            print(
                f"   📍 Using alignment die from initialization: Col {align_die_col}, Row {align_die_row}, Subsite {subsite}"
            )
        else:
            return ResponseBuilder.error(
                reply,
                "Alignment die not specified. Please provide align_die_col and align_die_row parameters, "
                "or set alignment_die during initialization.",
                400,
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

        agentStateMachine.transition("AlignWafer")

        return ResponseBuilder.success(
            reply,
            f"Wafer aligned using die at Col {align_die_col}, Row {align_die_row}, Subsite {subsite}",
        )
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def auto_focus(user=None, waferAgentName=None):
    """Execute auto-focus"""
    reply = get_reply_type()

    error = _ensure_initialized()
    if error:
        return error

    try:
        prober = get_current_prober()

        prober.auto_focus()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition("AutoFocus")

        return ResponseBuilder.success(
            reply, "Auto-focus command successfully executed"
        )
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def load_wafer(waferId: float, orientation: str, user=None, waferAgentName=None):
    """Load wafer onto chuck"""
    reply = get_reply_type()
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    from actions.WPDataBaseActions import update_wp_machine_loaded_wafer

    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()

    if g.loaded_wafer_id is not None:
        return ResponseBuilder.error(reply, "Wafer already loaded", 400)

    try:
        prober = get_current_prober()

        prober.load_wafer()
        prober.move_chuck_offaxis_area()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        update_wp_machine_loaded_wafer(loaded_wafer_id=waferId, orientation=orientation)

        agentStateMachine.transition("LoadWafer")

        g.chuck_z_position_state = "Separation"
        g.current_working_area = "OffAxis"

        return ResponseBuilder.success(reply, "Wafer has been loaded")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def unload_wafer(user=None, waferAgentName=None):
    """Unload wafer from chuck"""
    reply = get_reply_type()
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    from actions.WPDataBaseActions import update_wp_machine_loaded_wafer

    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()

    if g.loaded_wafer_id is None:
        return ResponseBuilder.error(reply, "No wafer loaded", 400)

    try:
        prober = get_current_prober()

        prober.unload_wafer()
        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        update_wp_machine_loaded_wafer(loaded_wafer_id=0, orientation=None)

        g.clear_wafer()
        agentStateMachine.transition("UnloadWafer")

        g.chuck_z_position_state = "Separation"
        g.current_working_area = "LoadPosition"

        return ResponseBuilder.success(reply, "Wafer unloaded")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def move_chuck_loaded_wafer(user=None, waferAgentName=None):
    """Load same wafer Load + MoveChuckOffAxis"""
    reply = get_reply_type()
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        prober.load_wafer()
        prober.move_chuck_offaxis_area()
        prober.local_mode()

        # Update info
        update_current_info(currentProber=prober)

        agentStateMachine.transition("MoveChuckLoadedWafer")

        g.chuck_z_position_state = "Separation"
        g.current_working_area = "OffAxis"

        return ResponseBuilder.success(
            reply, "Wafer has been loaded"
        )
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def move_chuck_unloaded_wafer(user=None, waferAgentName=None):
    """Unload wafer from chuck"""
    reply = get_reply_type()
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()

    if g.loaded_wafer_id is None:
        return ResponseBuilder.error(
            reply, "No wafer loaded", 400
        )

    try:
        prober = get_current_prober()

        prober.unload_wafer()
        prober.local_mode()

        # Update info
        update_current_info(currentProber=prober)

        agentStateMachine.transition("MoveChuckUnloadWafer")

        g.chuck_z_position_state = "Separation"
        g.current_working_area = "LoadPosition"

        return ResponseBuilder.success(reply, "Wafer unloaded")
    except Exception as e:

        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def open_project(projectName: str, user=None, waferAgentName=None):
    """Open project"""
    reply = get_reply_type()

    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    from actions.WPDataBaseActions import get_project_id_by_name

    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        project_path = os.path.join(str(g.projects_base_path), projectName)

        print(projectName)

        prober.open_project(projectName)

        # Update project name (ID would need to come from DB)
        g.projectName = projectName
        g.set_project_name(projectName)
        g.opened_project_id = get_project_id_by_name(projectName)

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition("OpenProject")

        return ResponseBuilder.success(
            reply, f"Opened project: {project_path}"
        )

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def stress_open_project(
    projectNameFirst: str,
    projectNameSecond: str,
    iterations: int,
    delay: float = 0.0,
    user=None,
    waferAgentName=None,
):
    """Open project"""

    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    reply = get_reply_type()
    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        for i in range(iterations):
            if i % 2 == 0:
                current_project = projectNameFirst

            else:
                current_project = projectNameSecond

            print(f"[{i + 1}/{iterations}] Opening: {current_project}")
            time1 = time.time()

            prober.open_project(current_project)

            # Update globals
            g.projectName = current_project
            g.set_project_name(current_project)

            # Go to separation
            prober.go_to_separation()
            time2 = time.time()
            dif = round(time2 - time1, 1)

            # Update current info
            update_current_info(currentProber=prober)

            # Optional delay between switches
            if delay > 0:
                time.sleep(delay)

            print("Dif =====================> ")
            print(dif)

        return ResponseBuilder.success(reply, f"test is DONE")

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def switch_camera(mountPoint, user=None, waferAgentName=None):
    """Switch camera mount point"""
    reply = get_reply_type()

    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()
        prober.switch_camera(mountPoint)

        # Update info
        update_current_info(currentProber=prober)

        # Update camera
        g.camera_mount_point = mountPoint
        prober.local_mode()

        agentStateMachine.transition("SwitchCamera")

        return ResponseBuilder.success(
            reply, f"Switched camera to {mountPoint}"
        )
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def get_chuck_position(user=None, waferAgentName=None):
    """Get current chuck position"""
    reply = get_reply_type()
    error = _ensure_initialized()
    if error:
        return error

    try:
        prober = get_current_prober()

        position = prober.get_chuck_position()
        prober.local_mode()

        return ResponseBuilder.success(reply, f"Chuck is {position}")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def set_chuck_overtravel(overtravelGap=None, user=None, waferAgentName=None):
    """Set overtravel that includes setting actual gap and enable overtravel"""
    reply = get_reply_type()
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()
        prober.enable_overtravel(overtravel=True)
        prober.set_overtravel(overtravelGap)

        g.set_overdrive(overtravelGap)

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition("SetChuckOvertravel")

        return ResponseBuilder.success(
            reply, "SetOvertravel command successfully executed"
        )
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def disable_overtravel(overtravelGap=None, user=None, waferAgentName=None):
    """Disable overtravel, set to 0"""
    reply = get_reply_type()
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_current_prober()

        prober.set_overtravel(overtravelGap=0)
        prober.enable_overtravel(overtravel=True)

        g.set_overdrive(overtravelGap)

        # Update info
        update_current_info(currentProber=prober)

        agentStateMachine.transition("DisableOvertravel")

        return ResponseBuilder.success(
            reply, "DisableOvertravel command successfully executed"
        )
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def local_mode(user=None, waferAgentName=None):
    """Set prober to local mode"""
    reply = get_reply_type()

    error = _ensure_initialized()
    if error:
        return error

    try:
        prober = get_current_prober()

        # Update info
        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition("LocalMode")

        return ResponseBuilder.success(reply, "Local mode")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def move_chuck_asic(asicId: int, subsite: int = 0, user=None, waferAgentName=None):
    """
    Move to ASIC die using database ID

    Args:
        asicId: ASIC ID from database
    """
    reply = get_reply_type()
    from actions.WPDataBaseActions import get_asic_by_id

    g = SvtWPAagentGlobalParameters.getInstance()

    error = _ensure_initialized()
    if error:
        return error

    # Get ASIC from database
    try:
        asic_data = get_asic_by_id(asicId)
    except Exception as e:
        return ResponseBuilder.error(
            reply, f"Failed to get ASIC from database: {e}", 400
        )

    # Extract serial number
    serial_number = asic_data.get("serialNumber")
    if not serial_number:
        return ResponseBuilder.error(
            reply, f"ASIC ID {asicId} has no serial number", 400
        )

    currentAsicWaferId = asic_data.get("waferId")
    if currentAsicWaferId != g.loaded_wafer_id:
        return ResponseBuilder.error(
            reply, f"ASIC ID {asicId} not found on loaded wafer", 400
        )

    print(f"   Serial Number: {serial_number}")

    # Convert serial number to local coordinates
    # Reuse existing _label_to_coordinates helper!
    result = _label_to_coordinates(serial_number)

    if result is None:
        return ResponseBuilder.error(
            reply,
            f"Cannot parse ASIC serial number '{serial_number}'",
            400,
        )

    col, row = result
    print(f"   ✅ Converted: col={col}, row={row}")

    # Move chuck
    try:
        prober = get_current_prober()
        prober.go_to_die(col, row)

        g.set_current_die(col, row, subsite)
        agentStateMachine.transition("MoveChuckAsic")

        update_current_info(currentProber=prober)
        prober.local_mode()

        return ResponseBuilder.success(
            reply,
            f"Moved to ASIC ID {asicId} (serial: {serial_number}) at col={col}, row={row}",
        )

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def testing_lock(
    user=None, waferAgentName=None, reason="Testing in progress", testSequenceId=None
):
    """
    Lock the WP Agent for testing to prevent interference from other users.

    Args:
        user: User who is locking the agent (REQUIRED)
        waferAgentName: Agent name
        reason: Reason for locking (default: "Testing in progress")
        testSequenceId: ID of test sequence being run

    Returns:
        Success if locked, error if already locked by someone else

    Example:
        testing_lock(
            user="TestAgent_User1",
            reason="Running IV characterization test",
            test_sequence_id="TEST_SEQ_12345"
        )
    """
    reply = get_reply_type()
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    if user is None:
        return ResponseBuilder.error(
            reply, "User parameter is required for locking", 400
        )

    g = SvtWPAagentGlobalParameters.getInstance()

    # Check if already locked
    if g.is_locked_for_testing:
        lock_info = g.get_lock_info()

        # If locked by same user, allow re-lock (update reason/test_id)
        if g.locked_by_user == user:
            g.lock_for_testing(user, reason, testSequenceId)
            return ResponseBuilder.success(
                reply, f"Lock updated for user '{user}'"
            )

        # Locked by different user - DENY
        return ResponseBuilder.error(
            reply,
            f"Already locked by '{g.locked_by_user}'. "
            f"Reason: {g.lock_reason}. "
            f"Locked for {lock_info['locked_duration_seconds']:.0f} seconds. "
            f"Cannot lock again until unlocked.",
            423,  # HTTP 423 Locked
        )

    # Lock the agent
    g.lock_for_testing(user, reason, testSequenceId)

    # Update state machine
    agentStateMachine.transition("TestingLock")

    return ResponseBuilder.success(
        reply, f"WP Agent locked for testing by '{user}'"
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
    reply = get_reply_type()
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    if user is None:
        return ResponseBuilder.error(
            reply, "User parameter is required for unlocking", 400
        )

    g = SvtWPAagentGlobalParameters.getInstance()

    # Check if locked
    if not g.is_locked_for_testing:
        return ResponseBuilder.success(reply, "WP Agent is not locked")

    # Get user hierarchy
    user_hierarchy = (
        g.user_logged_hierarchy if hasattr(g, "user_logged_hierarchy") else None
    )

    # Check authorization
    can_unlock = (
        user == g.locked_by_user  # User who locked it
        or user_hierarchy == "Developer"  # Developer
        or force
        and user_hierarchy == "Developer"  # Forced by Developer
    )

    if not can_unlock:
        return ResponseBuilder.error(
            reply,
            f"Not authorized to unlock. Locked by '{g.locked_by_user}'. "
            f"Only '{g.locked_by_user}' or a Developer can unlock.",
            403,  # HTTP 403 Forbidden
        )

    # Get lock info before unlocking (for logging)
    lock_info = g.get_lock_info()
    locked_by = g.locked_by_user

    # Unlock the agent
    g.unlock_from_testing()

    # Update state machine
    agentStateMachine.transition("TestingUnlock")


    return ResponseBuilder.success(reply, f"WP Agent unlocked (was locked by '{locked_by}')")


@validate_command
def move_chuck_top_left(user=None, waferAgentName=None):

    reply = get_reply_type()
    error = _ensure_initialized()
    if error:
        return error
    try:
        prober = get_current_prober()

        position = 'Relative'
        x = 20.0
        y = -15.0
        prober.move_chuck_xy(x, y, position)

        update_current_info(currentProber=prober)
        prober.local_mode()

        agentStateMachine.transition("MoveChuckTopLeft")
        return ResponseBuilder.success(reply, f"Moved chuck to Top Left corner")

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)

@validate_command
def move_chuck_top_right(user=None, waferAgentName=None):

    reply = get_reply_type()
    error = _ensure_initialized()
    if error:
        return error
    try:
        prober = get_current_prober()

        position = 'Relative'
        x = -20.0
        y = -15.0
        prober.move_chuck_xy(x, y, position)

        update_current_info(currentProber=prober)
        prober.local_mode()
        agentStateMachine.transition("MoveChuckTopRight")
        return ResponseBuilder.success(reply, f"Moved chuck to Top Right corner")

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)

@validate_command
def move_chuck_bottom_left(user=None, waferAgentName=None):
    reply = get_reply_type()
    error = _ensure_initialized()
    if error:
        return error
    try:
        prober = get_current_prober()

        position = 'Relative'
        x = 20.0
        y = 15.0
        prober.move_chuck_xy(x, y, position)

        update_current_info(currentProber=prober)
        prober.local_mode()
        agentStateMachine.transition("MoveChuckBottomLeft")
        return ResponseBuilder.success(reply, "Chuck moved to bottom-left")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)


@validate_command
def move_chuck_bottom_right(user=None, waferAgentName=None):
    """Move chuck to the bottom-right position of the wafer."""
    reply = get_reply_type()
    error = _ensure_initialized()
    if error:
        return error
    try:
        prober = get_current_prober()
        prober.move_chuck_bottom_right()
        update_current_info(currentProber=prober)
        agentStateMachine.transition("MoveChuckBottomRight")
        return ResponseBuilder.success(reply, "Chuck moved to bottom-right")
    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, str(e), 500)