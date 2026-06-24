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
from actions.WPTestingActions import _ensure_initialized
from actions.WPTestingActions import move_chuck_die

def sleep(seconds=1, user=None, waferAgentName=None, **kwargs):
    """Sleep for a given number of seconds."""
    import time
    seconds = float(seconds)
    print(f"   💤 Sleeping {seconds}s...")
    time.sleep(seconds)
    return ResponseBuilder.success("SleepReply", f"Slept {seconds}s")


def get_chuck_xy(log_file="chuck_xy_log.csv", label="", user=None, waferAgentName=None, **kwargs):
    """Query the actual chuck XY position and append it to a CSV log file.

    Useful for diagnosing axis-coupling drift: insert this command after every
    MoveChuckXY in a diagnostic sequence to compare commanded vs actual positions.

    Args:
        log_file: path to the CSV file (created if it does not exist)
        label:    free-text tag written into the 'label' column, e.g. "row0_col3"
    Returns:
        actual x, y in micrometres (Zero reference)
    """
    try:
        from sentio_prober_control.Sentio.Enumerations import ChuckSite, ChuckXYReference
        import csv

        prober = get_current_prober()
        x, y = prober.prober.get_chuck_xy(ChuckSite.Wafer, ChuckXYReference.Zero)

        print(f"   📍 ChuckXY [{label}]  x={x:.2f} µm  y={y:.2f} µm")

        if log_file:
            # Reset the file when writing HOME so each DebugChuckMovement
            # run starts clean — accumulated data from previous runs would
            # mix with the new measurements and corrupt the calibration.
            reset = (label == "HOME")
            mode  = "w" if reset else "a"
            with open(log_file, mode, newline="") as f:
                w = csv.writer(f)
                if reset:
                    w.writerow(["label", "x_um", "y_um"])
                w.writerow([label, f"{x:.2f}", f"{y:.2f}"])

        return ResponseBuilder.success("GetChuckXYReply", f"x={x:.2f}, y={y:.2f}")

    except Exception as e:
        import traceback; traceback.print_exc()
        return ResponseBuilder.error("GetChuckXYReply", str(e), 500)
    
def _coupling_constants_path(wafer=""):
    """Return path to coupling constants JSON for the given wafer."""
    return os.path.join("Imaging", str(wafer), "CALIBRATION_MOVEMENT", "coupling_constants.json")


def _load_coupling_constants(wafer=""):
    """Load axis-coupling constants from Imaging/<wafer>/CALIBRATION_MOVEMENT/coupling_constants.json.

    Raises FileNotFoundError with a clear message if the file is missing so
    that the operator knows to run DebugChuckMovement.yaml first.
    """
    import json
    path = _coupling_constants_path(wafer)
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Coupling calibration file not found: '{path}'. "
            f"Run DebugChuckMovement.yaml (with wafer='{wafer}') first to measure "
            f"axis coupling and generate this file."
        )
    with open(path) as f:
        data = json.load(f)
    return float(data["y_col_correction_um"]), float(data["x_row_correction_um"])


def move_chuck_xy_precise(x, y, position="Relative",
                          abs_target_x=None, abs_target_y=None,
                          precision_um=1.0, max_iterations=3,
                          correction_settle_s=0.2,
                          user=None, waferAgentName=None, **kwargs):
    """Closed-loop relative chuck move: apply calibrated move, then verify and
    correct until actual position is within precision_um of the target.

    Workflow:
      1. Read current physical position (= target reference for Relative moves)
      2. Command the primary move
      3. Read actual position; if within precision_um → done
      4. Otherwise apply a compensation-corrected micro-move, wait, re-read
      5. Repeat up to max_iterations corrections

    WHY THE CORRECTION IS DOUBLED (command = 2 × error):
    -----------------------------------------------------------------------
    This machine has a constant per-move axis coupling: every move drifts
    the chuck by approximately  X: -5.6 µm  Y: -10.4 µm  regardless of the
    commanded distance.  A naive correction of (ex, ey) therefore lands at
        (ex - x_coupling, ey - y_coupling) ≈ (0, 0) — almost no movement.
    Doubling the command to (2·ex, 2·ey) makes the net displacement ≈ (ex, ey)
    because the coupling drift removes roughly one copy of (ex, ey) and the
    other copy arrives at the target.  This is an approximation; the residual
    on the next read will be small and the loop will converge in 1–2 iterations.
    -----------------------------------------------------------------------

    A sustained iterations > 0 in normal operation (with calibrated raster
    corrections) suggests coupling has drifted — re-run DebugChuckMovement.yaml.

    Args:
        x, y               : move delta in µm (Relative) or absolute (Zero/Center)
        position           : "Relative" | "Zero" | "Center"
        precision_um       : acceptable error on either axis in µm (default 1.0)
        max_iterations     : max number of correction micro-moves (default 3)
        correction_settle_s: settle time after each correction micro-move
    """
    import time
    try:
        from sentio_prober_control.Sentio.Enumerations import ChuckSite, ChuckXYReference

        prober      = get_current_prober()
        x           = float(x)
        y           = float(y)
        precision   = float(precision_um)
        max_iter    = int(max_iterations)
        corr_settle = float(correction_settle_s)

        def _read_xy():
            return prober.prober.get_chuck_xy(ChuckSite.Wafer, ChuckXYReference.Zero)

        # Read current position to compute absolute target
        x0, y0 = _read_xy()

        if abs_target_x is not None and abs_target_y is not None:
            # Grid-anchored mode: target is the mathematically exact raster position
            # (chuck_home + tile_offset), precomputed by GenerateRasterSteps.
            # Drift on any previous tile has no effect on this target.
            target_x = float(abs_target_x)
            target_y = float(abs_target_y)
            # Recompute relative command from actual current position so the
            # primary move is as accurate as possible.
            x = target_x - x0
            y = target_y - y0
            print(f"   📐 MoveXYPrecise [grid]: pre=({x0:.2f},{y0:.2f})  "
                  f"target=({target_x:.2f},{target_y:.2f})  "
                  f"cmd=({x:+.3f},{y:+.3f}) µm")
        elif position == "Relative":
            target_x, target_y = x0 + x, y0 + y
            print(f"   📐 MoveXYPrecise: commanded=({x:+.3f}, {y:+.3f}) µm  "
                  f"pre=({x0:.2f},{y0:.2f})  target=({target_x:.2f},{target_y:.2f})")
        elif position == "Zero":
            target_x, target_y = x, y
            print(f"   📐 MoveXYPrecise [abs]: commanded=({x:+.3f}, {y:+.3f}) µm  "
                  f"pre=({x0:.2f},{y0:.2f})  target=({target_x:.2f},{target_y:.2f})")
        else:
            prober.move_chuck_xy(x, y, position)
            return ResponseBuilder.success("MoveChuckXYPreciseReply",
                                           f"Moved (unsupported reference '{position}', no loop)")

        # Primary move
        prober.move_chuck_xy(x, y, position)

        # Read → check → correct loop.
        # Runs max_iter+1 reads so the result of every correction is verified.
        #
        # Correction strategy (self-calibrating):
        #   Iteration 0  – primary move already done; read actual position.
        #   Correction #1 – coupling unknown; use 2× heuristic as a probe.
        #   After reading result of #1 we compute the per-correction-move coupling:
        #       coupling = err_before − cmd_applied − err_after
        #   All subsequent corrections use the exact formula:
        #       cmd = err − coupling
        #   which gives net displacement = err exactly (coupling cancels itself).
        #   This converges in 1 additional correction after the coupling is learned.
        # Hard physical floor: encoder step is 0.10 µm; coupling varies by ~0.10 µm per
        # move, so corrections below this threshold are unreliable and may overshoot.
        ENCODER_FLOOR_UM = 0.10
        accept_err = max(precision, ENCODER_FLOOR_UM)

        converged       = False
        iterations      = 0
        ax = ay = ex = ey = 0.0
        coup_x = coup_y = None          # learned per-correction-move coupling
        prev_ex = prev_ey = 0.0         # error before last correction
        prev_cx = prev_cy = 0.0         # command of last correction

        for i in range(max_iter + 1):
            ax, ay  = _read_xy()
            ex, ey  = target_x - ax, target_y - ay
            err_max = max(abs(ex), abs(ey))

            label = "primary" if i == 0 else f"after correction #{i}"
            print(f"   📍 Read ({label}): actual=({ax:.2f},{ay:.2f})  "
                  f"err=({ex:+.2f},{ey:+.2f}) µm  max_err={err_max:.2f}")

            if err_max <= accept_err:
                converged = True
                break

            if i < max_iter:
                iterations += 1

                # Learn coupling from the first correction result
                if i > 0 and coup_x is None:
                    coup_x = prev_ex - prev_cx - ex
                    coup_y = prev_ey - prev_cy - ey
                    print(f"   🔬 Learned coupling: ({coup_x:+.2f}, {coup_y:+.2f}) µm/move")

                if coup_x is not None:
                    # Exact correction: net displacement = err exactly
                    cx, cy = ex - coup_x, ey - coup_y
                    mode = "exact"
                else:
                    # First correction: coupling unknown, use 2× heuristic as probe
                    cx, cy = 2.0 * ex, 2.0 * ey
                    mode = "2× probe"

                print(f"   🔧 Correction #{iterations} [{mode}]: "
                      f"err=({ex:+.2f},{ey:+.2f})  "
                      f"cmd=({cx:+.2f},{cy:+.2f}) µm  settle={corr_settle}s")

                prev_ex, prev_ey = ex, ey
                prev_cx, prev_cy = cx, cy
                prober.prober.move_chuck_xy(ChuckXYReference.Relative, cx, cy)
                if corr_settle > 0:
                    time.sleep(corr_settle)
            # i == max_iter: final read already done above, loop ends

        flag = "✓" if converged else "✗"
        print(f"   {flag} MoveXYPrecise done  "
              f"target=({target_x:.2f},{target_y:.2f})  "
              f"actual=({ax:.2f},{ay:.2f})  "
              f"err=({ex:+.2f},{ey:+.2f}) µm  iterations={iterations}")

        if not converged:
            msg = (f"Precision not reached after {iterations} corrections: "
                   f"residual=({ex:+.2f}, {ey:+.2f}) µm  "
                   f"(tolerance={precision:.2f} µm)")
            print(f"   ✗ {msg}")
            return ResponseBuilder.error("MoveChuckXYPreciseReply", msg, 500)

        return ResponseBuilder.success(
            "MoveChuckXYPreciseReply",
            f"x={ax:.2f}, y={ay:.2f}, err=({ex:+.2f},{ey:+.2f}) µm, iter={iterations}"
        )

    except Exception as e:
        import traceback; traceback.print_exc()
        return ResponseBuilder.error("MoveChuckXYPreciseReply", str(e), 500)


def compute_coupling_constants(log_file="chuck_xy_log.csv", wafer="",
                               user=None, waferAgentName=None, **kwargs):
    """Analyse a zero-correction DebugChuckMovement CSV and save coupling constants.

    Reads chuck_xy_log.csv produced by DebugChuckMovement.yaml (run with
    y_col_correction_um=0, x_row_correction_um=0), computes the two coupling
    parameters, and writes them to calibration/coupling_constants.json.

    The JSON is saved to Imaging/<wafer>/CALIBRATION_MOVEMENT/ and is loaded
    automatically by generate_raster_steps.  archive_imaging skips this folder.
    """
    import csv, json, datetime

    try:
        if not os.path.exists(log_file):
            return ResponseBuilder.error("ComputeCouplingConstantsReply",
                                         f"Log file not found: '{log_file}'", 400)

        rows = []
        with open(log_file, newline="") as f:
            for r in csv.DictReader(f):
                if r["label"] == "HOME":
                    continue
                try:
                    rn, cn = r["label"].replace(".jpg", "").split("_")
                    rows.append((int(rn), int(cn), float(r["x_um"]), float(r["y_um"])))
                except Exception:
                    pass  # skip malformed rows

        if len(rows) < 4:
            return ResponseBuilder.error("ComputeCouplingConstantsReply",
                                         "Not enough data rows in log file.", 400)

        row_ids = sorted(set(r[0] for r in rows), reverse=True)
        nc      = max(r[1] for r in rows) + 1   # number of columns

        # ── Y coupling: mean dY per column step (should be 0 with zero corrections) ──
        all_dy = []
        for rn in row_ids:
            tiles = sorted([r for r in rows if r[0] == rn], key=lambda r: r[1])
            for i in range(len(tiles) - 1):
                all_dy.append(tiles[i + 1][3] - tiles[i][3])
        y_drift      = sum(all_dy) / len(all_dy)
        y_col_corr   = round(-y_drift, 3)   # negate: correction opposes drift

        # ── X coupling: net X drift at col-0 across rows ──────────────────────────
        col0 = sorted([(r[0], r[2], r[3]) for r in rows if r[1] == 0], key=lambda r: -r[0])
        dxs  = [col0[i + 1][1] - col0[i][1] for i in range(len(col0) - 1)]
        x_drift_per_row = sum(dxs) / len(dxs)
        x_row_corr      = round(-x_drift_per_row / nc, 3)   # per move

        constants = {
            "y_col_correction_um": y_col_corr,
            "x_row_correction_um": x_row_corr,
            "calibrated":          datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
            "source_log":          log_file,
            "num_columns":         nc,
            "num_rows":            len(row_ids),
        }

        out_path = _coupling_constants_path(wafer)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w") as f:
            json.dump(constants, f, indent=2)

        # Remove the intermediate CSV — the JSON is the authoritative output.
        try:
            os.remove(log_file)
            print(f"   🗑 Removed intermediate log: {log_file}")
        except OSError:
            pass

        msg = (f"Coupling constants saved → {out_path}\n"
               f"  y_col_correction_um = {y_col_corr:.3f} µm  "
               f"(raw Y drift/step = {y_drift:.3f} µm)\n"
               f"  x_row_correction_um = {x_row_corr:.3f} µm  "
               f"(raw X drift/row = {x_drift_per_row:.3f} µm over {nc} moves)")
        print(f"   ✅ {msg}")
        return ResponseBuilder.success("ComputeCouplingConstantsReply", msg)

    except Exception as e:
        import traceback; traceback.print_exc()
        return ResponseBuilder.error("ComputeCouplingConstantsReply", str(e), 500)


def generate_raster_steps(
        num_columns=1,
        num_rows=1,
        column_spacing_um=-2968,   # ~15% X overlap (was -2623 / ~25%)
        row_spacing_um=2476,       # ~15% Y overlap (was 2133 / ~27%)
        start_x_um=-21088,
        start_y_um=-27245,
        settle_time_s=1,
        # Per-move-type settle times.  Both default to settle_time_s so existing
        # YAMLs that only set settle_time_s are unaffected.
        # col_settle_time_s: after each short X column step
        # row_settle_time_s: after the combined large X+Y row-return move — set
        #   higher than col_settle_time_s if long rows show positioning drift.
        col_settle_time_s=None,
        row_settle_time_s=None,
        # ── axis-coupling drift corrections ───────────────────────────────────
        # Loaded automatically from calibration/coupling_constants.json when
        # left as None (the default).  If the file is missing, generate_raster_steps
        # raises FileNotFoundError — run DebugChuckMovement.yaml first.
        # Pass an explicit float to override (e.g. 0.0 for the calibration run itself).
        y_col_correction_um=None,
        x_row_correction_um=None,
        # ── circular wafer mask ───────────────────────────────────────────────
        # When wafer_radius_um > 0, only tiles whose centre falls inside the
        # circle are visited.  The chuck moves DIRECTLY between consecutive
        # valid tiles (no intermediate stops at forbidden corner positions).
        # Because the circle is convex, a straight move between any two
        # in-circle positions stays inside the circle.
        # Drift corrections are omitted in this mode — arbitrary-sized jumps
        # don't have measured coupling values, and the stitcher's phase
        # correlation corrects for small positioning errors anyway.
        #
        # wafer_center_x/y_um are expressed in the same coordinate frame as
        # start_x/y_um — i.e. relative to the chuck position at the time
        # GenerateRasterSteps is called (after MoveChuckRowColumn).
        #
        # For the 13" full-wafer sequence using SEG4 as reference:
        #   wafer_center_x_um = -155330
        #   wafer_center_y_um =  -91464
        #   wafer_radius_um   =  165100
        wafer_radius_um=0,
        wafer_center_x_um=0,
        wafer_center_y_um=0,
        # ── debug: edge columns only ──────────────────────────────────────────
        # When True (circle-mask mode only): for each row keep only the first
        # and last valid column.  ~2×num_rows images instead of the full mosaic.
        # Use DebugWaferGrid.yaml to quickly verify the circle mask covers the
        # wafer correctly before committing to a full scan.
        debug_edge_cols_only=False,
        wafer="",
        user=None,
        waferAgentName=None,
        **kwargs
):
    """Pre-compute raster positions and filenames.

    Normal mode (wafer_radius_um == 0)
    -----------------------------------
    Full rectangular grid with per-step drift corrections.  Axis coupling:
      • Column step (X) causes ~15 µm Y drift → corrected by y_col_correction_um.
      • Row-return (X+Y) causes ~2.6 µm X drift → corrected by x_row_correction_um.

    Circular-mask mode (wafer_radius_um > 0)
    -----------------------------------------
    Only tiles inside the circle are visited.  The chuck moves DIRECTLY between
    consecutive valid tiles (no stops at forbidden corner positions).  Because
    the circle is convex, every straight move between two in-circle points stays
    inside the circle, so forbidden zones are never entered.
    Drift corrections are omitted in this mode — the stitcher's phase correlation
    (Pass 1) corrects for any small positional errors from the larger jumps.

    Absolute grid targets
    ---------------------
    Each move step carries abs_x / abs_y: the mathematically exact tile position
    in Zero (absolute) coordinates, computed as chuck_home + _tile_abs(row, col).
    MoveChuckXYPrecise uses these as the correction target so that drift on one
    tile does not propagate to the next.
    """

    # coerce — YAML/Kafka may deliver these as strings or wrong types
    num_columns          = int(num_columns)
    num_rows             = int(num_rows)
    column_spacing_um    = float(column_spacing_um)
    row_spacing_um       = float(row_spacing_um)
    start_x_um           = float(start_x_um)
    start_y_um           = float(start_y_um)
    settle_time_s        = float(settle_time_s)
    col_settle           = float(col_settle_time_s) if col_settle_time_s is not None else settle_time_s
    row_settle           = float(row_settle_time_s) if row_settle_time_s is not None else settle_time_s

    wafer_radius_um      = float(wafer_radius_um)
    use_mask             = wafer_radius_um > 0

    # Auto-load coupling constants from calibration file when not explicitly set.
    # Skipped in circle-mask mode — arbitrary inter-tile jumps have no measured
    # coupling, and the stitcher's phase correlation corrects small position errors.
    # Raises FileNotFoundError if the file is missing — run DebugChuckMovement.yaml first.
    if not use_mask and (y_col_correction_um is None or x_row_correction_um is None):
        _y, _x = _load_coupling_constants(wafer)
        if y_col_correction_um is None:
            y_col_correction_um = _y
        if x_row_correction_um is None:
            x_row_correction_um = _x
        print(f"   📂 Coupling constants loaded from {_coupling_constants_path(wafer)}: "
              f"y_col={y_col_correction_um:.3f} µm  x_row={x_row_correction_um:.3f} µm")

    if y_col_correction_um is None:
        y_col_correction_um = 0.0
    if x_row_correction_um is None:
        x_row_correction_um = 0.0

    y_col_correction_um  = float(y_col_correction_um)
    x_row_correction_um  = float(x_row_correction_um)
    wafer_center_x_um    = float(wafer_center_x_um)
    wafer_center_y_um    = float(wafer_center_y_um)
    radius_sq            = wafer_radius_um ** 2

    # Absolute position of grid tile (row, col) from chuck_home.
    # start_x/y is the centre of the first tile directly (no quarter-step offset).
    first_x = float(start_x_um)
    first_y = float(start_y_um)

    def _tile_abs(row, col):
        return (first_x + col * column_spacing_um,
                first_y - row * row_spacing_um)   # rows go in -Y direction

    def _inside(row, col):
        tx, ty = _tile_abs(row, col)
        dx, dy = tx - wafer_center_x_um, ty - wafer_center_y_um
        return dx * dx + dy * dy <= radius_sq

    print(f"   🔍 RasterSteps: cols={num_columns} rows={num_rows} "
          f"x={start_x_um} y={start_y_um} "
          f"col_sp={column_spacing_um} row_sp={row_spacing_um}" +
          (f" wafer_mask=r{wafer_radius_um:.0f}um @({wafer_center_x_um:.0f},{wafer_center_y_um:.0f})"
           if use_mask else
           f" drift_corr=({x_row_correction_um:+.1f}um X, {y_col_correction_um:+.1f}um Y)"))

    # ── Read chuck home for absolute tile targets ─────────────────────────────
    # abs_x / abs_y = exact grid position in Zero coordinates for each tile.
    # MoveChuckXYPrecise uses these to anchor each correction to the grid rather
    # than to the (potentially drifted) previous tile position.
    # Gracefully skipped if no prober is available (offline / test mode).
    home_x = home_y = None
    try:
        from sentio_prober_control.Sentio.Enumerations import ChuckSite, ChuckXYReference as _CXR
        _pr = get_current_prober()
        home_x, home_y = _pr.prober.get_chuck_xy(ChuckSite.Wafer, _CXR.Zero)
        print(f"   🏠 Raster home: ({home_x:.2f}, {home_y:.2f}) µm  "
              f"(abs targets enabled)")
    except Exception:
        print(f"   ⚠ Raster home: prober not available — abs targets disabled")

    def _abs(tile_x, tile_y):
        """Absolute Zero coords for a tile at (tile_x, tile_y) relative to chuck_home."""
        if home_x is None:
            return None, None
        return home_x + tile_x, home_y + tile_y

    # ── Circular-mask mode: direct jumps between valid tiles only ────────────
    if use_mask:
        # Build ordered list of valid tile (abs_x, abs_y, filename)
        debug_edge_cols_only = bool(debug_edge_cols_only)
        valid = []
        for row in range(num_rows):
            row_tiles = []
            for col in range(num_columns):
                if _inside(row, col):
                    tx, ty = _tile_abs(row, col)
                    fname = f"{(num_rows - 1 - row):02d}_{col:02d}.jpg"
                    row_tiles.append((tx, ty, fname))
            if debug_edge_cols_only and len(row_tiles) > 2:
                row_tiles = [row_tiles[0], row_tiles[-1]]
            valid.extend(row_tiles)

        total    = num_rows * num_columns
        captured = len(valid)
        mode_tag = " [EDGE COLS ONLY]" if debug_edge_cols_only else ""
        print(f"   🔍 Circle mask{mode_tag}: {captured}/{total} tiles inside wafer "
              f"({100 * captured / total:.1f}%)")

        steps   = []
        prev_x  = 0.0   # chuck_home
        prev_y  = 0.0
        for tx, ty, fname in valid:
            ax, ay = _abs(tx, ty)
            steps.append({"action": "move",
                           "x": tx - prev_x, "y": ty - prev_y,
                           "abs_x": ax, "abs_y": ay,
                           "filename": None, "settle": row_settle})
            steps.append({"action": "snapshot",
                           "x": 0, "y": 0, "filename": fname, "settle": 0})
            prev_x, prev_y = tx, ty

        return {"status": "Success", "steps": steps}

    # ── Normal mode: full rectangular grid with drift corrections ────────────
    steps = []

    t0x, t0y = _tile_abs(0, 0)
    a0x, a0y = _abs(t0x, t0y)
    steps.append({"action": "move", "x": start_x_um, "y": start_y_um,
                  "abs_x": a0x, "abs_y": a0y,
                  "filename": None, "settle": settle_time_s})

    for row in range(num_rows):
        for col in range(num_columns):
            fname = f"{(num_rows - 1 - row):02d}_{col:02d}.jpg"
            steps.append({"action": "snapshot", "x": 0, "y": 0,
                           "filename": fname, "settle": 0})

            if col < num_columns - 1:
                tx, ty = _tile_abs(row, col + 1)
                ax, ay = _abs(tx, ty)
                steps.append({"action": "move",
                               "x": -abs(column_spacing_um),
                               "y": y_col_correction_um,
                               "abs_x": ax, "abs_y": ay,
                               "filename": None, "settle": col_settle})

        if row < num_rows - 1:
            # Row-return Y:
            # After a correctly-corrected row the physical Y = row_start Y exactly
            # (each col step's +y_col_correction cancels the -y_col coupling drift).
            # Sentio Relative moves are relative to PHYSICAL position, so there is
            # nothing to "unwind" — we simply need to:
            #   1. Move one row_spacing in -Y
            #   2. Pre-compensate the coupling drift from this row-return move itself
            #      (+y_col_correction, same per-move coupling as column steps)
            # → dY = -(row_spacing - y_col_correction_um)  [independent of num_columns]
            tx, ty = _tile_abs(row + 1, 0)
            ax, ay = _abs(tx, ty)
            steps.append({
                "action": "move",
                "x": +(abs(column_spacing_um) * (num_columns - 1)) + (x_row_correction_um * num_columns),
                "y": -(abs(row_spacing_um) - y_col_correction_um),
                "abs_x": ax, "abs_y": ay,
                "filename": None,
                "settle": row_settle
            })

    return {"status": "Success", "steps": steps}

def _imaging_folder(folder, wafer):
    """Return  Imaging/<wafer>/<folder>  when wafer is set, else <folder> unchanged."""
    return os.path.join("Imaging", wafer, folder) if wafer else folder



def stitch_images_large_for_wafer(folder, wafer="", save_overview_jpg=False,
                                   pyramid_tiff=True, tiff_quality=75, name_suffix="",
                                   n_workers=None, flatfield=None, flatfield_strength=1.0,
                                   user=None, waferAgentName=None, **kwargs):
    """Stitch a large grid using strip-based RAM-bounded stitcher.

    flatfield: path to a .npy correction map, or empty/None to auto-discover.
    When flatfield is empty and wafer is set, automatically looks for
    Imaging/<wafer>/FLATFIELD/flatfield.npy and uses it if present.
    """
    try:
        from utilities.WPImageStitchingFull import stitch_images_large
        from datetime import datetime

        effective_folder = _imaging_folder(folder, wafer)
        die_name  = os.path.basename(os.path.normpath(effective_folder))
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"{timestamp}_{die_name}{name_suffix}.jpg"

        # Auto-discover flatfield when not explicitly set
        ff = str(flatfield).strip() if flatfield else ""
        if not ff and wafer:
            auto = os.path.join("Imaging", str(wafer), "CALIBRATION_COLOR", "flatfield.npy")
            if os.path.exists(auto):
                ff = auto
                print(f"  Flatfield: auto-discovered → {ff}")
            else:
                print(f"  Flatfield: none found at {auto}, correction skipped")
        ff = ff or None

        stitched_path = stitch_images_large(
            folder=effective_folder,
            output_filename=output_filename,
            pyramid_tiff=bool(pyramid_tiff),
            tiff_quality=int(tiff_quality),
            save_overview_jpg=bool(save_overview_jpg),
            n_workers=int(n_workers) if n_workers is not None else None,
            flatfield=ff,
            flatfield_strength=float(flatfield_strength),
        )
        return ResponseBuilder.success("StitchImagesReply", f"Stitched -> {stitched_path}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        return ResponseBuilder.error("StitchImagesReply", str(e), 500)

def crop_stitched_image(folder, wafer="", x_px=0, y_px=0, width_px=None, height_px=None,
                        source="", output="", tif_quality=75,
                        user=None, waferAgentName=None, **kwargs):
    """Crop a stitched image using bottom-left origin coordinates.

    Parameters
    ----------
    folder      : die / output folder name (under Imaging/<wafer>/)
    wafer       : wafer name
    x_px        : left edge of crop, measured from the bottom-left corner (pixels)
    y_px        : bottom edge of crop, measured from the bottom-left corner (pixels)
    width_px    : crop width  (pixels); 0 or None → extend to right edge
    height_px   : crop height (pixels); 0 or None → extend to top edge
    source      : filename inside the folder to crop (auto-discovers latest .jpg/.tif if empty)
    output      : output filename (defaults to overwriting source)
    """
    import glob
    import tifffile
    import numpy as np

    effective_folder = _imaging_folder(folder, wafer)

    # ── Auto-discover source ──────────────────────────────────────────────────
    if not source:
        candidates = sorted(
            glob.glob(os.path.join(effective_folder, "*.tif")) +
            glob.glob(os.path.join(effective_folder, "*.jpg")),
            key=os.path.getmtime
        )
        if not candidates:
            return ResponseBuilder.error("CropImageReply",
                                         f"No .tif or .jpg found in '{effective_folder}'", 404)
        source_path = candidates[-1]   # most recent
    else:
        source_path = os.path.join(effective_folder, source)
        if not os.path.exists(source_path):
            return ResponseBuilder.error("CropImageReply",
                                         f"Source not found: '{source_path}'", 404)

    output_path = os.path.join(effective_folder, output) if output else source_path

    # ── Crop using tifffile memory-mapped windowed read (RAM-safe for any size) ──
    with tifffile.TiffFile(source_path) as tif:
        # Use the full-resolution page (level 0 of any pyramid)
        page = tif.pages[0]
        H, W = page.shape[:2]

    x_px     = int(x_px)
    y_px     = int(y_px)
    w        = int(width_px)  if (width_px  and int(width_px)  > 0) else W - x_px
    h        = int(height_px) if (height_px and int(height_px) > 0) else H - y_px

    # Convert bottom-left origin → top-left origin
    left = x_px
    top  = H - y_px - h

    if left < 0 or top < 0 or left + w > W or top + h > H:
        return ResponseBuilder.error("CropImageReply",
                                     f"Crop region out of image bounds {W}×{H}", 400)

    # Read only the crop window — tifffile loads tiles/strips on demand
    with tifffile.TiffFile(source_path) as tif:
        arr = tif.pages[0].asarray()          # full page as numpy array (memmapped when possible)
        cropped = arr[top:top + h, left:left + w]

    ext = os.path.splitext(output_path)[1].lower()
    if ext in (".tif", ".tiff"):
        tifffile.imwrite(output_path, cropped, compression="jpeg", compressionargs={"level": int(tif_quality)})
    else:
        from PIL import Image
        Image.fromarray(cropped).save(output_path)

    print(f"   ✂️  Cropped {os.path.basename(source_path)} "
          f"({W}×{H}) → ({w}×{h}) from bottom-left ({x_px},{y_px}) "
          f"→ {os.path.basename(output_path)}")
    return ResponseBuilder.success("CropImageReply",
                                   f"Saved {w}×{h} crop to '{output_path}'")


def build_flatfield_for_folder(folder, wafer="", sample_n=64, sigma=300,
                               output="flatfield.npy",
                               user=None, waferAgentName=None, **kwargs):
    """Estimate an illumination flatfield from a sample of tiles in folder.

    Saves a .npy correction map next to the tiles. Pass the same path as
    `flatfield` to StitchImagesFull to apply the correction during stitching.
    """
    try:
        from utilities.WPImageStitchingFull import build_flatfield

        effective_folder = _imaging_folder(folder, wafer)
        out_path = os.path.join(effective_folder, output)
        build_flatfield(effective_folder,
                        sample_n=int(sample_n),
                        sigma=float(sigma),
                        output=out_path)
        return ResponseBuilder.success("BuildFlatfieldReply",
                                       f"Flatfield saved → {out_path}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        return ResponseBuilder.error("BuildFlatfieldReply", str(e), 500)


def archive_imaging(source_dir="Imaging", dest_dir="/eos/project/a/aliceits3/ITS3-WP3/MOSAIX/prober_imaging",
                    user=None, waferAgentName=None, **kwargs):
    """Move the contents of source_dir to dest_dir file by file, then delete source_dir.

    Preserves the full sub-folder structure (Wafer/die/...) under dest_dir.
    Each file is copied first; the source is only deleted after a successful copy.
    source_dir itself is removed at the end once empty.
    """
    import shutil
    try:
        source_dir = str(source_dir)
        dest_dir   = str(dest_dir)

        if not os.path.isdir(source_dir):
            return ResponseBuilder.error("ArchiveImagingReply",
                                         f"Source not found: {source_dir}", 400)

        moved, skipped_ff, errors = 0, 0, []

        # Folder names that are never archived — calibration data stays on the local machine.
        # CALIBRATION_COLOR:    per-wafer illumination flatfield maps.
        # CALIBRATION_MOVEMENT: per-wafer axis-coupling constants.
        _SKIP_FOLDERS = {"CALIBRATION_COLOR", "CALIBRATION_MOVEMENT"}

        for dirpath, dirnames, filenames in os.walk(source_dir):
            # Skip protected folders
            if os.path.basename(dirpath) in _SKIP_FOLDERS:
                dirnames[:] = []   # don't recurse into sub-folders either
                skipped_ff += len(filenames)
                print(f"   ⏭ Skipping {os.path.basename(dirpath)}: {dirpath} ({len(filenames)} files)")
                continue

            # Prune protected folders from os.walk's descent list at any depth
            dirnames[:] = [d for d in dirnames if d not in _SKIP_FOLDERS]

            rel = os.path.relpath(dirpath, source_dir)
            target_dir = os.path.join(dest_dir, rel)
            os.makedirs(target_dir, exist_ok=True)

            for fname in filenames:
                src  = os.path.join(dirpath, fname)
                dst  = os.path.join(target_dir, fname)
                try:
                    shutil.copy2(src, dst)
                    os.remove(src)
                    moved += 1
                    print(f"   ✔ {src} → {dst}")
                except Exception as e:
                    errors.append(f"{src}: {e}")
                    print(f"   ✘ {src}: {e}")

        # Remove now-empty source directories (bottom-up)
        for dirpath, dirnames, filenames in os.walk(source_dir, topdown=False):
            try:
                os.rmdir(dirpath)
            except OSError:
                pass  # not empty (e.g. files that failed to copy)

        suffix = f" ({skipped_ff} calibration files kept locally)" if skipped_ff else ""
        if errors:
            return ResponseBuilder.error("ArchiveImagingReply",
                                         f"Moved {moved} files, {len(errors)} errors: "
                                         + "; ".join(errors) + suffix, 500)
        return ResponseBuilder.success("ArchiveImagingReply",
                                       f"Moved {moved} files from {source_dir} to {dest_dir}{suffix}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        return ResponseBuilder.error("ArchiveImagingReply", str(e), 500)


def cleanup_raster_images(folder, wafer="", user=None, waferAgentName=None, **kwargs):
    """Delete all grid tile images (RR_CC.jpg, incl. 3-digit indices),
    keeping stitched results, TIFFs and logs."""
    import re
    try:
        effective_folder = _imaging_folder(folder, wafer)
        pat = re.compile(r"\d{2,3}_\d{2,3}\.jpe?g", re.IGNORECASE)
        tiles = [f for f in os.listdir(effective_folder) if pat.fullmatch(f)]
        for f in tiles:
            os.remove(os.path.join(effective_folder, f))
        return ResponseBuilder.success("CleanupRasterImagesReply",
                                       f"Deleted {len(tiles)} tiles from {effective_folder}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        return ResponseBuilder.error("CleanupRasterImagesReply", str(e), 500)


def delete_imaging_folder(wafer="", user=None, waferAgentName=None, **kwargs):
    """Completely delete the Imaging/<wafer> folder and all its contents,
    including CALIBRATION_COLOR and CALIBRATION_MOVEMENT subfolders.

    Run ArchiveImaging first to copy imaging results to EOS; then call this
    to reclaim local disk space.  Calibration folders are preserved by archive
    so they remain available for the next wafer.
    """
    import shutil
    try:
        folder = _imaging_folder("", wafer).rstrip(os.sep)  # → Imaging/<wafer>
        if not folder or not os.path.isdir(folder):
            return ResponseBuilder.error("DeleteImagingFolderReply",
                                         f"Folder not found: {folder}", 400)

        shutil.rmtree(folder)
        msg = f"Deleted {folder} entirely"
        print(f"   🗑 {msg}")
        return ResponseBuilder.success("DeleteImagingFolderReply", msg)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return ResponseBuilder.error("DeleteImagingFolderReply", str(e), 500)
        
def take_image(
        snapshot_type="CameraRaw",
        save_locally=True,
        outputDir="screenshots",
        num_columns=5,
        num_rows=5,
        column_spacing_um=-2968,   # ~15% X overlap (was -2623 / ~25%)
        row_spacing_um=2476,       # ~15% Y overlap (was 2133 / ~27%)
        start_x_um=-21088,
        start_y_um=-27245,
        settle_time_s=0.25,
        user=None,
        waferAgentName=None
):
    """
    Step the chuck in a row/column raster, snap a JPEG at each position,
    then stitch all tiles into a single output image.
    Images saved as 00_00.jpg under outputDir.
    Starts at (start_x_um, start_y_um) absolutely, then steps relatively.
    """

    import time

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("TakeImageReply", error["output"], 400)

    try:
        from utilities.WPImageStitching import stitch_images

        prober = get_current_prober()        
        saved_files = []

        os.makedirs(outputDir, exist_ok=True)

        prober.find_home()
        prober.go_to_die(-3, 0)
        prober.move_chuck_xy(start_x_um, start_y_um, "Relative")
        prober.move_chuck_xy(column_spacing_um/4, -row_spacing_um/4, "Relative")
        time.sleep(settle_time_s)

        for row in range(num_rows):
            for col in range(num_columns):

                # row=0 is bottom-left → invert row index for filename
                fname = f"{(num_rows - 1 - row):02d}_{col:02d}.jpg"

                filepath = prober.take_screenshot(
                    filename=fname,
                    snapshot_type=snapshot_type,
                    save_locally=save_locally,
                    output_dir=outputDir
                )
                saved_files.append(os.path.abspath(filepath))

                # Step RIGHT after each column (except the last)
                if col < num_columns - 1:
                    prober.move_chuck_xy(-abs(column_spacing_um), 0, "Relative")
                    time.sleep(settle_time_s)

            # After finishing a row: reset X to col 0, step UP one row
            if row < num_rows - 1:
                prober.move_chuck_xy(
                    +abs(column_spacing_um) * (num_columns - 1),  # ← back to col 0
                    -abs(row_spacing_um),                          # ↑ step up (flipped)
                    "Relative"
                )
                time.sleep(settle_time_s)


        stitched_path = stitch_images(folder=outputDir)

        return ResponseBuilder.success(
            "TakeImageReply",
            f"Captured {len(saved_files)} images, stitched -> {stitched_path}"
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return ResponseBuilder.error("TakeImageReply", str(e), 500)

def take_screenshot(
        fileName=None,
        snapshot_type="CameraRaw",
        save_locally=True,
        outputDir="screenshotsSVT",
        wafer="",
        user=None,
        waferAgentName=None
):
    """
    Take a screenshot from prober camera.

    Args:
        fileName: Optional filename (auto-generated if not provided, always saved as .jpg)
        snapshot_type: "CameraRaw" (raw sensor image) or "WithOverlays" (SENTIO UI overlay)
        save_locally: True to save on WP Agent machine, False to save on prober PC
        outputDir: Directory/die name to save screenshots under (only when save_locally=True).
                   When wafer is set, the effective path is Imaging/<wafer>/<outputDir>.
        wafer: Wafer identifier (e.g. "Wafer25"). Combined with outputDir to form
               Imaging/<wafer>/<outputDir>. Leave empty to use outputDir as-is.
        user: User performing action
        waferAgentName: Agent name

    Returns:
        Response with screenshot absolute path
    """
    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("TakeScreenshotReply", error["output"], 400)

    try:
        prober = get_current_prober()

        effective_dir = _imaging_folder(outputDir, wafer)
        os.makedirs(effective_dir, exist_ok=True)

        filepath = prober.take_screenshot(
            filename=fileName,
            snapshot_type=snapshot_type,
            save_locally=save_locally,
            output_dir=effective_dir
        )

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