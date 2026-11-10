"""
WPContactingActions - commands for needle contacting: saving positions,
needle-mark analysis, moving to a target on the pads.

Storage (per project, in Contacting/<projectName>/) is in utilities/WPContacting.py.
"""

import glob
import json
import os

from utilities.WPResponseBuilder import ResponseBuilder
from utilities.WPValidationDecorator import validate_command, get_reply_type
from utilities.WPContacting import pad_target_offset, save_offset, save_position

from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.WPFactory import get_current_prober
from actions.WPTestingActions import _ensure_initialized, update_current_info


@validate_command
def save_chuck_position(name="contact", label=None, user=None, waferAgentName=None):
    """
    Read the current chuck position and save it in Contacting/<project>/positions.json.
    Moves nothing and does not change the agent state.

    Saved: chuck X/Y (Zero reference, um), contact height, Z state (contact /
    separation), work area (probing / off-axis: Zero-reference X/Y differ between
    them), die col/row/subsite (+ label if given), project, wafer, user.

    Args:
        name:  name of the position, e.g. "contact" (the latest one per name is kept,
               every save is also appended to the history)
        label: die label as used by MoveChuckRowColumn (e.g. "BAM00"); the prober
               only reports col/row, so pass it when known
    """
    reply = get_reply_type()

    error = _ensure_initialized()
    if error:
        return error

    g = SvtWPAagentGlobalParameters.getInstance()
    if not g.projectName:
        return ResponseBuilder.error(reply, "An open project is required to save a position", 400)

    try:
        prober = get_current_prober()

        update_current_info(currentProber=prober)    # die col/row, Z state, work area
        x, y = prober.get_chuck_xy()
        contact_height = prober.get_contact_height()
        prober.local_mode()

        record = {
            "x_um": round(float(x), 2),
            "y_um": round(float(y), 2),
            "reference": "Zero",
            "contact_height_um": round(float(contact_height), 2),
            "z_state": g.chuck_z_position_state,
            "work_area": g.current_working_area,
            "die": {
                "col": g.current_die_col,
                "row": g.current_die_row,
                "subsite": g.current_die_subsite,
                "label": label,
            },
            "project": g.projectName,
            "wafer_id": g.loaded_wafer_id,
            "user": user,
        }
        path = save_position(g.projectName, name, record)

        return ResponseBuilder.success(
            reply,
            f"Saved position '{name}': x={x:.2f} um, y={y:.2f} um, "
            f"contact height={contact_height:.2f} um, die col={g.current_die_col} "
            f"row={g.current_die_row}" + (f" ({label})" if label else "") + ", "
            f"{g.current_working_area}, {g.chuck_z_position_state} -> {path}",
        )

    except Exception as e:
        # Read-only command: report the failure but do not put the agent in Error
        # (same as ShowStatus / GetChuckXY); inside a sequence the error stops it.
        import traceback
        traceback.print_exc()
        return ResponseBuilder.error(reply, f"Could not save position '{name}': {e}", 500)


@validate_command
def analyze_needle_marks(folder, wafer="", config="lec", pattern="*_LEC.tif", contrast=False,
                         require_ok=False, root="Imaging",
                         user=None, waferAgentName=None, **kwargs):
    """
    Needle-mark analysis of the newest stitched image of one die folder.

    Works on files only (no prober), so it also runs on images taken earlier.
    Reads and writes in the same folder layout as the imaging commands:
        <root>/<wafer>/<folder>/<timestamp>_<folder>_LEC.tif        (from StitchImagesFull)
     -> <root>/<wafer>/<folder>/<image stem>_marks.json / _marks.csv / _overlay.tif
                                (+ _contrast.tif with contrast=True)
    root is "Imaging" (local, before ArchiveImaging; the reports are then archived
    with the image) or the ArchiveImaging destination on EOS, to analyse images
    already archived (ArchiveImaging keeps the <wafer>/<die> structure).

    Args:
        folder:     die folder name, e.g. "BAM00" (the $die of the TakeImage* sequences)
        wafer:      wafer folder name, e.g. "Wafer" (Imaging/<wafer>/<folder>)
        config:     needle_mark config: built-in name ("lec") or path to a JSON config
        pattern:    which stitched image of the folder to analyse (the newest match is used)
        contrast:   also write the contrast image (what the detection sees, for tuning)
        require_ok: fail the command (and so a sequence) when the pad detection is doubtful
                    (pad count or pad sizes do not match the config); otherwise report it
        root:       top folder: "Imaging" (default) or e.g. the EOS archive
                    /eos/project/a/aliceits3/ITS3-WP3/MOSAIX/prober_imaging
    """
    reply = get_reply_type()

    from utilities.needle_mark import NeedleMarkError, latest_image, run

    die_folder = _die_folder(root, wafer, folder)
    try:
        image = latest_image(die_folder, pattern)
        summary = run(image, config, contrast=_as_bool(contrast))
    except NeedleMarkError as e:
        return ResponseBuilder.error(reply, f"Needle-mark analysis of '{die_folder}': {e}", 400)
    except Exception as e:
        # files only: report, but do not put the agent in Error
        import traceback
        traceback.print_exc()
        message = f"Needle-mark analysis of '{die_folder}' failed: {e}"
        return ResponseBuilder.error(reply, message, 500)

    message = _needle_marks_message(folder, summary)
    print(f"   🔎 {message}")
    if _as_bool(require_ok) and not summary["ok"]:
        doubtful = "Pad detection doubtful, check the overlay: " + message
        return ResponseBuilder.error(reply, doubtful, 400)
    return ResponseBuilder.success(reply, message)


def _die_folder(root, wafer, folder):
    """<root>/<wafer>/<folder>: the layout of WPImagingActions._imaging_folder(), with
    the top folder ("Imaging") as a parameter. Without a wafer, the folder itself
    (as _imaging_folder() does)."""
    if not wafer:
        return str(folder)
    return os.path.join(str(root or "Imaging"), str(wafer), str(folder))


@validate_command
def compute_pad_target_offset(folder, wafer="", root="Imaging", corner="bottom_left", inset_um=20,
                              name="pad_target", max_aspect=1.5, min_valid_fraction=1.0,
                              max_spread_um=5.0, chuck_sign_x=-1, chuck_sign_y=1,
                              user=None, waferAgentName=None, **kwargs):
    """
    Chuck offset that brings the needle to a target on the pads, from the newest
    needle-mark report of a die (<root>/<wafer>/<folder>/*_marks.json, written by
    AnalyzeNeedleMarks). Saved in Contacting/<project>/offsets.json under `name`;
    moves nothing.

    Use case: one touchdown on every pad, right after PTPA. Success requires every
    pad (min_valid_fraction) to show exactly one round mark, clear of the pad edge,
    and the pads to agree (max_spread_um).

    Target: `inset_um` inside the pad from both edges of `corner` (bottom_left,
    bottom_right, top_left, top_right) or the pad centre (center). Per pad the
    needle displacement is target - mark offset (image axes, measured pad size);
    the median over the pads is converted to a chuck move with
        chuck dx = chuck_sign_x * image dx,   chuck dy = chuck_sign_y * image dy
    Defaults: chuck +x moves the needle to the pad's left (-x in the image), chuck
    +y moves it to the pad's bottom (+y in the image), so a needle at the pad
    centre needs a (+, +) chuck move to reach the bottom-left corner.

    Also saved: ptpa_offset_x_um / ptpa_offset_y_um, the chuck move that would
    centre the needle on the pads (independent of the chosen corner).

    Args:
        folder / wafer / root: die folder, as for AnalyzeNeedleMarks
        corner, inset_um:      where to land
        name:                  name of the saved offset
        max_aspect:            a mark is round if its box is at most this elongated
        min_valid_fraction:    fraction of pads that must have one round mark (1.0 = all)
        max_spread_um:         largest allowed disagreement between pads (95th percentile)
        chuck_sign_x/_y:       image -> chuck direction of each axis (+1 or -1)
    """
    reply = get_reply_type()

    g = SvtWPAagentGlobalParameters.getInstance()
    if not g.projectName:
        return ResponseBuilder.error(reply, "An open project is required to save the offset", 400)

    die_folder = _die_folder(root, wafer, folder)
    reports = sorted(glob.glob(os.path.join(die_folder, "*_marks.json")), key=os.path.getmtime)
    if not reports:
        return ResponseBuilder.error(
            reply, f"No needle-mark report in '{die_folder}': run AnalyzeNeedleMarks first", 400)

    try:
        with open(reports[-1], encoding="utf-8") as f:
            report = json.load(f)
        if not report["count_ok"]:
            return ResponseBuilder.error(
                reply, f"{folder}: {report['pads_found']}/{report['pads_expected']} pads found "
                       f"in the report, pad numbering not trusted", 400)

        result = pad_target_offset(report["pads"], corner, float(inset_um), float(max_aspect))
        problem = _offset_problem(result, float(min_valid_fraction), float(max_spread_um))
        if problem:
            return ResponseBuilder.error(reply, f"{folder}: {problem}", 400)

        sx, sy = int(chuck_sign_x), int(chuck_sign_y)
        record = {
            "dx_um": round(sx * result["dx_um"], 2),
            "dy_um": round(sy * result["dy_um"], 2),
            "ptpa_offset_x_um": round(sx * result["center_dx_um"], 2),
            "ptpa_offset_y_um": round(sy * result["center_dy_um"], 2),
            "corner": corner,
            "inset_um": float(inset_um),
            "image_dx_um": result["dx_um"],
            "image_dy_um": result["dy_um"],
            "chuck_signs": [sx, sy],
            "spread_um": result["spread_um"],
            "n_pads_used": result["n_used"],
            "n_pads": result["n_pads"],
            "rejected_pads": result["rejected"],
            "die": folder,
            "wafer": wafer,
            "report": reports[-1],
            "project": g.projectName,
            "user": user,
        }
        path = save_offset(g.projectName, name, record)

    except (KeyError, ValueError) as e:
        return ResponseBuilder.error(reply, f"{folder}: cannot compute the offset: {e}", 400)
    except Exception as e:
        # files only: report, but do not put the agent in Error
        import traceback
        traceback.print_exc()
        return ResponseBuilder.error(reply, f"{folder}: offset computation failed: {e}", 500)

    message = " | ".join([
        f"{folder}: offset '{name}' to {corner} (inset {float(inset_um):g} um): "
        f"chuck dx={record['dx_um']:+.2f} um, dy={record['dy_um']:+.2f} um",
        f"ptpa offset x={record['ptpa_offset_x_um']:+.2f}, "
        f"y={record['ptpa_offset_y_um']:+.2f} um",
        f"{result['n_used']}/{result['n_pads']} pads, spread {result['spread_um']} um -> {path}",
    ])
    print(f"   🎯 {message}")
    return ResponseBuilder.success(reply, message)


def _offset_problem(result, min_valid_fraction, max_spread_um):
    """Why an offset must not be used, or None if it is fine."""
    n_used, n_pads = result["n_used"], result["n_pads"]
    if n_pads == 0:
        return "no pads in the report"
    if n_used < min_valid_fraction * n_pads:
        first = ", ".join(f"pad {i}: {why}" for i, why in result["rejected"][:5])
        more = f" (+{len(result['rejected']) - 5} more)" if len(result["rejected"]) > 5 else ""
        return (f"only {n_used}/{n_pads} pads have one round mark clear of the edge "
                f"(required: {min_valid_fraction:.0%}): {first}{more}")
    if result["spread_um"] > max_spread_um:
        return f"pads disagree: spread {result['spread_um']} um > max_spread_um={max_spread_um} um"
    return None


def _needle_marks_message(folder, summary):
    """One-line result of AnalyzeNeedleMarks for the reply and the console."""
    counts = summary["verdict_counts"]
    parts = [
        f"{folder}: {summary['pads_found']}/{summary['pads_expected'] or '?'} pads",
        f"no mark={counts['NO_MARK']}, single={counts['SINGLE_MARK']}, "
        f"multiple={counts['MULTIPLE_MARKS']}, at edge={counts['AT_EDGE']}",
    ]
    if summary["pads_at_edge"]:
        parts.append(f"marks at edge on pads {summary['pads_at_edge']}")
    if not summary["count_ok"]:
        parts.append("PAD COUNT MISMATCH")
    if summary["pads_size_off"]:
        parts.append(f"{len(summary['pads_size_off'])} pads off design size")
    parts.append(f"report: {os.path.basename(summary['outputs']['json'])}")
    return " | ".join(parts)


def _as_bool(value):
    """YAML / Kafka may deliver booleans as strings: "false" must stay False."""
    if isinstance(value, str):
        return value.strip().lower() in ("true", "1", "yes")
    return bool(value)
