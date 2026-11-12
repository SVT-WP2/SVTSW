"""
WPDieGridActions - precise die moves with the die size of the wafer map.

    GetDieSize   read the die size (pitch) and map setup from SENTIO; moves nothing

The precise move itself is a flag of MoveChuckRowColumn (actions/WPTestingActions.py):

    MoveChuckRowColumn {"label": "BAM03", "precise": true}
        reference = the current position (after the usual move to the off-axis side)
    MoveChuckRowColumn {"label": "BAM03", "precise": true, "reference": "BAMTest"}
        reference = a position saved by SaveChuckPosition (off-axis), e.g. after PTPA on BAMTest

    target = reference XY + d_col * col_step + d_row * row_step   (exact die pitches)

No calibration step: the axis and sign of the steps are learned from SENTIO's own
step_die positions during the move (utilities/WPDieGrid.py).
"""

from utilities.WPResponseBuilder import ResponseBuilder
from utilities.WPValidationDecorator import validate_command, get_reply_type
from utilities.WPDieGrid import choose_steps, die_offset_um, learn_steps, load_grid, save_grid
from utilities.WPContacting import load_position
from utilities.WPMessagesStatus import WPMessagesStatus

from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.WPFactory import get_current_prober


def _die_size(prober):
    w, h = prober.get_die_size()
    return float(w), float(h)


def _current_die(prober):
    idx = str(prober.get_current_index()).split(",")
    return int(idx[1]), int(idx[2])


def read_reference(prober, project, reference=None):
    """Reference of a precise move: (die (col, row), (x, y) um, description). Moves nothing.

    reference: name of a position saved by SaveChuckPosition, or None for the current
    chuck position and current die. A saved position must be from the current work
    area (Zero-reference XY differ between off-axis and probing).
    Raises KeyError / ValueError with the reason.
    """
    area = str(prober.get_current_working_area()).removesuffix("Camera")
    if reference:
        pos = load_position(project, reference)
        die = pos.get("die") or {}
        if die.get("col") is None or die.get("row") is None:
            raise ValueError(f"saved position '{reference}' has no die col/row")
        if pos.get("work_area") and pos["work_area"] != area:
            raise ValueError(f"saved position '{reference}' was taken in {pos['work_area']}, the chuck "
                             f"is in {area}: Zero-reference XY differ between work areas")
        return ((int(die["col"]), int(die["row"])), (float(pos["x_um"]), float(pos["y_um"])),
                f"saved position '{reference}'")
    x, y = prober.get_chuck_xy()
    return _current_die(prober), (float(x), float(y)), "current position"


def precise_die_move(prober, project, ref_die, ref_xy, target_die, precision_um=0.5,
                     max_iterations=10, correction_settle_s=0.1, step_tolerance_um=50.0):
    """Move the chuck to `target_die` at the same point inside the die as `ref_xy` is
    inside `ref_die`. Returns a short description; raises RuntimeError on failure.

    1. SENTIO step_die to the reference die and to the target die, read the chuck XY
       at both: this displacement gives the axis / sign of the column and row steps
    2. target = ref_xy + d_col * col_step + d_row * row_step (exact die size)
    3. closed-loop MoveChuckXYPrecise (Zero reference) to the target
    """
    from actions.WPImagingActions import move_chuck_xy_precise

    d_col = int(target_die[0]) - int(ref_die[0])
    d_row = int(target_die[1]) - int(ref_die[1])
    col_step = row_step = None

    if d_col or d_row:
        w, h = _die_size(prober)
        prober.go_to_die(*ref_die)
        ax, ay = prober.get_chuck_xy()
        prober.go_to_die(*target_die)
        bx, by = prober.get_chuck_xy()
        dx, dy = bx - ax, by - ay
        cands = learn_steps(d_col, d_row, dx, dy, w, h, step_tolerance_um)
        try:
            col_step, row_step = choose_steps(cands, load_grid(project))
        except ValueError as e:
            what = (f"SENTIO moved ({dx:+.1f}, {dy:+.1f}) um for {d_col:+d} col / {d_row:+d} row, "
                    f"die size {w:.3f} x {h:.3f} um")
            if str(e) == "ambiguous":
                raise RuntimeError(f"{what}: cannot tell columns from rows for this move. Do one precise "
                                   f"move to a die in another column of the same row first")
            raise RuntimeError(f"{what}: does not match the die size (tolerance "
                               f"{float(step_tolerance_um):g} um): check the wafer map / project")
        learned = {"die_size_um": [w, h]}
        if col_step:
            learned["col_step_um"] = list(col_step)
        if row_step:
            learned["row_step_um"] = list(row_step)
        save_grid(project, learned)

    ox, oy = die_offset_um(d_col, d_row, col_step, row_step)
    tx, ty = ref_xy[0] + ox, ref_xy[1] + oy
    print(f"   🧭 die {tuple(ref_die)} ({ref_xy[0]:.2f}, {ref_xy[1]:.2f}) -> die {tuple(target_die)}: "
          f"offset ({ox:+.2f}, {oy:+.2f}) um -> target ({tx:.2f}, {ty:.2f}) um")

    result = move_chuck_xy_precise(tx, ty, position="Zero", precision_um=precision_um,
                                   max_iterations=max_iterations, correction_settle_s=correction_settle_s)
    detail = result["error"]["message"]
    if result["status"] != WPMessagesStatus.Success:
        raise RuntimeError(f"precise move to ({tx:.2f}, {ty:.2f}) um failed: {detail}")
    return (f"offset ({ox:+.2f}, {oy:+.2f}) um from die col={ref_die[0]} row={ref_die[1]}, "
            f"target ({tx:.2f}, {ty:.2f}) um. {detail}")


@validate_command
def get_die_size(user=None, waferAgentName=None, **kwargs):
    """Die size (index size) of the open project's wafer map, axis orientation, grid
    origin, current die and the steps learned so far. Moves nothing."""
    from actions.WPTestingActions import _ensure_initialized, update_current_info
    reply = get_reply_type()
    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()
    try:
        prober = get_current_prober()
        w, h = _die_size(prober)
        orient = prober.get_map_axis_orient()
        origin = prober.get_grid_origin()
        update_current_info(currentProber=prober)
        prober.local_mode()
    except Exception as e:
        return ResponseBuilder.error(reply, f"Could not read the die size: {e}", 500)

    message = (f"Die size {w:.3f} x {h:.3f} um, axis orientation {orient}, grid origin {origin}, "
               f"current die col={g.current_die_col} row={g.current_die_row}")
    try:
        grid = load_grid(g.projectName)
    except (ValueError, OSError):
        grid = {}
    if grid.get("col_step_um") or grid.get("row_step_um"):
        message += (f"; learned: +1 col = {grid.get('col_step_um')} um, "
                    f"+1 row = {grid.get('row_step_um')} um")
    return ResponseBuilder.success(reply, message)
