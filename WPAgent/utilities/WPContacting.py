"""
WPContacting - per-project contacting data and pad-target maths (no prober access).

Storage, under Contacting/<projectName>/ in the agent's working directory:

    positions.json   chuck positions saved by SaveChuckPosition
    offsets.json     chuck offsets computed by ComputePadTargetOffset

Both files have the same layout:
    {
      "latest":  {"<name>": {record}, ...},     # most recent record per name
      "history": [{"name": "<name>", ...}, ...] # every save, oldest first
    }
Writes are atomic: a file is never left half-written.

Pad-target maths (pad_target_offset) works on the "pads" list of a needle_mark
report (<image>_marks.json). Image axes: +x = right, +y = down, um from the pad centre.
"""

import json
import os
from datetime import datetime
from statistics import median

CONTACTING_DIR = "Contacting"
POSITIONS_FILE = "positions.json"
OFFSETS_FILE = "offsets.json"


# --- storage -------------------------------------------------------------------

def contacting_folder(project):
    """Contacting/<project>; raises ValueError when no project is open."""
    if not project:
        raise ValueError("no project open: contacting data is saved per project")
    return os.path.join(CONTACTING_DIR, str(project))


def positions_path(project):
    """Contacting/<project>/positions.json"""
    return os.path.join(contacting_folder(project), POSITIONS_FILE)


def offsets_path(project):
    """Contacting/<project>/offsets.json"""
    return os.path.join(contacting_folder(project), OFFSETS_FILE)


def load_positions(project):
    """All saved positions of a project ({"latest": {}, "history": []} if none yet)."""
    return _load(positions_path(project))


def load_position(project, name):
    """Latest position saved under `name`; KeyError if there is none."""
    return _latest(load_positions(project), name, "position", project)


def save_position(project, name, record):
    """Save a chuck position as the latest `name` (+ history). Returns the file path."""
    return _save(positions_path(project), name, record)


def load_offsets(project):
    """All saved offsets of a project ({"latest": {}, "history": []} if none yet)."""
    return _load(offsets_path(project))


def load_offset(project, name):
    """Latest offset saved under `name`; KeyError if there is none."""
    return _latest(load_offsets(project), name, "offset", project)


def save_offset(project, name, record):
    """Save a chuck offset as the latest `name` (+ history). Returns the file path."""
    return _save(offsets_path(project), name, record)


def _load(path):
    if not os.path.exists(path):
        return {"latest": {}, "history": []}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _latest(data, name, kind, project):
    if name not in data["latest"]:
        raise KeyError(f"no {kind} '{name}' saved for project '{project}'")
    return data["latest"][name]


def _save(path, name, record):
    if not name:
        raise ValueError("a record needs a name")
    data = _load(path)
    record = {**record, "saved_at": datetime.now().isoformat(timespec="seconds")}
    data["latest"][name] = record
    data["history"].append({"name": name, **record})
    _write_json(path, data)
    return path


def _write_json(path, data):
    """Write via a temporary file and rename, so a crash never leaves a broken file."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, path)


# --- pad-target maths --------------------------------------------------------------

# Corner directions in image axes (+x right, +y down)
CORNERS = {
    "center": (0, 0),
    "bottom_left": (-1, +1),
    "bottom_right": (+1, +1),
    "top_left": (-1, -1),
    "top_right": (+1, -1),
}


def corner_target(pad_w_um, pad_h_um, corner, inset_um):
    """Where the needle should land, relative to the pad centre (image axes, um):
    `inset_um` inside the pad from both edges of `corner` ("center": the centre)."""
    if corner not in CORNERS:
        raise ValueError(f"unknown corner '{corner}', use one of {sorted(CORNERS)}")
    sx, sy = CORNERS[corner]
    if corner != "center" and (inset_um <= 0 or inset_um >= min(pad_w_um, pad_h_um) / 2):
        raise ValueError(f"inset_um={inset_um} must be > 0 and smaller than half the pad "
                         f"({pad_w_um:.1f} x {pad_h_um:.1f} um)")
    return sx * (pad_w_um / 2 - inset_um), sy * (pad_h_um / 2 - inset_um)


def is_round(mark, max_aspect):
    """A mark is round if its box is no more elongated than max_aspect (long / short side)."""
    w, h = float(mark["w_um"]), float(mark["h_um"])
    return min(w, h) > 0 and max(w, h) / min(w, h) <= max_aspect


def pad_target_offset(pads, corner, inset_um, max_aspect=1.5):
    """Needle displacement that brings the mark of every pad to its target.

    A pad is used only if it has exactly one mark, the mark is round and it does
    not touch the pad edge. For each used pad p (image axes, um):
        target_p     = corner_target(pad size_p, corner, inset_um)
        displacement = target_p - mark offset_p
    The result is the median over the used pads, robust to a few odd pads.

    Returns a dict: dx_um, dy_um (displacement), center_dx_um, center_dy_um
    (displacement that would centre the needle), spread_um (95th percentile of the
    pads' distance from the median displacement), n_used, n_pads, rejected
    ([[pad index, reason], ...]).
    """
    used, rejected = [], []
    for pad in pads:
        index, marks = pad["index"], pad["marks"]
        if len(marks) != 1:
            rejected.append([index, f"{len(marks)} marks"])
            continue
        mark = marks[0]
        if not is_round(mark, max_aspect):
            rejected.append([index, f"mark not round ({mark['w_um']} x {mark['h_um']} um)"])
            continue
        if mark.get("at_edge"):
            rejected.append([index, "mark at the pad edge"])
            continue
        tx, ty = corner_target(pad["size_um"][0], pad["size_um"][1], corner, inset_um)
        used.append((tx - mark["dx_um"], ty - mark["dy_um"], -mark["dx_um"], -mark["dy_um"]))

    result = {"n_used": len(used), "n_pads": len(pads), "rejected": rejected}
    if not used:
        return result
    dx, dy = median(u[0] for u in used), median(u[1] for u in used)
    distances = sorted(((u[0] - dx) ** 2 + (u[1] - dy) ** 2) ** 0.5 for u in used)
    result.update({
        "dx_um": round(dx, 2), "dy_um": round(dy, 2),
        "center_dx_um": round(median(u[2] for u in used), 2),
        "center_dy_um": round(median(u[3] for u in used), 2),
        "spread_um": round(distances[min(len(distances) - 1, int(0.95 * len(distances)))], 2),
    })
    return result
