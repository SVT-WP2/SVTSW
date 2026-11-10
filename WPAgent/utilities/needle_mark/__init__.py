"""needle_mark - needle-mark analysis of a column of probe pads.

High level (what a WPAgent action calls), see api.py:

    from needle_mark import run, latest_image

    summary = run(latest_image("Imaging/Wafer/BAM00"), config="lec")

Lower level, step by step:

    from needle_mark import load_config, load_image, analyze, write_outputs

    image  = load_image("Imaging/Wafer/BAM00/20261105_101500_BAM00_LEC.tif")
    result = analyze(image, load_config("lec"))
    write_outputs(result, image, "Imaging/Wafer/BAM00")
    result.to_dict()   # everything, JSON-serialisable
"""

from .analysis import MULTIPLE_MARKS, NO_MARK, SINGLE_MARK, VERDICTS, Analysis, PadResult, analyze
from .api import analyze_file, available_configs, latest_image, load_config, run, summarize
from .config import Config, NeedleMarkError
from .image import Image, load_image
from .marks import Mark, PadMaps, PadMarks, find_marks, pad_maps
from .pads import Pad, PadDetection, detect_pads
from .report import draw_contrast, draw_overlay, write_csv, write_outputs

__version__ = "1.0.0"

__all__ = [
    # high level
    "run", "analyze_file", "load_config", "available_configs", "latest_image", "summarize",
    # step by step
    "load_image", "analyze", "write_outputs", "write_csv", "draw_overlay", "draw_contrast",
    "detect_pads", "pad_maps", "find_marks",
    # types and constants
    "Analysis", "Config", "Image", "Mark", "NeedleMarkError", "Pad", "PadDetection", "PadMaps",
    "PadMarks", "PadResult", "NO_MARK", "SINGLE_MARK", "MULTIPLE_MARKS", "VERDICTS",
]
