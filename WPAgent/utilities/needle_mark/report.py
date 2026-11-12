"""Outputs: overlay image, CSV (one row per mark), JSON (full result) and,
on request, the contrast image (what the mark detection sees)."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import cv2
import numpy as np

from .analysis import MULTIPLE_MARKS, NO_MARK, SINGLE_MARK, Analysis
from .image import Image
from .marks import classify_regions, pad_maps

# BGR colours (overlay): pad outline per verdict, mark boxes
VERDICT_COLOURS = {
    NO_MARK: (160, 160, 160),     # grey
    SINGLE_MARK: (0, 200, 0),     # green
    MULTIPLE_MARKS: (0, 140, 255),  # orange
}
MARK_COLOUR = (255, 0, 255)       # magenta
EDGE_MARK_COLOUR = (0, 0, 255)    # red: mark reaching the pad edge

# BGR colours of the contrast image outlines
EDGE_BAND_COLOUR = (255, 0, 0)    # blue: limit of the ignored pad edge band
REGION_COLOUR = (255, 255, 0)     # cyan: region accepted as a mark
REJECTED_COLOUR = (0, 0, 255)     # red: region rejected (too small and/or too faint)
FINAL_COLOUR = (255, 255, 255)    # white: box of every reported mark
NEAR_MISS_COLOUR = (0, 255, 255)  # yellow: box of a near miss (rejected on one criterion only)

CSV_COLUMNS = [
    "pad_index", "verdict", "pad_at_edge", "pad_x_px", "pad_y_px", "pad_w_px", "pad_h_px", "pad_size_ok",
    "n_marks", "mark_index", "at_edge", "cx_px", "cy_px", "dx_px", "dy_px", "dx_pct", "dy_pct", "area_px", "clearance_px",
    "contrast", "peak_ratio", "dx_um", "dy_um", "w_um", "h_um", "area_um2", "area_pct_of_pad", "clearance_um",
]


def write_outputs(result: Analysis, image: Image, out_dir: str | Path, stem: str | None = None,
                  contrast: bool = False) -> dict:
    """Write <stem>_overlay.tif, <stem>_marks.csv, <stem>_marks.json and, with
    contrast=True, <stem>_contrast.tif. Returns their paths."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = stem or (image.path.stem if image.path else "image")
    paths = {
        "overlay": out_dir / f"{stem}_overlay.tif",
        "csv": out_dir / f"{stem}_marks.csv",
        "json": out_dir / f"{stem}_marks.json",
    }
    if contrast:
        paths["contrast"] = out_dir / f"{stem}_contrast.tif"
        cv2.imwrite(str(paths["contrast"]), draw_contrast(image.bgr, result))
    cv2.imwrite(str(paths["overlay"]), draw_overlay(image.bgr, result))
    write_csv(result, paths["csv"])
    with open(paths["json"], "w") as f:
        json.dump(result.to_dict(), f, indent=2)
    return {k: str(v) for k, v in paths.items()}


def write_csv(result: Analysis, path: str | Path) -> None:
    """One row per mark; a pad without marks gets one row with empty mark columns."""
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for pad in result.to_dict()["pads"]:
            x, y, w, h = pad["box_px"]
            base = {"pad_index": pad["index"], "verdict": pad["verdict"], "pad_at_edge": pad["at_edge"],
                    "pad_x_px": x,
                    "pad_y_px": y, "pad_w_px": w, "pad_h_px": h, "pad_size_ok": pad["size_ok"],
                    "n_marks": pad["n_marks"]}
            if not pad["marks"]:
                writer.writerow(base)
            for i, mark in enumerate(pad["marks"], start=1):
                row = {k: mark[k] for k in CSV_COLUMNS if k in mark}
                writer.writerow({**base, "mark_index": i, **row})


def draw_overlay(bgr: np.ndarray, result: Analysis) -> np.ndarray:
    """Full-resolution copy of the image with pads outlined in their verdict
    colour, the pad number to their left, and every mark boxed: magenta, or
    red if it reaches the pad edge."""
    overlay = bgr.copy()
    if not result.pads:
        return overlay
    pad_h = float(np.median([r.pad.box[3] for r in result.pads]))
    thick = max(1, round(pad_h / 40))
    font = max(0.3, pad_h / 60)

    for r in result.pads:
        corners = np.round(cv2.boxPoints(r.pad.rect)).astype(np.int32)
        cv2.polylines(overlay, [corners], True, VERDICT_COLOURS[r.verdict], thick)
        x, y, _, h = r.pad.box
        label = str(r.pad.index)
        (tw, _), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font, thick)
        cv2.putText(overlay, label, (max(0, x - tw - 2 * thick), y + h // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, font, VERDICT_COLOURS[r.verdict], thick)
        for m, at_edge in zip(r.marks, r.at_edge):
            colour = EDGE_MARK_COLOUR if at_edge else MARK_COLOUR
            mx, my, mw, mh = m.box
            cv2.rectangle(overlay, (mx, my), (mx + mw - 1, my + mh - 1), colour, max(1, thick // 2))
            cv2.circle(overlay, (round(m.cx), round(m.cy)), thick, colour, -1)
    return overlay


def draw_contrast(bgr: np.ndarray, result: Analysis) -> np.ndarray:
    """What the mark detection sees, for inspection and tuning.

    Outside the pads: the image, dimmed. Inside each pad: the colour distance
    from the pad colour (marks.pad_maps) as a heat map, black = pad colour,
    purple -> orange -> yellow = increasingly different. Outlines:
    blue = edge band limit, cyan = regions accepted as marks, red = regions
    rejected (too small and/or too faint), white boxes = reported marks,
    yellow boxes = near misses (rejected on one criterion only).
    """
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    out = cv2.cvtColor((gray * 0.4).astype(np.uint8), cv2.COLOR_GRAY2BGR)
    for r in result.pads:
        x, y, w, h = r.pad.box
        maps = pad_maps(bgr, r.pad, result.config)
        heat = cv2.applyColorMap(np.clip(maps.diff, 0, 255).astype(np.uint8), cv2.COLORMAP_INFERNO)
        view = out[y:y + h, x:x + w]               # a view: drawing on it draws on `out`
        on_pad = maps.dist_to_edge > 0
        view[on_pad] = heat[on_pad]
        _outline(view, maps.inside, EDGE_BAND_COLOUR)
        regions = classify_regions(maps, result.config, result.um_per_px, r.pad, result.reference_threshold)
        for label, _, reasons in regions:
            _outline(view, maps.regions == label, REJECTED_COLOUR if reasons else REGION_COLOUR)
        boxes = [(m, FINAL_COLOUR) for m in r.marks] + [(m, NEAR_MISS_COLOUR) for m, _ in r.near_misses]
        for m, colour in boxes:
            mx, my, mw, mh = m.box
            cv2.rectangle(out, (mx - 1, my - 1), (mx + mw, my + mh), colour, 1)
    return out


def _outline(view: np.ndarray, mask: np.ndarray, colour: tuple) -> None:
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(view, contours, -1, colour, 1)
