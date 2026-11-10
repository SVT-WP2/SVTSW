"""Analysis settings.

One `Config` describes one kind of chip / pad column (built-in: needle_mark/configs/*.json).
Sizes are physical (µm), so the same config works at any camera resolution or
magnification: they are converted to pixels with the image's pixel size.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, fields
from pathlib import Path

METHODS = ("gray", "chroma", "black", "bgdiff")
POLARITIES = ("dark", "light")


class NeedleMarkError(Exception):
    """Raised for any analysis failure (bad image, bad config, no pads found)."""


@dataclass(frozen=True)
class Config:
    # --- design (µm) -----------------------------------------------------------
    expected_pads: int = 152          # pads in the column; 0 = unknown
    pad_sizes_um: tuple = ()          # design pad sizes [[x, y], ...] in image axes; () = unknown
    pad_size_tolerance_um: float = 5.0  # measured pad size may differ from the design by this much
    min_mark_diameter_um: float = 6.0   # smallest real needle mark: a circle of this diameter

    # --- pad detection (pads.py) -------------------------------------------
    method: str = "auto"              # one of METHODS, or "auto" = try all, keep the best
    polarity: str = "auto"            # "dark", "light" or "auto"
    column_tolerance: float = 0.25    # max left-edge shift between consecutive pads (x pad width)

    # --- mark detection (marks.py) -----------------------------------------
    edge_px: int = 3                  # pad border ignored: blurred / JPEG-ringing pad edge (px)
    min_contrast: float = 25.0        # min colour distance from the pad colour (0..441)
    noise_k: float = 5.0              # ... and above the pad's own noise by this many sigmas
    peak_factor: float = 2.0          # a mark's peak must reach this x the reference threshold
    peak_reference: str = "image"     # reference threshold: "image" (median of all pads) or "pad"

    # --- verdicts (analysis.py) --------------------------------------------
    min_clearance_um: float = 0.0     # "at edge" also below this distance to the edge; 0 = touching only
    um_per_px: float | None = None    # pixel size; overrides the TIFF tags and the pad-based estimate

    def __post_init__(self):
        # JSON gives lists: store pad sizes as a tuple of (x, y) floats
        sizes = tuple((float(x), float(y)) for x, y in self.pad_sizes_um)
        object.__setattr__(self, "pad_sizes_um", sizes)

        if self.method not in METHODS + ("auto",):
            raise NeedleMarkError(f"method must be one of {METHODS} or 'auto', got {self.method!r}")
        if self.polarity not in POLARITIES + ("auto",):
            raise NeedleMarkError(f"polarity must be one of {POLARITIES} or 'auto', got {self.polarity!r}")
        if self.peak_reference not in ("image", "pad"):
            raise NeedleMarkError(f"peak_reference must be 'image' or 'pad', got {self.peak_reference!r}")
        if self.expected_pads < 0:
            raise NeedleMarkError("expected_pads must be >= 0")
        if any(x <= 0 or y <= 0 for x, y in sizes):
            raise NeedleMarkError("pad_sizes_um must be positive [x, y] pairs")
        if self.um_per_px is not None and self.um_per_px <= 0:
            raise NeedleMarkError("um_per_px must be > 0")

    @classmethod
    def from_dict(cls, data: dict) -> Config:
        """Keys starting with "_" are comments (e.g. "_help" in needle_mark/configs/lec.json)."""
        data = {k: v for k, v in data.items() if not k.startswith("_")}
        known = {f.name for f in fields(cls)}
        unknown = set(data) - known
        if unknown:
            raise NeedleMarkError(f"unknown config keys: {sorted(unknown)}")
        return cls(**data)

    @classmethod
    def from_json(cls, path: str | Path) -> Config:
        with open(path) as f:
            return cls.from_dict(json.load(f))

    def to_dict(self) -> dict:
        return asdict(self)
