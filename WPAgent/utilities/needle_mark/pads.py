"""Pad detection: find the vertical column of rectangular pads.

Pipeline (detect_pads):
  1. segment()          binary mask of "pad-like" pixels, for one method/polarity
  2. _find_candidates() rectangular blobs in that mask
  3. _columns()         chain blobs into vertical columns, clean them up
  4. _score()           keep the column that best matches the expected pad count
                        and has the most regular pitch
With method/polarity = "auto", steps 1-4 run for every combination and the
best-scoring column overall wins.

Design sizes (Config.pad_sizes_um) are used to bound the candidate blob size,
to estimate the pixel size from the pads (estimate_um_per_px) and to check every
pad against the design (match_design).
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from .config import METHODS, POLARITIES, Config, NeedleMarkError

_MAX_SIZE_RATIO = 2.5   # a pad more than 2.5x larger/smaller than the column median is junk
_GAP_SPLIT = 2.5        # a gap > 2.5x the median pitch splits a column in two
_MIN_COLUMN = 3         # fewer pads than this is not a column
_AREA_FRAC = (5e-5, 0.5)  # candidate area limits (x image area) when the design size is unknown
_AREA_MARGIN = 2.0        # ... else between design area / 2 and design area x 2


@dataclass(frozen=True)
class Pad:
    index: int                      # 1 = top of the image
    box: tuple[int, int, int, int]  # axis-aligned bounding box x, y, w, h (px)
    rect: tuple                     # rotated rectangle ((cx, cy), (w, h), angle), cv2.minAreaRect

    @property
    def center(self) -> tuple[float, float]:
        return self.rect[0]


@dataclass(frozen=True)
class PadDetection:
    pads: list[Pad]
    method: str        # segmentation method that produced the pads
    polarity: str
    pitch_px: float    # median vertical distance between consecutive pads
    pitch_cv: float    # std/mean of that distance: ~0 for a regular column
    score: float       # lower is better (see _score)


def detect_pads(bgr: np.ndarray, cfg: Config, um_per_px: float | None = None) -> PadDetection:
    """Find the pad column. With a pixel size and design pad sizes, candidate
    blobs must be within a factor 2 of a design pad area."""
    methods = METHODS if cfg.method == "auto" else (cfg.method,)
    polarities = POLARITIES if cfg.polarity == "auto" else (cfg.polarity,)

    if um_per_px and cfg.pad_sizes_um:
        areas = [x * y / um_per_px ** 2 for x, y in cfg.pad_sizes_um]
        area_range = (min(areas) / _AREA_MARGIN, max(areas) * _AREA_MARGIN)
    else:
        area_range = (_AREA_FRAC[0] * bgr[..., 0].size, _AREA_FRAC[1] * bgr[..., 0].size)

    best = None
    for method in methods:
        for polarity in polarities:
            candidates = _find_candidates(segment(bgr, method, polarity), area_range)
            for column in _columns(candidates, cfg.column_tolerance):
                score = _score(column, cfg.expected_pads)
                if best is None or score < best[0]:
                    best = (score, column, method, polarity)

    if best is None:
        raise NeedleMarkError("no vertical column of pads found")

    score, column, method, polarity = best
    column = sorted(column, key=lambda p: p.box[1])
    pads = [Pad(i, p.box, p.rect) for i, p in enumerate(column, start=1)]
    pitch = np.diff([p.box[1] for p in pads])
    return PadDetection(pads, method, polarity,
                        pitch_px=float(np.median(pitch)),
                        pitch_cv=float(pitch.std() / pitch.mean()),
                        score=float(score))


# --- 1. segmentation -------------------------------------------------------

def segment(bgr: np.ndarray, method: str, polarity: str) -> np.ndarray:
    """Binary mask (255 = pad) for one segmentation method.

    gray    pads are the dark (or light) class of the grayscale image
    chroma  pads are the neutral (grey) class against a coloured background
    black   pads are both dark and neutral
    bgdiff  pads are whatever differs from the dominant (background) colour
    """
    dark = polarity == "dark"
    if method == "gray":
        mask = _otsu(_gray(bgr), foreground_low=dark)
    elif method == "chroma":
        mask = _otsu(_chroma(bgr), foreground_low=dark)
    elif method == "black":
        mask = _otsu(_gray(bgr), foreground_low=dark) & _otsu(_chroma(bgr), foreground_low=True)
    elif method == "bgdiff":
        mask = _otsu(_background_distance(bgr), foreground_low=not dark)
    else:
        raise NeedleMarkError(f"unknown method {method!r}")
    # Light opening removes specks. No closing: it would bridge the thin
    # gaps between neighbouring pads and fuse them into one blob.
    return cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))


def _otsu(signal: np.ndarray, foreground_low: bool) -> np.ndarray:
    kind = cv2.THRESH_BINARY_INV if foreground_low else cv2.THRESH_BINARY
    _, mask = cv2.threshold(cv2.GaussianBlur(signal, (5, 5), 0), 0, 255, kind + cv2.THRESH_OTSU)
    return mask


def _gray(bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)


def _chroma(bgr: np.ndarray) -> np.ndarray:
    """Colourfulness max(B,G,R) - min(B,G,R): ~0 for grey/black/white pixels."""
    return (bgr.max(axis=2) - bgr.min(axis=2)).astype(np.uint8)


def _background_distance(bgr: np.ndarray) -> np.ndarray:
    """Colour distance of every pixel from the image's median (background) colour."""
    sample = bgr[::4, ::4].reshape(-1, 3)
    background = np.median(sample, axis=0).astype(np.float32)
    dist = np.linalg.norm(bgr.astype(np.float32) - background, axis=2)
    return (dist * (255.0 / max(float(dist.max()), 1e-6))).astype(np.uint8)


# --- 2. candidate blobs ----------------------------------------------------

def _find_candidates(mask: np.ndarray, area_range: tuple[float, float]) -> list[Pad]:
    """Rectangular blobs with an area in area_range (index = 0, assigned later)."""
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    lo, hi = area_range
    candidates = []
    for contour in contours:
        area = cv2.contourArea(contour)    # outer contour: holes (bright marks) count as pad
        if not lo <= area <= hi:
            continue
        rect = cv2.minAreaRect(contour)
        if area < 0.5 * rect[1][0] * rect[1][1]:
            continue                        # less than half-filled: not a rectangle
        candidates.append(Pad(0, cv2.boundingRect(contour), rect))
    return candidates


# --- 3. columns ------------------------------------------------------------

def _columns(candidates: list[Pad], tolerance: float) -> list[list[Pad]]:
    """All plausible columns: each chained column and its pieces split at big gaps."""
    result = []
    for column in _chain_columns(candidates, tolerance):
        column = _drop_size_outliers(column)
        pieces = _split_at_gaps(column)
        for col in [column] + (pieces if len(pieces) > 1 else []):
            if len(col) >= _MIN_COLUMN:
                result.append(col)
    return result


def _chain_columns(candidates: list[Pad], tolerance: float) -> list[list[Pad]]:
    """Group blobs into columns, top to bottom, by their LEFT edge.

    A blob joins the column whose last pad's left edge is closest, if within
    `tolerance` x that pad's width. Comparing with the last pad (not a fixed x)
    follows a column that drifts slowly sideways in a slightly rotated image.
    Left edge, not centre: narrower pads in the column are left-aligned.
    """
    columns: list[list[Pad]] = []
    for pad in sorted(candidates, key=lambda p: p.box[1]):
        x = pad.box[0]
        near = [c for c in columns if abs(x - c[-1].box[0]) <= tolerance * c[-1].box[2]]
        if near:
            min(near, key=lambda c: abs(x - c[-1].box[0])).append(pad)
        else:
            columns.append([pad])
    return columns


def _drop_size_outliers(column: list[Pad]) -> list[Pad]:
    """Drop blobs far from the median size (merged pads, specks). Loose on
    purpose: a column can legitimately mix rectangular and squarer pads."""
    if len(column) < _MIN_COLUMN:
        return column
    med_w = np.median([p.box[2] for p in column])
    med_h = np.median([p.box[3] for p in column])

    def ratio(a, b):
        return max(a / b, b / a)

    return [p for p in column
            if ratio(p.box[2], med_w) <= _MAX_SIZE_RATIO and ratio(p.box[3], med_h) <= _MAX_SIZE_RATIO]


def _split_at_gaps(column: list[Pad]) -> list[list[Pad]]:
    """Split where the gap to the next pad is much larger than the median pitch,
    e.g. label text above the pads that happens to share their left edge."""
    if len(column) < 4:
        return [column]
    gaps = np.diff([p.box[1] for p in column])
    limit = _GAP_SPLIT * np.median(gaps)
    pieces = [[column[0]]]
    for pad, gap in zip(column[1:], gaps):
        if gap > limit:
            pieces.append([])
        pieces[-1].append(pad)
    return pieces


# --- 4. scoring --------------------------------------------------------------

def _score(column: list[Pad], expected: int) -> float:
    """Lower is better. The count match dominates (we know the pad count), then
    pitch regularity, then (lightly) size uniformity. Without an expected count,
    the longest regular column wins."""
    gaps = np.diff([p.box[1] for p in column])
    if gaps.mean() <= 0:
        return float("inf")
    pitch_cv = gaps.std() / gaps.mean()
    areas = np.array([p.box[2] * p.box[3] for p in column], dtype=float)
    area_cv = areas.std() / areas.mean()
    if expected:
        count_term = 20.0 * abs(len(column) - expected) / expected
    else:
        count_term = -len(column)
    return count_term + pitch_cv + 0.2 * area_cv


# --- design sizes ------------------------------------------------------------

def match_design(pad: Pad, um_per_px: float, sizes: tuple) -> tuple[tuple[float, float], float]:
    """Closest design size to the pad's measured size, and the larger of the
    x / y differences (µm). Uses the axis-aligned box: fine for small rotations."""
    w, h = pad.box[2] * um_per_px, pad.box[3] * um_per_px
    errors = [max(abs(w - x), abs(h - y)) for x, y in sizes]
    best = int(np.argmin(errors))
    return sizes[best], float(errors[best])


def estimate_um_per_px(pads: list[Pad], sizes: tuple) -> float:
    """Pixel size from the pads themselves: each pad is matched to the design
    size with the closest aspect ratio, and gives design / measured size.
    The median over the column is robust to a few odd pads."""
    estimates = []
    for pad in pads:
        w, h = pad.box[2], pad.box[3]
        x, y = min(sizes, key=lambda s: abs(np.log((s[0] / s[1]) / (w / h))))
        estimates.append((x / w + y / h) / 2)
    return float(np.median(estimates))
