"""
WPImageStitching.py
Microscope grid stitcher — fixed step + phase correlation refinement.
Expects images named 00_00.jpg (row_col) as produced by take_image().

Improvements over v1:
  - Hann windowing before FFT to suppress spectral leakage on periodic structures
  - Multi-peak selection: picks peak most consistent with expected offset
    rather than blindly taking the global maximum
  - Laplacian pyramid blending: high frequencies blended with a sharp seam,
    low frequencies with a wide feather — eliminates blur at tile borders
"""

import cv2
import numpy as np
import os
from pathlib import Path
from scipy.ndimage import maximum_filter


# ==============================================================================
# DEFAULT CONFIG  (tuned/tested values — override via function args if needed)
# ==============================================================================

_IMAGE_WIDTH_PX  = 2464
_IMAGE_HEIGHT_PX = 2056
_UM_PER_PX       = 1.41
_STAGE_MOVE_X_UM = 3140
_STAGE_MOVE_Y_UM = 2600
_TOLERANCE_PX    = 20
_JPEG_QUALITY    = 95
_N_PEAKS         = 5     # number of correlation peaks to evaluate
_PYRAMID_LEVELS  = 4     # Laplacian pyramid depth for blending

# ==============================================================================


def _load_grid_images(folder):
    """Load images named 00_00.jpg and return dict keyed by (row, col)."""
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
    """Rotate portrait tiles to landscape if dimensions are transposed."""
    fixed = {}
    for key, img in images.items():
        h, w = img.shape[:2]
        if w == target_h and h == target_w:
            img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
        elif w != target_w or h != target_h:
            continue  # skip unexpected sizes silently
        fixed[key] = img
    return fixed


def _find_best_peak(corr, mask, sh, sw, expected_dx, expected_dy, n_peaks):
    """
    Find the N strongest local maxima in the masked correlation map and
    return the one closest to the expected offset.

    Picking the nearest-to-expected peak rather than the global maximum
    avoids false locks on periodic repetitions of the structure, which
    produce equally strong (sometimes stronger) spurious peaks.
    """
    # Suppress non-local-maxima (min_distance ~ 5 px between peaks)
    local_max  = maximum_filter(corr * mask, size=5)
    peak_mask  = (corr == local_max) & (mask > 0)
    peak_coords = np.argwhere(peak_mask)

    if len(peak_coords) == 0:
        # Fallback: use raw argmax
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
    """
    Refine inter-tile shift using phase correlation on the overlap strip only.

    Hann windowing is applied before the FFT to suppress spectral leakage,
    which is the primary cause of false peaks on fine periodic structures.
    Peak selection then picks the candidate most consistent with the nominal
    stage offset rather than the raw global maximum.
    """
    h, w = img1.shape[:2]

    if abs(expected_dx) > abs(expected_dy):
        # Horizontal neighbour — overlap is right edge of img1 / left of img2
        overlap_w = w - step_x
        if overlap_w < 10:
            return int(round(expected_dx)), int(round(expected_dy))
        strip1 = img1[:, w - overlap_w:]
        strip2 = img2[:, :overlap_w]
        # For refine_shift the local expected offset within the strip is ~0
        local_expected_dx, local_expected_dy = 0, 0
    else:
        # Vertical neighbour — overlap is bottom of img1 / top of img2
        overlap_h = h - step_y
        if overlap_h < 10:
            return int(round(expected_dx)), int(round(expected_dy))
        strip1 = img1[h - overlap_h:, :]
        strip2 = img2[:overlap_h, :]
        local_expected_dx, local_expected_dy = 0, 0

    g1 = cv2.cvtColor(strip1, cv2.COLOR_BGR2GRAY).astype(np.float32)
    g2 = cv2.cvtColor(strip2, cv2.COLOR_BGR2GRAY).astype(np.float32)
    sh, sw = g1.shape

    # Hann window — critical for periodic structures
    win  = np.outer(np.hanning(sh), np.hanning(sw)).astype(np.float32)
    g1  *= win
    g2  *= win

    F1   = np.fft.fft2(g1)
    F2   = np.fft.fft2(g2)
    R    = F1 * np.conj(F2)
    R   /= (np.abs(R) + 1e-8)
    corr = np.fft.ifft2(R).real

    # Restrict search to within tolerance of zero (strips are pre-aligned)
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
    """
    Chain refined offsets from left/top neighbours, averaging both when
    available to prevent drift across the grid.
    """
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
                        tolerance=tolerance, n_peaks=n_peaks
                    )
                    lx, ly = positions[left_key]
                    estimates.append((lx + dx, ly + dy))

            if ri > 0:
                top_key = (rows[ri - 1], c)
                if top_key in images and (r, c) in images:
                    dx, dy = _refine_shift(
                        images[top_key], images[(r, c)],
                        expected_dx=0, expected_dy=step_y,
                        step_x=step_x, step_y=step_y,
                        tolerance=tolerance, n_peaks=n_peaks
                    )
                    tx, ty = positions[top_key]
                    estimates.append((tx + dx, ty + dy))

            positions[(r, c)] = (
                int(round(np.mean([e[0] for e in estimates]))),
                int(round(np.mean([e[1] for e in estimates])))
            ) if estimates else (0, 0)

    return positions


def _safe_pyramid_levels(h, w, requested):
    """Clamp pyramid depth so the smallest level is at least 4 px on each axis."""
    levels = 0
    ch, cw = h, w
    for _ in range(requested):
        ch, cw = (ch + 1) // 2, (cw + 1) // 2
        if ch < 4 or cw < 4:
            break
        levels += 1
    return max(levels, 1)


def _pyramid_blend(img1, img2, mask_1ch, levels):
    """
    Laplacian pyramid blending.

    High frequencies are blended with a sharp transition at the seam;
    low frequencies are blended with a wide feather. This avoids the
    double-edge blur that linear blending produces when tiles are even
    1-2 px misaligned.

    Args:
        img1, img2 : uint8 BGR tiles of identical size
        mask_1ch   : float32 H x W, values 0..1  (1 = fully img1)
        levels     : pyramid depth (clamped automatically to safe depth)
    """
    h, w = img1.shape[:2]
    levels = _safe_pyramid_levels(h, w, levels)

    f1 = img1.astype(np.float32)
    f2 = img2.astype(np.float32)
    # Keep mask 2D throughout — broadcast to 3ch only at blend step
    m  = mask_1ch.astype(np.float32)

    # Build Gaussian pyramids (images 3ch, mask 2D — built separately)
    gp1, gp2, gpm = [f1], [f2], [m]
    for _ in range(levels):
        gp1.append(cv2.pyrDown(gp1[-1]))
        gp2.append(cv2.pyrDown(gp2[-1]))
        gpm.append(cv2.pyrDown(gpm[-1]))

    # Build Laplacian pyramids — force pyrUp to match parent size exactly
    lp1 = [gp1[-1]]
    lp2 = [gp2[-1]]
    for i in range(levels, 0, -1):
        target_h, target_w = gp1[i - 1].shape[:2]
        up1 = cv2.pyrUp(gp1[i], dstsize=(target_w, target_h))
        up2 = cv2.pyrUp(gp2[i], dstsize=(target_w, target_h))
        lp1.append(gp1[i - 1] - up1)
        lp2.append(gp2[i - 1] - up2)

    # Blend each pyramid level — broadcast mask to 3ch here only
    blended = []
    for l1, l2, mi in zip(lp1, lp2, gpm[::-1]):
        # Ensure mask spatial dims match this level (pyrDown rounding safety)
        mi_resized = cv2.resize(mi, (l1.shape[1], l1.shape[0]),
                                interpolation=cv2.INTER_LINEAR)
        mi3 = mi_resized[:, :, np.newaxis]
        blended.append(l1 * mi3 + l2 * (1.0 - mi3))

    # Reconstruct from coarsest level up
    result = blended[0]
    for i in range(1, levels + 1):
        target_h, target_w = blended[i].shape[:2]
        result = cv2.pyrUp(result, dstsize=(target_w, target_h)) + blended[i]

    return np.clip(result, 0, 255).astype(np.uint8)



def _stitch(images, positions, pyramid_levels):
    """
    Place all tiles on canvas in a single pass using Laplacian pyramid blending.

    Each pixel on the canvas is written from the original tile image(s) only —
    never from pre-blended canvas data — so no double-processing occurs.

    Non-overlapping regions: copied directly from the tile.
    Overlapping regions: pyramid-blended from the two original tiles.
    """
    h, w = list(images.values())[0].shape[:2]

    min_x     = min(x for x, y in positions.values())
    min_y     = min(y for x, y in positions.values())
    positions = {k: (x - min_x, y - min_y) for k, (x, y) in positions.items()}

    max_x  = max(x for x, y in positions.values()) + w
    max_y  = max(y for x, y in positions.values()) + h

    canvas     = np.zeros((max_y, max_x, 3), dtype=np.float32)
    weight_sum = np.zeros((max_y, max_x),    dtype=np.float32)

    # Centre-weighted Gaussian mask for each tile — naturally suppresses dark
    # vignette edges and gives bright tile centres priority in overlap zones.
    sigma_x = w / 4.0
    sigma_y = h / 4.0
    cx, cy  = w / 2.0, h / 2.0
    xs      = np.arange(w, dtype=np.float32)
    ys      = np.arange(h, dtype=np.float32)
    tile_weight = np.exp(
        -0.5 * ((xs[np.newaxis, :] - cx) / sigma_x) ** 2
        -0.5 * ((ys[:, np.newaxis] - cy) / sigma_y) ** 2
    ).astype(np.float32)

    # Accumulate weighted tiles
    for key in sorted(positions.keys()):
        if key not in images:
            continue
        x0, y0 = positions[key]
        tile    = images[key].astype(np.float32)
        w3      = tile_weight[:, :, np.newaxis]
        canvas    [y0:y0+h, x0:x0+w] += tile * w3
        weight_sum[y0:y0+h, x0:x0+w] += tile_weight

    # Normalise
    weight_sum = np.maximum(weight_sum, 1e-6)
    base       = np.clip(canvas / weight_sum[:, :, np.newaxis], 0, 255).astype(np.uint8)

    img_h, img_w = h, w  # single-tile dimensions

    def _blend_overlap(key_a, key_b, xa0, ya0, xb0, yb0, axis):
        """
        Pyramid-blend the overlap strip between tile a and tile b.
        axis=1: horizontal seam (a is left,  b is right)
        axis=0: vertical   seam (a is top,   b is bottom)
        """
        if key_a not in images or key_b not in images:
            return

        if axis == 1:  # horizontal — overlap in X
            overlap = (xa0 + img_w) - xb0
            if overlap <= 4:
                return
            # Y extent shared by both tiles
            oy0 = max(ya0, yb0)
            oy1 = min(ya0 + img_h, yb0 + img_h)
            if oy1 - oy0 <= 0:
                return
            # Clamp into each tile's coordinate space
            la0 = max(0, oy0 - ya0);  la1 = min(img_h, oy1 - ya0)
            lb0 = max(0, oy0 - yb0);  lb1 = min(img_h, oy1 - yb0)
            lx0 = max(0, img_w - overlap);  lx1 = img_w
            rx0 = 0;                         rx1 = min(overlap, img_w)
            strip_l = images[key_a][la0:la1, lx0:lx1]
            strip_r = images[key_b][lb0:lb1, rx0:rx1]
            wgt_l   = tile_weight  [la0:la1, lx0:lx1]
            wgt_r   = tile_weight  [lb0:lb1, rx0:rx1]
            # Canvas region to write back
            cx0 = xb0;  cx1 = xa0 + img_w
            cy0 = oy0;  cy1 = oy0 + min(la1-la0, lb1-lb0)

        else:  # vertical — overlap in Y
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
            wgt_l   = tile_weight  [ty0:ty1, ta0:ta1]
            wgt_r   = tile_weight  [by0:by1, tb0:tb1]
            cx0 = ox0;       cx1 = ox0 + min(ta1-ta0, tb1-tb0)
            cy0 = yb0;       cy1 = yb0 + min(ty1-ty0, by1-by0)

        sh_ = min(strip_l.shape[0], strip_r.shape[0])
        sw_ = min(strip_l.shape[1], strip_r.shape[1])
        if sh_ <= 0 or sw_ <= 0:
            return

        strip_l = strip_l[:sh_, :sw_].copy()
        strip_r = strip_r[:sh_, :sw_].copy()
        wgt_l   = wgt_l  [:sh_, :sw_]
        wgt_r   = wgt_r  [:sh_, :sw_]

        blend_mask = wgt_l / np.maximum(wgt_l + wgt_r, 1e-6)
        blended    = _pyramid_blend(strip_l, strip_r, blend_mask, pyramid_levels)

        cy1_real = cy0 + sh_
        cx1_real = cx0 + sw_
        if cy1_real > base.shape[0] or cx1_real > base.shape[1]:
            return
        base[cy0:cy1_real, cx0:cx1_real] = blended

    for key in sorted(positions.keys()):
        if key not in images:
            continue
        row, col = key
        x0, y0   = positions[key]

        right_key  = (row, col + 1)
        if right_key in positions:
            rx0, ry0 = positions[right_key]
            _blend_overlap(key, right_key, x0, y0, rx0, ry0, axis=1)

        bottom_key = (row + 1, col)
        if bottom_key in positions:
            bx0, by0 = positions[bottom_key]
            _blend_overlap(key, bottom_key, x0, y0, bx0, by0, axis=0)

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

    Expects images named 00_00.jpg (row_col) in folder, as produced by take_image().
    Output is saved as <folder>/<output_filename>.

    Args:
        folder:           Path to folder containing the grid images.
        output_filename:  Output file name (saved inside folder).
        stage_move_x_um:  Stage step in X (micrometers).
        stage_move_y_um:  Stage step in Y (micrometers).
        um_per_px:        Micrometers per pixel for this camera/lens.
        image_width_px:   Expected tile width in pixels.
        image_height_px:  Expected tile height in pixels.
        tolerance_px:     Phase correlation search radius (pixels).
        jpeg_quality:     JPEG output quality (0-100).
        n_peaks:          Number of correlation peaks to evaluate (default 5).
        pyramid_levels:   Laplacian pyramid depth for overlap blending (default 4).

    Returns:
        str: Absolute path to the stitched output file.

    Raises:
        FileNotFoundError: If no valid grid images are found in folder.
        RuntimeError:      If stitching fails.
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