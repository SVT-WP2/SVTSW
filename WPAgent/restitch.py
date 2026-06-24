#!/usr/bin/env python3
"""
restitch.py — re-run stitching on an existing tile folder (no prober needed).

Place this script in the wafer-agent root (the folder that CONTAINS
`utilities/`), or pass --utilities explicitly. Examples:

    python restitch.py SEG03                         # TIFF only (default)
    python restitch.py SEG03 --jpg                   # TIFF + JPEG overview
    python restitch.py SEG03 --no-tiff --jpg         # JPEG overview only
    python restitch.py SEG03 --grid 5x5              # diagnostic: top-left 5x5 subset
    python restitch.py SEG03 --grid 10x10            # diagnostic: top-left 10x10 subset
    python restitch.py SEG03 --max-rows 5 --max-cols 10   # asymmetric subset
    python restitch.py SEG03 --utilities /path/to/agent_root

Outputs (written into the tile folder):
    <timestamp>_<name>_restitch.tif          full-res pyramid (default)
    <timestamp>_<name>_restitch.jpg          scaled overview (only with --jpg)
    <timestamp>_<name>_restitch_stitch.log   full log — share this for analysis
"""

import argparse
import os
import sys
from datetime import datetime


def main():
    ap = argparse.ArgumentParser(description="Re-stitch an existing tile folder.")
    ap.add_argument("folder", help="Folder containing RR_CC.jpg tiles (e.g. /SEG03)")
    ap.add_argument("--output", default=None,
                    help="Base filename stem. Default: <timestamp>_<name>_restitch.jpg")
    ap.add_argument("--jpg", action="store_true",
                    help="Also write a scaled-down JPEG overview alongside the TIFF.")
    ap.add_argument("--no-tiff", action="store_true",
                    help="Skip the full-resolution pyramidal BigTIFF (requires --jpg).")
    ap.add_argument("--final-scale", type=float, default=0.5)
    ap.add_argument("--final-max-px", type=int, default=65500,
                    help="Cap on longest overview side (--jpg only). Default: 65500")
    ap.add_argument("--quality", type=int, default=75, help="JPEG overview quality (--jpg only).")
    ap.add_argument("--tiff-quality", type=int, default=85)
    ap.add_argument("--flatfield", default=None,
                    help="Path to flatfield.npy correction map.")
    ap.add_argument("--flatfield-strength", type=float, default=1.0,
                    help="Correction strength 0.0–1.0 (default 1.0). "
                         "Reduce if corrected regions look over-bright.")
    ap.add_argument("--utilities", default=None,
                    help="Path to the folder CONTAINING utilities/ "
                         "(default: this script's folder)")
    ap.add_argument("--grid", default=None, metavar="RxC",
                    help="Stitch only the top-left N×M subset, e.g. --grid 5x5 "
                         "or --grid 10x10.  Overrides --max-rows/--max-cols.")
    ap.add_argument("--max-rows", type=int, default=None,
                    help="Keep only the first N rows (sorted ascending).")
    ap.add_argument("--max-cols", type=int, default=None,
                    help="Keep only the first M cols (sorted ascending).")
    ap.add_argument("--only-rows", default=None, metavar="R[,R,...]",
                    help="Keep only these specific row indices, e.g. --only-rows 0,1,2. "
                         "Overrides --max-rows.")
    ap.add_argument("--only-cols", default=None, metavar="C[,C,...]",
                    help="Keep only these specific col indices, e.g. --only-cols 0 "
                         "for a single-column strip.  Overrides --max-cols.")
    args = ap.parse_args()

    if args.no_tiff and not args.jpg:
        ap.error("--no-tiff requires --jpg (otherwise nothing would be written).")

    # Parse --grid shorthand
    if args.grid:
        try:
            parts = args.grid.lower().split("x")
            args.max_rows = int(parts[0])
            args.max_cols = int(parts[1])
        except (ValueError, IndexError):
            ap.error("--grid must be in the form NxM, e.g. --grid 5x5")

    # Parse --only-rows / --only-cols into int lists
    only_rows = None
    only_cols = None
    if args.only_rows:
        try:
            only_rows = [int(x.strip()) for x in args.only_rows.split(",")]
        except ValueError:
            ap.error("--only-rows must be comma-separated integers, e.g. --only-rows 0,1,2")
    if args.only_cols:
        try:
            only_cols = [int(x.strip()) for x in args.only_cols.split(",")]
        except ValueError:
            ap.error("--only-cols must be comma-separated integers, e.g. --only-cols 0")

    base = os.path.abspath(args.utilities or os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, base)
    sys.path.insert(0, os.path.join(base, "utilities"))
    try:
        from WPImageStitchingFull import stitch_images_large
    except ImportError as e:
        sys.exit(f"Cannot import WPImageStitchingFull ({e}).\n"
                 f"Searched: {base} and {os.path.join(base, 'utilities')}.\n"
                 "Run this script from the wafer-agent root or pass --utilities.")

    folder = os.path.abspath(args.folder)
    if not os.path.isdir(folder):
        sys.exit(f"Not a folder: {folder}")

    name = os.path.basename(os.path.normpath(folder))
    out  = args.output or \
        f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{name}_restitch.jpg"

    path = stitch_images_large(
        folder              = folder,
        output_filename     = out,
        final_scale         = args.final_scale,
        final_max_px        = args.final_max_px,
        jpeg_quality        = args.quality,
        pyramid_tiff        = not args.no_tiff,
        tiff_quality        = args.tiff_quality,
        save_overview_jpg   = args.jpg,
        max_rows            = args.max_rows,
        max_cols            = args.max_cols,
        only_rows           = only_rows,
        only_cols           = only_cols,
        flatfield           = args.flatfield,
        flatfield_strength  = args.flatfield_strength,
    )
    print(f"\nRestitch complete -> {path}")


if __name__ == "__main__":
    main()
