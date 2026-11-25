"""
WPTopographyActions - in-house LEC topography (Contacting domain).

    GetDieList                   dies of the open project, from its die map (for sequences)
    MeasureLECTopographyDie      autofocus on the 9 LEC positions of one die, store the heights
    ComputeTopographyCorrection  focus-height difference of a die to the reference die

Sequences: sequencer/LECTopography_ER2.yaml / LECTopography_ER2B.yaml measure every
die of both chip projects of a wafer type. Storage and maths: utilities/WPTopography.py.
"""

import time

from utilities.WPResponseBuilder import ResponseBuilder
from utilities.WPValidationDecorator import validate_command, validate_command_with_name, get_reply_type
from utilities.WPDieMaps import label_to_coordinates, project_dies, wafer_type
from utilities.WPImagingConfig import raster_start
from utilities.WPTopography import (die_measurement, save_die_entry, save_die_topography, summarize,
                                    topography_correction, topography_path)
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine

from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.WPFactory import get_current_prober
from actions.WPTestingActions import _ensure_initialized, _go_to_offaxis_side, update_current_info


@validate_command
def get_die_list(user=None, waferAgentName=None, **kwargs):
    """
    Dies of the open project, from the die map of its wafer type (configs/WPMapConversion_<type>.json):
    only the dies of the project's ASIC (babyMOSAIX dies in a babyMOSAIX project, ...).
    Moves nothing.

    The reply carries them as "steps" ([{"label", "col", "row"}, ...]), so a sequence can
    loop over them:
        - command: GetDieList
          as: dies
        - foreach: $dies.steps
          as: d
          steps: [... label: $d.label ...]
    """
    reply = get_reply_type()
    g = SvtWPAagentGlobalParameters.getInstance()
    try:
        dies = project_dies(g.projectName)
    except (ValueError, OSError) as e:
        return ResponseBuilder.error(reply, f"Cannot list the dies: {e}", 400)

    steps = [{"label": d["label"], "col": d["column_local"], "row": d["row_local"]} for d in dies]
    result = ResponseBuilder.success(
        reply, f"{len(steps)} dies in {g.projectName}: {', '.join(s['label'] for s in steps)}")
    result["steps"] = steps
    return result


@validate_command_with_name("MeasureLECTopographyDie")   # "LEC" in capitals: not derivable from the name
def measure_lec_topography_die(label, wafer="", n_points=9, row_spacing_um=2476, start_config="LEC",
                               settle_s=0.2, min_points=5, user=None, waferAgentName=None, **kwargs):
    """
    LEC topography of one die: autofocus on the LEC column, store the focus heights.

    Off-axis: move to the die, then to the n_points positions of the LEC imaging raster
    (first one = raster start `start_config` of configs/WPImagingConfig.json, then
    row_spacing_um apart along -Y), autofocus at each and read the chuck Z; finally back
    to the die position. Stored per wafer in Contacting/topography/<wafer>/LEC_topography.json
    (utilities/WPTopography.py): every point, mean / std / min / max / range of the focus
    height and its slope along the column (die tilt).

    A failed autofocus is recorded and the die goes on; with fewer than min_points good
    points the die is stored as incomplete (the reply says so, but succeeds, so a wafer
    scan continues) and ComputeTopographyCorrection refuses it. A failed move puts the
    agent in error state.

    Args:
        label:          die label of the open project's map, e.g. "BAMTest"
        wafer:          wafer name, e.g. "L3W15" (the file is per wafer)
        n_points:       LEC positions (9 = the LEC imaging raster)
        row_spacing_um: distance between positions (as the LEC imaging)
        start_config:   raster start block of configs/WPImagingConfig.json
        settle_s:       wait after each move, before the autofocus
        min_points:     good points needed for a complete die
    """
    reply = get_reply_type()
    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()
    try:
        col, row = label_to_coordinates(label, g.projectName)
        sx, sy = raster_start(start_config)
        n, spacing, settle = int(n_points), float(row_spacing_um), float(settle_s)
        path = topography_path(wafer)                     # checks the wafer name
    except (ValueError, OSError) as e:
        return ResponseBuilder.error(reply, f"Topography of '{label}' refused: {e}", 400)

    points, failed = [], []
    try:
        prober = get_current_prober()
        _go_to_offaxis_side(prober)
        prober.go_to_die(col, row)
        g.set_current_die(col, row, 0)
        x0, y0 = prober.get_chuck_xy()

        for i in range(n):
            prober.move_chuck_xy(x0 + sx, y0 + sy - i * spacing, "Zero")
            if settle > 0:
                time.sleep(settle)
            x, y = prober.get_chuck_xy()
            try:
                focus = float(prober.auto_focus())
                chuck_z = float(prober.get_chuck_z())
            except Exception as e:                        # one bad focus: record it, go on
                print(f"   ⚠️  {label} point {i}: autofocus failed: {e}")
                failed.append({"index": i, "x_um": round(float(x), 2), "y_um": round(float(y), 2),
                               "error": str(e)})
                continue
            points.append({"index": i, "x_um": round(float(x), 2), "y_um": round(float(y), 2),
                           "focus_um": round(focus, 2), "chuck_z_um": round(chuck_z, 2)})
            print(f"   🔎 {label} point {i}: focus {focus:.2f} um, chuck Z {chuck_z:.2f} um")

        prober.move_chuck_xy(x0, y0, "Zero")              # back to the die position
        update_current_info(currentProber=prober)
        prober.local_mode()
    except Exception as e:
        import traceback
        traceback.print_exc()
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error(reply, f"Topography of '{label}' failed: {e}", 500)

    stats = summarize(points, min_points)
    record = {
        "project": g.projectName,
        "wafer_type": wafer_type(g.projectName),
        "die": {"col": col, "row": row},
        "wafer_id": g.loaded_wafer_id,
        "start_config": start_config,
        "raster_start_um": [sx, sy],
        "row_spacing_um": spacing,
        **stats,
        "points": points,
        "failed": failed,
        "user": user,
    }
    try:
        save_die_topography(wafer, label, record)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return ResponseBuilder.error(reply, f"Topography of '{label}' measured but not saved: {e}", 500)

    if not stats["n_points"]:
        message = f"{label}: INCOMPLETE, no autofocus succeeded ({n} tried) -> {path}"
    else:
        message = (f"{label}: {stats['n_points']}/{n} points, focus mean {stats['mean_focus_um']:.2f} um, "
                   f"std {stats['std_focus_um']:.2f}, range {stats['range_um']:.2f}, "
                   f"slope {stats['slope_um_per_mm']} um/mm"
                   + ("" if stats["complete"] else f", INCOMPLETE (< {int(min_points)} points)") + f" -> {path}")
    print(f"   🗺️  {message}")
    return ResponseBuilder.success(reply, message)


@validate_command
def compute_topography_correction(die, wafer="", reference="BAMTest", max_abs_um=40.0,
                                  user=None, waferAgentName=None, **kwargs):
    """
    Topography correction of a die: difference of its mean LEC focus height to the
    reference die's (Contacting/topography/<wafer>/LEC_topography.json).

        dz_um            = mean focus(die) - mean focus(reference)   (> 0: die higher,
                           closer to the needles)
        od_correction_um = -dz_um, to add to the nominal overdrive

    |dz_um| > max_abs_um: something is wrong (bad focus, wrong die, tilted wafer):
    nothing is saved and the agent goes to error state. Otherwise saved as
    "topography_correction" in the die's own file Contacting/topography/<wafer>/dies/<die>.json.
    Both dies must be complete (enough autofocus points). Moves nothing.

    Args:
        die:        die label, e.g. "BAM03"
        wafer:      wafer name, as for MeasureLECTopographyDie
        reference:  reference die (default "BAMTest": PTPA / needle offset die)
        max_abs_um: largest |dz| accepted (default 40)
    """
    reply = get_reply_type()
    try:
        meas, ref = die_measurement(wafer, die), die_measurement(wafer, reference)
    except (KeyError, ValueError, OSError) as e:
        return ResponseBuilder.error(reply, f"Cannot compute the correction of '{die}': {e}", 400)
    for name, rec in ((die, meas), (reference, ref)):
        if not rec.get("complete"):
            return ResponseBuilder.error(
                reply, f"Die '{name}' has an incomplete topography ({rec.get('n_points', 0)} points): "
                       f"measure it again", 400)

    dz, od = topography_correction(meas, ref)
    limit = float(max_abs_um)
    if abs(dz) > limit:
        message = (f"Topography correction of '{die}' vs '{reference}': dz={dz:+.2f} um exceeds "
                   f"max_abs_um={limit:g}: not saved")
        agentStateMachine.enter_error_state(message)
        return ResponseBuilder.error(reply, message, 500)

    entry = {
        "reference": reference,
        "dz_um": dz,
        "od_correction_um": od,
        "die_mean_focus_um": meas["mean_focus_um"],
        "reference_mean_focus_um": ref["mean_focus_um"],
        "die_std_focus_um": meas["std_focus_um"],
        "reference_std_focus_um": ref["std_focus_um"],
        "die_measured_at": meas.get("measured_at"),
        "reference_measured_at": ref.get("measured_at"),
        "max_abs_um": limit,
        "user": user,
    }
    try:
        path = save_die_entry(wafer, die, "topography_correction", entry)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return ResponseBuilder.error(reply, f"Correction of '{die}' computed but not saved: {e}", 500)

    message = (f"{die} vs {reference}: dz={dz:+.2f} um (die {meas['mean_focus_um']:.2f}, reference "
               f"{ref['mean_focus_um']:.2f}), overdrive correction {od:+.2f} um -> {path}")
    print(f"   📐 {message}")
    return ResponseBuilder.success(reply, message)
