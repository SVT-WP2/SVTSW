"""
WPChuckPositioning - closed-loop positioning of the chuck to an absolute XY target.

Separate from WPImagingActions.move_chuck_xy_precise (raster imaging); used by
MoveChuckPrecise. Works with the prober interface (move_chuck_xy / get_chuck_xy), so it
runs the same on the SENTIO and the mock prober.
"""

import time

# Encoder step is 0.1 µm: corrections below it are unreliable and may overshoot.
ENCODER_FLOOR_UM = 0.10


def move_to_xy(prober, target_x, target_y, precision_um=1.0, max_iterations=4,
               settle_s=0.2, log=print):
    """
    Move the chuck to an absolute position (Zero reference) and correct until the
    error is within precision_um on both axes.

    1. Absolute move to the target.
    2. Read the position. Within precision: done.
    3. Otherwise a relative correction. The first one is the plain error; the machine
       drifts a little on every move (axis coupling), so after it the coupling is learned
       (error_before - command - error_after) and subtracted from the next corrections.

    Returns a dict: converged, x, y, err_x, err_y (µm, target - actual), iterations.
    """
    target_x, target_y = float(target_x), float(target_y)
    accept = max(float(precision_um), ENCODER_FLOOR_UM)

    prober.move_chuck_xy(target_x, target_y, "Zero")

    coupling = None
    prev = None  # (err_x, err_y, cmd_x, cmd_y) of the last correction
    iterations = 0
    converged = False
    x = y = ex = ey = 0.0

    for i in range(int(max_iterations) + 1):
        x, y = prober.get_chuck_xy()
        ex, ey = target_x - x, target_y - y
        log(f"   📍 Read ({'primary' if i == 0 else f'after correction #{i}'}): "
            f"actual=({x:.2f},{y:.2f}) err=({ex:+.2f},{ey:+.2f}) µm")

        if max(abs(ex), abs(ey)) <= accept:
            converged = True
            break
        if i == int(max_iterations):
            break

        if prev is not None and coupling is None:
            coupling = (prev[0] - prev[2] - ex, prev[1] - prev[3] - ey)
            log(f"   🔬 Learned coupling: ({coupling[0]:+.2f}, {coupling[1]:+.2f}) µm/move")

        cx, cy = (ex - coupling[0], ey - coupling[1]) if coupling else (ex, ey)
        log(f"   🔧 Correction #{iterations + 1}: cmd=({cx:+.2f},{cy:+.2f}) µm")
        prev = (ex, ey, cx, cy)
        prober.move_chuck_xy(cx, cy, "Relative")
        iterations += 1
        if settle_s > 0:
            time.sleep(settle_s)

    return {
        "converged": converged, "x": x, "y": y,
        "err_x": ex, "err_y": ey, "iterations": iterations,
    }
