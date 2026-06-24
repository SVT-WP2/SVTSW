"""
WPImageStitchingFull.py  —  Canvas-free band stitcher for large grids
==============================================================================
Same position quality as WPImageStitching.py (global least-squares optimisation)
with RAM bounded to a few GB and no full-resolution scratch canvas.

Strategy
--------
  Pass 1  Measure all adjacent pair offsets (H and V):
            - Load tile pair at full resolution (previous tile cached in the
              H sweep, so each tile is decoded ~3x instead of 4x)
            - Run phase correlation → (dx, dy), store offset, discard tiles

  Pass 2  Global least-squares position optimisation:
            - Matrix-free conjugate-gradient solver (in WPImageStitching.py):
              O(edges) memory, seconds even for 150x150 grids.

  Pass 3  Rolling-band composition (no disk canvas):
            - A full-mosaic-width band of ~1 tile-row height lives in RAM.
            - Tiles are placed row by row; seam cuts are measured against the
              band content over the geometrically valid overlap (same regions
              and same graph-cut / straight-cut logic as the default stitcher).
            - When a tile row completes, the finished top rows of the band are
              streamed out and the band scrolls down.  The finished rows feed
              TWO outputs simultaneously:
                a) downscaled into the single-file overview (JPEG/WebP,
                   scale auto-fitted to the format's hard per-side limits:
                   WebP 16383 px, JPEG 65500 px — capped by `final_max_px`)
                b) at FULL resolution into a tiled pyramidal BigTIFF
                   (JPEG-compressed tiles, reduced-resolution pages), the
                   format QuPath / openslide / ImageJ open as a zoomable
                   slide.  Requires:  pip install tifffile imagecodecs

Peak RAM ≈ band (~2 GB worst case) + overview buffer (~0.8 GB at default cap)
           + one full-width strip (~0.4 GB) + 2 tiles.
Temp disk for the pyramid cascade ≈ 1/3 of the raw mosaic (auto-deleted);
the BigTIFF itself is JPEG-compressed (~0.3-0.5 byte/px incl. pyramid).

Naming convention : 00_00.jpg / 000_000.jpeg ... (row_col, any zero padding)
Entry point       : stitch_images_large(folder=...)
"""

import cv2
import numpy as np
import os
import sys
import shutil
import threading
import traceback
import queue as _queue
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from utilities.WPImageStitching import (
        _measure_pair_h,
        _measure_pair_v,
        _global_tile_positions,
        _graph_cut_vseam,
        _best_hcut,
        _save_image,
        _WEBP_MAX_PX,
        _JPEG_MAX_PX,
        _IMAGE_WIDTH_PX,
        _IMAGE_HEIGHT_PX,
        _UM_PER_PX,
        _STAGE_MOVE_X_UM,
        _STAGE_MOVE_Y_UM,
        _TOLERANCE_PX,
        _CUT_MARGIN,
    )
except ImportError:
    from WPImageStitching import (
        _measure_pair_h,
        _measure_pair_v,
        _global_tile_positions,
        _graph_cut_vseam,
        _best_hcut,
        _save_image,
        _WEBP_MAX_PX,
        _JPEG_MAX_PX,
        _IMAGE_WIDTH_PX,
        _IMAGE_HEIGHT_PX,
        _UM_PER_PX,
        _STAGE_MOVE_X_UM,
        _STAGE_MOVE_Y_UM,
        _TOLERANCE_PX,
        _CUT_MARGIN,
    )


# ==============================================================================
# HELPERS
# ==============================================================================

def _discover_grid(folder):
    """Scan folder for RR_CC.jpg/.jpeg tiles (any zero-padding, any case).

    Returns (rows, cols, paths) where paths maps (r, c) -> Path.
    """
    rows_set, cols_set, paths = set(), set(), {}
    for fp in sorted(Path(folder).iterdir()):
        if fp.suffix.lower() not in (".jpg", ".jpeg"):
            continue
        parts = fp.stem.split("_")
        if len(parts) == 2:
            try:
                r, c = int(parts[0]), int(parts[1])
            except ValueError:
                continue
            rows_set.add(r)
            cols_set.add(c)
            paths[(r, c)] = fp
    return sorted(rows_set), sorted(cols_set), paths


def _apply_flatfield(tile, flatfield, strength=1.0):
    """Divide a uint8 BGR tile by a flatfield correction map, mean≈1.0.

    flatfield shape:
      (H, W)    — legacy luminance map, same correction applied to all channels
      (H, W, 3) — per-channel BGR map, corrects colour gradients independently

    strength (0.0–1.0) blends the correction towards no-op:
      1.0 → full correction (default)
      0.5 → half the correction effect
      0.0 → passthrough (no correction)
    """
    h, w = tile.shape[:2]
    if flatfield.ndim == 3:
        ff = flatfield[:h, :w, :]                # (h, w, 3) per-channel
    else:
        ff = flatfield[:h, :w, np.newaxis]       # (h, w, 1) luminance → broadcast
    if strength < 1.0:
        ff = 1.0 + (ff - 1.0) * float(strength) # compress towards 1.0
    t  = tile.astype(np.float32) / ff
    return np.clip(t, 0, 255).astype(np.uint8)


def _load_tile(paths, row, col, flatfield=None, flatfield_strength=1.0):
    fp = paths.get((row, col))
    if fp is not None and fp.exists():
        tile = cv2.imread(str(fp))
        if tile is not None and flatfield is not None:
            tile = _apply_flatfield(tile, flatfield, strength=flatfield_strength)
        return tile
    return None


def build_flatfield(folder, sample_n=64, sigma=300, output="flatfield.npy"):
    """Estimate a per-channel illumination correction field from a sample of tiles.

    Samples up to `sample_n` tiles and computes the per-pixel median separately
    for each BGR channel.  Treating channels independently captures both brightness
    gradients and colour-cast gradients (e.g. a left-to-right yellowing caused by
    uneven sensor response or off-axis illumination).

    Each channel is smoothed with a large Gaussian (sigma px) to suppress device
    features and retain only the slow spatial envelope, then normalised to mean=1.0.

    Returns a float32 (H, W, 3) array.  Backward-compatible with old (H, W) maps
    (those are handled in _apply_flatfield via broadcasting).
    Saves to `output` (.npy) if a path is given.
    """
    try:
        from scipy.ndimage import gaussian_filter
    except ImportError:
        raise ImportError("scipy is required: pip install scipy")
    import random

    rows, cols, tile_paths = _discover_grid(folder)
    all_keys = list(tile_paths.keys())
    if not all_keys:
        raise ValueError(f"No tiles found in {folder}")

    sample_n = min(sample_n, len(all_keys))
    sampled  = random.sample(all_keys, sample_n)
    print(f"  Flatfield: sampling {sample_n} / {len(all_keys)} tiles (per-channel) ...")

    ch_stacks = [[], [], []]   # one list per BGR channel
    for r, c in sampled:
        tile = _load_tile(tile_paths, r, c)    # no correction applied here
        if tile is None:
            continue
        for ch in range(3):
            ch_stacks[ch].append(tile[:, :, ch].astype(np.float32))

    n_valid = len(ch_stacks[0])
    if n_valid < 3:
        raise ValueError("Too few valid tiles for flatfield estimation (need ≥ 3)")

    print(f"  Flatfield: per-channel median + Gaussian smooth (σ={sigma} px) "
          f"over {n_valid} tiles ...")

    ch_names = ("B", "G", "R")
    h, w = ch_stacks[0][0].shape
    result = np.empty((h, w, 3), dtype=np.float32)

    for ch in range(3):
        stack   = np.stack(ch_stacks[ch], axis=0)           # (N, H, W)
        median  = np.median(stack, axis=0)                  # (H, W)
        smoothed = gaussian_filter(median, sigma=sigma).astype(np.float32)
        smoothed /= float(smoothed.mean())
        smoothed  = np.clip(smoothed, 0.1, 10.0)
        result[:, :, ch] = smoothed
        print(f"    {ch_names[ch]}: min={smoothed.min():.3f}  "
              f"max={smoothed.max():.3f}  range={smoothed.max()-smoothed.min():.3f}")

    if output:
        np.save(output, result)
        print(f"  Flatfield saved → {output}  shape={result.shape}")

    return result


# ── parallel pair-measurement workers ────────────────────────────────────────
# Thread-based: cv2.imread and numpy FFT both release the GIL so multiple
# threads genuinely run in parallel.  Must be module-level to be picklable
# (future-proofing) and to avoid closure overhead.

def _h_pair_worker(args):
    tile_paths, r, c, cn, step_x, tolerance_px, flatfield, flatfield_strength = args
    t_left  = _load_tile(tile_paths, r,  c,  flatfield, flatfield_strength)
    t_right = _load_tile(tile_paths, r,  cn, flatfield, flatfield_strength)
    if t_left is None or t_right is None:
        return (r, c, r, cn), None
    dx, dy = _measure_pair_h(t_left, t_right, step_x, tolerance_px)
    return (r, c, r, cn), (dx, dy)


def _v_pair_worker(args):
    tile_paths, r, rn, c, step_y, tolerance_px, flatfield, flatfield_strength = args
    t_top = _load_tile(tile_paths, r,  c, flatfield, flatfield_strength)
    t_bot = _load_tile(tile_paths, rn, c, flatfield, flatfield_strength)
    if t_top is None or t_bot is None:
        return (r, c, rn, c), None
    dx, dy, conf = _measure_pair_v(t_top, t_bot, step_y, tolerance_px)
    return (r, c, rn, c), (dx, dy, conf)


def _place_tile(canvas, tile, tx, ty, left_ow=0, x_cut=None,
                top_oh=0, y_cut=None):
    """
    Place tile onto canvas/band at (tx, ty) using pre-computed seam cuts.

    Semantics match the default stitcher's wavefront compositor:
      interior          → tile
      left overlap      → tile where col >= x_cut[row]   (graph-cut path)
      top overlap       → tile where row >= y_cut        (straight cut)
      corner            → tile where either condition holds (OR, like the
                          default's np.maximum mask combination)
    Canvas pixels that are still empty (all-black) inside the tile footprint
    are always filled from the tile, mirroring the default's empty-canvas
    guard (prevents black bleed next to missing tiles / drifted edges).
    """
    Hc, Wc = canvas.shape[:2]
    Ht, Wt = tile.shape[:2]

    x0 = max(0, tx);  x1 = min(Wc, tx + Wt)
    y0 = max(0, ty);  y1 = min(Hc, ty + Ht)
    if x0 >= x1 or y0 >= y1:
        return

    rows_i = np.arange(Ht)[:, None]
    cols_i = np.arange(Wt)[None, :]
    in_left = cols_i < left_ow          # (1, Wt)
    in_top  = rows_i < top_oh           # (Ht, 1)

    if x_cut is not None and left_ow > 0:
        if isinstance(x_cut, np.ndarray):
            cuts = np.clip(x_cut, 0, left_ow).astype(np.int64)
            if len(cuts) < Ht:
                cuts = np.concatenate([cuts,
                                       np.full(Ht - len(cuts), cuts[-1])])
        else:
            cuts = np.full(Ht, min(max(int(x_cut), 0), left_ow), dtype=np.int64)
        vmask = cols_i >= cuts[:, None]     # (Ht, Wt)
    else:
        vmask = np.zeros((Ht, 1), dtype=bool)

    if y_cut is not None and top_oh > 0:
        hmask = rows_i >= int(y_cut)        # (Ht, 1)
    else:
        hmask = np.zeros((Ht, 1), dtype=bool)

    use = (vmask | ~in_left) & (hmask | ~in_top)
    use = use | (in_left & in_top & (vmask | hmask))
    use = np.broadcast_to(use, (Ht, Wt))

    ty0 = y0 - ty;  tx0 = x0 - tx
    t_sub = tile[ty0:ty0 + (y1 - y0), tx0:tx0 + (x1 - x0)]
    m_sub = use[ty0:ty0 + (y1 - y0), tx0:tx0 + (x1 - x0)]

    region = canvas[y0:y1, x0:x1]
    empty  = ~region.any(axis=2)
    m      = m_sub | empty
    region[m] = t_sub[m]


# ==============================================================================
# PYRAMIDAL BigTIFF WRITER
# ==============================================================================

class _PyramidTiff:
    """Streams full-resolution BGR strips into a tiled pyramidal BigTIFF.

    Level 0 is written on a worker thread while composition runs (strips
    arrive through a bounded queue, so RAM stays bounded).  Each pushed
    strip is also 2x-downscaled into a level-1 temp memmap; after level 0
    completes, levels 2+ are cascaded from it and all reduced levels are
    appended as SUBFILETYPE=ReducedImage pages (libvips-style pyramid,
    readable by QuPath / openslide / ImageJ / ASAP).
    """

    def __init__(self, path, w, h, um_per_px, tile=512, quality=85):
        import tifffile  # raises ImportError if unavailable
        self._tifffile = tifffile
        try:
            import imagecodecs  # noqa: F401  (needed for JPEG tiles)
            self._compression = "jpeg"
        except ImportError:
            print("  !! imagecodecs not installed -> TIFF tiles use deflate "
                  "(lossless but several x larger).  pip install imagecodecs")
            self._compression = "zlib"

        self.path = path
        self.w, self.h = w, h
        self.tile = tile
        self.quality = quality
        self.um_per_px = um_per_px
        self._strip_fill = 0
        self._strip = np.empty((tile, w, 3), np.uint8)   # BGR staging
        self._q = _queue.Queue(maxsize=2)
        self._err = []

        # level-1 temp memmap (filled during streaming)
        self.l1_w, self.l1_h = w // 2, h // 2
        self._l1_path = path + ".l1.tmp"
        self._l1 = np.memmap(self._l1_path, dtype=np.uint8, mode="w+",
                             shape=(self.l1_h, self.l1_w, 3))
        self._l1_y = 0

        import inspect
        self._has_cargs = ("compressionargs" in
                           inspect.signature(tifffile.TiffWriter.write).parameters)
        self._tw = tifffile.TiffWriter(path, bigtiff=True)
        self._thread = threading.Thread(target=self._write_level0, daemon=True)
        self._thread.start()

    # ---- writer-thread side -------------------------------------------------
    def _write_kwargs(self, level):
        kw = dict(tile=(self.tile, self.tile),
                  photometric="rgb",
                  compression=self._compression,
                  resolution=(1e4 / (self.um_per_px * 2 ** level),
                              1e4 / (self.um_per_px * 2 ** level)),
                  resolutionunit="CENTIMETER",
                  software="WPImageStitching")
        if self._compression == "jpeg":
            if self._has_cargs:
                kw["compressionargs"] = {"level": self.quality}
            else:
                kw["compression"] = ("jpeg", self.quality)
        return kw

    def _tiles_from_strips(self, strip_iter, w):
        for strip in strip_iter:                      # BGR, (h<=tile, w, 3)
            for x0 in range(0, w, self.tile):
                t = strip[:, x0:x0 + self.tile, ::-1]   # BGR -> RGB
                yield np.ascontiguousarray(t)

    def _queue_strips(self):
        while True:
            s = self._q.get()
            if s is None:
                break
            yield s

    def _write_level0(self):
        try:
            self._tw.write(
                self._tiles_from_strips(self._queue_strips(), self.w),
                shape=(self.h, self.w, 3), dtype=np.uint8,
                subifds=0, **self._write_kwargs(0))
        except Exception as e:                        # pragma: no cover
            self._err.append(e)
            # drain so the producer never blocks on a dead consumer
            while self._q.get() is not None:
                pass

    # ---- producer side ------------------------------------------------------
    def _emit_full_strip(self):
        strip = self._strip[:self._strip_fill]
        self._q.put(strip.copy())
        # cascade into level 1 (exact 2x box filter)
        h2 = self._strip_fill // 2
        if h2 > 0 and self._l1_y < self.l1_h:
            h2 = min(h2, self.l1_h - self._l1_y)
            self._l1[self._l1_y:self._l1_y + h2] = cv2.resize(
                strip[:h2 * 2], (self.l1_w, h2),
                interpolation=cv2.INTER_AREA)
            self._l1_y += h2
        self._strip_fill = 0

    def push_rows(self, rows_bgr):
        """Feed finished full-resolution mosaic rows (BGR, full TIFF width)."""
        if self._err:
            raise self._err[0]
        i = 0
        while i < len(rows_bgr):
            take = min(len(rows_bgr) - i, self.tile - self._strip_fill)
            self._strip[self._strip_fill:self._strip_fill + take] = \
                rows_bgr[i:i + take]
            self._strip_fill += take
            i += take
            if self._strip_fill == self.tile:
                self._emit_full_strip()

    # ---- finalisation -------------------------------------------------------
    def _memmap_strips(self, mm):
        for y0 in range(0, mm.shape[0], self.tile):
            yield np.asarray(mm[y0:y0 + self.tile])

    def close(self):
        if self._strip_fill > 0:
            self._emit_full_strip()
        self._q.put(None)
        self._thread.join()
        if self._err:
            self._tw.close()
            self._cleanup()
            raise self._err[0]

        # cascade levels 2+ from level 1, then append all reduced pages
        levels = [(self._l1, self.l1_w, self.l1_h, self._l1_path)]
        w_k, h_k = self.l1_w, self.l1_h
        k = 1
        while max(w_k, h_k) > 2048 and min(w_k, h_k) >= 2:
            k += 1
            w_n, h_n = w_k // 2, h_k // 2
            p_n  = self.path + f".l{k}.tmp"
            mm_n = np.memmap(p_n, dtype=np.uint8, mode="w+",
                             shape=(h_n, w_n, 3))
            src = levels[-1][0]
            for y0 in range(0, h_n, self.tile):
                y1 = min(y0 + self.tile, h_n)
                chunk = np.asarray(src[y0 * 2:y1 * 2])
                mm_n[y0:y1] = cv2.resize(chunk, (w_n, y1 - y0),
                                         interpolation=cv2.INTER_AREA)
            levels.append((mm_n, w_n, h_n, p_n))
            w_k, h_k = w_n, h_n

        for lvl, (mm, w_k, h_k, _) in enumerate(levels, start=1):
            print(f"    pyramid level {lvl}: {w_k} x {h_k} px")
            self._tw.write(
                self._tiles_from_strips(self._memmap_strips(mm), w_k),
                shape=(h_k, w_k, 3), dtype=np.uint8,
                subfiletype=1, **self._write_kwargs(lvl))

        self._tw.close()
        for mm, _, _, p in levels:
            del mm
        self._l1 = None
        levels = None
        self._cleanup()

    def _cleanup(self):
        import glob
        for p in glob.glob(self.path + ".l*.tmp"):
            try:
                os.remove(p)
            except OSError:
                pass

    def abort(self):
        try:
            self._q.put(None)
            self._thread.join(timeout=10)
            self._tw.close()
        finally:
            self._cleanup()


# ==============================================================================
# PUBLIC API
# ==============================================================================

class _Tee:
    """Duplicate writes to several streams (console + stitch log)."""

    def __init__(self, *streams):
        self._streams = streams

    def write(self, s):
        for st in self._streams:
            try:
                st.write(s)
            except Exception:
                pass

    def flush(self):
        for st in self._streams:
            try:
                st.flush()
            except Exception:
                pass


def stitch_images_large(folder, output_filename="stitched.jpg",
                        max_rows=None, max_cols=None,
                        only_rows=None, only_cols=None,
                        save_overview_jpg=False,
                        flatfield=None,
                        flatfield_strength=1.0,
                        **kwargs):
    """Run the band stitcher with all console output additionally captured
    to <output stem>_stitch.log inside `folder` (including any traceback),
    so long runs can be reviewed after the fact.

    max_rows / max_cols: if given, keep only the first N rows / M cols from
    the discovered grid (sorted ascending).  Useful for quick diagnostic runs
    on a small subset (e.g. max_rows=5, max_cols=5).

    save_overview_jpg: if False (default), only the pyramidal BigTIFF is
    written.  Pass True to also write the scaled-down JPEG overview.
    """
    from datetime import datetime
    # log_path = os.path.join(
    #     folder, os.path.splitext(output_filename)[0] + "_stitch.log")
    old_stdout = sys.stdout
    log_f = None                           # log file disabled
    # try:
    #     log_f = open(log_path, "w", buffering=1, encoding="utf-8")
    # except OSError:
    #     log_f = None                       # folder not writable: log to console only
    # if log_f is not None:
    #     sys.stdout = _Tee(old_stdout, log_f)
    try:
        print(f"  Run started : {datetime.now().isoformat(timespec='seconds')}")
        result = _stitch_images_large_impl(
            folder, output_filename=output_filename,
            max_rows=max_rows, max_cols=max_cols,
            only_rows=only_rows, only_cols=only_cols,
            save_overview_jpg=save_overview_jpg,
            flatfield=flatfield,
            flatfield_strength=float(flatfield_strength),
            **kwargs)
        print(f"  Run finished: {datetime.now().isoformat(timespec='seconds')}")
        return result
    except BaseException:
        traceback.print_exc(file=sys.stdout)
        raise
    finally:
        sys.stdout = old_stdout
        if log_f is not None:
            log_f.close()


def _stitch_images_large_impl(
        folder,
        output_filename="stitched.jpg",
        stage_move_x_um=_STAGE_MOVE_X_UM,
        stage_move_y_um=_STAGE_MOVE_Y_UM,
        um_per_px=_UM_PER_PX,
        image_width_px=_IMAGE_WIDTH_PX,
        image_height_px=_IMAGE_HEIGHT_PX,
        tolerance_px=_TOLERANCE_PX,
        crop_inset_x=100,
        crop_inset_y=100,
        final_scale=0.5,
        final_max_px=65500,
        jpeg_quality=75,
        webp_quality=75,
        pyramid_tiff=True,
        tiff_quality=85,
        tiff_tile=512,
        save_overview_jpg=False,
        n_workers=None,
        flatfield=None,
        flatfield_strength=1.0,
        max_rows=None,
        max_cols=None,
        only_rows=None,
        only_cols=None,
):
    """
    Stitch a large grid of microscope images.  Produces:
      1) if pyramid_tiff (default True): a FULL-RESOLUTION tiled pyramidal
         BigTIFF (<output stem>.tif) viewable in QuPath / openslide / ImageJ.
         Requires: pip install tifffile imagecodecs
      2) if save_overview_jpg (default False): a scaled-down JPEG/WebP
         overview, size-capped by final_max_px.
      2) if pyramid_tiff: a FULL-RESOLUTION tiled pyramidal BigTIFF
         (<output stem>.tif) viewable as a zoomable slide in QuPath /
         openslide / ImageJ.  Requires: pip install tifffile imagecodecs
         Temp disk during the run ≈ 1/3 of the raw mosaic size.

    Returns absolute path to the overview file.
    """
    step_x = int(round(stage_move_x_um / um_per_px))
    step_y = int(round(stage_move_y_um / um_per_px))

    print("=" * 60)
    print("  Band Stitcher (canvas-free)  —  Global Optimisation")
    print("=" * 60)
    print(f"\n  Stage move X : {stage_move_x_um} um  ->  {step_x} px")
    print(f"  Stage move Y : {stage_move_y_um} um  ->  {step_y} px")
    print(f"  Image size   : {image_width_px} x {image_height_px} px")

    rows, cols, tile_paths = _discover_grid(folder)
    if not rows or not cols:
        raise FileNotFoundError(
            f"No grid images found in '{folder}'. "
            "Expected files named 00_00.jpg.")

    # --- optional subset for diagnostic runs ---
    full_rows, full_cols = len(rows), len(cols)
    # only_rows / only_cols: exact index lists (override max_rows/max_cols)
    if only_rows is not None:
        rows = [r for r in rows if r in set(only_rows)]
    elif max_rows is not None:
        rows = rows[:int(max_rows)]
    if only_cols is not None:
        cols = [c for c in cols if c in set(only_cols)]
    elif max_cols is not None:
        cols = cols[:int(max_cols)]
    if len(rows) != full_rows or len(cols) != full_cols:
        rows_set   = set(rows)
        cols_set   = set(cols)
        tile_paths = {k: v for k, v in tile_paths.items()
                      if k[0] in rows_set and k[1] in cols_set}
        print(f"  ** Subset mode: using {len(rows)}x{len(cols)} "
              f"(of {full_rows}x{full_cols}) tiles **")

    n_rows = len(rows)
    n_cols = len(cols)
    print(f"  Grid: {n_rows} rows x {n_cols} cols  "
          f"({len(tile_paths)} tiles found, {n_rows * n_cols} grid slots)\n")

    # ── flatfield correction ───────────────────────────────────────────
    if isinstance(flatfield, str):
        if flatfield and os.path.exists(flatfield):
            flatfield = np.load(flatfield).astype(np.float32)
            print(f"  Flatfield    : loaded from {flatfield}  "
                  f"shape={flatfield.shape}  "
                  f"min={flatfield.min():.3f}  max={flatfield.max():.3f}")
        else:
            if flatfield:
                print(f"  !! Flatfield file not found: {flatfield} — correction skipped")
            flatfield = None
    elif flatfield is not None and not isinstance(flatfield, np.ndarray):
        flatfield = None

    # ── Pass 1: measure all adjacent pair offsets ─────────────────────
    print("=== Pass 1: measuring all pair offsets ===")
    pair_offsets = {}
    total_pairs  = (n_rows * (n_cols - 1)) + ((n_rows - 1) * n_cols)

    _n_workers = int(n_workers) if n_workers is not None else min(os.cpu_count() or 1, 6)
    print(f"  Workers : {_n_workers}  (cv2+numpy release the GIL → real parallelism)")

    h_tasks = [
        (tile_paths, r, cols[ci], cols[ci + 1], step_x, tolerance_px, flatfield, flatfield_strength)
        for r in rows for ci in range(len(cols) - 1)
    ]
    v_tasks = [
        (tile_paths, rows[ri], rows[ri + 1], c, step_y, tolerance_px, flatfield, flatfield_strength)
        for ri in range(len(rows) - 1) for c in cols
    ]

    done = 0
    with ThreadPoolExecutor(max_workers=_n_workers) as ex:
        h_futs = {ex.submit(_h_pair_worker, t): 'H' for t in h_tasks}
        v_futs = {ex.submit(_v_pair_worker, t): 'V' for t in v_tasks}
        for fut in as_completed({**h_futs, **v_futs}):
            key, val = fut.result()
            done += 1
            if val is not None:
                pair_offsets[key] = val
            else:
                print(f"  !! missing tile {key[0]},{key[1]}→{key[2]},{key[3]}")
            if done % 200 == 0 or done == total_pairs:
                print(f"  [{done}/{total_pairs}] pairs measured")

    # ── Pass 2: global least-squares optimisation ─────────────────────
    print("\n=== Pass 2: global position optimisation (matrix-free CG) ===")
    positions = _global_tile_positions(pair_offsets, rows, cols)

    # ── mosaic geometry (only tiles that exist) ───────────────────────
    pos_t = {k: positions[k] for k in tile_paths if k in positions}
    if not pos_t:
        raise RuntimeError("No positioned tiles to place.")
    all_tx = [v[0] for v in pos_t.values()]
    all_ty = [v[1] for v in pos_t.values()]
    canvas_w = max(all_tx) + image_width_px
    canvas_h = max(all_ty) + image_height_px

    # content bounds after edge crop
    x0c = min(all_tx) + crop_inset_x
    y0c = min(all_ty) + crop_inset_y
    x1c = canvas_w - crop_inset_x
    y1c = canvas_h - crop_inset_y
    if x1c - x0c < 1 or y1c - y0c < 1:          # inset too large — skip crop
        x0c, y0c, x1c, y1c = min(all_tx), min(all_ty), canvas_w, canvas_h

    src_w, src_h = x1c - x0c, y1c - y0c
    ext   = os.path.splitext(output_filename)[1].lower()
    limit = _WEBP_MAX_PX if ext == ".webp" else _JPEG_MAX_PX
    cap   = min(final_max_px, limit)
    scale = min(final_scale, cap / max(src_w, src_h), 1.0)
    out_w = max(1, int(round(src_w * scale)))
    out_h = max(1, int(round(src_h * scale)))

    print(f"\n  Mosaic (full res) : {canvas_w} x {canvas_h} px")
    print(f"  Content (cropped) : {src_w} x {src_h} px")
    if scale < final_scale:
        print(f"  Auto-fit scale    : {scale:.4f} "
              f"(requested {final_scale}, cap {cap} px/side for '{ext}')")
    else:
        print(f"  Scale             : {scale:.4f}")
    print(f"  Overview          : {out_w} x {out_h} px")

    # ── pyramidal TIFF setup ──────────────────────────────────────────
    ptiff = None
    tiff_path = None
    if pyramid_tiff:
        tiff_path = os.path.join(
            folder, os.path.splitext(output_filename)[0] + ".tif")
        temp_need = src_w * src_h            # ≈ raw/3 for the level cascade
        free = shutil.disk_usage(folder).free
        if temp_need > free * 0.9:
            print(f"  !! ~{temp_need/1e9:.1f} GB temp disk needed for the "
                  f"pyramid but only {free/1e9:.1f} GB free -> TIFF skipped")
        else:
            try:
                ptiff = _PyramidTiff(tiff_path, src_w, src_h, um_per_px,
                                     tile=tiff_tile, quality=tiff_quality)
                print(f"  Pyramid BigTIFF   : {tiff_path}  "
                      f"(full res, {um_per_px} um/px)")
            except ImportError:
                print("  !! tifffile not installed -> pyramid TIFF skipped. "
                      "pip install tifffile imagecodecs")

    # ── band sizing ────────────────────────────────────────────────────
    row_ymin, row_ymax = {}, {}
    for (r, c), (tx, ty) in pos_t.items():
        row_ymin[r] = min(row_ymin.get(r, ty), ty)
        row_ymax[r] = max(row_ymax.get(r, ty + image_height_px),
                          ty + image_height_px)
    active_rows = [r for r in rows if r in row_ymin]

    straddle = int(np.ceil(src_h / max(1, out_h))) + 2
    band_h, b = 0, row_ymin[active_rows[0]]
    for r in active_rows:
        b = max(b, row_ymin[r] - straddle)
        band_h = max(band_h, row_ymax[r] - b)
    band_h += 8

    band_gb = band_h * canvas_w * 3 / 1e9
    print(f"  Band in RAM       : {canvas_w} x {band_h} px  ({band_gb:.2f} GB)\n")

    # ── Pass 3: rolling-band composition ──────────────────────────────
    print("=== Pass 3: placing tiles (rolling band, streamed outputs) ===")

    band    = np.zeros((band_h, canvas_w, 3), np.uint8)
    band_y0 = row_ymin[active_rows[0]]
    out     = np.zeros((out_h, out_w, 3), np.uint8)
    state   = {"next_out": 0, "band_y0": band_y0, "fr_next": y0c}

    def _src_row(o):
        """First source (mosaic) row feeding overview row o."""
        return y0c + (o * src_h) // out_h

    max_chunk_rows = max(straddle + 1, int(512e6 // (src_w * 3)))

    def _flush_and_scroll(new_base):
        """Emit overview + full-res rows above new_base, then scroll."""
        nonlocal band
        no = state["next_out"]
        by0 = state["band_y0"]
        band_end = by0 + band_h

        # -- overview rows whose sources are complete ----------------------
        hi = no
        while hi < out_h:
            sy1 = _src_row(hi + 1) if hi + 1 < out_h else y1c
            if sy1 > new_base:
                break
            hi += 1

        while no < hi:
            oe  = no + 1
            sy0 = _src_row(no)
            while oe < hi:
                syn = _src_row(oe + 1) if oe + 1 < out_h else y1c
                if syn - sy0 > max_chunk_rows:
                    break
                oe += 1
            sy1 = _src_row(oe) if oe < out_h else y1c

            if sy0 >= band_end:
                pass                      # gap beyond band: stays black
            else:
                s1 = min(sy1, band_end)
                chunk = band[sy0 - by0:s1 - by0, x0c:x1c]
                if s1 < sy1:              # partial gap: pad with black
                    pad = np.zeros((sy1 - sy0, src_w, 3), np.uint8)
                    pad[:s1 - sy0] = chunk
                    chunk = pad
                if chunk.shape[0] == oe - no and chunk.shape[1] == out_w:
                    out[no:oe] = chunk
                else:
                    out[no:oe] = cv2.resize(chunk, (out_w, oe - no),
                                            interpolation=cv2.INTER_AREA)
            no = oe
        state["next_out"] = no

        # scroll: keep everything the next overview row still needs
        retain = min(new_base, _src_row(no) if no < out_h else new_base)

        # -- full-res rows for the pyramid TIFF ----------------------------
        if ptiff is not None:
            fr  = max(state["fr_next"], y0c)
            lim = min(retain, y1c)
            while fr < lim:
                e = min(lim, band_end, fr + tiff_tile)
                if fr >= band_end:        # gap beyond band: black rows
                    ptiff.push_rows(np.zeros((lim - fr, src_w, 3), np.uint8))
                    fr = lim
                else:
                    ptiff.push_rows(band[fr - by0:e - by0, x0c:x1c])
                    fr = e
            state["fr_next"] = max(state["fr_next"], lim)

        shift = retain - by0
        if shift >= band_h:
            band[:] = 0
            state["band_y0"] = retain
        elif shift > 0:
            # block-wise copy (blocks <= shift rows, so src/dst never overlap)
            for i in range(0, band_h - shift, shift):
                j = min(i + shift, band_h - shift)
                band[i:j] = band[i + shift:j + shift]
            band[band_h - shift:] = 0
            state["band_y0"] = retain

    total = n_rows * n_cols
    done  = 0

    # ── single-tile lookahead: load tile N+1 while compositing tile N ──
    # Uses one background thread; RAM overhead = 1 extra tile (~15 MB).
    _active_row_pos = {r: i for i, r in enumerate(active_rows)}

    def _next_tile_key(r, ci):
        """Return (next_r, next_c) in traversal order, or (None, None)."""
        if ci + 1 < len(cols):
            return r, cols[ci + 1]
        pos = _active_row_pos.get(r, -1) + 1
        if pos < len(active_rows):
            return active_rows[pos], cols[0]
        return None, None

    _la_fut = None   # lookahead future
    _la_key = None   # (r, c) that future is loading

    try:
      with ThreadPoolExecutor(max_workers=1) as _loader:
        # Pre-load the very first tile
        if active_rows:
            _la_key = (active_rows[0], cols[0])
            _la_fut = _loader.submit(_load_tile, tile_paths, *_la_key, flatfield, flatfield_strength)

        for ri, r in enumerate(rows):
            if r not in row_ymin:
                done += len(cols)
                continue
            if ri > 0:
                _flush_and_scroll(row_ymin[r])
            if row_ymax[r] - state["band_y0"] > band_h:
                raise RuntimeError(
                    f"Band too small for tile row {r} "
                    f"(needs {row_ymax[r] - state['band_y0']}, has {band_h}).")

            for ci, c in enumerate(cols):
                done += 1
                print(f"  [{done}/{total}] Tile ({r},{c})", end="  ")

                # Retrieve tile — from lookahead future if ready, else load now
                if _la_key == (r, c) and _la_fut is not None:
                    tile = _la_fut.result()
                    _la_fut = None
                else:
                    tile = _load_tile(tile_paths, r, c, flatfield, flatfield_strength)

                # Immediately kick off next tile load before compositing
                nr, nc = _next_tile_key(r, ci)
                if nr is not None:
                    _la_key = (nr, nc)
                    _la_fut = _loader.submit(_load_tile, tile_paths, nr, nc, flatfield, flatfield_strength)
                else:
                    _la_key = _la_fut = None

                if tile is None or (r, c) not in positions:
                    print("!! missing, skipping")
                    continue

                Ht, Wt = tile.shape[:2]
                tx, ty = positions[(r, c)]
                tx = max(0, min(tx, canvas_w - Wt))
                by0 = state["band_y0"]

                # ── overlap geometry (only against existing neighbours) ──
                left_ow = top_oh = 0
                tx_l = ty_l = tx_t = ty_t = None
                if ci > 0 and (r, cols[ci - 1]) in tile_paths:
                    tx_l, ty_l = positions[(r, cols[ci - 1])]
                    left_ow = max(0, min(tx_l + image_width_px - tx, Wt))
                if ri > 0 and (rows[ri - 1], c) in tile_paths:
                    tx_t, ty_t = positions[(rows[ri - 1], c)]
                    top_oh = max(0, min(ty_t + image_height_px - ty, Ht))

                # ── V-seam: band vs tile over the valid common rows ──────
                x_cut = None
                if left_ow > _CUT_MARGIN * 2 and tx_l is not None:
                    y_v0 = max(ty, ty_l)
                    y_v1 = min(ty + Ht, ty_l + image_height_px)
                    if top_oh > 0:
                        y_v0 = max(y_v0, ty + top_oh)
                    if y_v1 - y_v0 > _CUT_MARGIN * 2:
                        sl = band[y_v0 - by0:y_v1 - by0, tx:tx + left_ow]
                        sr = tile[y_v0 - ty:y_v1 - ty, :left_ow]
                        print(f"V-ow={left_ow}px", end="  ")
                        path, _, _ = _graph_cut_vseam(sl, sr)
                        full = np.empty(Ht, dtype=np.int32)
                        p0   = y_v0 - ty
                        full[:p0] = path[0]
                        end = min(p0 + len(path), Ht)
                        full[p0:end] = path[:end - p0]
                        full[end:]   = path[-1]
                        x_cut = full

                # ── H-seam: band vs tile over the valid common cols ──────
                y_cut = None
                if top_oh > _CUT_MARGIN * 2 and tx_t is not None:
                    x_h0 = max(tx, tx_t)
                    x_h1 = min(tx + Wt, tx_t + image_width_px, canvas_w)
                    if x_h1 - x_h0 > _CUT_MARGIN * 2:
                        st = band[ty - by0:ty + top_oh - by0, x_h0:x_h1]
                        sb = tile[:top_oh, x_h0 - tx:x_h1 - tx]
                        print(f"H-ow={top_oh}px", end="  ")
                        y_cut, _, _ = _best_hcut(st, sb)

                print(f"→ mosaic ({tx},{ty})")

                _place_tile(band, tile, tx, ty - by0,
                            left_ow=left_ow, x_cut=x_cut,
                            top_oh=top_oh,   y_cut=y_cut)
                tile = None

        # ── final flush ──────────────────────────────────────────────
        print("\n=== Final flush and save ===")
        _flush_and_scroll(y1c)
        del band

        if ptiff is not None:
            print("  Writing pyramid levels...")
            ptiff.close()
            mb = os.path.getsize(ptiff.path) / 1e6
            print(f"  -> {ptiff.path}  ({src_w}x{src_h} px full res, {mb:.0f} MB)")
            ptiff = None

    except Exception:
        if ptiff is not None:
            ptiff.abort()
        raise

    if save_overview_jpg:
        output_path = os.path.join(folder, output_filename)
        output_path = _save_image(output_path, out,
                                  jpeg_quality=jpeg_quality,
                                  webp_quality=webp_quality)
        mb = os.path.getsize(output_path) / 1e6
        print(f"  -> {output_path}  ({out.shape[1]}x{out.shape[0]} px, {mb:.1f} MB)")

    print("\n=== All done ===")

    # Return TIFF path when it was written, else the overview image path
    if tiff_path is not None and os.path.exists(tiff_path):
        return os.path.abspath(tiff_path)
    if save_overview_jpg:
        return os.path.abspath(output_path)
    raise RuntimeError("No output was written: pyramid_tiff=False and save_overview_jpg=False")


# ==============================================================================
# COMMAND-LINE ENTRY POINT
# ==============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Canvas-free band stitcher for large grids of microscope "
                    "images (named RR_CC.jpg).  Writes a single-file overview "
                    "plus a full-resolution pyramidal BigTIFF.")
    parser.add_argument("folder", help="Folder containing the tile images.")
    parser.add_argument("--output", default="stitched.jpg",
                        help="Overview filename inside <folder>. Default: stitched.jpg")
    parser.add_argument("--stage-x-um", type=float, default=_STAGE_MOVE_X_UM)
    parser.add_argument("--stage-y-um", type=float, default=_STAGE_MOVE_Y_UM)
    parser.add_argument("--um-per-px",  type=float, default=_UM_PER_PX)
    parser.add_argument("--width-px",   type=int,   default=_IMAGE_WIDTH_PX)
    parser.add_argument("--height-px",  type=int,   default=_IMAGE_HEIGHT_PX)
    parser.add_argument("--final-scale",  type=float, default=0.5,
                        help="Requested downscale of the overview. Default: 0.5")
    parser.add_argument("--final-max-px", type=int,   default=16000,
                        help="Cap on longest overview side. Default: 16000 "
                             "(raise up to 65500 for JPEG)")
    parser.add_argument("--quality", type=int, default=80,
                        help="Overview JPEG quality. Default: 80")
    parser.add_argument("--no-tiff", action="store_true",
                        help="Skip the full-resolution pyramidal BigTIFF.")
    parser.add_argument("--tiff-quality", type=int, default=85,
                        help="JPEG quality of TIFF tiles. Default: 85")

    args = parser.parse_args()
    stitch_images_large(
        folder          = args.folder,
        output_filename = args.output,
        stage_move_x_um = args.stage_x_um,
        stage_move_y_um = args.stage_y_um,
        um_per_px       = args.um_per_px,
        image_width_px  = args.width_px,
        image_height_px = args.height_px,
        final_scale     = args.final_scale,
        final_max_px    = args.final_max_px,
        jpeg_quality    = args.quality,
        pyramid_tiff    = not args.no_tiff,
        tiff_quality    = args.tiff_quality,
    )
