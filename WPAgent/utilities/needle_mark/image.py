"""Image loading: any OpenCV-readable file -> 8-bit BGR array + pixel size."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from .config import NeedleMarkError


@dataclass(frozen=True)
class Image:
    bgr: np.ndarray            # H x W x 3, uint8
    um_per_px: float | None    # from the TIFF resolution tags, if present
    path: Path | None = None


def load_image(path: str | Path) -> Image:
    """Read an image. For a pyramidal TIFF this is page 0, the full resolution."""
    path = Path(path)
    if not path.is_file():
        raise NeedleMarkError(f"image not found: {path}")
    raw = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if raw is None:
        raise NeedleMarkError(f"cannot read image: {path}")
    return Image(bgr=to_bgr_u8(raw), um_per_px=read_um_per_px(path), path=path)


def to_bgr_u8(img: np.ndarray) -> np.ndarray:
    """Any bit depth / channel count -> 8-bit, 3-channel BGR."""
    if img.dtype != np.uint8:
        lo, hi = np.percentile(img, (0.1, 99.9))   # robust to a few hot pixels
        img = np.clip((img.astype(np.float32) - lo) * 255.0 / max(hi - lo, 1e-6), 0, 255)
        img = img.astype(np.uint8)
    if img.ndim == 2:
        return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    return np.ascontiguousarray(img[:, :, :3])     # drop alpha if present


def read_um_per_px(path: Path) -> float | None:
    """Pixel size from TIFF resolution tags (as written by WPAgent's stitcher).

    Returns None for non-TIFF files, missing tags, or if tifffile is not installed.
    """
    if path.suffix.lower() not in (".tif", ".tiff"):
        return None
    try:
        import tifffile
        with tifffile.TiffFile(path) as tif:
            tags = tif.pages[0].tags
            num, den = tags["XResolution"].value          # pixels per unit
            unit = int(tags["ResolutionUnit"].value)       # 2 = inch, 3 = cm
    except Exception:
        return None
    um_per_unit = {2: 25400.0, 3: 10000.0}.get(unit)
    if um_per_unit is None or num == 0:
        return None
    return um_per_unit * den / num
