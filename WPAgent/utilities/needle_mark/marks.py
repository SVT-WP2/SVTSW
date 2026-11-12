"""Needle-mark detection inside one pad.

pad_maps():
  1. Build the pad's own mask from its rotated rectangle and the distance of
     every pixel to the pad edge (_pad_distance).
  2. Ignore a thin border (edge_px): the blurred / JPEG-ringing pad edge.
  3. DETECT: reference colour = median colour of the pad. A pixel stands out
     from the pad if its colour distance from the reference is above an
     ABSOLUTE threshold:  max(min_contrast, typical + noise_k * noise sigma).
     A clean pad therefore yields no marks (no per-pad contrast stretching).
  4. REGIONS: contiguous standing-out pixels form one region (8-connected).
     Nothing is merged across pad-coloured pixels.

classify_regions(), for every region:
  5. MEASURE the region as a whole, holes filled: the box embraces every
     contiguous standing-out pixel, so an elongated mark keeps its faint tail,
     and a ring-shaped scrub (centre close to the pad colour) counts as solid.
     Centroid, offset, area, box, clearance to the pad edge, contrast.
  6. ACCEPT the region as a mark only if it is
       - solid: at least a circle of min_mark_diameter_um (area, width and
         height). Sparse specks of silicon irregularities are separate tiny
         regions, each rejected; and
       - strong: its peak reaches peak_factor x the reference threshold,
         i.e. it has a clearly marked centre, not only a faint haze. The
         reference is the median detection threshold of all pads in the image
         (peak_reference = "image"), so a noisier pad does not raise the bar
         for its own marks; or the pad's own threshold (peak_reference = "pad").
     Regions failing only one of the two are kept as near misses, so a missed
     mark can be diagnosed from the results.
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from .config import Config
from .pads import Pad


@dataclass(frozen=True)
class Mark:
    cx: float                       # centroid of the (filled) region, image px
    cy: float
    dx_px: float                    # offset from the pad centre, image axes:
    dy_px: float                    # (+x = right, +y = DOWN)
    area_px: int                    # pixel count of the region, holes filled
    box: tuple[int, int, int, int]  # bounding box x, y, w, h (image px)
    clearance_px: float             # smallest distance from the region to the pad edge
    contrast: float                 # peak colour distance above the pad's typical level
    peak_ratio: float               # peak / reference threshold (accepted if >= peak_factor)


@dataclass(frozen=True)
class PadMarks:
    marks: list[Mark]                    # accepted marks, largest first
    near_misses: list[tuple[Mark, str]]  # regions failing one criterion: (region, "too small" / "too faint")
    threshold: float                     # detection threshold of this pad


@dataclass(frozen=True)
class PadMaps:
    """Per-pixel maps of one pad (pad bounding-box coordinates), as used by
    find_marks(); also drawn by report.draw_contrast() for inspection."""
    diff: np.ndarray          # colour distance from the pad colour
    dist_to_edge: np.ndarray  # distance to the pad edge (px), 0 outside the pad
    inside: np.ndarray        # analysed pixels (pad minus the edge band)
    regions: np.ndarray       # label of the contiguous region of every standing-out pixel, 0 = none
    typical: float            # typical colour distance of the pad
    threshold: float          # detection threshold


def pad_maps(bgr: np.ndarray, pad: Pad, cfg: Config) -> PadMaps:
    """Steps 1-4: pad geometry, colour distance, contiguous regions."""
    x, y, w, h = pad.box
    crop = bgr[y:y + h, x:x + w].astype(np.float32)
    dist_to_edge = _pad_distance(pad)
    inside = dist_to_edge > cfg.edge_px
    if not inside.any():
        inside = dist_to_edge > 0

    # 3. detect: colour distance from the pad colour, absolute threshold
    reference = np.median(crop[inside], axis=0)
    diff = cv2.GaussianBlur(np.linalg.norm(crop - reference, axis=2), (3, 3), 0)
    typical = float(np.median(diff[inside]))
    sigma = 1.4826 * float(np.median(np.abs(diff[inside] - typical)))   # robust std (MAD)
    threshold = max(cfg.min_contrast, typical + cfg.noise_k * sigma)

    # 4. contiguous regions of standing-out pixels
    standing_out = ((diff > threshold) & inside).astype(np.uint8)
    _, regions = cv2.connectedComponents(standing_out, connectivity=8)
    return PadMaps(diff, dist_to_edge, inside, regions, typical, threshold)


def find_marks(maps: PadMaps, pad: Pad, cfg: Config, um_per_px: float,
               reference_threshold: float | None = None) -> PadMarks:
    """Marks of one pad (from its pad_maps()), plus the near misses.
    reference_threshold: what peak_factor multiplies; default the pad's own threshold."""
    marks, near_misses = [], []
    for _, mark, reasons in classify_regions(maps, cfg, um_per_px, pad, reference_threshold):
        if not reasons:
            marks.append(mark)
        elif len(reasons) == 1:
            near_misses.append((mark, reasons[0]))
    return PadMarks(sorted(marks, key=lambda m: -m.area_px), near_misses, maps.threshold)


def classify_regions(maps: PadMaps, cfg: Config, um_per_px: float, pad: Pad,
                     reference_threshold: float | None = None):
    """Steps 5-6 for every region: yields (label, mark, reasons); no reasons = accepted."""
    reference = reference_threshold or maps.threshold
    min_size = cfg.min_mark_diameter_um / um_per_px     # px
    min_area = np.pi * (min_size / 2) ** 2
    for label in range(1, int(maps.regions.max()) + 1):
        region = (maps.regions == label).astype(np.uint8)
        peak = float(np.percentile(maps.diff[region > 0], 95))   # robust to a few hot pixels

        # 5. the whole region, holes filled
        contours, _ = cv2.findContours(region, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cv2.drawContours(region, contours, -1, 1, cv2.FILLED)
        ys, xs = np.nonzero(region)
        mark = _measure(xs, ys, peak, reference, maps, pad)

        # 6. solid and strong
        _, _, w, h = mark.box
        reasons = []
        if mark.area_px < min_area or w < min_size or h < min_size:
            reasons.append("too small")
        if mark.peak_ratio < cfg.peak_factor:
            reasons.append("too faint")
        yield label, mark, reasons


def _measure(xs, ys, peak, reference, maps: PadMaps, pad: Pad) -> Mark:
    """Mark from its pixels (crop coordinates)."""
    x0, y0 = pad.box[:2]
    cx, cy = x0 + xs.mean(), y0 + ys.mean()
    pcx, pcy = pad.center
    return Mark(
        cx=float(cx), cy=float(cy),
        dx_px=float(cx - pcx), dy_px=float(cy - pcy),
        area_px=int(len(xs)),
        box=(int(x0 + xs.min()), int(y0 + ys.min()), int(np.ptp(xs) + 1), int(np.ptp(ys) + 1)),
        clearance_px=float(maps.dist_to_edge[ys, xs].min()),
        contrast=peak - maps.typical,
        peak_ratio=peak / reference,
    )


def _pad_distance(pad: Pad) -> np.ndarray:
    """For every pixel of the pad's bounding box: distance (px) to the pad edge,
    0 outside the pad. Using the rotated rectangle (not the bounding box) keeps
    background corners of a slightly rotated pad out of the analysis."""
    x, y, w, h = pad.box
    (cx, cy), size, angle = pad.rect
    corners = cv2.boxPoints(((cx - x, cy - y), size, angle))
    mask = np.zeros((h, w), np.uint8)
    cv2.fillConvexPoly(mask, np.round(corners).astype(np.int32), 255)
    # pad the mask with a zero border so the box edge counts as pad edge
    mask = cv2.copyMakeBorder(mask, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    return cv2.distanceTransform(mask, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)[1:-1, 1:-1]
