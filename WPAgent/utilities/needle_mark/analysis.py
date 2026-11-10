"""Top-level analysis: scale -> pads -> marks -> what is on each pad.

Nothing is assumed about how many marks a pad should have: every pad is
described as it is (no mark / one mark / several marks), and every mark that
reaches the pad edge is flagged.

    image  = load_image("die_LEC.tif")
    result = analyze(image, load_config("lec"))
    result.to_dict()        # plain JSON-serialisable result
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .config import Config, NeedleMarkError
from .image import Image
from .marks import Mark, find_marks, pad_maps
from .pads import Pad, PadDetection, detect_pads, estimate_um_per_px, match_design

# What is on a pad (descriptive, no expectation)
NO_MARK = "NO_MARK"                # nothing found
SINGLE_MARK = "SINGLE_MARK"        # one mark
MULTIPLE_MARKS = "MULTIPLE_MARKS"  # two or more separate marks
VERDICTS = (NO_MARK, SINGLE_MARK, MULTIPLE_MARKS)

_TOUCH_PX = 1.5            # a mark within edge_px + this of the edge reaches the edge


@dataclass(frozen=True)
class PadResult:
    pad: Pad
    marks: list[Mark]
    verdict: str                           # NO_MARK / SINGLE_MARK / MULTIPLE_MARKS
    at_edge: tuple[bool, ...]              # per mark: reaches the pad edge
    near_misses: list[tuple[Mark, str]]    # regions rejected on one criterion only, with the reason
    threshold: float                       # detection threshold of this pad (colour distance)
    design_um: tuple[float, float] | None  # closest design size (None without design sizes)
    size_error_um: float | None            # max |measured - design| over x and y
    size_ok: bool | None                   # size_error_um within pad_size_tolerance_um


@dataclass(frozen=True)
class Analysis:
    image_path: str | None
    image_size: tuple[int, int]        # width, height (px)
    um_per_px: float                   # pixel size used for every µm value
    scale_source: str                  # "config", "tiff" or "pads"
    um_per_px_from_pads: float | None  # independent estimate from the design pad sizes
    reference_threshold: float | None  # what peak_factor multiplies (None: each pad's own threshold)
    detection: PadDetection
    pads: list[PadResult]
    config: Config

    @property
    def count_ok(self) -> bool:
        """True if the expected number of pads was found (or none was expected)."""
        expected = self.config.expected_pads
        return not expected or len(self.pads) == expected

    @property
    def sizes_ok(self) -> bool | None:
        """True if every pad matches a design size (None without design sizes)."""
        if not self.config.pad_sizes_um:
            return None
        return all(r.size_ok for r in self.pads)

    def counts(self) -> dict[str, int]:
        """Pads per verdict, plus AT_EDGE = pads with at least one mark at the edge."""
        counts = {v: sum(p.verdict == v for p in self.pads) for v in VERDICTS}
        counts["AT_EDGE"] = sum(any(p.at_edge) for p in self.pads)
        return counts

    def to_dict(self) -> dict:
        um = self.um_per_px

        def mark_dict(m: Mark, pad: Pad, at_edge: bool) -> dict:
            w, h = pad.box[2], pad.box[3]
            return {
                "at_edge": at_edge,
                "cx_px": round(m.cx, 1), "cy_px": round(m.cy, 1),
                "dx_px": round(m.dx_px, 1), "dy_px": round(m.dy_px, 1),
                "dx_pct": round(100 * m.dx_px / (w / 2), 1),
                "dy_pct": round(100 * m.dy_px / (h / 2), 1),
                "area_px": m.area_px,
                "box_px": list(m.box),
                "clearance_px": round(m.clearance_px, 1),
                "contrast": round(m.contrast, 1),
                "peak_ratio": round(m.peak_ratio, 2),
                "dx_um": round(m.dx_px * um, 1), "dy_um": round(m.dy_px * um, 1),
                "w_um": round(m.box[2] * um, 1), "h_um": round(m.box[3] * um, 1),
                "area_um2": round(m.area_px * um ** 2, 1),
                "area_pct_of_pad": round(100 * m.area_px / (w * h), 2),
                "clearance_um": round(m.clearance_px * um, 1),
            }

        d = self.detection
        return {
            "image": self.image_path,
            "image_size_px": list(self.image_size),
            "scale": {"um_per_px": round(um, 4), "source": self.scale_source,
                      "um_per_px_from_pads": (round(self.um_per_px_from_pads, 4)
                                              if self.um_per_px_from_pads else None)},
            "pads_found": len(self.pads),
            "pads_expected": self.config.expected_pads,
            "count_ok": self.count_ok,
            "sizes_ok": self.sizes_ok,
            "verdict_counts": self.counts(),
            "reference_threshold": (round(self.reference_threshold, 1)
                                    if self.reference_threshold else None),
            "detection": {"method": d.method, "polarity": d.polarity,
                          "pitch_px": round(d.pitch_px, 1), "pitch_um": round(d.pitch_px * um, 1),
                          "pitch_cv": round(d.pitch_cv, 4), "score": round(d.score, 4)},
            "pads": [{
                "index": r.pad.index,
                "verdict": r.verdict,
                "at_edge": any(r.at_edge),
                "box_px": list(r.pad.box),
                "center_px": [round(c, 1) for c in r.pad.center],
                "size_um": [round(r.pad.box[2] * um, 1), round(r.pad.box[3] * um, 1)],
                "design_um": list(r.design_um) if r.design_um else None,
                "size_ok": r.size_ok,
                "n_marks": len(r.marks),
                "marks": [mark_dict(m, r.pad, e) for m, e in zip(r.marks, r.at_edge)],
                "threshold": round(r.threshold, 1),
                "near_misses": [{"reason": reason, **mark_dict(m, r.pad, _at_edge(m, um, self.config))}
                                for m, reason in r.near_misses],
            } for r in self.pads],
            "config": self.config.to_dict(),
        }


def analyze(image: Image, cfg: Config | None = None) -> Analysis:
    cfg = cfg or Config()
    sizes = cfg.pad_sizes_um

    # 1. pixel size: config > TIFF tags > estimated from the design pad sizes
    um_per_px, source = (cfg.um_per_px, "config") if cfg.um_per_px else (image.um_per_px, "tiff")
    detection = detect_pads(image.bgr, cfg, um_per_px)
    from_pads = estimate_um_per_px(detection.pads, sizes) if sizes else None
    if not um_per_px:
        if not from_pads:
            raise NeedleMarkError("unknown pixel size: set um_per_px or pad_sizes_um in the config")
        um_per_px, source = from_pads, "pads"

    # 2. per-pad maps, and the reference threshold for "strong" marks
    maps = [pad_maps(image.bgr, pad, cfg) for pad in detection.pads]
    reference = _reference_threshold(maps, cfg)

    # 3. marks, pad by pad
    results = []
    for pad, pad_map in zip(detection.pads, maps):
        found = find_marks(pad_map, pad, cfg, um_per_px, reference)
        marks = found.marks
        verdict = NO_MARK if not marks else SINGLE_MARK if len(marks) == 1 else MULTIPLE_MARKS
        at_edge = tuple(_at_edge(m, um_per_px, cfg) for m in marks)
        design, error = match_design(pad, um_per_px, sizes) if sizes else (None, None)
        size_ok = None if error is None else error <= cfg.pad_size_tolerance_um
        results.append(PadResult(pad, marks, verdict, at_edge, found.near_misses, found.threshold,
                                 design, error, size_ok))

    h, w = image.bgr.shape[:2]
    return Analysis(
        image_path=str(image.path) if image.path else None,
        image_size=(w, h),
        um_per_px=um_per_px,
        scale_source=source,
        um_per_px_from_pads=from_pads,
        reference_threshold=reference,
        detection=detection,
        pads=results,
        config=cfg,
    )


def _reference_threshold(maps: list, cfg: Config) -> float | None:
    """Median detection threshold over all pads ("image"), or None = each pad's own ("pad").
    The pads of one image share surface and lighting, so the median is a robust bar
    that a single noisy pad does not raise for its own marks."""
    if cfg.peak_reference == "pad" or not maps:
        return None
    return float(np.median([m.threshold for m in maps]))


def _at_edge(mark: Mark, um_per_px: float, cfg: Config) -> bool:
    """The mark reaches the pad edge (it touches the ignored edge band),
    or is closer to it than min_clearance_um when that is set."""
    c = mark.clearance_px
    return c <= cfg.edge_px + _TOUCH_PX or c * um_per_px < cfg.min_clearance_um
