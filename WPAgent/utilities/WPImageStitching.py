"""
WPImageStitching_fixed.py
Microscope grid stitcher — fixed step + phase correlation refinement.
Expects images named 00_00.jpg (row_col) as produced by take_image().

This is a drop-in replacement for WPImageStitching.py with three bug fixes:

  FIX 1 — Blend mask now uses a directional cosine ramp (0→1) across the
           overlap strip instead of the Gaussian-weight ratio.
           The old mask never reached 0 or 1 at the strip boundaries,
           causing a hard brightness discontinuity (visible stripe) at each
           seam edge.  The cosine ramp guarantees continuity.

  FIX 2 — Pyramid depth is now clamped to log2(overlap/4) so the coarsest
           level is always ≥ 4 px wide.  Previously a narrow overlap strip
           (e.g. 64 px, 10 % overlap) produced a coarsest level of 5 px
           that when upsampled ×8 smeared fine detail in the seam zone.

  FIX 3 — Corner patches (4-tile junctions) are re-blended after the H/V
           passes using a 2-D cosine mask so they are not left with the
           artefacts from two inconsistent 1-D blends applied on top of each
           other.
"""

import cv2
import numpy as np
import os
from pathlib import Path
from scipy.ndimage import maximum_filter
import math


# ==============================================================================
# DEFAULT CONFIG  (same as original — override via function args if needed)
# ==============================================================================

_IMAGE_WIDTH_PX  = 2464
_IMAGE_HEIGHT_PX = 2056
_UM_PER_PX       = 1.41
_STAGE_MOVE_X_UM = 3140
_STAGE_MOVE_Y_UM = 2600
_TOLERANCE_PX    = 20
_JPEG_QUALITY    = 95
_N_PEAKS         = 5
_PYRAMID_LEVELS  = 4

# ==============================================================================


def _load_grid_images(folder):
    images = {}
    for filepath in Path(folder).glob("*.jp*g"):
        parts = filepath.stem.split("_")
        if len(parts) == 2:
            try:
                row, col = int(parts[0]), int(parts[1])
                img = cv2.imread(str(filepath))
                if img is not None:
                    images[(row, col)] = img
            except ValueError:
                pass
    return images


def _normalize_orientations(images, target_w, target_h):
    fixed = {}
    for key, img in images.items():
        h, w = img.shape[:2]
        if w == target_h and h == target_w:
            img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
        elif w != target_w or h != target_h:
            continue
        fixed[key] = img
    return fixed


def _find_best_peak(corr, mask, sh, sw, expected_dx, expected_dy, n_peaks):
    local_max   = maximum_filter(corr * mask, size=5)
    peak_mask   = (corr == local_max) & (mask > 0)
    peak_coords = np.argwhere(peak_mask)

    if len(peak_coords) == 0:
        raw = np.unravel_index(np.argmax(corr * mask), corr.shape)
        dy  = raw[0] if raw[0] < sh // 2 else raw[0] - sh
        dx  = raw[1] if raw[1] < sw // 2 else raw[1] - sw
        return dx, dy

    peak_vals = corr[peak_mask]
    order     = np.argsort(peak_vals)[::-1][:n_peaks]
    peaks     = peak_coords[order]

    best, best_dist = None, float('inf')
    for py, px in peaks:
        dy   = py if py < sh // 2 else py - sh
        dx   = px if px < sw // 2 else px - sw
        dist = (dx - expected_dx) ** 2 + (dy - expected_dy) ** 2
        if dist < best_dist:
            best_dist = dist
            best = (dx, dy)
    return best


def _refine_shift(img1, img2, expected_dx, expected_dy, step_x, step_y,
                  tolerance, n_peaks):
    h, w = img1.shape[:2]

    if abs(expected_dx) > abs(expected_dy):
        overlap_w = w - step_x
        if overlap_w < 10:
            return int(round(expected_dx)), int(round(expected_dy))
        strip1 = img1[:, w - overlap_w:]
        strip2 = img2[:, :overlap_w]
        local_expected_dx, local_expected_dy = 0, 0
    else:
        overlap_h = h - step_y
        if overlap_h < 10:
            return int(round(expected_dx)), int(round(expected_dy))
        strip1 = img1[h - overlap_h:, :]
        strip2 = img2[:overlap_h, :]
        local_expected_dx, local_expected_dy = 0, 0

    g1 = cv2.cvtColor(strip1, cv2.COLOR_BGR2GRAY).astype(np.float32)
    g2 = cv2.cvtColor(strip2, cv2.COLOR_BGR2GRAY).astype(np.float32)
    sh, sw = g1.shape

    win  = np.outer(np.hanning(sh), np.hanning(sw)).astype(np.float32)
    g1  *= win
    g2  *= win

    F1   = np.fft.fft2(g1)
    F2   = np.fft.fft2(g2)
    R    = F1 * np.conj(F2)
    R   /= (np.abs(R) + 1e-8)
    corr = np.fft.ifft2(R).real

    mask      = np.zeros_like(corr)
    y_indices = [d % sh for d in range(-tolerance, tolerance + 1)]
    x_indices = [d % sw for d in range(-tolerance, tolerance + 1)]
    mask[np.ix_(y_indices, x_indices)] = 1.0

    fine_dx, fine_dy = _find_best_peak(
        corr, mask, sh, sw,
        local_expected_dx, local_expected_dy,
        n_peaks
    )
    return int(round(expected_dx + fine_dx)), int(round(expected_dy + fine_dy))


def _compute_tile_positions(images, rows, cols, step_x, step_y, tolerance,
                             n_peaks):
    positions = {}
    for ri, r in enumerate(rows):
        for ci, c in enumerate(cols):
            estimates = []
            if ci > 0:
                left_key = (r, cols[ci - 1])
                if left_key in images and (r, c) in images:
                    dx, dy = _refine_shift(
                        images[left_key], images[(r, c)],
                        expected_dx=step_x, expected_dy=0,
                        step_x=step_x, step_y=step_y,
                        tolerance=tolerance, n_peaks=n_peaks)
                    lx, ly = positions[left_key]
                    estimates.append((lx + dx, ly + dy))
            if ri > 0:
                top_key = (rows[ri - 1], c)
                if top_key in images and (r, c) in images:
                    dx, dy = _refine_shift(
                        images[top_key], images[(r, c)],
                        expected_dx=0, expected_dy=step_y,
                        step_x=step_x, step_y=step_y,
                        tolerance=tolerance, n_peaks=n_peaks)
                    tx, ty = positions[top_key]
                    estimates.append((tx + dx, ty + dy))
            positions[(r, c)] = (
                int(round(np.mean([e[0] for e in estimates]))),
                int(round(np.mean([e[1] for e in estimates])))
            ) if estimates else (0, 0)
    return positions


# ── FIX 2: pyramid depth clamped by overlap size ─────────────────────────────

def _safe_pyramid_levels(h, w, requested):
    """
    FIX 2: clamp pyramid depth so the coarsest level is always ≥ 4 px on
    the SMALLER axis, AND so the depth is sensible for the actual overlap size.

    For a 64 px wide strip the old code returned 3 levels (coarsest = 5 px).
    pyrUp from 5→10→20→40 px blurs low-frequency content badly.
    The new rule: max_levels = floor(log2(min(h,w) / 4)), so the coarsest
    level is always at least 4 px. Additionally we never exceed `requested`.
    """
    max_from_size = int(math.floor(math.log2(max(min(h, w) / 4.0, 1))))
    return max(min(requested, max_from_size), 1)


def _pyramid_blend(img1, img2, mask_1ch, levels):
    """
    Laplacian pyramid blending.

    mask_1ch = 1 → fully img1,  0 → fully img2.

    FIX 1 applied here: the caller now passes a proper directional ramp mask,
    so the blend transitions smoothly from pure-img1 to pure-img2 across the
    overlap strip with no leftover mixed boundary value.
    """
    h, w   = img1.shape[:2]
    levels = _safe_pyramid_levels(h, w, levels)

    f1 = img1.astype(np.float32)
    f2 = img2.astype(np.float32)
    m  = mask_1ch.astype(np.float32)

    gp1, gp2, gpm = [f1], [f2], [m]
    for _ in range(levels):
        gp1.append(cv2.pyrDown(gp1[-1]))
        gp2.append(cv2.pyrDown(gp2[-1]))
        gpm.append(cv2.pyrDown(gpm[-1]))

    lp1 = [gp1[-1]]
    lp2 = [gp2[-1]]
    for i in range(levels, 0, -1):
        target_h, target_w = gp1[i - 1].shape[:2]
        up1 = cv2.pyrUp(gp1[i], dstsize=(target_w, target_h))
        up2 = cv2.pyrUp(gp2[i], dstsize=(target_w, target_h))
        lp1.append(gp1[i - 1] - up1)
        lp2.append(gp2[i - 1] - up2)

    blended = []
    for l1, l2, mi in zip(lp1, lp2, gpm[::-1]):
        mi_resized = cv2.resize(mi, (l1.shape[1], l1.shape[0]),
                                interpolation=cv2.INTER_LINEAR)
        mi3 = mi_resized[:, :, np.newaxis]
        blended.append(l1 * mi3 + l2 * (1.0 - mi3))

    result = blended[0]
    for i in range(1, levels + 1):
        target_h, target_w = blended[i].shape[:2]
        result = cv2.pyrUp(result, dstsize=(target_w, target_h)) + blended[i]

    out = np.clip(result, 0, 255).astype(np.uint8)

    # FIX 2b — boundary reinforcement:
    # pyrUp/pyrDown rounding at strip edges can leave a small reconstruction
    # residual at x=0 and x=w-1 even when mask=1 or mask=0.  Pinning the first
    # and last few columns to the exact source tile eliminates this.
    REINFORCE = min(4, w // 4)
    if REINFORCE > 0:
        for i in range(REINFORCE):
            alpha = float(i) / REINFORCE          # 0 at edge → 1 inside
            out[:, i] = np.clip(
                alpha * out[:, i].astype(float)
                + (1.0 - alpha) * img1[:, i].astype(float),
                0, 255).astype(np.uint8)
            out[:, w - 1 - i] = np.clip(
                alpha * out[:, w - 1 - i].astype(float)
                + (1.0 - alpha) * img2[:, w - 1 - i].astype(float),
                0, 255).astype(np.uint8)

    return out


# ── FIX 1 helper: build a directional cosine-ramp blend mask ─────────────────

def _cosine_ramp(n):
    """1-D cosine ramp: 1.0 at index 0, 0.0 at index n-1."""
    if n <= 1:
        return np.array([1.0], dtype=np.float32)
    return ((np.cos(np.linspace(0, np.pi, n)) + 1.0) * 0.5).astype(np.float32)


def _make_blend_mask(sh_, sw_, axis):
    """
    FIX 1: cosine ramp across the overlap strip, directed towards the owning tile.

    axis=1 (H seam, left→right):  mask is 1 at left edge, 0 at right edge.
    axis=0 (V seam, top→bottom):  mask is 1 at top edge,  0 at bottom edge.
    """
    if axis == 1:
        ramp = _cosine_ramp(sw_)                              # shape (sw_,)
        return np.broadcast_to(ramp[np.newaxis, :], (sh_, sw_)).copy()
    else:
        ramp = _cosine_ramp(sh_)                              # shape (sh_,)
        return np.broadcast_to(ramp[:, np.newaxis], (sh_, sw_)).copy()


def _stitch(images, positions, pyramid_levels):
    """
    Place all tiles on canvas using Laplacian pyramid blending.

    Pass 1: Gaussian-weighted accumulation → base canvas (single-tile regions
            are correct; overlap regions are a starting point that gets replaced).
    Pass 2: Pyramid-blend each overlap strip and write back.
            FIX 1: mask is now a cosine ramp so strip edges match the base.
            FIX 2: pyramid depth is clamped to the overlap size.
    Pass 3: FIX 3 — re-blend the corner patches using a 2-D cosine mask.
    """
    h, w = list(images.values())[0].shape[:2]

    min_x     = min(x for x, y in positions.values())
    min_y     = min(y for x, y in positions.values())
    positions = {k: (x - min_x, y - min_y) for k, (x, y) in positions.items()}

    max_x = max(x for x, y in positions.values()) + w
    max_y = max(y for x, y in positions.values()) + h

    canvas     = np.zeros((max_y, max_x, 3), dtype=np.float32)
    weight_sum = np.zeros((max_y, max_x),    dtype=np.float32)

    # Centre-weighted Gaussian tile weight (same as original)
    sigma_x = w / 4.0
    sigma_y = h / 4.0
    cx, cy  = w / 2.0, h / 2.0
    xs = np.arange(w, dtype=np.float32)
    ys = np.arange(h, dtype=np.float32)
    tile_weight = np.exp(
        -0.5 * ((xs[np.newaxis, :] - cx) / sigma_x) ** 2
        -0.5 * ((ys[:, np.newaxis] - cy) / sigma_y) ** 2
    ).astype(np.float32)

    for key in sorted(positions.keys()):
        if key not in images:
            continue
        x0, y0 = positions[key]
        tile    = images[key].astype(np.float32)
        w3      = tile_weight[:, :, np.newaxis]
        canvas    [y0:y0+h, x0:x0+w] += tile * w3
        weight_sum[y0:y0+h, x0:x0+w] += tile_weight

    weight_sum = np.maximum(weight_sum, 1e-6)
    base = np.clip(canvas / weight_sum[:, :, np.newaxis], 0, 255).astype(np.uint8)

    img_h, img_w = h, w

    def _blend_overlap(key_a, key_b, xa0, ya0, xb0, yb0, axis):
        if key_a not in images or key_b not in images:
            return

        if axis == 1:  # horizontal seam
            overlap = (xa0 + img_w) - xb0
            if overlap <= 4:
                return
            oy0 = max(ya0, yb0)
            oy1 = min(ya0 + img_h, yb0 + img_h)
            if oy1 - oy0 <= 0:
                return
            la0 = max(0, oy0 - ya0);  la1 = min(img_h, oy1 - ya0)
            lb0 = max(0, oy0 - yb0);  lb1 = min(img_h, oy1 - yb0)
            lx0 = max(0, img_w - overlap);  lx1 = img_w
            rx0 = 0;                         rx1 = min(overlap, img_w)
            strip_l = images[key_a][la0:la1, lx0:lx1]
            strip_r = images[key_b][lb0:lb1, rx0:rx1]
            cx0 = xb0;  cx1 = xa0 + img_w
            cy0 = oy0;  cy1 = oy0 + min(la1-la0, lb1-lb0)

        else:  # vertical seam
            overlap = (ya0 + img_h) - yb0
            if overlap <= 4:
                return
            ox0 = max(xa0, xb0)
            ox1 = min(xa0 + img_w, xb0 + img_w)
            if ox1 - ox0 <= 0:
                return
            ta0 = max(0, ox0 - xa0);  ta1 = min(img_w, ox1 - xa0)
            tb0 = max(0, ox0 - xb0);  tb1 = min(img_w, ox1 - xb0)
            ty0 = max(0, img_h - overlap);  ty1 = img_h
            by0 = 0;                         by1 = min(overlap, img_h)
            strip_l = images[key_a][ty0:ty1, ta0:ta1]
            strip_r = images[key_b][by0:by1, tb0:tb1]
            cx0 = ox0;       cx1 = ox0 + min(ta1-ta0, tb1-tb0)
            cy0 = yb0;       cy1 = yb0 + min(ty1-ty0, by1-by0)

        sh_ = min(strip_l.shape[0], strip_r.shape[0])
        sw_ = min(strip_l.shape[1], strip_r.shape[1])
        if sh_ <= 0 or sw_ <= 0:
            return

        strip_l = strip_l[:sh_, :sw_].copy()
        strip_r = strip_r[:sh_, :sw_].copy()

        # ── FIX 1: directional cosine ramp, not Gaussian-weight ratio ────
        blend_mask = _make_blend_mask(sh_, sw_, axis)

        blended = _pyramid_blend(strip_l, strip_r, blend_mask, pyramid_levels)

        cy1_real = cy0 + sh_
        cx1_real = cx0 + sw_
        if cy1_real > base.shape[0] or cx1_real > base.shape[1]:
            return
        base[cy0:cy1_real, cx0:cx1_real] = blended

    # Pass 2: blend H and V seams
    for key in sorted(positions.keys()):
        if key not in images:
            continue
        row, col = key
        x0, y0   = positions[key]

        right_key = (row, col + 1)
        if right_key in positions:
            rx0, ry0 = positions[right_key]
            _blend_overlap(key, right_key, x0, y0, rx0, ry0, axis=1)

        bottom_key = (row + 1, col)
        if bottom_key in positions:
            bx0, by0 = positions[bottom_key]
            _blend_overlap(key, bottom_key, x0, y0, bx0, by0, axis=0)

    # ── FIX 3: re-blend corner patches with a 2-D cosine mask ────────────
    # At every grid corner (r,c)+(r,c+1)+(r+1,c)+(r+1,c+1) there are 4 tiles.
    # The overlap_H x overlap_V patch was written by two 1-D blends in series.
    # We replace it with a single blend using a smooth 2-D cosine mask that
    # weights each tile by its Gaussian weight at that pixel.
    for key in sorted(positions.keys()):
        if key not in images:
            continue
        row, col = key
        right_key  = (row,     col + 1)
        bottom_key = (row + 1, col)
        br_key     = (row + 1, col + 1)

        if not all(k in images and k in positions
                   for k in [right_key, bottom_key, br_key]):
            continue

        x0, y0   = positions[key]
        rx0, ry0 = positions[right_key]
        bx0, by0 = positions[bottom_key]
        brx0, bry0 = positions[br_key]

        # Corner patch extent
        ov_x = (x0 + img_w) - rx0   # horizontal overlap width
        ov_y = (y0 + img_h) - by0   # vertical overlap height
        if ov_x <= 4 or ov_y <= 4:
            continue

        # Each tile's strip inside the corner
        a_y0, a_y1 = img_h - ov_y, img_h
        a_x0, a_x1 = img_w - ov_x, img_w
        b_y0, b_y1 = img_h - ov_y, img_h
        b_x0, b_x1 = 0, ov_x
        c_y0, c_y1 = 0, ov_y
        c_x0, c_x1 = img_w - ov_x, img_w
        d_y0, d_y1 = 0, ov_y
        d_x0, d_x1 = 0, ov_x

        pa = images[key]      [a_y0:a_y1, a_x0:a_x1].astype(np.float32)
        pb = images[right_key ][b_y0:b_y1, b_x0:b_x1].astype(np.float32)
        pc = images[bottom_key][c_y0:c_y1, c_x0:c_x1].astype(np.float32)
        pd = images[br_key]   [d_y0:d_y1, d_x0:d_x1].astype(np.float32)

        # Ensure all patches are the same size
        mh = min(pa.shape[0], pb.shape[0], pc.shape[0], pd.shape[0])
        mw = min(pa.shape[1], pb.shape[1], pc.shape[1], pd.shape[1])
        pa, pb, pc, pd = [p[:mh, :mw] for p in [pa, pb, pc, pd]]

        # 2-D cosine weights for each corner quadrant
        ramp_x = _cosine_ramp(mw)                         # 1→0 left→right
        ramp_y = _cosine_ramp(mh)                         # 1→0 top→bottom
        wa = ramp_y[:, np.newaxis] * ramp_x[np.newaxis, :]   # top-left
        wb = ramp_y[:, np.newaxis] * (1 - ramp_x)[np.newaxis, :]  # top-right
        wc = (1 - ramp_y)[:, np.newaxis] * ramp_x[np.newaxis, :]  # bottom-left
        wd = (1 - ramp_y)[:, np.newaxis] * (1 - ramp_x)[np.newaxis, :]  # bottom-right

        total = wa + wb + wc + wd + 1e-6
        wa, wb, wc, wd = wa/total, wb/total, wc/total, wd/total

        blended_corner = (pa * wa[:, :, np.newaxis]
                          + pb * wb[:, :, np.newaxis]
                          + pc * wc[:, :, np.newaxis]
                          + pd * wd[:, :, np.newaxis])
        blended_corner = np.clip(blended_corner, 0, 255).astype(np.uint8)

        # Write corner back to canvas
        cp_y0 = by0
        cp_x0 = rx0
        cp_y1 = cp_y0 + mh
        cp_x1 = cp_x0 + mw
        if cp_y1 <= base.shape[0] and cp_x1 <= base.shape[1]:
            base[cp_y0:cp_y1, cp_x0:cp_x1] = blended_corner

    return base


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
        pyramid_levels=_PYRAMID_LEVELS
):
    """
    Stitch a grid of microscope images into a single output JPEG.
    Drop-in replacement for WPImageStitching.stitch_images().
    """
    step_x = int(round(stage_move_x_um / um_per_px))
    step_y = int(round(stage_move_y_um / um_per_px))

    images = _load_grid_images(folder)
    if not images:
        raise FileNotFoundError(
            f"No grid images found in '{folder}'. "
            f"Expected files named 00_00.jpg as produced by take_image()."
        )

    images = _normalize_orientations(images, image_width_px, image_height_px)
    if not images:
        raise RuntimeError("No images remained after orientation normalisation.")

    rows = sorted(set(r for r, c in images.keys()))
    cols = sorted(set(c for r, c in images.keys()))

    positions = _compute_tile_positions(
        images, rows, cols,
        step_x=step_x, step_y=step_y,
        tolerance=tolerance_px,
        n_peaks=n_peaks
    )

    result      = _stitch(images, positions, pyramid_levels)
    output_path = os.path.join(folder, output_filename)
    cv2.imwrite(output_path, result, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
    return os.path.abspath(output_path)