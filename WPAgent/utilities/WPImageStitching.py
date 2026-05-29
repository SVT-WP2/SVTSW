"""
WPImageStitching_fixed.py  —  v3  (Global Position Optimisation)
=================================================================
Drop-in replacement for WPImageStitching.py with the same stitch_images() API.

Algorithm
---------
The old sequential approach (build row composites, then stack rows) accumulated
pairwise measurement errors and gave *different* results from the rows-path vs
the cols-path — a direct sign of inconsistency.

The new approach:

  Step 1  Measure every adjacent pair (horizontal AND vertical) with
          phase correlation → N pairwise (dx, dy) offsets.

  Step 2  Solve ONE global least-squares system for all tile positions
          simultaneously.  For a 5×5 grid: ~40 equations, 24 unknowns.
          Measurement noise averages out; the solution is self-consistent.

  Step 3  Wavefront composition: iterate tiles in raster order, placing each
          one directly onto the growing canvas.  Each tile sees BOTH its left
          neighbour (V-seam) and its top neighbour (H-seam) simultaneously,
          so interior tiles blend at two edges at once.  The corner region
          uses a combined mask: canvas owns the top-left quadrant, tile owns
          everything else.

Result: a single, self-consistent output; interior tiles reference real
stitched content from both neighbours, eliminating corner artefacts that
accumulate in the old row-composite + stack approach.

Naming convention : 00_00.jpg  (row_col, zero-padded, underscore separator)
Entry point       : stitch_images(folder=...)   — same call as before
"""

import cv2
import numpy as np
import os
from pathlib import Path


# ==============================================================================
# DEFAULT CONFIG  (override via function arguments)
# ==============================================================================

_IMAGE_WIDTH_PX  = 2464
_IMAGE_HEIGHT_PX = 2056
_UM_PER_PX       = 1.417
_STAGE_MOVE_X_UM = 2967
_STAGE_MOVE_Y_UM = 2476
_TOLERANCE_PX    = 5
_JPEG_QUALITY    = 95
_N_PEAKS         = 5       # API compat, not used
_PYRAMID_LEVELS  = 4       # API compat, not used
_FEATHER_PX      = 35      # half-width of blend band around cut (px)

_CUT_MARGIN = 20           # min px from overlap edge for seam cut
_EQUIV_COST_MARGIN = 0.05  # V-seam (left/right tiles): candidate cuts within 5 %
                           # of min SAD are equivalent; smallest x_cut is chosen.
_EQUIV_COST_MARGIN_H = 0.30 # H-seam (top/bottom tiles): wider 30 % window.
                           # Periodic histology tissue creates multiple cost aliases
                           # one tissue-period apart; the deepest (largest row) alias
                           # within this window is chosen, placing the seam as close
                           # to the physical tile boundary as possible.
_DX_TOLERANCE_V = 20      # search range (px) for horizontal offset in vertical pairs
                           # must be larger than _TOLERANCE_PX because no horizontal
                           # stage command is issued between rows, so stage drift /
                           # sample rotation can produce dx values of 10-15 px.
_DY_TOLERANCE_V = 50      # search range (px) for vertical shift in vertical pairs.
                           # The commanded step_y sets the nominal overlap; the actual
                           # stage landing can differ by 40+ px on this microscope
                           # (confirmed by brute-force SAD scan: true fdy ≈ −43 px,
                           # well outside the _TOLERANCE_PX = 5 window).  Using
                           # tolerance=5 returns a noise peak and gives the wrong dy.


# ==============================================================================
# I/O
# ==============================================================================

def _load_grid_images(folder):
    images = {}
    for fp in Path(folder).glob("*.jp*g"):
        parts = fp.stem.split("_")
        if len(parts) == 2:
            try:
                r, c = int(parts[0]), int(parts[1])
                img  = cv2.imread(str(fp))
                if img is not None:
                    images[(r, c)] = img
                    print(f"  Loaded [{r},{c}]  {img.shape[1]}x{img.shape[0]} px")
            except ValueError:
                pass
    return images


def _normalize_orientations(images, tw, th):
    fixed = {}
    for key, img in images.items():
        h, w = img.shape[:2]
        if w == th and h == tw:
            img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
            print(f"  WARNING: [{key[0]},{key[1]}] rotated")
        elif w != tw or h != th:
            print(f"  WARNING: [{key[0]},{key[1]}] unexpected size {w}x{h}, skipping")
            continue
        fixed[key] = img
    return fixed


# ==============================================================================
# PHASE CORRELATION
# ==============================================================================

def _phase_corr_peak(strip1, strip2, tolerance, tolerance_x=None):
    """Hann-windowed phase correlation; returns (fine_dx, fine_dy).

    tolerance   : search radius in y (rows).
    tolerance_x : search radius in x (cols); defaults to tolerance.
                  Pass a larger value (e.g. _DX_TOLERANCE_V) when measuring
                  the horizontal offset of vertically-adjacent tiles where
                  the true dx can exceed the normal ±5 px fine window.
    """
    g1 = cv2.cvtColor(strip1, cv2.COLOR_BGR2GRAY).astype(np.float32)
    g2 = cv2.cvtColor(strip2, cv2.COLOR_BGR2GRAY).astype(np.float32)
    sh, sw  = g1.shape
    tol_y   = tolerance
    tol_x   = tolerance_x if tolerance_x is not None else tolerance
    win  = np.outer(np.hanning(sh), np.hanning(sw)).astype(np.float32)
    g1  *= win;  g2 *= win
    R    = np.fft.fft2(g1) * np.conj(np.fft.fft2(g2))
    R   /= np.abs(R) + 1e-8
    corr = np.fft.ifft2(R).real
    mask = np.zeros_like(corr)
    yi   = [d % sh for d in range(-tol_y, tol_y + 1)]
    xi   = [d % sw for d in range(-tol_x, tol_x + 1)]
    mask[np.ix_(yi, xi)] = 1.0
    cm   = corr * mask
    p    = np.unravel_index(np.argmax(cm), corr.shape)
    fdy  = p[0] if p[0] < sh // 2 else p[0] - sh
    fdx  = p[1] if p[1] < sw // 2 else p[1] - sw
    return fdx, fdy


def _subwindow_dy(st, sb, tolerance):
    """Median dy (and dx) from near-square sub-windows of a short/wide Y overlap strip.

    Each sub-window is roughly square so that both horizontal and vertical
    phase-correlation peaks are well-conditioned.

    The dx search uses a wider tolerance (_DX_TOLERANCE_V) because the
    commanded stage movement between rows has no horizontal component, so
    the total horizontal offset between tiles can exceed the fine ±tolerance
    window used for dy.

    Returns (median_dy, n, std, raw_dys, x_centers).
    The median dx across sub-windows is stored in _subwindow_dy.last_dx
    so _measure_pair_v can retrieve it without a separate call.
    """
    sh, sw = st.shape[:2]
    n  = max(1, sw // sh)
    raw_dy, raw_dx, x_centers = [], [], []
    for i in range(n):
        x0 = i * (sw // n)
        x1 = (i + 1) * (sw // n) if i < n - 1 else sw
        fdx, fdy = _phase_corr_peak(st[:, x0:x1], sb[:, x0:x1],
                                    tolerance, tolerance_x=_DX_TOLERANCE_V)
        raw_dy.append(fdy)
        raw_dx.append(fdx)
        x_centers.append((x0 + x1) / 2.0)
    raw_dy    = np.array(raw_dy,    dtype=np.float32)
    raw_dx    = np.array(raw_dx,    dtype=np.float32)
    x_centers = np.array(x_centers, dtype=np.float32)
    med_dy = int(round(float(np.median(raw_dy))))
    med_dx = int(round(float(np.median(raw_dx))))
    _subwindow_dy.last_dx = med_dx          # stash for caller
    return med_dy, n, float(np.std(raw_dy)), raw_dy, x_centers


def _subwindow_dx(sl, sr, tolerance):
    """Median dx from near-square sub-windows of a tall/narrow X overlap strip.

    Returns (median_dx, n, std).
    """
    sh, sw = sl.shape[:2]
    n      = max(1, sh // sw);  sub_h = sh // n
    dx     = [_phase_corr_peak(sl[i*sub_h:(i+1)*sub_h, :],
                               sr[i*sub_h:(i+1)*sub_h, :], tolerance)[0]
              for i in range(n)]
    return int(round(float(np.median(dx)))), n, float(np.std(dx))


# ==============================================================================
# SEAM-CUT FINDING
# ==============================================================================

def _refine_shift_1d(a, b, axis, max_shift=8):
    """Measure residual 1-D shift between already-roughly-aligned strips.

    axis=0 : shift along y (rows)  — used to fine-tune dy at V-seams.
    axis=1 : shift along x (cols)  — used to fine-tune dx at H-seams.

    Returns integer shift s such that b is shifted by s pixels relative to a
    in the chosen axis direction (positive = b further down/right).
    This matches the sign convention of dy / dx throughout this module.

    Returns 0 if no reliable peak is found — specifically when:
      • the best offset is right at the search-window boundary (the true peak
        is likely outside the window, so the result would be biased), or
      • the best offset is not a true local maximum (the correlation is
        monotone in the window — common when sample periodicity ≈ overlap size).
    """
    h = min(a.shape[0], b.shape[0])
    w = min(a.shape[1], b.shape[1])
    ca = a[:h, :w];  cb = b[:h, :w]
    if ca.ndim == 3:
        ca = cv2.cvtColor(ca.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
        cb = cv2.cvtColor(cb.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
    # Project onto the axis of interest
    pa = ca.mean(axis=1 - axis).astype(np.float64)
    pb = cb.mean(axis=1 - axis).astype(np.float64)
    pa -= pa.mean();  pb -= pb.mean()
    n    = len(pa)
    corr = np.correlate(pa, pb, mode='full')
    center = n - 1
    lo = max(0, center - max_shift);  hi = min(len(corr), center + max_shift + 1)
    best_idx = int(np.argmax(corr[lo:hi])) + lo
    best_off = best_idx - center

    # Reject if best offset is at the boundary — unreliable, true peak is elsewhere.
    if abs(best_off) >= max_shift:
        return 0

    # Reject if not a genuine local maximum (no clear peak shape).
    peak_val  = corr[best_idx]
    left_val  = corr[best_idx - 1] if best_idx > 0              else peak_val - 1
    right_val = corr[best_idx + 1] if best_idx < len(corr) - 1  else peak_val - 1
    if not (peak_val > left_val and peak_val > right_val):
        return 0

    return best_off


def _best_hcut(st, sb, margin=_CUT_MARGIN):
    """Best horizontal cut = deepest equivalent candidate in the overlap strip.

    Row-by-row SAD
    --------------
    Compare each row of the two (already dy-aligned) overlap strips.  Rows where
    the tissue features happen to line up give a low SAD; rows in the middle of a
    bright grid-line / dense-stain band give a high SAD.

    Search window
    -------------
    Only the top edge has a margin applied (to avoid the poorly-calibrated /
    vignetting zone at the top of the incoming strip).  The bottom is searched
    all the way to the last overlap row: the overlap bottom is in the interior
    of the canvas tile where quality is good, and the best seam often lies near
    the physical tile boundary.

    With periodic tissue there are multiple cost aliases one tissue-period apart.
    We find all candidates within _EQUIV_COST_MARGIN_H of the global minimum and
    pick the **deepest** (largest row index), placing the seam as close as
    possible to the physical boundary between the two tiles.  Rows with extreme
    cost spikes (bright grid lines etc.) are naturally excluded by the threshold.
    """
    H  = min(st.shape[0], sb.shape[0])
    lo = max(0, margin)       # top margin only
    hi = H                    # search all the way to the overlap bottom
    diff      = np.abs(st[lo:hi].astype(np.float32) - sb[lo:hi].astype(np.float32))
    row_costs = diff.sum(axis=(1, 2))
    min_cost  = row_costs.min()
    threshold = min_cost * (1.0 + _EQUIV_COST_MARGIN_H)
    candidates = np.where(row_costs <= threshold)[0] + lo   # absolute row indices

    # Pick the deepest equivalent candidate (closest to the physical tile boundary).
    y_cut = int(candidates[-1])

    print(f"    H-cut at row {y_cut}/{H}  (cost {row_costs[y_cut - lo]:.0f},"
          f" {len(candidates)} equiv. candidates, deepest)")
    return y_cut


def _best_vcut(sl, sr, margin=_CUT_MARGIN):
    """Best vertical cut = column where the two overlap strips agree most.

    Among all columns within _EQUIV_COST_MARGIN of the global minimum,
    pick the one that gives the best-balanced blend zone:

    • If the cost landscape has a clear minimum (few equivalent candidates),
      the chosen column is close to the true best seam — keep it as-is, but
      require at least `margin` pixels of overlap on BOTH sides so the
      Laplacian pyramid has enough room to blend.

    • If the landscape is flat (many equivalent candidates — periodic tissue),
      there is no "best" column.  In this case pick the deepest equivalent
      candidate that still satisfies the left-side margin requirement.  This
      maximises the canvas contribution to the coarse pyramid levels, which
      is what absorbs brightness offsets between the two tiles.
    """
    H  = min(sl.shape[0], sr.shape[0])
    diff      = np.abs(sl[:H].astype(np.float32) - sr[:H].astype(np.float32))
    col_costs = diff.sum(axis=(0, 2))
    W  = col_costs.shape[0]
    lo = max(0, margin);  hi = max(lo + 1, W - margin)
    costs_win = col_costs[lo:hi]
    min_cost  = costs_win.min()
    threshold = min_cost * (1.0 + _EQUIV_COST_MARGIN)
    candidates = np.where(costs_win <= threshold)[0] + lo

    # For a Laplacian pyramid blend to absorb a brightness step, the coarsest
    # level must see pixels on BOTH sides of the seam.  With n=6 levels the
    # coarsest cell is ~64 px wide, so we need at least 64 px of overlap on
    # each side of x_cut.  If the cost landscape is flat (many candidates),
    # this is free — we just slide the cut rightward until we have that margin.
    # If the landscape has a clear minimum (few candidates), we accept x_cut
    # even if it is closer to the edge (the SAD really is lower there).
    _BLEND_MIN = 64          # min px of overlap on each side for pyramid
    balanced = candidates[(candidates >= _BLEND_MIN) & (candidates <= W - _BLEND_MIN)]
    if len(balanced) > 0:
        x_cut = int(balanced[0])   # smallest valid (still minimises tile crop)
    else:
        x_cut = int(candidates[0])  # cost-driven minimum; accept unbalanced blend

    print(f"    V-cut at col {x_cut}/{W}  (cost {col_costs[x_cut]:.0f},"
          f" {len(candidates)} equiv. candidates)")
    return x_cut


# ==============================================================================
# LAPLACIAN PYRAMID BLENDING
# ==============================================================================
#
# Replaces the old linear feather.  Key properties:
#   • Fine pyramid levels  → very narrow transition  → no double-line halo
#     even when tiles are 3–4 px misaligned
#   • Coarse pyramid levels → wide transition  → absorbs brightness offsets
#     (vignetting, exposure drift) without requiring flat-field calibration
# ==============================================================================

def _pyramid_blend(img_a, img_b, mask, n_levels):
    """Blend img_a (mask=0) and img_b (mask=1) via Laplacian pyramid.

    img_a, img_b : float32 arrays, same shape (H, W, 3) or (H, W).
    mask         : float32 (H, W), values in [0, 1].
    n_levels     : number of pyramid levels (3–5 recommended).

    At fine levels the mask transitions sharply (preserves edge sharpness).
    At coarse levels it transitions slowly (absorbs global brightness offset).
    """
    def _gp(img, n):
        p = [img.astype(np.float32)]
        for _ in range(n):
            p.append(cv2.pyrDown(p[-1]))
        return p

    def _lp(img, n):
        gaus = _gp(img, n)
        lap  = []
        for i in range(n):
            h, w = gaus[i].shape[:2]
            lap.append(gaus[i] - cv2.pyrUp(gaus[i + 1], dstsize=(w, h)))
        lap.append(gaus[n])
        return lap

    la = _lp(img_a, n_levels)
    lb = _lp(img_b, n_levels)
    gm = _gp(mask,  n_levels)

    blended = []
    for i in range(n_levels + 1):
        h = min(la[i].shape[0], lb[i].shape[0], gm[i].shape[0])
        w = min(la[i].shape[1], lb[i].shape[1], gm[i].shape[1])
        m = gm[i][:h, :w]
        if img_a.ndim == 3:
            m = m[:, :, np.newaxis]
        blended.append(la[i][:h, :w] * (1.0 - m) + lb[i][:h, :w] * m)

    img = blended[-1]
    for i in range(n_levels - 1, -1, -1):
        h, w = blended[i].shape[:2]
        img  = cv2.pyrUp(img, dstsize=(w, h)) + blended[i]
    return np.clip(img, 0.0, 255.0)


# ==============================================================================
# SEAM BLENDING  (pyramid-based)
# ==============================================================================

def _apply_vcut(canvas, tile, x_cut, x_ol, dy=0, feather=None):
    """Extend canvas rightward with a vertical seam at x_cut.

    dy : vertical offset of tile relative to the canvas top (pixels).
         dy > 0  → tile starts dy rows BELOW the canvas top.
         dy < 0  → tile starts |dy| rows ABOVE the canvas top.
         dy = 0  → tile and canvas share the same top edge (original behaviour).

    Both the left (canvas) and right (tile) halves are placed at their correct
    relative y positions so that horizontally-running features stay continuous
    across the seam.  Uses Laplacian pyramid blending.
    `feather` is accepted but ignored (kept for API compatibility).
    """
    Hc = canvas.shape[0];  Ht = tile.shape[0]
    ow    = canvas.shape[1] - x_ol
    new_w = canvas.shape[1] + tile.shape[1] - ow

    # y offsets of canvas and tile in the combined result coordinate system
    if dy >= 0:
        cy0, ty0 = 0, dy
    else:
        cy0, ty0 = -dy, 0

    new_h  = max(cy0 + Hc, ty0 + Ht)
    result = np.zeros((new_h, new_w, 3), np.uint8)

    # ── Left part: canvas only ──────────────────────────────────────────────
    result[cy0:cy0 + Hc, :x_ol] = canvas[:, :x_ol]

    # ── Overlap x-zone ──────────────────────────────────────────────────────
    # Vertical region where both canvas and tile are present
    ov_y0 = max(cy0, ty0)
    ov_y1 = min(cy0 + Hc, ty0 + Ht)
    Hol   = max(0, ov_y1 - ov_y0)

    # Canvas rows that are above the tile (no tile counterpart → paste canvas)
    if cy0 < ov_y0:
        result[cy0:ov_y0, x_ol:x_ol + ow] = canvas[:ov_y0 - cy0, x_ol:]

    # Tile rows that are above the canvas (no canvas counterpart → paste tile)
    if ty0 < ov_y0:
        result[ty0:ov_y0, x_ol:x_ol + ow] = tile[:ov_y0 - ty0, :ow]

    # Blended region where both are present
    if Hol > 1:
        c_ol = canvas[ov_y0 - cy0:ov_y1 - cy0, x_ol:].astype(np.float32)
        t_ol = tile[ov_y0 - ty0:ov_y1 - ty0,    :ow].astype(np.float32)
        mask = np.zeros((Hol, ow), np.float32)
        mask[:, max(0, x_cut):] = 1.0
        n_lev = max(1, min(4, int(np.log2(max(ow, 2))) - 1))
        blended = _pyramid_blend(c_ol, t_ol, mask, n_lev)
        result[ov_y0:ov_y1, x_ol:x_ol + ow] = blended.astype(np.uint8)

    # Canvas rows below the tile (no tile counterpart → paste canvas)
    if ov_y1 < cy0 + Hc:
        result[ov_y1:cy0 + Hc, x_ol:x_ol + ow] = canvas[ov_y1 - cy0:, x_ol:]

    # Tile rows below the canvas (no canvas counterpart → paste tile)
    if ov_y1 < ty0 + Ht:
        result[ov_y1:ty0 + Ht, x_ol:x_ol + ow] = tile[ov_y1 - ty0:, :ow]

    # ── Right part: tile only ───────────────────────────────────────────────
    result[ty0:ty0 + Ht, x_ol + ow:] = tile[:, ow:]

    return result


def _apply_hcut(canvas, strip, y_cut, y_ol, dx=0, feather=None):
    """Extend canvas downward with a horizontal seam at y_cut.

    dx : horizontal offset of strip relative to canvas left edge (pixels).
         dx > 0 → strip starts dx px RIGHT of canvas left.
         dx < 0 → strip starts |dx| px LEFT of canvas left.
         dx = 0 → original behaviour.

    Both the top (canvas) and bottom (strip) halves are placed at their correct
    relative x positions so that vertically-running features stay continuous
    across the seam.  Uses Laplacian pyramid blending.
    """
    Wc = canvas.shape[1];  Ws = strip.shape[1]
    oh    = canvas.shape[0] - y_ol
    new_h = canvas.shape[0] + strip.shape[0] - oh

    # x offsets of canvas and strip in the combined result
    if dx >= 0:
        cx0, sx0 = 0, dx
    else:
        cx0, sx0 = -dx, 0
    new_w = max(cx0 + Wc, sx0 + Ws)

    result = np.zeros((new_h, new_w, 3), np.uint8)

    # ── Top part: canvas only (rows 0..y_ol) ───────────────────────────────
    result[:y_ol, cx0:cx0 + Wc] = canvas[:y_ol, :]

    # ── Overlap y-zone ──────────────────────────────────────────────────────
    # Horizontal region where both canvas and strip are present
    ov_x0 = max(cx0, sx0)
    ov_x1 = min(cx0 + Wc, sx0 + Ws)
    Wol   = max(0, ov_x1 - ov_x0)

    # Canvas-only cols to the left of the strip
    if cx0 < ov_x0:
        result[y_ol:y_ol + oh, cx0:ov_x0] = canvas[y_ol:, :ov_x0 - cx0]
    # Strip-only cols to the left of the canvas
    if sx0 < ov_x0:
        result[y_ol:y_ol + oh, sx0:ov_x0] = strip[:oh, :ov_x0 - sx0]

    # Blended region where both canvas and strip are present
    if Wol > 1:
        c_ol = canvas[y_ol:, ov_x0 - cx0:ov_x1 - cx0].astype(np.float32)
        s_ol = strip[:oh,    ov_x0 - sx0:ov_x1 - sx0].astype(np.float32)
        h    = min(c_ol.shape[0], s_ol.shape[0])
        c_ol = c_ol[:h];  s_ol = s_ol[:h]
        yc   = int(round(float(np.atleast_1d(np.asarray(y_cut))[0])))
        mask = np.zeros((h, Wol), np.float32)
        mask[max(0, yc):, :] = 1.0
        n_lev   = max(1, min(4, int(np.log2(max(h, 2))) - 1))
        blended = _pyramid_blend(c_ol, s_ol, mask, n_lev)
        result[y_ol:y_ol + h, ov_x0:ov_x1] = blended.astype(np.uint8)

    # Canvas-only cols to the right of the strip
    if ov_x1 < cx0 + Wc:
        result[y_ol:y_ol + oh, ov_x1:cx0 + Wc] = canvas[y_ol:, ov_x1 - cx0:]
    # Strip-only cols to the right of the canvas
    if ov_x1 < sx0 + Ws:
        result[y_ol:y_ol + oh, ov_x1:sx0 + Ws] = strip[:oh, ov_x1 - sx0:]

    # ── Bottom part: strip only ─────────────────────────────────────────────
    result[y_ol + oh:, sx0:sx0 + Ws] = strip[oh:, :]

    return result


# ==============================================================================
# STEP 1 — MEASURE ALL ADJACENT PAIRS
# ==============================================================================

def _measure_pair_h(img_left, img_right, step_x, tolerance):
    """Phase-correlate horizontally adjacent tiles.

    Returns (total_dx, fdy) where total_dx = step_x + fine correction.
    """
    H  = min(img_left.shape[0], img_right.shape[0])
    ow = img_left.shape[1] - step_x
    if ow < 4:
        return step_x, 0
    sl       = img_left[:H,  img_left.shape[1] - ow:]
    sr       = img_right[:H, :ow]
    fdx, fdy = _phase_corr_peak(sl, sr, tolerance)
    return step_x + fdx, fdy


def _measure_pair_v(img_top, img_bot, step_y, tolerance):
    """Phase-correlate vertically adjacent tiles.

    Uses subwindow approach for robust dy estimate.
    Returns (fdx, total_dy) where total_dy = step_y + fine correction.

    The y-search always uses _DY_TOLERANCE_V (not the caller's `tolerance`)
    because the true vertical landing of the stage can differ from step_y by
    40+ px — far outside the ±5 px fine-tolerance window used for horizontal
    pairs.  Using a tight tolerance here would lock onto a noise peak and
    produce a wrong dy (confirmed: tol=5 gives fdy=+1, tol=50 gives fdy=−43,
    and brute-force SAD confirms dy=1704 is the true alignment).
    """
    W  = min(img_top.shape[1], img_bot.shape[1])
    oh = img_top.shape[0] - step_y
    if oh < 4:
        return 0, step_y
    st               = img_top[img_top.shape[0] - oh:, :W]
    sb               = img_bot[:oh, :W]
    fdy, n, spread, _, _ = _subwindow_dy(st, sb, _DY_TOLERANCE_V)
    # dx is retrieved from the stash set inside _subwindow_dy — each sub-window
    # already ran phase correlation with _DX_TOLERANCE_V (wider search) so that
    # large horizontal offsets (10–15 px) are captured correctly.
    fdx = _subwindow_dy.last_dx
    print(f"    dy={step_y + fdy:+d} px  "
          f"({n} sub-windows, spread ±{spread:.1f} px)  dx={fdx:+d}")
    return fdx, step_y + fdy


# ==============================================================================
# STEP 2 — GLOBAL LEAST-SQUARES POSITION OPTIMISATION
# ==============================================================================

def _global_tile_positions(pair_offsets, rows, cols):
    """Solve for all tile positions by least squares over all pairwise offsets.

    pair_offsets : dict  {(r1,c1,r2,c2): (dx, dy)}
        Measured offset: position(r2,c2) − position(r1,c1).
        Include BOTH horizontal and vertical pairs for a well-conditioned system.

    Returns : dict  {(r,c): (x_px, y_px)}
        Top-left of each tile in a shared canvas (tile 0,0 is reference at 0,0).
    """
    n_r = len(rows);  n_c = len(cols);  n = n_r * n_c
    ri  = {r: i for i, r in enumerate(rows)}
    ci  = {c: i for i, c in enumerate(cols)}

    def idx(r, c): return ri[r] * n_c + ci[c]

    eqs_x, eqs_y = [], []
    for (r1, c1, r2, c2), (dx, dy) in pair_offsets.items():
        i, j = idx(r1, c1), idx(r2, c2)
        eqs_x.append((i, j, float(dx)))
        eqs_y.append((i, j, float(dy)))

    def _solve(eqs):
        ne = len(eqs)
        if ne == 0:
            return np.zeros(n)
        A = np.zeros((ne, n), dtype=np.float64)
        b = np.zeros(ne,      dtype=np.float64)
        for k, (i, j, off) in enumerate(eqs):
            A[k, i] = -1.0;  A[k, j] = +1.0;  b[k] = off
        # Tile (rows[0], cols[0]) is fixed at position 0: drop its column
        pos_rest, _, _, _ = np.linalg.lstsq(A[:, 1:], b, rcond=None)
        return np.concatenate([[0.0], pos_rest])

    xpos = _solve(eqs_x)
    ypos = _solve(eqs_y)

    # Normalise: shift so minimum position = 0
    xpos -= xpos.min()
    ypos -= ypos.min()

    positions = {}
    for r in rows:
        for c in cols:
            i = idx(r, c)
            positions[(r, c)] = (int(round(xpos[i])), int(round(ypos[i])))

    # Print grid of positions
    print("\n  Globally-optimised tile positions (x, y):")
    for r in rows:
        line = f"    row {r}: "
        for c in cols:
            x, y = positions[(r, c)]
            line += f"({x:5d},{y:4d}) "
        print(line)

    return positions


# ==============================================================================
# STEP 3 — ROW COMPOSITES  (using global x positions)
# ==============================================================================

def _build_row_composite(images, r, cols, positions, pair_offsets, feather):
    """Stitch all tiles in row r at their globally-optimised x positions.

    Before finding each vertical seam cut the incoming tile is aligned in Y
    so that horizontal features (grid lines, edges) are coincident when the
    minimum-SAD column is chosen.

    dy is derived by chaining direct pairwise measurements (pair_offsets) for
    horizontal adjacent tiles rather than using global-optimisation positions.
    The global optimiser mixes horizontal and vertical constraints; on periodic
    images the noisy vertical measurements can corrupt horizontal y-offsets by
    several pixels, pushing the initial dy estimate outside the refinement
    search window and causing false-peak lock-on.  Direct chaining is immune
    to this because each step is the measured offset between adjacent tiles.

    Returns (composite_image, abs_x_origin, abs_y_origin).
    """
    r_cols = [c for c in cols if (r, c) in images]
    if not r_cols:
        return None, 0, 0

    x_ref          = positions[(r, r_cols[0])][0]   # absolute x of first tile
    y_ref          = positions[(r, r_cols[0])][1]   # absolute y of canvas top (updated)
    running_tile_y = y_ref                           # tracks curr tile y via direct chain
    canvas         = images[(r, r_cols[0])].copy()

    for ci in range(1, len(r_cols)):
        c      = r_cols[ci]
        prev_c = r_cols[ci - 1]
        tile   = images[(r, c)]

        # x of this tile relative to this row's canvas left edge
        x_tile = positions[(r, c)][0] - x_ref
        ow     = canvas.shape[1] - x_tile   # overlap width
        x_ol   = x_tile                     # overlap starts here in canvas coords

        # Y-alignment via direct pairwise chain (robust against global-opt drift).
        pair_key = (r, prev_c, r, c)
        if pair_key in pair_offsets:
            running_tile_y += pair_offsets[pair_key][1]   # direct dy(prev→curr)
        else:
            running_tile_y = positions[(r, c)][1]          # fallback
        dy = running_tile_y - y_ref

        if ow < 2:
            # No meaningful overlap: extend canvas, hard-paste tile at correct y
            if dy >= 0:
                cy0, ty0 = 0, dy
            else:
                cy0, ty0 = -dy, 0
            new_w  = x_tile + tile.shape[1]
            new_h  = max(cy0 + canvas.shape[0], ty0 + tile.shape[0])
            result = np.zeros((new_h, new_w, 3), np.uint8)
            result[cy0:cy0 + canvas.shape[0], :canvas.shape[1]] = canvas
            result[ty0:ty0 + tile.shape[0],   x_tile:]          = tile
            canvas = result
            y_ref += min(0, dy)   # canvas top may have moved up
            print(f"  [{r},{c}] x={positions[(r,c)][0]}  dy={dy:+d}  (gap — hard paste)")
        else:
            # Build Y-aligned overlap strips for seam-cut finding.
            # canvas row i aligns with tile row (i - dy):
            #   dy > 0  → tile shifted down → canvas[dy:H_ol]   ↔  tile[0:H_ol-dy]
            #   dy < 0  → tile shifted up   → canvas[0:H_ol+dy] ↔  tile[-dy:H_ol]
            H_ol = min(canvas.shape[0], tile.shape[0])
            if dy > 0:
                h_align = max(0, H_ol - dy)
                if h_align > 2:
                    sl = canvas[dy:dy + h_align, x_ol:]
                    sr = tile[0:h_align,          :ow]
                else:
                    sl = canvas[:H_ol, x_ol:]
                    sr = tile[:H_ol,   :ow]
            elif dy < 0:
                h_align = max(0, H_ol + dy)
                if h_align > 2:
                    sl = canvas[0:h_align,        x_ol:]
                    sr = tile[-dy:-dy + h_align,  :ow]
                else:
                    sl = canvas[:H_ol, x_ol:]
                    sr = tile[:H_ol,   :ow]
            else:
                sl = canvas[:H_ol, x_ol:]
                sr = tile[:H_ol,   :ow]

            # Fine-tune dy: measure residual shift on the already-aligned strips
            if sl.shape[0] > 4 and sl.shape[1] > 4:
                dy_res = _refine_shift_1d(sl, sr, axis=0, max_shift=6)
                if dy_res != 0:
                    dy += dy_res
                    print(f"    dy residual {dy_res:+d} → dy final {dy:+d}")

            x_cut  = _best_vcut(sl, sr)
            print(f"  [{r},{c}] x={positions[(r,c)][0]}  overlap={ow} px  dy={dy:+d}")
            # Pass dy so _apply_vcut places both halves at correct y positions
            canvas = _apply_vcut(canvas, tile, x_cut, x_ol, dy=dy, feather=feather)
            # If tile was above canvas top, canvas top moved up by |dy|
            y_ref += min(0, dy)

    return canvas, x_ref, y_ref


# ==============================================================================
# STEP 4 — STACK ROWS  (using global y positions)
# ==============================================================================

def _stack_rows(row_composites, row_y, row_x_refs, feather):
    """Stack row composites at their globally-optimised y positions.

    Before finding each horizontal seam cut the incoming strip is aligned in X
    (using the difference of row x-origins) so that vertical features (grid
    lines, edges) are coincident when the minimum-SAD row is chosen.  This
    eliminates the lateral step artefact that would otherwise appear when a
    vertical pattern crosses a horizontal seam.

    row_y      : dict {row_index: y_px}  — absolute y of each composite's top.
    row_x_refs : dict {row_index: x_px}  — absolute x of each composite's left.
    """
    sorted_rows = sorted(row_composites.keys(), key=lambda r: row_y[r])
    canvas      = row_composites[sorted_rows[0]].copy()
    y_ref       = row_y[sorted_rows[0]]
    x_ref_base  = row_x_refs[sorted_rows[0]]   # x-origin of the first row

    for ri in range(1, len(sorted_rows)):
        r      = sorted_rows[ri]
        strip  = row_composites[r]
        y_abs  = row_y[r] - y_ref        # position relative to canvas top
        oh     = canvas.shape[0] - y_abs  # overlap height
        W      = min(canvas.shape[1], strip.shape[1])

        # X-alignment: how many px this row's composite is shifted right
        # vs the base row.  A positive dx means the strip starts further right.
        dx = row_x_refs[r] - x_ref_base

        print(f"\n  Stack row {sorted_rows[ri-1]} → row {r}: "
              f"y={y_abs}  overlap={oh} px  dx={dx:+d}")

        if oh < 2:
            if dx >= 0:
                cx0, sx0 = 0, dx
            else:
                cx0, sx0 = -dx, 0
            new_h  = y_abs + strip.shape[0]
            new_w  = max(cx0 + canvas.shape[1], sx0 + strip.shape[1])
            result = np.zeros((new_h, new_w, 3), np.uint8)
            result[:canvas.shape[0], cx0:cx0 + canvas.shape[1]] = canvas
            result[y_abs:,           sx0:sx0 + strip.shape[1]]  = strip
            canvas = result
            x_ref_base += min(0, dx)
        else:
            y_ol = canvas.shape[0] - oh

            # Build X-aligned overlap strips for seam-cut finding.
            # canvas col j aligns with strip col (j - dx):
            #   dx > 0 → strip shifted right → canvas[y_ol:, dx:W] ↔ strip[:oh, 0:W-dx]
            #   dx < 0 → strip shifted left  → canvas[y_ol:, 0:W+dx] ↔ strip[:oh, -dx:W]
            if dx > 0:
                w_align = max(0, W - dx)
                if w_align > 2:
                    st = canvas[y_ol:, dx:dx + w_align]
                    sb = strip[:oh,    0:w_align]
                else:
                    st = canvas[y_ol:, :W];  sb = strip[:oh, :W]
            elif dx < 0:
                w_align = max(0, W + dx)
                if w_align > 2:
                    st = canvas[y_ol:, 0:w_align]
                    sb = strip[:oh,    -dx:-dx + w_align]
                else:
                    st = canvas[y_ol:, :W];  sb = strip[:oh, :W]
            else:
                st = canvas[y_ol:, :W];  sb = strip[:oh, :W]

            # NOTE: both dx and dy refinements via _refine_shift_1d are intentionally
            # omitted here.
            #
            # dx (axis=1): the subwindow phase-correlation in _measure_pair_v already
            # produces a reliable dx via 7 near-square sub-windows with a wide
            # tolerance window.  A 1-D x-projection refinement on the overlap strips
            # is unreliable for histology images which lack strong vertical-stripe
            # structure.  Applying a spurious dx_res changes the strip trimming and
            # distorts the SAD cost landscape, collapsing multiple equivalent seam
            # candidates down to a single spurious minimum near the overlap edge.
            #
            # dy (axis=0): the global optimiser already gives a self-consistent dy.
            # A 1-D y-projection refinement on the (already dx-trimmed) overlap
            # strips shifts the overlap by a few rows; with periodic tissue this
            # collapses the 5-candidate equivalent set to 1 isolated minimum near
            # the overlap edge (row 34/308 instead of row 178/308).  The global-opt
            # dy is the better estimate.

            y_cut  = _best_hcut(st, sb)
            canvas = _apply_hcut(canvas, strip, y_cut, y_ol, dx=dx, feather=feather)
            # If strip started left of canvas, canvas grew leftward
            x_ref_base += min(0, dx)

    return canvas


# ==============================================================================
# WAVEFRONT TILE COMPOSITOR
# ==============================================================================

def _apply_tile_wavefront(canvas, tile, tx, ty,
                          left_ow=0, x_cut=None,
                          top_oh=0,  y_cut=None):
    """Place *tile* at canvas position (tx, ty), blending at up to two seams.

    tx, ty    : tile top-left in current canvas coordinates (may be negative
                if the tile extends the canvas to the left / upward).
    left_ow   : width of the left-overlap zone (canvas cols tx..tx+left_ow-1
                overlap the tile's leftmost left_ow columns).
    x_cut     : V-seam column within the left overlap (0-based).
                Tile wins for cols >= x_cut.  None → keep canvas.
    top_oh    : height of the top-overlap zone (canvas rows ty..ty+top_oh-1
                overlap the tile's topmost top_oh rows).
    y_cut     : H-seam row within the top overlap (0-based).
                Tile wins for rows >= y_cut.  None → keep canvas.

    Divides the tile footprint into four non-overlapping zones:
      A  corner (top_oh × left_ow)       — combined V + H mask
      B  top-only (top_oh × (Wt-left_ow)) — H mask only
      C  left-only ((Ht-top_oh) × left_ow) — V mask only
      D  pure tile ((Ht-top_oh) × (Wt-left_ow)) — direct paste

    Returns (new_canvas, shift_x, shift_y) where shift_x/shift_y are the
    amounts the canvas origin shifted (negative = grew left/up).
    """
    Hc, Wc = canvas.shape[:2]
    Ht, Wt = tile.shape[:2]

    # Canvas may grow if tile extends beyond its current bounds.
    shift_x = max(0, -tx)    # canvas shifts right if tile is left of origin
    shift_y = max(0, -ty)    # canvas shifts down  if tile is above origin

    cx0 = shift_x;  cy0 = shift_y          # canvas origin in new coords
    tx_n = tx + shift_x;  ty_n = ty + shift_y   # tile origin in new coords (≥0)

    new_w = max(cx0 + Wc, tx_n + Wt)
    new_h = max(cy0 + Hc, ty_n + Ht)

    # Start from canvas content; tile is pasted zone by zone below.
    result = np.zeros((new_h, new_w, 3), np.uint8)
    result[cy0:cy0 + Hc, cx0:cx0 + Wc] = canvas

    # ------------------------------------------------------------------
    # Helper: hard-cut a rectangular zone (no blending, pixel-accurate)
    # ------------------------------------------------------------------
    def _blend(r0_res, r1_res, c0_res, c1_res, r0_t, c0_t, make_mask):
        h = r1_res - r0_res;  w = c1_res - c0_res
        if h <= 0 or w <= 0:
            return
        h2 = min(h, tile.shape[0] - r0_t)
        w2 = min(w, tile.shape[1] - c0_t)
        if h2 <= 0 or w2 <= 0:
            return
        mask = make_mask(h2, w2)
        # Hard cut: wherever mask >= 0.5 → use tile pixel; else keep canvas.
        tile_part   = tile[r0_t:r0_t + h2, c0_t:c0_t + w2]
        use_tile    = (mask >= 0.5)
        if use_tile.ndim == 2:
            use_tile = use_tile[:, :, np.newaxis]
        region = result[r0_res:r0_res + h2, c0_res:c0_res + w2].copy()
        region[use_tile.squeeze(-1)] = tile_part[use_tile.squeeze(-1)]
        result[r0_res:r0_res + h2, c0_res:c0_res + w2] = region

    # ------------------------------------------------------------------
    # Zone D  — pure tile, no canvas overlap: direct paste
    # ------------------------------------------------------------------
    r0_d = ty_n + top_oh;  r1_d = ty_n + Ht
    c0_d = tx_n + left_ow; c1_d = tx_n + Wt
    if r1_d > r0_d and c1_d > c0_d:
        result[r0_d:r1_d, c0_d:c1_d] = tile[top_oh:, left_ow:]

    # ------------------------------------------------------------------
    # Zone B  — top overlap only (cols beyond left overlap)
    # ------------------------------------------------------------------
    if top_oh > 0 and (tx_n + Wt) > (tx_n + left_ow):
        if y_cut is not None:
            def _mb(h, w):
                m = np.zeros((h, w), np.float32)
                m[max(0, y_cut):, :] = 1.0
                return m
            _blend(ty_n, ty_n + top_oh, tx_n + left_ow, tx_n + Wt,
                   0, left_ow, _mb)
        else:
            # No seam computed — keep canvas (do nothing; canvas already there)
            pass

    # ------------------------------------------------------------------
    # Zone C  — left overlap only (rows beyond top overlap)
    # ------------------------------------------------------------------
    if left_ow > 0 and (ty_n + Ht) > (ty_n + top_oh):
        if x_cut is not None:
            def _mc(h, w):
                m = np.zeros((h, w), np.float32)
                m[:, max(0, x_cut):] = 1.0
                return m
            _blend(ty_n + top_oh, ty_n + Ht, tx_n, tx_n + left_ow,
                   top_oh, 0, _mc)
        else:
            pass  # keep canvas

    # ------------------------------------------------------------------
    # Zone A  — corner (both overlaps meet)
    # ------------------------------------------------------------------
    if top_oh > 0 and left_ow > 0:
        def _ma(h, w):
            if x_cut is not None and y_cut is not None:
                # Canvas owns top-left quadrant (x < x_cut AND y < y_cut)
                # Tile owns everything else  →  mask = (x≥x_cut) OR (y≥y_cut)
                mx = np.zeros((h, w), np.float32);  mx[:, max(0, x_cut):] = 1.0
                my = np.zeros((h, w), np.float32);  my[max(0, y_cut):, :] = 1.0
                return np.maximum(mx, my)
            elif x_cut is not None:
                m = np.zeros((h, w), np.float32);  m[:, max(0, x_cut):] = 1.0
                return m
            elif y_cut is not None:
                m = np.zeros((h, w), np.float32);  m[max(0, y_cut):, :] = 1.0
                return m
            else:
                return np.zeros((h, w), np.float32)   # keep canvas
        _blend(ty_n, ty_n + top_oh, tx_n, tx_n + left_ow, 0, 0, _ma)

    return result, -shift_x, -shift_y


def _compose_wavefront(images, positions, pair_offsets, rows, cols, feather):
    """Assemble the grid tile-by-tile in raster order onto a single canvas.

    Each tile is placed directly against the growing canvas, consulting both
    its left neighbour (V-seam) and its top neighbour (H-seam) simultaneously.
    Interior tiles (row > 0, col > 0) therefore blend at two edges at once,
    which avoids the corner artefacts that arise when rows are first composited
    independently and then stacked.

    Algorithm per tile (r, c)
    -------------------------
    1.  Compute tile position (tx, ty) from global optimisation.
    2.  If col > 0: extract left-overlap strips from canvas and tile,
        find V-seam cut with _best_vcut.
    3.  If row > 0: extract top-overlap strips from canvas and tile,
        find H-seam cut with _best_hcut.
    4.  Call _apply_tile_wavefront to blend zones A-D in one shot.
    5.  Update canvas-origin bookkeeping if the canvas grew.
    """
    # Anchor: tile (rows[0], cols[0])
    canvas  = images[(rows[0], cols[0])].copy()
    # Global coordinates of canvas top-left corner
    gx0 = positions[(rows[0], cols[0])][0]
    gy0 = positions[(rows[0], cols[0])][1]

    for ri, r in enumerate(rows):
        for ci, c in enumerate(cols):
            if ri == 0 and ci == 0:
                continue
            if (r, c) not in images:
                continue

            tile      = images[(r, c)]
            Ht, Wt    = tile.shape[:2]
            gx, gy    = positions[(r, c)]

            # Tile position in current canvas coords
            tx = gx - gx0
            ty = gy - gy0

            has_left = (ci > 0)
            has_top  = (ri > 0)

            # Overlap is determined by the DIRECT neighbour's position, not
            # by the overall canvas extent.  The canvas may extend far beyond
            # the actual physical overlap because earlier rows/cols are already
            # merged into it.
            if has_left:
                gx_prev = positions[(r, cols[ci - 1])][0]
                left_ow = max(0, min(gx_prev + Wt - gx, Wt))
            else:
                left_ow = 0

            if has_top:
                gy_prev = positions[(rows[ri - 1], c)][1]
                top_oh  = max(0, min(gy_prev + Ht - gy, Ht))
            else:
                top_oh  = 0

            x_cut = None
            y_cut = None

            # ── V-seam (left neighbour) ──────────────────────────────────
            # Compare RAW tile edges, not the already-blended canvas.
            # The canvas at the left-overlap columns for interior tiles has
            # been processed by H-seam blending and may be a mix of two
            # rows' content.  Comparing blended canvas vs raw tile inflates
            # SAD by 40+ px/px and produces a flat cost landscape (all
            # columns look equally bad) → x_cut is weakly determined.
            # Using raw tile (r,c-1) right edge vs raw tile (r,c) left edge
            # gives clean, unmodified pixel comparisons.
            if left_ow > _CUT_MARGIN * 2:
                left_tile    = images[(r, cols[ci - 1])]
                gy_prev_col  = positions[(r, cols[ci - 1])][1]
                # Clip to Y-range where both raw tiles are physically present,
                # and skip the H-seam blend zone at the top for interior rows.
                gy_v0 = max(gy, gy_prev_col)
                gy_v1 = min(gy + Ht, gy_prev_col + Ht)
                if ri > 0:
                    gy_v0 = max(gy_v0, gy + top_oh)
                if gy_v1 - gy_v0 > _CUT_MARGIN * 2:
                    # Rows within each raw tile
                    lt_r0 = gy_v0 - gy_prev_col;  lt_r1 = gy_v1 - gy_prev_col
                    rt_r0 = gy_v0 - gy;           rt_r1 = gy_v1 - gy
                    # Right edge of left tile  |  Left edge of right tile
                    sl = left_tile[lt_r0:lt_r1, left_tile.shape[1] - left_ow:]
                    sr = tile[rt_r0:rt_r1,      :left_ow]
                    print(f"  [{r},{c}] V-seam  left_ow={left_ow}  "
                          f"rows={gy_v0-gy}..{gy_v1-gy}  (raw tiles)", end="  ")
                    x_cut = _best_vcut(sl, sr)

            # ── H-seam (top neighbour) ───────────────────────────────────
            # Same principle: compare raw tile (r-1,c) bottom edge vs raw
            # tile (r,c) top edge.  This avoids any V-seam blend artefacts
            # in the canvas columns and gives the cleanest possible y_cut.
            if top_oh > _CUT_MARGIN * 2:
                top_tile     = images[(rows[ri - 1], c)]
                gx_prev_row  = positions[(rows[ri - 1], c)][0]
                # Clip to X-range where both raw tiles are physically present.
                gx_h0 = max(gx, gx_prev_row)
                gx_h1 = min(gx + Wt, gx_prev_row + Wt)
                if gx_h1 - gx_h0 > _CUT_MARGIN * 2:
                    # Columns within each raw tile
                    tt_c0 = gx_h0 - gx_prev_row;  tt_c1 = gx_h1 - gx_prev_row
                    bt_c0 = gx_h0 - gx;           bt_c1 = gx_h1 - gx
                    # Bottom edge of top tile  |  Top edge of bottom tile
                    st = top_tile[top_tile.shape[0] - top_oh:, tt_c0:tt_c1]
                    sb = tile[:top_oh,                          bt_c0:bt_c1]
                    print(f"  [{r},{c}] H-seam  top_oh={top_oh}  "
                          f"cols={gx_h0-gx}..{gx_h1-gx}  (raw tiles)", end="  ")
                    y_cut = _best_hcut(st, sb)

            # ── Place tile onto canvas ───────────────────────────────────
            canvas, dsx, dsy = _apply_tile_wavefront(
                canvas, tile, tx, ty,
                left_ow=left_ow, x_cut=x_cut,
                top_oh=top_oh,   y_cut=y_cut,
            )
            # Update global origin if canvas grew leftward / upward
            gx0 += dsx
            gy0 += dsy

    return canvas


# ==============================================================================
# PUBLIC API
# ==============================================================================

def stitch_images(
        folder,
        output_filename="stitched.jpg",
        stage_move_x_um=_STAGE_MOVE_X_UM,
        stage_move_y_um=_STAGE_MOVE_Y_UM,
        um_per_px=_UM_PER_PX,
        image_width_px=_IMAGE_WIDTH_PX,
        image_height_px=_IMAGE_HEIGHT_PX,
        tolerance_px=_TOLERANCE_PX,
        jpeg_quality=_JPEG_QUALITY,
        n_peaks=_N_PEAKS,
        pyramid_levels=_PYRAMID_LEVELS,
        feather_px=_FEATHER_PX,
):
    """
    Stitch a grid of microscope images into a single output JPEG.
    Drop-in replacement for WPImageStitching.stitch_images().
    Expects images named 00_00.jpg (row_col) in folder.
    Returns absolute path to output_filename (stitched.jpg).

    Also writes row_NN.jpg for visual inspection of individual rows.

    feather_px : half-width (px) of the linear blend band centred on the
                 straight cut.  Increase to absorb larger photometric offsets.
    """
    step_x = int(round(stage_move_x_um / um_per_px))
    step_y = int(round(stage_move_y_um / um_per_px))

    print("=" * 60)
    print("  Microscope Grid Stitcher  —  Global Position Optimisation")
    print("=" * 60)
    print(f"\n  Scale        : {um_per_px} um/px")
    print(f"  Stage move X : {stage_move_x_um} um  ->  {step_x} px")
    print(f"  Stage move Y : {stage_move_y_um} um  ->  {step_y} px")
    print(f"  Image size   : {image_width_px} x {image_height_px} px")
    ov_x = 100 * (1 - stage_move_x_um / (image_width_px  * um_per_px))
    ov_y = 100 * (1 - stage_move_y_um / (image_height_px * um_per_px))
    print(f"  Overlap X    : {ov_x:.1f}%  (~{int(image_width_px  * ov_x / 100)} px)")
    print(f"  Overlap Y    : {ov_y:.1f}%  (~{int(image_height_px * ov_y / 100)} px)")
    print(f"  Tolerance    : +/-{tolerance_px} px")
    print(f"  Feather      : +/-{feather_px} px around cut\n")

    print(f"=== Loading images from: {folder} ===")
    images = _load_grid_images(folder)
    if not images:
        raise FileNotFoundError(
            f"No grid images found in '{folder}'. "
            "Expected files named 00_00.jpg.")
    images = _normalize_orientations(images, image_width_px, image_height_px)
    if not images:
        raise RuntimeError("No images remained after orientation normalisation.")

    rows = sorted(set(r for r, c in images.keys()))
    cols = sorted(set(c for r, c in images.keys()))
    print(f"\n  Grid: {len(rows)} rows x {len(cols)} cols = {len(images)} tiles\n")

    def _save(img, name):
        path = os.path.join(folder, name)
        cv2.imwrite(path, img, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
        mb = os.path.getsize(path) / 1e6
        print(f"  -> {name}  ({img.shape[1]}x{img.shape[0]} px, {mb:.1f} MB)")
        return path

    # ------------------------------------------------------------------
    # Step 1: measure all adjacent pairs
    # ------------------------------------------------------------------
    print("=== Step 1: measuring all adjacent pairs ===")
    pair_offsets = {}

    print("\n  Horizontal pairs:")
    for r in rows:
        for ci in range(len(cols) - 1):
            c, cn = cols[ci], cols[ci + 1]
            if (r, c) not in images or (r, cn) not in images:
                continue
            print(f"  [{r},{c}] -> [{r},{cn}]:  ", end="", flush=True)
            dx, dy = _measure_pair_h(images[(r, c)], images[(r, cn)],
                                     step_x, tolerance_px)
            print(f"dx={dx:+d}  dy={dy:+d}")
            pair_offsets[(r, c, r, cn)] = (dx, dy)

    print("\n  Vertical pairs:")
    for ri in range(len(rows) - 1):
        r, rn = rows[ri], rows[ri + 1]
        for c in cols:
            if (r, c) not in images or (rn, c) not in images:
                continue
            print(f"  [{r},{c}] -> [{rn},{c}]:  ", end="", flush=True)
            dx, dy = _measure_pair_v(images[(r, c)], images[(rn, c)],
                                     step_y, tolerance_px)
            pair_offsets[(r, c, rn, c)] = (dx, dy)

    # ------------------------------------------------------------------
    # Step 2: global least-squares optimisation
    # ------------------------------------------------------------------
    print("\n=== Step 2: global position optimisation ===")
    positions = _global_tile_positions(pair_offsets, rows, cols)

    # ------------------------------------------------------------------
    # Step 3: wavefront composition  (tile-by-tile, raster order)
    # ------------------------------------------------------------------
    print("\n=== Step 3: wavefront tile composition ===")
    full = _compose_wavefront(images, positions, pair_offsets, rows, cols, feather_px)

    output_path = os.path.join(folder, output_filename)
    cv2.imwrite(output_path, full, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
    mb = os.path.getsize(output_path) / 1e6
    print(f"\n  -> {output_filename}  "
          f"({full.shape[1]}x{full.shape[0]} px, {mb:.1f} MB)")

    print("\n=== All done ===")
    return os.path.abspath(output_path)
