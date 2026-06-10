"""
WPImageStitchingFull.py  —  Strip-based stitcher for large grids
==================================================================
Same algorithm as WPImageStitching.py but processes one row at a time
to keep RAM bounded to ~2 GB regardless of grid size.

Strategy
--------
  Pass 1  For each tile row:
            - Load that row's tiles at FULL resolution
            - Run phase correlation (H pairs only within the row)
            - Run global optimisation for that row
            - Run seam measurement and composition → strip image
            - Save strip to disk as JPEG 90
            - Free all tile RAM before next row

  Pass 2  Measure V offsets between adjacent strips at REDUCED resolution
            (strips are narrow vertically so this is cheap)

  Pass 3  Load strips at REDUCED resolution, stack with V offsets,
            crop, save as WebP 75

Naming convention : 00_00.jpg  (row_col, zero-padded, underscore separator)
Entry point       : stitch_images_large(folder=...)
"""

import cv2
import numpy as np
import os
import shutil
import gc
from pathlib import Path

from utilities.WPImageStitching import (
    _normalize_orientations,
    _phase_corr_peak,
    _subwindow_dy,
    _measure_pair_h,
    _measure_pair_v,
    _global_tile_positions,
    _tile_geometry,
    _measure_all_seams,
    _smooth_seam_cuts,
    _compose_wavefront,
    _crop_to_content,
    _IMAGE_WIDTH_PX,
    _IMAGE_HEIGHT_PX,
    _UM_PER_PX,
    _STAGE_MOVE_X_UM,
    _STAGE_MOVE_Y_UM,
    _TOLERANCE_PX,
    _DY_TOLERANCE_V,
    _DX_TOLERANCE_V,
)

_STRIP_JPEG_QUALITY = 90    # strip intermediate quality — high to preserve detail
_WEBP_QUALITY       = 75    # final output
_STRIP_SCALE        = 0.25  # scale for pass 2/3 (strip stacking)


# ==============================================================================
# HELPERS
# ==============================================================================

def _load_row(folder, row, cols):
    """Load all tiles for a single row at full resolution."""
    images = {}
    for c in cols:
        fp = Path(folder) / f"{row:02d}_{c:02d}.jpg"
        if fp.exists():
            img = cv2.imread(str(fp))
            if img is not None:
                images[(row, c)] = img
    return images


def _discover_grid(folder):
    """Scan folder and return sorted (rows, cols) lists."""
    rows_set, cols_set = set(), set()
    for fp in Path(folder).glob("*.jp*g"):
        parts = fp.stem.split("_")
        if len(parts) == 2:
            try:
                r, c = int(parts[0]), int(parts[1])
                rows_set.add(r)
                cols_set.add(c)
            except ValueError:
                pass
    return sorted(rows_set), sorted(cols_set)


def _stitch_single_row(row, cols, folder, step_x, step_y, tolerance_px,
                       image_width_px, image_height_px):
    """
    Load, stitch and return a single row strip at full resolution.
    Returns the strip image (numpy array) or None if no tiles found.
    """
    images = _load_row(folder, row, cols)
    if not images:
        return None

    images = _normalize_orientations(images, image_width_px, image_height_px)
    if not images:
        return None

    row_cols = sorted(set(c for _, c in images.keys()))

    # H pairs only (within the row)
    pair_offsets = {}
    for ci in range(len(row_cols) - 1):
        c, cn = row_cols[ci], row_cols[ci + 1]
        if (row, c) not in images or (row, cn) not in images:
            continue
        dx, dy = _measure_pair_h(images[(row, c)], images[(row, cn)],
                                 step_x, tolerance_px)
        pair_offsets[(row, c, row, cn)] = (dx, dy)

    rows_single = [row]
    positions   = _global_tile_positions(pair_offsets, rows_single, row_cols)
    geo         = _tile_geometry(images, positions, rows_single, row_cols)
    raw_log     = _measure_all_seams(images, positions, rows_single, row_cols, geo)
    seam_log    = _smooth_seam_cuts(raw_log, rows_single, row_cols)
    strip       = _compose_wavefront(images, positions, rows_single, row_cols,
                                     geo, seam_log)
    del images
    gc.collect()
    return strip


# ==============================================================================
# PUBLIC API
# ==============================================================================

def stitch_images_large(
        folder,
        output_filename="stitched.webp",
        stage_move_x_um=_STAGE_MOVE_X_UM,
        stage_move_y_um=_STAGE_MOVE_Y_UM,
        um_per_px=_UM_PER_PX,
        image_width_px=_IMAGE_WIDTH_PX,
        image_height_px=_IMAGE_HEIGHT_PX,
        tolerance_px=_TOLERANCE_PX,
        crop_inset_x=100,
        crop_inset_y=100,
):
    """
    Stitch a large grid of microscope images into a single WebP.

    Processes one row at a time to keep RAM bounded (~2 GB peak).
    Strips are saved to disk between passes.

    Returns absolute path to the output file.
    """
    step_x = int(round(stage_move_x_um / um_per_px))
    step_y = int(round(stage_move_y_um / um_per_px))

    print("=" * 60)
    print("  Large Grid Stitcher  —  Strip-based, RAM-bounded")
    print("=" * 60)
    print(f"\n  Stage move X : {stage_move_x_um} um  ->  {step_x} px")
    print(f"  Stage move Y : {stage_move_y_um} um  ->  {step_y} px")
    print(f"  Image size   : {image_width_px} x {image_height_px} px")
    print(f"  Strip scale  : {_STRIP_SCALE*100:.0f}% for final stack\n")

    rows, cols = _discover_grid(folder)
    if not rows or not cols:
        raise FileNotFoundError(
            f"No grid images found in '{folder}'. "
            "Expected files named 00_00.jpg.")

    print(f"  Grid: {len(rows)} rows x {len(cols)} cols  "
          f"({len(rows) * len(cols)} tiles total)\n")

    # ── Pass 1: stitch each row → save strip to disk ──────────────────
    strip_folder = os.path.join(folder, "_strips")
    os.makedirs(strip_folder, exist_ok=True)
    strip_paths  = []

    for ri, r in enumerate(rows):
        print(f"\n=== Row {ri+1}/{len(rows)}  (row index {r}) ===")
        strip = _stitch_single_row(r, cols, folder, step_x, step_y,
                                   tolerance_px, image_width_px, image_height_px)
        if strip is None:
            print(f"  ⚠️  No tiles for row {r}, skipping")
            continue

        strip_path = os.path.join(strip_folder, f"strip_{r:04d}.jpg")
        cv2.imwrite(strip_path, strip, [cv2.IMWRITE_JPEG_QUALITY, _STRIP_JPEG_QUALITY])
        mb = os.path.getsize(strip_path) / 1e6
        print(f"  Strip saved: {strip_path}  ({strip.shape[1]}x{strip.shape[0]} px, {mb:.1f} MB)")
        strip_paths.append((r, strip_path))
        del strip
        gc.collect()

    if not strip_paths:
        raise RuntimeError("No strips were produced — check tile files.")

    # ── Pass 2: measure V offsets between adjacent strips at reduced res ──
    print(f"\n=== Pass 2: measuring inter-strip V offsets "
          f"(at {_STRIP_SCALE*100:.0f}% resolution) ===")

    strip_images_scaled = {}
    for r, path in strip_paths:
        img = cv2.imread(path)
        img = cv2.resize(img, (0, 0), fx=_STRIP_SCALE, fy=_STRIP_SCALE,
                         interpolation=cv2.INTER_AREA)
        strip_images_scaled[r] = img

    # measure vertical offset between each pair of adjacent strips
    strip_rows  = [r for r, _ in strip_paths]
    v_offsets   = {}   # r_top → dy to r_bottom
    for i in range(len(strip_rows) - 1):
        r_top = strip_rows[i]
        r_bot = strip_rows[i + 1]
        img_t = strip_images_scaled[r_top]
        img_b = strip_images_scaled[r_bot]
        scaled_step_y = int(round(step_y * _STRIP_SCALE))
        dx, dy = _measure_pair_v(img_t, img_b, scaled_step_y, tolerance_px)
        v_offsets[r_top] = dy
        print(f"  strip {r_top} -> strip {r_bot}:  dy={dy:+d}  dx={dx:+d}")

    # ── Pass 3: stack strips at reduced resolution ────────────────────
    print(f"\n=== Pass 3: stacking {len(strip_paths)} strips ===")

    # compute canvas height from accumulated V offsets
    strip_h    = strip_images_scaled[strip_rows[0]].shape[0]
    strip_w    = strip_images_scaled[strip_rows[0]].shape[1]
    total_dy   = sum(v_offsets.get(r, strip_h) for r in strip_rows[:-1]) + strip_h
    canvas_h   = max(total_dy, strip_h * len(strip_rows))
    canvas     = np.zeros((canvas_h, strip_w, 3), dtype=np.uint8)

    y_cursor = 0
    for i, r in enumerate(strip_rows):
        img = strip_images_scaled[r]
        h   = img.shape[0]
        end = min(y_cursor + h, canvas_h)
        canvas[y_cursor:end, :img.shape[1]] = img[:end - y_cursor]
        if i < len(strip_rows) - 1:
            y_cursor += v_offsets.get(r, h)

    del strip_images_scaled
    gc.collect()

    # ── crop and save ─────────────────────────────────────────────────
    print("\n=== Crop and save ===")
    canvas = _crop_to_content(canvas, inset_x=crop_inset_x, inset_y=crop_inset_y)

    output_path = os.path.join(folder, output_filename)
    cv2.imwrite(output_path, canvas, [cv2.IMWRITE_WEBP_QUALITY, _WEBP_QUALITY])
    mb = os.path.getsize(output_path) / 1e6
    print(f"  -> {output_path}  ({canvas.shape[1]}x{canvas.shape[0]} px, {mb:.1f} MB)")

    # cleanup strips
    shutil.rmtree(strip_folder)
    print(f"  Strip folder cleaned up.")
    print("\n=== All done ===")

    return os.path.abspath(output_path)