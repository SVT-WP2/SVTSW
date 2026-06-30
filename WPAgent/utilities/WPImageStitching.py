"""
WPImageStitching.py
=================================================================
Stitch a grid of microscope tiles (named RR_CC.jpg) into a single TIF / JPEG.

Algorithm
---------
  Step 1  Measure every adjacent pair (horizontal AND vertical) with
          phase correlation → N pairwise (dx, dy) offsets.

  Step 2  Solve ONE global least-squares system for all tile positions
          simultaneously.  For a 5×5 grid: ~40 equations, 24 unknowns.
          Measurement noise averages out; the solution is self-consistent.

  Step 3  Wavefront composition: iterate tiles in raster order, placing each
          one directly onto the growing canvas.  Each tile sees BOTH its left
          neighbour (V-seam) and its top neighbour (H-seam) simultaneously,
          so interior tiles blend at two edges at once.

Naming convention : 00_00.jpg  (row_col, zero-padded, underscore separator)
Entry point       : stitch_images(folder=...)
"""

import cv2
import numpy as np
import os
from pathlib import Path


# ==============================================================================
# FULL WAFER
# ==============================================================================

def stitch_images_large_for_wafer(folder, user=None, waferAgentName=None, **kwargs):
    """Wafer-agent wrapper around the large-grid stitcher.

    NOTE: `ResponseBuilder` must be importable in the deployment environment
    (it was previously referenced without an import -> guaranteed NameError).
    If it is not available, the plain output path / exception is returned
    so the function still works standalone.
    """
    try:
        try:
            from utilities.WPImageStitchingFull import stitch_images_large
        except ImportError:
            from WPImageStitchingFull import stitch_images_large
        from datetime import datetime
        name      = os.path.basename(os.path.normpath(folder))
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        stitched  = stitch_images_large(folder=folder,
                                        output_filename=f"{timestamp}_{name}.jpg")
        try:
            return ResponseBuilder.success("StitchImagesReply", f"Stitched -> {stitched}")
        except NameError:
            return stitched
    except Exception as e:
        import traceback
        traceback.print_exc()
        try:
            return ResponseBuilder.error("StitchImagesReply", str(e), 500)
        except NameError:
            raise

# ==============================================================================
# DEFAULT CONFIG  (override via function arguments)
# ==============================================================================

_IMAGE_WIDTH_PX  = 2464
_IMAGE_HEIGHT_PX = 2056
_UM_PER_PX       = 1.417
_STAGE_MOVE_X_UM = 2968   # ~15% X overlap  (was 2623 / ~25%)
_STAGE_MOVE_Y_UM = 2476   # ~15% Y overlap  (was 2133 / ~27%)
_TOLERANCE_PX    = 25     # dx search range for horizontal pairs (px), around step_x.
                          # Was ±5: too tight for long rows — thermal drift or X-step
                          # calibration error beyond ±7 um clamps the measurement and
                          # bends the whole mosaic.  ±25 px = ±35 um.
_JPEG_QUALITY    = 95

_CUT_MARGIN          = 20   # min px from overlap edge for seam cut
_EQUIV_COST_MARGIN_H = 0.30  # H-seam: wider 30% window (periodic tissue has aliases)

# Search windows for phase correlation.  Measurements landing exactly on a
# window edge are CLAMPED (and flagged '!! at window edge' in the log).
# Drawback of wider windows: if the sample has a periodic structure with a
# pitch smaller than the window, the correlation can lock onto the wrong
# period copy — keep windows below the device pitch where possible.
_DY_TOLERANCE_H = 60    # dy search range for horizontal pairs (px).
                        # Stage drift / camera-stage rotation shifts tiles
                        # vertically even with no vertical command (~4 px/col
                        # observed); ±60 px = ±85 um headroom.
_DX_TOLERANCE_V = 15    # dx search range for vertical pairs (px).
                        # The stage does NOT move X between rows, so true
                        # X-drift is empirically <10 px.  The device array
                        # has a cell period of ~48 px in X; a wider window
                        # (we tried ±50) lets phase correlation lock onto
                        # the alias peak at ±48, corrupting BOTH dx and dy.
                        # ±15 is safely below the alias and above real drift.
                        # Raise only if '!! dx at window edge' appears AND
                        # the device period is confirmed to be >30 px.
_DY_TOLERANCE_V = 50    # dy search range for vertical pairs (px).
                        # Stage landing can differ from step_y by 40+ px;
                        # ±50 px = ±71 um.  Raise if flagged at the edge.


# ==============================================================================
# I/O
# ==============================================================================

def _load_grid_images(folder):
    images = {}
    for fp in sorted(Path(folder).iterdir()):
        if fp.suffix.lower() not in (".jpg", ".jpeg"):
            continue
        parts = fp.stem.split("_")
        if len(parts) == 2:
            try:
                r, c = int(parts[0]), int(parts[1])
                img  = cv2.imread(str(fp))
                if img is not None:
                    images[(r, c)] = img
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


def _subwindow_dy(st, sb, tolerance, dx_tolerance=None):
    """Median dy (and dx) from near-square sub-windows of a short/wide Y overlap strip.

    Each sub-window is roughly square so phase-correlation peaks are well-conditioned.
    The dx search uses _DX_TOLERANCE_V (wider) because large horizontal offsets
    (10-15 px) can occur between rows even with no horizontal stage command.

    Returns (median_dy, median_dx, n, std).
    """
    sh, sw = st.shape[:2]
    n      = max(1, sw // sh)
    dx_tol = _DX_TOLERANCE_V if dx_tolerance is None else dx_tolerance
    raw_dy, raw_dx = [], []
    for i in range(n):
        x0 = i * (sw // n)
        x1 = (i + 1) * (sw // n) if i < n - 1 else sw
        fdx, fdy = _phase_corr_peak(st[:, x0:x1], sb[:, x0:x1],
                                    tolerance, tolerance_x=dx_tol)
        raw_dy.append(fdy)
        raw_dx.append(fdx)
    raw_dy = np.array(raw_dy, dtype=np.float32)
    raw_dx = np.array(raw_dx, dtype=np.float32)
    return (int(round(float(np.median(raw_dy)))),
            int(round(float(np.median(raw_dx)))),
            n, float(np.std(raw_dy)))


# ==============================================================================
# SEAM-CUT FINDING
# ==============================================================================

def _best_hcut(st, sb, margin=_CUT_MARGIN):
    """Best horizontal cut row within the overlap strip.

    Row-by-row SAD with brightness normalisation (subtract per-row mean).
    Among all rows within _EQUIV_COST_MARGIN_H of the global minimum, pick
    the one nearest to the centre of the search window — neutral and robust
    to the flat cost landscapes typical of periodic histology tissue.
    """
    H  = min(st.shape[0], sb.shape[0])
    lo = max(0, margin)
    hi = max(lo + 1, H - margin)   # keep margin at BOTH edges of the overlap
    st_f = st[lo:hi].astype(np.float32);  st_f -= st_f.mean(axis=1, keepdims=True)
    sb_f = sb[lo:hi].astype(np.float32);  sb_f -= sb_f.mean(axis=1, keepdims=True)
    diff      = np.abs(st_f - sb_f)
    row_costs = diff.sum(axis=(1, 2))
    min_cost  = row_costs.min()
    threshold = min_cost * (1.0 + _EQUIV_COST_MARGIN_H)
    candidates = np.where(row_costs <= threshold)[0] + lo

    centre = (lo + hi) // 2
    y_cut  = int(candidates[np.argmin(np.abs(candidates - centre))])

    n_cand   = len(candidates)
    W_comp   = diff.shape[1]
    mismatch = row_costs[y_cut - lo] / max(1, W_comp)
    flat_pct = 100.0 * n_cand / max(1, hi - lo)
    qual     = "GOOD" if mismatch < 15 else ("SOFT" if mismatch < 30 else "HARD")
    flag     = "  !! flat landscape" if flat_pct > 60 else ""
    print(f"    H-cut row {y_cut}/{H}  {mismatch:.0f}px/px [{qual}]"
          f"  {n_cand} cand  {flat_pct:.0f}%flat{flag}")
    return y_cut, mismatch, n_cand


def _graph_cut_vseam(sl, sr, margin=_CUT_MARGIN, max_slope=2):
    """Find the minimum-cost curved seam path through the vertical overlap.

    Dynamic programming from top to bottom; at each row the path may shift
    at most `max_slope` columns from the previous row.  This lets the seam
    route through natural gaps between repeating structures rather than
    cutting identically across every row as a straight cut would.

    Returns (path, mean_mismatch, 1) where path is an int32 array of shape
    (H,) giving the per-row cut column within the overlap strip.
    """
    H  = min(sl.shape[0], sr.shape[0])
    W  = min(sl.shape[1], sr.shape[1])
    sl_f = sl[:H, :W].astype(np.float32);  sl_f -= sl_f.mean(axis=0, keepdims=True)
    sr_f = sr[:H, :W].astype(np.float32);  sr_f -= sr_f.mean(axis=0, keepdims=True)
    cost = np.abs(sl_f - sr_f).sum(axis=2)   # (H, W)

    lo = max(0, margin)
    hi = max(lo + 1, W - margin)
    W_win = hi - lo

    dp = np.full((H, W_win), np.inf, dtype=np.float32)
    dp[0] = cost[0, lo:hi]

    hw = max_slope
    for row in range(1, H):
        prev   = dp[row - 1]
        n      = W_win
        padded = np.pad(prev, hw, constant_values=np.inf)
        idx    = np.arange(2 * hw + 1)[np.newaxis, :] + np.arange(n)[:, np.newaxis]
        dp[row] = cost[row, lo:hi] + padded[idx].min(axis=1)

    path = np.zeros(H, dtype=np.int32)
    path[H - 1] = lo + int(np.argmin(dp[H - 1]))
    for row in range(H - 2, -1, -1):
        col   = path[row + 1]
        p0    = max(lo, col - hw)
        p1    = min(hi, col + hw + 1)
        path[row] = p0 + int(np.argmin(dp[row, p0 - lo : p1 - lo]))

    total_cost = float(sum(cost[r, path[r]] for r in range(H)))
    mean_mm    = total_cost / max(1, H)
    qual       = "GOOD" if mean_mm < 15 else ("SOFT" if mean_mm < 30 else "HARD")
    print(f"    V-path col {path.min()}–{path.max()} (mean {int(path.mean())}/{W})"
          f"  {mean_mm:.0f}px/px [{qual}]")
    return path, mean_mm, 1


# ==============================================================================
# STEP 1 — MEASURE ALL ADJACENT PAIRS
# ==============================================================================

def _measure_pair_h(img_left, img_right, step_x, tolerance, dy_tolerance=None):
    """Phase-correlate horizontally adjacent tiles; returns (total_dx, fdy).

    dx searches ±tolerance around step_x; dy searches ±dy_tolerance
    (default _DY_TOLERANCE_H).  Results at a window edge are clamped and
    flagged in the log by the caller.
    """
    dy_tol = _DY_TOLERANCE_H if dy_tolerance is None else dy_tolerance
    H  = min(img_left.shape[0], img_right.shape[0])
    ow = img_left.shape[1] - step_x
    if ow < 4:
        return step_x, 0
    sl = img_left[:H,  img_left.shape[1] - ow:]
    sr = img_right[:H, :ow]
    fdx, fdy = _phase_corr_peak(sl, sr, dy_tol, tolerance_x=tolerance)
    if abs(fdx) >= tolerance or abs(fdy) >= dy_tol:
        print("!! at window edge ", end="")
    return step_x + fdx, fdy


def _measure_pair_v(img_top, img_bot, step_y, tolerance,
                    dx_tolerance=None, dy_tolerance=None):
    """Phase-correlate vertically adjacent tiles; returns (fdx, total_dy, conf).

    Primary measurement: ONE phase correlation over the FULL-WIDTH overlap
    strip with a tight dx search (±_DX_TOLERANCE_V, default 15 px).  Keeping
    the X window narrow is critical: the device array has a cell period of
    ~48 px in X, and a wider window lets the correlation lock onto the alias
    peak at ±48 px, corrupting BOTH dx and dy.

    Sub-windows (4 equally-spaced columns of the strip) provide a secondary
    confidence estimate: if they all agree, the measurement is reliable; if
    they scatter widely the content is periodic/low-texture and the result
    may be an alias in Y as well.  The confidence (0..1) is returned so the
    global solver can down-weight unreliable pairs.

    dy searches ±dy_tolerance (default _DY_TOLERANCE_V, not `tolerance`);
    dx searches ±dx_tolerance (default _DX_TOLERANCE_V).  Results at a
    window edge are clamped and flagged.
    """
    dx_tol = _DX_TOLERANCE_V if dx_tolerance is None else dx_tolerance
    dy_tol = _DY_TOLERANCE_V if dy_tolerance is None else dy_tolerance
    W  = min(img_top.shape[1], img_bot.shape[1])
    oh = img_top.shape[0] - step_y
    if oh < 4:
        return 0, step_y, 1.0
    st  = img_top[img_top.shape[0] - oh:, :W]
    sb  = img_bot[:oh, :W]

    # primary measurement: single full-width strip with tight dx window
    fdx, fdy = _phase_corr_peak(st, sb, dy_tol, tolerance_x=dx_tol)

    # secondary: sub-window spread as confidence proxy
    _, _, n, spread = _subwindow_dy(st, sb, dy_tol, dx_tolerance=dx_tol)

    # confidence: degrade progressively with spread
    # (spread < 8 → 1.0; spread 8-20 → 0.7; spread 20-35 → 0.4; > 35 → 0.2)
    if spread < 8:
        conf = 1.0
    elif spread < 20:
        conf = 0.7
    elif spread < 35:
        conf = 0.4
    else:
        conf = 0.2

    edge = ""
    if abs(fdx) >= dx_tol:
        edge += "  !! dx at window edge"
        conf = min(conf, 0.2)     # alias probable — further down-weight
    if abs(fdy) >= dy_tol:
        edge += "  !! dy at window edge"
    periodic = "  !! periodic/low-texture content" if spread > 8 else ""
    print(f"    dy={step_y + fdy:+d} px  dx={fdx:+d}  "
          f"(full strip; {n} sub-windows spread ±{spread:.1f} px  conf={conf:.1f})"
          f"{periodic}{edge}")
    return fdx, step_y + fdy, conf


# ==============================================================================
# STEP 2 — GLOBAL LEAST-SQUARES POSITION OPTIMISATION
# ==============================================================================

def _global_tile_positions(pair_offsets, rows, cols):
    """Solve for all tile positions by least squares over all pairwise offsets.

    pair_offsets : {(r1,c1,r2,c2): (dx, dy)}  or  {…: (dx, dy, conf)}
                   position(r2,c2) − position(r1,c1).
                   Optional third element `conf` (0..1) seeds the IRLS weights
                   so confidently-wrong V-pair measurements (periodic-content
                   aliases) are down-weighted from the very first iteration.
    Returns      : {(r,c): (x_px, y_px)}  — tile (0,0) is reference at (0,0).
    """
    n_r = len(rows);  n_c = len(cols);  n = n_r * n_c
    ri  = {r: i for i, r in enumerate(rows)}
    ci  = {c: i for i, c in enumerate(cols)}

    def idx(r, c): return ri[r] * n_c + ci[c]

    eqs_x, eqs_y = [], []
    for (r1, c1, r2, c2), val in pair_offsets.items():
        dx, dy = val[0], val[1]
        conf   = float(val[2]) if len(val) > 2 else 1.0
        i, j   = idx(r1, c1), idx(r2, c2)
        eqs_x.append((i, j, float(dx), conf))
        eqs_y.append((i, j, float(dy), conf))

    # Extract optional per-equation confidence seeds
    def _conf_weights(eqs):
        if eqs and len(eqs[0]) > 3:
            return np.array([e[3] for e in eqs], dtype=np.float64)
        return None

    xpos = _solve_offset_robust(eqs_x, n, axis="x",
                                 init_weights=_conf_weights(eqs_x))
    xpos -= xpos.min()
    ypos = _solve_offset_robust(eqs_y, n, axis="y",
                                 init_weights=_conf_weights(eqs_y))
    ypos -= ypos.min()

    positions = {(r, c): (int(round(xpos[idx(r, c)])), int(round(ypos[idx(r, c)])))
                 for r in rows for c in cols}

    # Residual report: pairs whose measurement disagrees with the global
    # solution (typically periodic-content mismeasurements; they were
    # down-weighted, listed here for diagnosis).
    bad = []
    for (r1, c1, r2, c2), val in pair_offsets.items():
        dx, dy = val[0], val[1]
        rx = positions[(r2, c2)][0] - positions[(r1, c1)][0] - int(dx)
        ry = positions[(r2, c2)][1] - positions[(r1, c1)][1] - int(dy)
        if abs(rx) > 10 or abs(ry) > 10:
            bad.append((max(abs(rx), abs(ry)), (r1, c1, r2, c2), rx, ry))
    if bad:
        bad.sort(key=lambda t: -t[0])
        print(f"\n  !! {len(bad)}/{len(pair_offsets)} pair measurement(s) "
              f"inconsistent with the global solution (>10 px, down-weighted):")
        for _, (r1, c1, r2, c2), rx, ry in bad[:20]:
            print(f"     ({r1},{c1})->({r2},{c2}): residual x={rx:+d}  y={ry:+d}")
        if len(bad) > 20:
            print(f"     ... and {len(bad) - 20} more")

    if n_r <= 30 and n_c <= 30:
        print("\n  Globally-optimised tile positions (x, y):")
        for r in rows:
            line = f"    row {r}: "
            for c in cols:
                x, y = positions[(r, c)]
                line += f"({x:5d},{y:4d}) "
            print(line)
    else:
        print(f"\n  Globally-optimised positions for {n} tiles "
              f"(table suppressed for grids > 30x30)")

    return positions


def _solve_offset_robust(eqs, n, n_iter=3, axis="", init_weights=None):
    """Robust (IRLS / Huber) version of the global position solve.

    Solves ordinary least squares first, then iteratively down-weights
    equations whose residual exceeds ~3 robust sigma — so a handful of
    confidently-wrong pair measurements (periodic-content aliases, blank
    overlaps) no longer bend the whole mosaic.  The grid has ~2x redundancy
    (every interior tile is constrained by 4 pairs), which is what makes
    this work.

    init_weights : optional array of per-equation confidence seeds (0..1).
                   Seeds the very first iteration so known-bad V-pair
                   measurements don't pull the initial solution off-track
                   before IRLS can identify them as outliers.
    """
    if not eqs:
        return np.zeros(n)
    I   = np.array([e[0] for e in eqs], dtype=np.int64)
    J   = np.array([e[1] for e in eqs], dtype=np.int64)
    OFF = np.array([e[2] for e in eqs], dtype=np.float64)

    x = _solve_offset_lsq(eqs, n, weights=init_weights)
    t = None
    for _ in range(n_iter):
        res = x[J] - x[I] - OFF
        mad = np.median(np.abs(res - np.median(res)))
        t   = max(6.0, 3.0 * 1.4826 * mad)      # Huber threshold, >= 6 px
        absr = np.abs(res)
        w   = np.where(absr <= t, 1.0, t / np.maximum(absr, 1e-9))
        if (w < 1.0).sum() == 0:
            return x
        x = _solve_offset_lsq(eqs, n, weights=w)

    # final pass: hard-reject clear outliers (near-zero weight keeps the
    # graph connected even if a node would otherwise lose all equations)
    res  = x[J] - x[I] - OFF
    absr = np.abs(res)
    w    = np.where(absr <= t, 1.0, 1e-4)
    n_rej = int((w < 0.5).sum())
    if n_rej:
        x = _solve_offset_lsq(eqs, n, weights=w)
        print(f"  Robust solve [{axis}]: {n_rej}/{len(eqs)} outlier pair(s) "
              f"rejected (residual > ~{t:.0f} px)")
    return x


def _solve_offset_lsq(eqs, n, weights=None):
    """Least-squares node positions from pairwise offsets, node 0 anchored at 0.

    eqs : list of (i, j, off) meaning  pos[j] - pos[i] = off.
    weights : optional per-equation weights (IRLS).

    Solves the normal equations  L p = b  (L = weighted graph Laplacian) with
    a matrix-free conjugate gradient: O(edges) memory, exact same minimiser
    as the previous dense `np.linalg.lstsq` formulation.  The dense version
    built an (n_eqs x n) matrix — ~3.3 GB and hours of SVD for a 120x120
    grid; this runs in milliseconds-to-seconds for any realistic grid size.

    Nodes with no equations (missing tiles) are left at 0.
    """
    if not eqs:
        return np.zeros(n)
    I   = np.array([e[0] for e in eqs], dtype=np.int64)
    J   = np.array([e[1] for e in eqs], dtype=np.int64)
    OFF = np.array([e[2] for e in eqs], dtype=np.float64)
    W   = np.ones(len(eqs)) if weights is None else np.asarray(weights, np.float64)

    deg = (np.bincount(I, weights=W, minlength=n)
           + np.bincount(J, weights=W, minlength=n))
    b   = (np.bincount(J, weights=W * OFF, minlength=n)
           - np.bincount(I, weights=W * OFF, minlength=n))
    b[0] = 0.0   # anchor node 0 at position 0

    def Lmul(x):
        s  = deg * x
        s -= np.bincount(I, weights=W * x[J], minlength=n)
        s -= np.bincount(J, weights=W * x[I], minlength=n)
        s[0] = 0.0   # anchored row
        return s

    x  = np.zeros(n, dtype=np.float64)
    r  = b.copy()
    p  = r.copy()
    rs = float(r @ r)
    if rs == 0.0:
        return x
    tol2     = max(rs * 1e-20, 1e-12)
    max_iter = max(200, 4 * n)
    for _ in range(max_iter):
        Ap    = Lmul(p)
        denom = float(p @ Ap)
        if denom <= 0.0:
            break
        alpha = rs / denom
        x    += alpha * p
        r    -= alpha * Ap
        rs_new = float(r @ r)
        if rs_new < tol2:
            break
        p  = r + (rs_new / rs) * p
        rs = rs_new
    return x


# ==============================================================================
# WAVEFRONT TILE COMPOSITOR
# ==============================================================================

def _apply_tile_wavefront(canvas, tile, tx, ty,
                          left_ow=0, x_cut=None,
                          top_oh=0,  y_cut=None):
    """Place *tile* at canvas position (tx, ty), blending at up to two seams.

    tx, ty    : tile top-left in current canvas coordinates (may be negative).
    left_ow   : width of the left-overlap zone; tile wins for cols >= x_cut.
    top_oh    : height of the top-overlap zone; tile wins for rows >= y_cut.

    Divides the tile footprint into four zones:
      A  corner (top_oh × left_ow)              — combined V + H mask
      B  top strip (top_oh × (Wt-left_ow))      — H mask only
      C  left strip ((Ht-top_oh) × left_ow)     — V mask only
      D  interior ((Ht-top_oh) × (Wt-left_ow))  — direct paste

    Returns (new_canvas, shift_x, shift_y).
    """
    Hc, Wc = canvas.shape[:2]
    Ht, Wt = tile.shape[:2]

    shift_x = max(0, -tx)
    shift_y = max(0, -ty)
    cx0 = shift_x;  cy0 = shift_y
    tx_n = tx + shift_x;  ty_n = ty + shift_y

    result = np.zeros((max(cy0 + Hc, ty_n + Ht),
                       max(cx0 + Wc, tx_n + Wt), 3), np.uint8)
    result[cy0:cy0 + Hc, cx0:cx0 + Wc] = canvas

    def _blend(r0_res, r1_res, c0_res, c1_res, r0_t, c0_t, make_mask):
        h = r1_res - r0_res;  w = c1_res - c0_res
        if h <= 0 or w <= 0:
            return
        h2 = min(h, tile.shape[0] - r0_t)
        w2 = min(w, tile.shape[1] - c0_t)
        if h2 <= 0 or w2 <= 0:
            return
        tile_part = tile[r0_t:r0_t + h2, c0_t:c0_t + w2]
        use_tile  = (make_mask(h2, w2) >= 0.5)
        region    = result[r0_res:r0_res + h2, c0_res:c0_res + w2].copy()

        # Empty canvas rows/cols have no valid spatial reference.
        # Filling from the nearest row would introduce a y-offset mismatch
        # equal to the inter-tile dy, producing a visible step at the seam.
        # Instead, let tile content through directly for those positions.
        empty_rows = (region.sum(axis=(1, 2)) == 0)
        if empty_rows.any():
            if (~empty_rows).any():
                use_tile[np.where(empty_rows)[0]] = True
            else:
                use_tile[:] = True

        empty_cols = (region.sum(axis=(0, 2)) == 0)
        if empty_cols.any():
            if (~empty_cols).any():
                use_tile[:, np.where(empty_cols)[0]] = True
            else:
                use_tile[:] = True

        region[use_tile] = tile_part[use_tile]
        result[r0_res:r0_res + h2, c0_res:c0_res + w2] = region

    # Zone D — pure tile, direct paste
    r0_d = ty_n + top_oh;  c0_d = tx_n + left_ow
    if ty_n + Ht > r0_d and tx_n + Wt > c0_d:
        result[r0_d:ty_n + Ht, c0_d:tx_n + Wt] = tile[top_oh:, left_ow:]

    _x_is_path = isinstance(x_cut, np.ndarray)

    def _vcut_mask(h, w, tile_row_offset):
        m = np.zeros((h, w), np.float32)
        if _x_is_path:
            rows_idx = np.clip(np.arange(h) + tile_row_offset, 0, len(x_cut) - 1)
            cuts     = x_cut[rows_idx]
            m = (np.arange(w)[np.newaxis, :] >= cuts[:, np.newaxis]).astype(np.float32)
        elif x_cut is not None:
            m[:, max(0, x_cut):] = 1.0
        return m

    # Zone B — top overlap only
    if top_oh > 0 and y_cut is not None and tx_n + Wt > tx_n + left_ow:
        def _mb(h, w):
            m = np.zeros((h, w), np.float32);  m[max(0, y_cut):, :] = 1.0;  return m
        _blend(ty_n, ty_n + top_oh, tx_n + left_ow, tx_n + Wt, 0, left_ow, _mb)

    # Zone C — left overlap only
    if left_ow > 0 and x_cut is not None and ty_n + Ht > ty_n + top_oh:
        _blend(ty_n + top_oh, ty_n + Ht, tx_n, tx_n + left_ow,
               top_oh, 0, lambda h, w: _vcut_mask(h, w, tile_row_offset=top_oh))

    # Zone A — corner
    if top_oh > 0 and left_ow > 0:
        def _ma(h, w):
            mx = _vcut_mask(h, w, tile_row_offset=0)
            if y_cut is not None:
                my = np.zeros((h, w), np.float32);  my[max(0, y_cut):, :] = 1.0
                return np.maximum(mx, my) if x_cut is not None else my
            return mx
        _blend(ty_n, ty_n + top_oh, tx_n, tx_n + left_ow, 0, 0, _ma)

    return result, -shift_x, -shift_y


def _seam_quality(mismatch):
    if mismatch < 15:  return "GOOD"
    if mismatch < 30:  return "SOFT"
    return "HARD"


def _tile_geometry(images, positions, rows, cols):
    """Pre-compute overlap widths/heights for every tile."""
    geo = {}
    for ri, r in enumerate(rows):
        for ci, c in enumerate(cols):
            if (r, c) not in images:
                continue
            Ht, Wt = images[(r, c)].shape[:2]
            gx, gy = positions[(r, c)]
            left_ow = top_oh = 0
            # Only use a neighbour's position if its image actually exists:
            # missing tiles get garbage positions from the optimiser.
            if ci > 0 and (r, cols[ci-1]) in images:
                left_ow = max(0, min(positions[(r, cols[ci-1])][0] + Wt - gx, Wt))
            if ri > 0 and (rows[ri-1], c) in images:
                top_oh  = max(0, min(positions[(rows[ri-1], c)][1] + Ht - gy, Ht))
            geo[(r, c)] = (left_ow, top_oh)
    return geo


def _measure_all_seams(images, positions, rows, cols, geo):
    """Measure every V and H seam using raw tile edges (canvas-independent).

    Returns seam_log: {(r,c): {'v': (path, mismatch, 1), 'h': (row, mismatch, n)}}
    """
    seam_log = {}

    for ri, r in enumerate(rows):
        for ci, c in enumerate(cols):
            if ri == 0 and ci == 0:
                continue
            if (r, c) not in images:
                continue

            tile   = images[(r, c)]
            Ht, Wt = tile.shape[:2]
            gx, gy = positions[(r, c)]
            left_ow, top_oh = geo[(r, c)]
            x_cut = x_mm = x_nc = None
            y_cut = y_mm = y_nc = None

            # V-seam
            if left_ow > _CUT_MARGIN * 2:
                left_tile   = images[(r, cols[ci - 1])]
                gy_prev_col = positions[(r, cols[ci - 1])][1]
                gy_v0 = max(gy, gy_prev_col)
                gy_v1 = min(gy + Ht, gy_prev_col + Ht)
                if ri > 0:
                    gy_v0 = max(gy_v0, gy + top_oh)
                if gy_v1 - gy_v0 > _CUT_MARGIN * 2:
                    sl = left_tile[gy_v0 - gy_prev_col : gy_v1 - gy_prev_col,
                                   left_tile.shape[1] - left_ow:]
                    sr = tile[gy_v0 - gy : gy_v1 - gy, :left_ow]
                    print(f"  [{r},{c}] V ow={left_ow}px", end="  ")
                    x_cut, x_mm, x_nc = _graph_cut_vseam(sl, sr)
                    # Extend path to full tile height
                    if isinstance(x_cut, np.ndarray):
                        path_start = gy_v0 - gy
                        full = np.empty(Ht, dtype=np.int32)
                        full[:path_start] = x_cut[0]
                        end = min(path_start + len(x_cut), Ht)
                        full[path_start:end] = x_cut[:end - path_start]
                        full[end:] = x_cut[-1]
                        x_cut = full

            # H-seam
            if top_oh > _CUT_MARGIN * 2:
                top_tile    = images[(rows[ri - 1], c)]
                gx_prev_row = positions[(rows[ri - 1], c)][0]
                gx_h0 = max(gx, gx_prev_row)
                gx_h1 = min(gx + Wt, gx_prev_row + Wt)
                if gx_h1 - gx_h0 > _CUT_MARGIN * 2:
                    tc0 = gx_h0 - gx_prev_row;  tc1 = gx_h1 - gx_prev_row
                    bc0 = gx_h0 - gx;           bc1 = gx_h1 - gx
                    st = top_tile[top_tile.shape[0] - top_oh:, tc0:tc1]
                    sb = tile[:top_oh, bc0:bc1]
                    print(f"  [{r},{c}] H ow={top_oh}px", end="  ")
                    y_cut, y_mm, y_nc = _best_hcut(st, sb)

            seam_log[(r, c)] = {
                'v': (x_cut, x_mm, x_nc),
                'h': (y_cut, y_mm, y_nc),
            }

    return seam_log


def _smooth_seam_cuts(seam_log, rows, cols):
    """Enforce H-seam consistency across each row boundary via median smoothing.

    Tiles with an isolated minimum (≤8 candidates, >120 px from median) keep
    their original cut to avoid degrading a genuinely good seam.  All others
    are pulled to the median.  V-seam paths are per-tile graph-cut paths and
    are kept as-is.
    """
    _ISO_CAND   = 8
    _ISO_SHIFT  = 120
    _WARN_SHIFT = 60

    smooth = {k: dict(v) for k, v in seam_log.items()}

    def _decide(orig, med, ncand, label):
        delta    = abs(orig - med)
        isolated = (ncand is not None and ncand <= _ISO_CAND and delta > _ISO_SHIFT)
        if isolated:
            return orig, f"kept  (isolated min, Δ{delta}px > {_ISO_SHIFT}px threshold)"
        elif delta > _WARN_SHIFT:
            return med,  f"forced→{med} (Δ{delta}px  !! may degrade quality at [{label}])"
        else:
            return med,  f"→{med}" if delta > 5 else "=median"

    # V-seam paths are per-tile graph-cut results; no cross-tile smoothing applied.
    for ri in range(1, len(rows)):
        r    = rows[ri]
        vals = [(c, seam_log[(r,c)]['h'][0], seam_log[(r,c)]['h'][2])
                for c in cols
                if (r,c) in seam_log and seam_log[(r,c)]['h'][0] is not None]
        if not vals:
            continue
        raw = [y for _,y,_ in vals]
        med = int(np.median(raw))
        rng = max(raw) - min(raw)
        if rng > 40:
            print(f"  H-seam row{ri}: {raw}  median={med}  range={rng}px  !! high variation")
        for c, orig, ncand in vals:
            final, action = _decide(orig, med, ncand, f"{ri},{c}")
            if action not in ("=median",) and not action.startswith("→"):
                print(f"    [{r},{c}]: {action}")
            smooth[(r,c)]['h'] = (final, seam_log[(r,c)]['h'][1], ncand)

    return smooth


def _compose_wavefront(images, positions, rows, cols, geo, seam_cuts):
    """Assemble the grid from pre-computed, smoothed seam positions."""
    canvas = images[(rows[0], cols[0])].copy()
    gx0    = positions[(rows[0], cols[0])][0]
    gy0    = positions[(rows[0], cols[0])][1]

    for ri, r in enumerate(rows):
        for ci, c in enumerate(cols):
            if ri == 0 and ci == 0:
                continue
            if (r, c) not in images:
                continue
            gx, gy = positions[(r, c)]
            left_ow, top_oh = geo[(r, c)]
            entry  = seam_cuts.get((r, c), {})
            x_cut  = (entry.get('v') or (None,))[0]
            y_cut  = (entry.get('h') or (None,))[0]
            canvas, dsx, dsy = _apply_tile_wavefront(
                canvas, images[(r, c)], gx - gx0, gy - gy0,
                left_ow=left_ow, x_cut=x_cut,
                top_oh=top_oh,   y_cut=y_cut,
            )
            gx0 += dsx
            gy0 += dsy

    return canvas

def _crop_to_content(image, inset_x=100, inset_y=100):
    """
    Crop a fixed inset from all four edges to remove stitching zigzags.
    """
    H, W = image.shape[:2]

    top    = inset_y
    bottom = H - inset_y
    left   = inset_x
    right  = W - inset_x

    if bottom - top < 1 or right - left < 1:
        print(f"  Crop: inset {inset_x}x{inset_y}px too large for {W}x{H}, skipped")
        return image

    cropped = image[top:bottom, left:right]

    print(f"  Crop: inset {inset_x}x{inset_y}px  "
          f"original {W}x{H}  "
          f"cropped {cropped.shape[1]}x{cropped.shape[0]}")

    return cropped


# Hard per-side pixel limits of the encoders (format specifications).
_WEBP_MAX_PX = 16383
_JPEG_MAX_PX = 65500


def _save_image(path, img, jpeg_quality=80, webp_quality=75):
    """Write `img` to `path`, honouring format size limits and checking success.

    WebP cannot exceed 16383 px per side; if the image is bigger the file is
    silently truncated/failed by OpenCV, so we fall back to JPEG (<= 65500 px).
    Returns the actual path written.
    """
    h, w = img.shape[:2]
    base, ext = os.path.splitext(path)
    ext = ext.lower()

    if ext == ".webp" and max(h, w) > _WEBP_MAX_PX:
        print(f"  !! {w}x{h} exceeds WebP limit ({_WEBP_MAX_PX} px/side) "
              f"-> falling back to JPEG")
        ext, path = ".jpg", base + ".jpg"
    if ext in (".jpg", ".jpeg") and max(h, w) > _JPEG_MAX_PX:
        raise ValueError(
            f"Image {w}x{h} exceeds JPEG limit ({_JPEG_MAX_PX} px/side). "
            "Reduce the output scale (see final_max_px in stitch_images_large).")

    if ext == ".webp":
        params = [cv2.IMWRITE_WEBP_QUALITY, webp_quality]
    elif ext in (".jpg", ".jpeg"):
        params = [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality]
    else:
        params = []

    if not cv2.imwrite(path, img, params):
        raise IOError(f"cv2.imwrite failed for {path} ({w}x{h})")
    return path


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
        webp_quality=75,
        crop_inset_x=100,
        crop_inset_y=100,
):
    """
    Stitch a grid of microscope images into a single output JPEG.
    Expects images named 00_00.jpg (row_col) in folder.
    Returns absolute path to output_filename.
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
    print(f"  Tolerance    : +/-{tolerance_px} px\n")

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
    sample = next(iter(images.values()))
    print(f"  {len(images)} tiles  ({sample.shape[1]}x{sample.shape[0]} px each)")
    print(f"  Grid: {len(rows)} rows x {len(cols)} cols\n")

    # Step 1: measure all adjacent pairs
    print("=== Step 1: measuring all adjacent pairs ===")
    pair_offsets = {}

    for r in rows:
        for ci in range(len(cols) - 1):
            c, cn = cols[ci], cols[ci + 1]
            if (r, c) not in images or (r, cn) not in images:
                continue
            print(f"  [{r},{c}] -> [{r},{cn}]:  ", end="", flush=True)
            dx, dy = _measure_pair_h(images[(r, c)], images[(r, cn)], step_x, tolerance_px)
            print(f"dx={dx:+d}  dy={dy:+d}")
            pair_offsets[(r, c, r, cn)] = (dx, dy)

    print()
    for ri in range(len(rows) - 1):
        r, rn = rows[ri], rows[ri + 1]
        for c in cols:
            if (r, c) not in images or (rn, c) not in images:
                continue
            print(f"  [{r},{c}] -> [{rn},{c}]:  ", end="", flush=True)
            dx, dy, conf = _measure_pair_v(images[(r, c)], images[(rn, c)],
                                           step_y, tolerance_px)
            pair_offsets[(r, c, rn, c)] = (dx, dy, conf)

    # Step 2: global least-squares optimisation
    print("\n=== Step 2: global position optimisation ===")
    positions = _global_tile_positions(pair_offsets, rows, cols)

    # Step 3: wavefront composition
    geo = _tile_geometry(images, positions, rows, cols)

    print("\n=== Step 3a: measuring seam positions ===")
    raw_log = _measure_all_seams(images, positions, rows, cols, geo)

    print("\n=== Step 3b: smoothing seam lines ===")
    seam_log = _smooth_seam_cuts(raw_log, rows, cols)

    full = _compose_wavefront(images, positions, rows, cols, geo, seam_log)

    # ── crop ragged edges ──────────────────────────────────────────────
    full = _crop_to_content(full, inset_x=crop_inset_x, inset_y=crop_inset_y)
    # ──────────────────────────────────────────────────────────────────
    
    # Seam quality summary
    print("\n=== Seam quality summary ===")
    print("  mismatch px/px at the chosen cut  |  GOOD<15  SOFT<30  HARD≥30\n")

    print("  V-seams (left↔right):")
    print("         " + "".join(f"  col{c:d}" for c in cols[1:]))
    for r in rows:
        line = f"  row {r}  "
        for c in cols[1:]:
            tup = (seam_log.get((r, c), {}).get('v') or (None, None))
            mm  = tup[1] if tup and len(tup) > 1 else None
            line += f" {mm:4.0f}{_seam_quality(mm)[0]}" if mm is not None else "     — "
        print(line)

    print("\n  H-seams (top↔bottom):")
    print("         " + "".join(f"  col{c:d}" for c in cols))
    for r in rows[1:]:
        line = f"  row {r}  "
        for c in cols:
            tup = (seam_log.get((r, c), {}).get('h') or (None, None))
            mm  = tup[1] if tup and len(tup) > 1 else None
            line += f" {mm:4.0f}{_seam_quality(mm)[0]}" if mm is not None else "     — "
        print(line)
    print("  (G=GOOD  S=SOFT  H=HARD)\n")

# ── output ────────────────────────────────────────────────────────
    # Full quality JPEG (reference, ~18 MB) — uncomment to keep:
    # _save_image(os.path.join(folder, output_filename.replace(".jpg", "_full.jpg")),
    #             full, jpeg_quality=95)

    # WebP — good quality, ~half the JPEG size (auto-falls back to JPEG
    # if the stitch exceeds WebP's 16383 px/side format limit)
    output_path = os.path.join(folder, output_filename.replace(".jpg", ".webp"))
    output_path = _save_image(output_path, full,
                              jpeg_quality=jpeg_quality, webp_quality=webp_quality)
    mb = os.path.getsize(output_path) / 1e6
    print(f"  -> {output_path}  ({full.shape[1]}x{full.shape[0]} px, {mb:.1f} MB)")
    # ──────────────────────────────────────────────────────────────────

    print("\n=== All done ===")
    return os.path.abspath(output_path)


# ==============================================================================
# COMMAND-LINE ENTRY POINT
# ==============================================================================
#
# Usage:
#   python WPImageStitching.py  <folder>  [options]
#
# The folder must contain images named  RR_CC.jpg  (row_col, zero-padded).
# Run with --help to see all flags.
# ==============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Stitch a grid of microscope images (named RR_CC.jpg) "
                    "into a single JPEG.")
    parser.add_argument("folder",
                        help="Folder containing the tile images.")
    parser.add_argument("--output", default="stitched.jpg",
                        help="Output filename inside <folder>. Default: stitched.jpg")
    parser.add_argument("--stage-x-um", type=float, default=_STAGE_MOVE_X_UM,
                        help=f"Stage X move in µm. Default: {_STAGE_MOVE_X_UM}")
    parser.add_argument("--stage-y-um", type=float, default=_STAGE_MOVE_Y_UM,
                        help=f"Stage Y move in µm. Default: {_STAGE_MOVE_Y_UM}")
    parser.add_argument("--um-per-px", type=float, default=_UM_PER_PX,
                        help=f"µm per pixel. Default: {_UM_PER_PX}")
    parser.add_argument("--width-px",  type=int, default=_IMAGE_WIDTH_PX,
                        help=f"Tile width in pixels. Default: {_IMAGE_WIDTH_PX}")
    parser.add_argument("--height-px", type=int, default=_IMAGE_HEIGHT_PX,
                        help=f"Tile height in pixels. Default: {_IMAGE_HEIGHT_PX}")
    parser.add_argument("--quality",   type=int, default=_JPEG_QUALITY,
                        help=f"JPEG output quality (1-100). Default: {_JPEG_QUALITY}")

    args = parser.parse_args()
    stitch_images(
        folder           = args.folder,
        output_filename  = args.output,
        stage_move_x_um  = args.stage_x_um,
        stage_move_y_um  = args.stage_y_um,
        um_per_px        = args.um_per_px,
        image_width_px   = args.width_px,
        image_height_px  = args.height_px,
        jpeg_quality     = args.quality,
    )
