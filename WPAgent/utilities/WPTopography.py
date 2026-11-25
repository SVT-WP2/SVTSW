"""
WPTopography - in-house LEC topography: storage and maths (no prober access).

MeasureLECTopographyDie autofocuses on the LEC column of a die (the same positions
as the LEC imaging) and stores, per wafer, in the agent's working directory:

    Contacting/topography/<wafer>/LEC_topography.json
        {
          "wafer": "<wafer>",
          "dies":    {"<label>": {record}, ...},      # latest measurement per die
          "history": [{"label": "<label>", ...}, ...] # every measurement, oldest first
        }
    record: project, wafer type, die col/row, points [{index, x_um, y_um, focus_um,
            chuck_z_um}], failed points, and the statistics of summarize().

ComputeTopographyCorrection compares a die with the reference die and stores the
result in the die's own file:

    Contacting/topography/<wafer>/dies/<label>.json
        {"label": ..., "wafer": ..., "topography_correction": {...}}

Sign: a higher focus height means a higher wafer surface, closer to the needles.
    dz_um            = focus(die) - focus(reference), averaged over the LEC positions
                       measured on both dies                    (> 0: die higher)
    od_correction_um = -dz_um     (to add to the nominal overdrive: a lower / thinner
                                   die needs more overdrive, a higher one less)
Only the positions measured on both dies are compared: the focus height varies along
the LEC column in the same way on every die, so comparing different positions would
add that pattern (a few um) to dz.
"""

import json
import os
from datetime import datetime
from statistics import mean, pstdev

from utilities.WPContacting import CONTACTING_DIR, _write_json

TOPOGRAPHY_DIR = "topography"
TOPOGRAPHY_FILE = "LEC_topography.json"


# --- storage -------------------------------------------------------------------

def topography_folder(wafer):
    """Contacting/topography/<wafer>; raises ValueError without a wafer name."""
    if not str(wafer or "").strip():
        raise ValueError("a wafer name is required (e.g. \"L3W15\"): topography is saved per wafer")
    return os.path.join(CONTACTING_DIR, TOPOGRAPHY_DIR, str(wafer).strip())


def topography_path(wafer):
    """Contacting/topography/<wafer>/LEC_topography.json"""
    return os.path.join(topography_folder(wafer), TOPOGRAPHY_FILE)


def die_file_path(wafer, label):
    """Contacting/topography/<wafer>/dies/<label>.json"""
    return os.path.join(topography_folder(wafer), "dies", f"{label}.json")


def load_topography(wafer):
    """The wafer's topography file ({"wafer", "dies": {}, "history": []} if none yet)."""
    path = topography_path(wafer)
    if not os.path.exists(path):
        return {"wafer": str(wafer), "dies": {}, "history": []}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_die_topography(wafer, label, record):
    """Store a die measurement as the latest one of `label` (+ history). Returns the path."""
    data = load_topography(wafer)
    record = {**record, "measured_at": datetime.now().isoformat(timespec="seconds")}
    data["dies"][label] = record
    data["history"].append({"label": label, **record})
    path = topography_path(wafer)
    _write_json(path, data)
    return path


def die_measurement(wafer, label):
    """Latest measurement of a die; KeyError if the die was not measured."""
    data = load_topography(wafer)
    if label not in data["dies"]:
        raise KeyError(f"die '{label}' has no topography on wafer '{wafer}' "
                       f"({topography_path(wafer)}): run MeasureLECTopographyDie first")
    return data["dies"][label]


def save_die_entry(wafer, label, key, entry):
    """Set `key` in the die's own file (other entries are kept). Returns the path."""
    path = die_file_path(wafer, label)
    data = {"label": label, "wafer": str(wafer)}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    data[key] = {**entry, "saved_at": datetime.now().isoformat(timespec="seconds")}
    _write_json(path, data)
    return path


# --- maths ---------------------------------------------------------------------

def summarize(points, min_points):
    """Statistics of the focus heights of one die.

    points: [{"y_um": ..., "focus_um": ...}, ...] (successful autofocus points only)
    Returns n_points, mean_focus_um, std_focus_um (population), min/max_focus_um,
    range_um, slope_um_per_mm (least-squares slope of focus vs chuck Y along the LEC
    column: the die tilt in that direction; None with fewer than 2 points) and
    complete (at least min_points points).
    """
    z = [float(p["focus_um"]) for p in points]
    result = {"n_points": len(z), "complete": len(z) >= int(min_points)}
    if not z:
        return result
    result.update({
        "mean_focus_um": round(mean(z), 2),
        "std_focus_um": round(pstdev(z), 2),
        "min_focus_um": round(min(z), 2),
        "max_focus_um": round(max(z), 2),
        "range_um": round(max(z) - min(z), 2),
        "slope_um_per_mm": None,
    })
    if len(z) >= 2:
        y = [float(p["y_um"]) for p in points]
        my, mz = mean(y), mean(z)
        syy = sum((v - my) ** 2 for v in y)
        if syy > 0:
            slope = sum((a - my) * (b - mz) for a, b in zip(y, z)) / syy   # um per um
            result["slope_um_per_mm"] = round(slope * 1000.0, 3)
    return result


def topography_correction(die_record, ref_record):
    """Focus-height difference of a die to the reference, on the LEC positions both have.

    Returns a dict: dz_um = mean over the common positions of focus(die) - focus(reference),
    od_correction_um = -dz_um, positions (the common LEC position indices), n_common,
    sd_diff_um (spread of the point-by-point differences; None below 2 points).
    """
    die = {p["index"]: float(p["focus_um"]) for p in die_record.get("points", [])}
    ref = {p["index"]: float(p["focus_um"]) for p in ref_record.get("points", [])}
    common = sorted(set(die) & set(ref))
    diffs = [die[i] - ref[i] for i in common]
    if not diffs:
        return {"dz_um": None, "od_correction_um": None, "positions": [], "n_common": 0, "sd_diff_um": None}
    dz = mean(diffs)
    return {"dz_um": round(dz, 2), "od_correction_um": round(-dz, 2), "positions": common,
            "n_common": len(common), "sd_diff_um": round(pstdev(diffs), 2) if len(diffs) > 1 else None}
