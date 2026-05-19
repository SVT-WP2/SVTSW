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

  Step 3  Build one row composite per row using the globally-optimised
          per-row x positions.  Seam cut = flattest column in incoming tile.

  Step 4  Stack row composites at the globally-optimised y positions.
          Seam cut = flattest row in incoming strip.

Result: a single, self-consistent output with no rows-vs-cols duality.

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

def _phase_corr_peak(strip1, strip2, tolerance):
    """Hann-windowed phase correlation; returns (fine_dx, fine_dy)."""
    g1 = cv2.cvtColor(strip1, cv2.COLOR_BGR2GRAY).astype(np.float32)
    g2 = cv2.cvtColor(strip2, cv2.COLOR_BGR2GRAY).astype(np.float32)
    sh, sw = g1.shape
    win  = np.outer(np.hanning(sh), np.hanning(sw)).astype(np.float32)
    g1  *= win;  g2 *= win
    R    = np.fft.fft2(g1) * np.conj(np.fft.fft2(g2))
    R   /= np.abs(R) + 1e-8
    corr = np.fft.ifft2(R).real
    mask = np.zeros_like(corr)
    yi   = [d % sh for d in range(-tolerance, tolerance + 1)]
    xi   = [d % sw for d in range(-tolerance, tolerance + 1)]
    mask[np.ix_(yi, xi)] = 1.0
    cm   = corr * mask
    p    = np.unravel_index(np.argmax(cm), corr.shape)
    fdy  = p[0] if p[0] < sh // 2 else p[0] - sh
    fdx  = p[1] if p[1] < sw // 2 else p[1] - sw
    return fdx, fdy


def _subwindow_dy(st, sb, tolerance):
    """Median dy from near-square sub-windows of a short/wide Y overlap strip.

    Returns (median_dy, n, std, raw_dys, x_centers).
    """
    sh, sw = st.shape[:2]
    n  = max(1, sw // sh)
    raw, x_centers = [], []
    for i in range(n):
        x0 = i * (sw // n)
        x1 = (i + 1) * (sw // n) if i < n - 1 else sw
        raw.append(_phase_corr_peak(st[:, x0:x1], sb[:, x0:x1], tolerance)[1])
        x_centers.append((x0 + x1) / 2.0)
    raw       = np.array(raw,       dtype=np.float32)
    x_centers = np.array(x_centers, dtype=np.float32)
    med = int(round(float(np.median(raw))))
    return med, n, float(np.std(raw)), raw, x_centers


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

def _best_hcut(st, sb, margin=_CUT_MARGIN):
    """Best horizontal cut = row where the two overlap strips agree most.

    Uses minimum sum-of-absolute-differences between canvas (st) and incoming
    strip (sb).  This naturally avoids cutting on features that are misaligned
    between the two tiles — a bright grid line that sits 3 px off in the
    incoming tile gives a HIGH diff, so it is never chosen as the cut row.
    Between-feature dark regions give LOW diff on both sides → preferred.
    """
    H  = min(st.shape[0], sb.shape[0])
    lo = max(0, margin);  hi = max(lo + 1, H - margin)
    diff      = np.abs(st[lo:hi].astype(np.float32) - sb[lo:hi].astype(np.float32))
    row_costs = diff.sum(axis=(1, 2))
    y_cut     = lo + int(np.argmin(row_costs))
    print(f"    H-cut at row {y_cut}/{H}  (cost {row_costs[y_cut - lo]:.0f})")
    return y_cut


def _best_vcut(sl, sr, margin=_CUT_MARGIN):
    """Best vertical cut = column where the two overlap strips agree most."""
    H  = min(sl.shape[0], sr.shape[0])
    diff      = np.abs(sl[:H].astype(np.float32) - sr[:H].astype(np.float32))
    col_costs = diff.sum(axis=(0, 2))
    W  = col_costs.shape[0]
    lo = max(0, margin);  hi = max(lo + 1, W - margin)
    x_cut = lo + int(np.argmin(col_costs[lo:hi]))
    print(f"    V-cut at col {x_cut}/{W}  (cost {col_costs[x_cut]:.0f})")
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

def _apply_vcut(canvas, tile, x_cut, x_ol, feather=None):
    """Extend canvas rightward with a vertical seam at x_cut.

    Uses Laplacian pyramid blending: sharp at fine scales (no double-line),
    smooth at coarse scales (absorbs brightness offset).
    `feather` is accepted but ignored (kept for API compatibility).
    """
    Hc    = canvas.shape[0];  Ht = tile.shape[0];  H = max(Hc, Ht)
    ow    = canvas.shape[1] - x_ol
    new_w = canvas.shape[1] + tile.shape[1] - ow

    result = np.zeros((H, new_w, 3), np.uint8)
    result[:Hc, :x_ol] = canvas[:, :x_ol]

    Hol  = min(Hc, Ht)
    c_ol = canvas[:Hol, x_ol:].astype(np.float32)
    t_ol = tile[:Hol,   :ow].astype(np.float32)

    # mask: 0 = canvas (left), 1 = tile (right), step at x_cut
    mask = np.zeros((Hol, ow), np.float32)
    mask[:, max(0, x_cut):] = 1.0

    n_lev = max(1, min(4, int(np.log2(max(ow, 2))) - 1))
    blended = _pyramid_blend(c_ol, t_ol, mask, n_lev)

    result[:Hol, x_ol:x_ol + ow] = blended.astype(np.uint8)
    if Hc > Ht: result[Ht:Hc, x_ol:x_ol + ow] = canvas[Ht:, x_ol:]
    elif Ht > Hc: result[Hc:Ht, x_ol:x_ol + ow] = tile[Hc:, :ow]
    result[:Ht, x_ol + ow:] = tile[:, ow:]
    return result


def _apply_hcut(canvas, strip, y_cut, y_ol, feather=None):
    """Extend canvas downward with a horizontal seam at y_cut.

    Uses Laplacian pyramid blending.
    y_cut: int (straight cut) — per-column arrays no longer needed because
    the global optimisation already places tiles at their correct positions.
    """
    W     = min(canvas.shape[1], strip.shape[1])
    oh    = canvas.shape[0] - y_ol
    new_h = canvas.shape[0] + strip.shape[0] - oh

    result = np.empty((new_h, W, 3), np.uint8)
    result[:y_ol, :] = canvas[:y_ol, :W]

    c_ol = canvas[y_ol:, :W].astype(np.float32)
    s_ol = strip[:oh,   :W].astype(np.float32)

    # mask: 0 = canvas (top), 1 = strip (bottom), step at y_cut
    yc   = int(round(float(np.atleast_1d(np.asarray(y_cut))[0])))
    mask = np.zeros((oh, W), np.float32)
    mask[max(0, yc):, :] = 1.0

    n_lev = max(1, min(4, int(np.log2(max(oh, 2))) - 1))
    blended = _pyramid_blend(c_ol, s_ol, mask, n_lev)

    result[y_ol:y_ol + oh, :] = blended.astype(np.uint8)
    result[y_ol + oh:, :]     = strip[oh:, :W]
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
    """
    W  = min(img_top.shape[1], img_bot.shape[1])
    oh = img_top.shape[0] - step_y
    if oh < 4:
        return 0, step_y
    st               = img_top[img_top.shape[0] - oh:, :W]
    sb               = img_bot[:oh, :W]
    fdy, n, spread, _, _ = _subwindow_dy(st, sb, tolerance)
    # horizontal component of vertical-pair measurement
    fdx, _, _        = _subwindow_dx(st, sb, tolerance)
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

def _build_row_composite(images, r, cols, positions, feather):
    """Stitch all tiles in row r at their globally-optimised x positions.

    Before finding each vertical seam cut the incoming tile is aligned in Y
    (using the global dy offset) so that horizontal features (grid lines, edges)
    are coincident when the minimum-SAD column is chosen.  This eliminates the
    step artefact that would otherwise appear when a horizontal pattern crosses
    a vertical seam.

    Returns (composite_image, abs_x_origin) where abs_x_origin is the
    absolute x-position (global canvas) of the composite's left edge.
    """
    r_cols = [c for c in cols if (r, c) in images]
    if not r_cols:
        return None, 0

    x_ref  = positions[(r, r_cols[0])][0]   # absolute x of first tile
    y_ref  = positions[(r, r_cols[0])][1]   # absolute y of first tile (canvas top)
    canvas = images[(r, r_cols[0])].copy()

    for ci in range(1, len(r_cols)):
        c    = r_cols[ci]
        tile = images[(r, c)]

        # x of this tile relative to this row's canvas left edge
        x_tile = positions[(r, c)][0] - x_ref
        ow     = canvas.shape[1] - x_tile   # overlap width
        x_ol   = x_tile                     # overlap starts here in canvas coords

        # Y-alignment: how many px this tile is shifted down vs the canvas top
        dy = positions[(r, c)][1] - y_ref

        if ow < 2:
            # No meaningful overlap: extend canvas, hard-paste tile
            new_w  = x_tile + tile.shape[1]
            H      = max(canvas.shape[0], tile.shape[0])
            result = np.zeros((H, new_w, 3), np.uint8)
            result[:canvas.shape[0], :canvas.shape[1]] = canvas
            result[:tile.shape[0],   x_tile:]           = tile
            canvas = result
            print(f"  [{r},{c}] x={positions[(r,c)][0]}  dy={dy:+d}  (gap — hard paste)")
        else:
            H_ol = min(canvas.shape[0], tile.shape[0])

            # Build Y-aligned overlap strips for seam-cut finding only.
            # canvas row i aligns with tile row (i - dy):
            #   dy > 0  → tile shifted down  → canvas[dy:H_ol]  ↔  tile[0:H_ol-dy]
            #   dy < 0  → tile shifted up    → canvas[0:H_ol+dy] ↔  tile[-dy:H_ol]
            #   dy == 0 → no adjustment
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

            x_cut = _best_vcut(sl, sr)
            print(f"  [{r},{c}] x={positions[(r,c)][0]}  overlap={ow} px  dy={dy:+d}")
            canvas = _apply_vcut(canvas, tile, x_cut, x_ol, feather=feather)

    return canvas, x_ref


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
            new_h  = y_abs + strip.shape[0]
            result = np.zeros((new_h, W, 3), np.uint8)
            result[:canvas.shape[0], :W] = canvas[:, :W]
            result[y_abs:,           :W] = strip[:, :W]
            canvas = result
        else:
            y_ol = canvas.shape[0] - oh

            # Build X-aligned overlap strips for seam-cut finding only.
            # canvas col j aligns with strip col (j - dx):
            #   dx > 0 → strip shifted right → canvas[y_ol:, dx:W] ↔ strip[:oh, 0:W-dx]
            #   dx < 0 → strip shifted left  → canvas[y_ol:, 0:W+dx] ↔ strip[:oh, -dx:W]
            #   dx == 0 → no adjustment
            if dx > 0:
                w_align = max(0, W - dx)
                if w_align > 2:
                    st = canvas[y_ol:, dx:dx + w_align]
                    sb = strip[:oh,    0:w_align]
                else:
                    st = canvas[y_ol:, :W]
                    sb = strip[:oh,    :W]
            elif dx < 0:
                w_align = max(0, W + dx)
                if w_align > 2:
                    st = canvas[y_ol:, 0:w_align]
                    sb = strip[:oh,    -dx:-dx + w_align]
                else:
                    st = canvas[y_ol:, :W]
                    sb = strip[:oh,    :W]
            else:
                st = canvas[y_ol:, :W]
                sb = strip[:oh,    :W]

            y_cut  = _best_hcut(st, sb)
            canvas = _apply_hcut(canvas, strip, y_cut, y_ol, feather=feather)

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
    # Step 3: build row composites
    # ------------------------------------------------------------------
    print("\n=== Step 3: building row composites ===")
    row_composites = {}
    row_y          = {}
    row_x_refs     = {}   # absolute x-origin of each row composite

    for r in rows:
        print(f"\n  -- Row {r} --")
        comp, x_ref = _build_row_composite(images, r, cols, positions, feather_px)
        if comp is not None:
            row_composites[r] = comp
            row_x_refs[r]     = x_ref
            # Canonical y for this row = median y across its tiles
            ys     = [positions[(r, c)][1] for c in cols if (r, c) in images]
            row_y[r] = int(round(np.median(ys)))
            _save(comp, f"row_{r:02d}.jpg")

    # ------------------------------------------------------------------
    # Step 4: stack rows into final image
    # ------------------------------------------------------------------
    print("\n=== Step 4: stacking rows ===")
    full = _stack_rows(row_composites, row_y, row_x_refs, feather_px)

    output_path = os.path.join(folder, output_filename)
    cv2.imwrite(output_path, full, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
    mb = os.path.getsize(output_path) / 1e6
    print(f"\n  -> {output_filename}  "
          f"({full.shape[1]}x{full.shape[0]} px, {mb:.1f} MB)")

    print("\n=== All done ===")
    return os.path.abspath(output_path)
