"""
WPDieGrid - die pitch maths for precise die moves (no prober access).

The die size (pitch) comes from the SENTIO wafer map of the open project
(map:get_index_size). Which chuck direction a column / row step goes (axis and
sign, depends on the map orientation and the machine) is LEARNED during every
precise move, no separate calibration:

    1. SENTIO step_die to the reference die  -> home position A
    2. SENTIO step_die to the target die     -> home position B
    3. B - A = d_col * col_step + d_row * row_step (+ a few um of stage error):
       compared with d_col * die width / d_row * die height it tells the axis and
       the sign of each step (learn_steps)
    4. target = reference XY + d_col * col_step + d_row * row_step (exact pitches),
       reached by the closed-loop MoveChuckXYPrecise

The learned steps are remembered in Contacting/<projectName>/die_grid.json, only to
decide the rare ambiguous case (|d_col| * width == |d_row| * height, both non-zero).
"""

import json
import os
from datetime import datetime

from utilities.WPContacting import contacting_folder, _write_json

GRID_FILE = "die_grid.json"


# --- storage -------------------------------------------------------------------

def grid_path(project):
    """Contacting/<project>/die_grid.json"""
    return os.path.join(contacting_folder(project), GRID_FILE)


def load_grid(project):
    """Steps learned by earlier precise moves of the project ({} if none yet)."""
    path = grid_path(project)
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_grid(project, record):
    """Merge `record` into die_grid.json. Returns the file path."""
    data = {**load_grid(project), **record,
            "saved_at": datetime.now().isoformat(timespec="seconds")}
    path = grid_path(project)
    _write_json(path, data)
    return path


# --- maths ---------------------------------------------------------------------

def _sign(v):
    return 1.0 if v > 0 else -1.0


def learn_steps(d_col, d_row, dx, dy, die_w, die_h, tolerance_um=50.0):
    """Possible (col_step, row_step) from one SENTIO die-to-die displacement.

    d_col, d_row: die index difference; dx, dy: measured chuck displacement (um)
    between the two die home positions; die_w / die_h: map die size (um).
    A step whose index difference is 0 cannot be learned and is None.
    Returns a list of candidates: [] = the displacement does not match the die
    size (wrong map setup), 2 = ambiguous (both chuck-axis assignments fit).
    """
    d_col, d_row = int(d_col), int(d_row)
    w, h = abs(float(die_w)), abs(float(die_h))
    if w <= 0 or h <= 0:
        raise ValueError(f"die size {die_w} x {die_h} um is not set in the wafer map")
    tol = float(tolerance_um)
    cands = []
    # columns along chuck X, rows along chuck Y (the usual case) / swapped
    for col_axis in (0, 1):
        col_d = (dx, dy)[col_axis]
        row_d = (dx, dy)[1 - col_axis]
        if abs(abs(col_d) - abs(d_col) * w) > tol or abs(abs(row_d) - abs(d_row) * h) > tol:
            continue
        col_step = row_step = None
        if d_col:
            v = _sign(col_d) * _sign(d_col) * w
            col_step = (v, 0.0) if col_axis == 0 else (0.0, v)
        if d_row:
            v = _sign(row_d) * _sign(d_row) * h
            row_step = (0.0, v) if col_axis == 0 else (v, 0.0)
        cand = (col_step, row_step)
        if cand not in cands:
            cands.append(cand)
    return cands


def choose_steps(cands, known):
    """Pick one candidate of learn_steps; `known` = die_grid.json content decides
    an ambiguous case. Raises ValueError("no candidate" / "ambiguous")."""
    if not cands:
        raise ValueError("no candidate")
    if len(cands) == 1:
        return cands[0]
    kc, kr = known.get("col_step_um"), known.get("row_step_um")
    if kc is None and kr is None:
        raise ValueError("ambiguous")
    fits = [c for c in cands
            if (c[0] is None or kc is None or list(c[0]) == list(kc))
            and (c[1] is None or kr is None or list(c[1]) == list(kr))]
    if len(fits) == 1:
        return fits[0]
    raise ValueError("ambiguous")


def die_offset_um(d_col, d_row, col_step, row_step):
    """Chuck displacement (dx, dy) in um for d_col columns and d_row rows."""
    cx, cy = col_step if col_step else (0.0, 0.0)
    rx, ry = row_step if row_step else (0.0, 0.0)
    return d_col * cx + d_row * rx, d_col * cy + d_row * ry
