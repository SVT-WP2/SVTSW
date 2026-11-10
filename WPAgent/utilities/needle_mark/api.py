"""High-level entry points: the functions to call from WPAgent actions or scripts.

    from needle_mark import run, latest_image

    summary = run(latest_image("Imaging/Wafer/BAM00"), config="lec")
    summary["ok"], summary["verdict_counts"], summary["outputs"]

run()          analyse one image, write the outputs, return a JSON-serialisable summary
analyze_file() analyse one image, return the full Analysis object (nothing written)
load_config()  a Config from a built-in name ("lec"), a JSON path, a dict, or None
latest_image() the newest image matching a pattern in a folder (e.g. a die folder)
summarize()    the compact summary of an Analysis (what run() returns)

Every expected failure raises NeedleMarkError; nothing here prints or exits.
"""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path

from .analysis import MULTIPLE_MARKS, NO_MARK, Analysis, analyze
from .config import Config, NeedleMarkError
from .image import Image, load_image
from .report import write_outputs

CONFIG_DIR = Path(__file__).resolve().parent / "configs"


def available_configs() -> list[str]:
    """Names of the built-in configs (needle_mark/configs/*.json)."""
    return sorted(p.stem for p in CONFIG_DIR.glob("*.json"))


def load_config(config: str | Path | dict | Config | None = None, **overrides) -> Config:
    """Config from a built-in name ("lec"), a JSON file path, a dict, a Config, or
    None (defaults). Keyword overrides replace single fields: load_config("lec", peak_factor=1.8)."""
    if config is None:
        cfg = Config()
    elif isinstance(config, Config):
        cfg = config
    elif isinstance(config, dict):
        cfg = Config.from_dict(config)
    elif str(config) in available_configs():
        cfg = Config.from_json(CONFIG_DIR / f"{config}.json")
    elif Path(config).is_file():
        cfg = Config.from_json(config)
    else:
        raise NeedleMarkError(f"config not found: {config!r} (built-in: {available_configs()})")
    try:
        return replace(cfg, **overrides) if overrides else cfg
    except TypeError as e:
        raise NeedleMarkError(f"bad config override: {e}") from None


def latest_image(folder: str | Path, pattern: str = "*_LEC.tif") -> Path:
    """Newest file matching pattern in folder, e.g. the LEC stitch of a die folder."""
    matches = sorted(Path(folder).glob(pattern), key=lambda p: p.stat().st_mtime)
    if not matches:
        raise NeedleMarkError(f"no '{pattern}' image in {folder}")
    return matches[-1]


def analyze_file(image: str | Path | Image, config=None, **overrides) -> Analysis:
    """Analyse one image (path or loaded Image). Nothing is written."""
    image = image if isinstance(image, Image) else load_image(image)
    return analyze(image, load_config(config, **overrides))


def run(image: str | Path | Image, config=None, out_dir: str | Path | None = None,
        contrast: bool = False, **overrides) -> dict:
    """Analyse one image, write its outputs and return the summary (see summarize()).

    out_dir   where the CSV / JSON / overlay go (default: next to the image)
    contrast  also write the contrast image (what the detection sees)
    overrides single config fields, e.g. peak_factor=1.8
    """
    image = image if isinstance(image, Image) else load_image(image)
    result = analyze(image, load_config(config, **overrides))
    if out_dir is None:
        if image.path is None:
            raise NeedleMarkError("out_dir is required for an image without a path")
        out_dir = image.path.parent
    paths = write_outputs(result, image, out_dir, contrast=contrast)
    return summarize(result, paths)


def summarize(result: Analysis, paths: dict | None = None) -> dict:
    """Compact, JSON-serialisable summary, e.g. for a Kafka reply. The full
    result is in the JSON file (paths["json"]) or result.to_dict()."""
    def pads_where(condition):
        return [r.pad.index for r in result.pads if condition(r)]

    return {
        "ok": result.count_ok and result.sizes_ok is not False,  # the analysis itself can be trusted
        "image": result.image_path,
        "pads_found": len(result.pads),
        "pads_expected": result.config.expected_pads,
        "count_ok": result.count_ok,
        "sizes_ok": result.sizes_ok,
        "um_per_px": round(result.um_per_px, 4),
        "verdict_counts": result.counts(),
        "pads_no_mark": pads_where(lambda r: r.verdict == NO_MARK),
        "pads_multiple_marks": pads_where(lambda r: r.verdict == MULTIPLE_MARKS),
        "pads_at_edge": pads_where(lambda r: any(r.at_edge)),
        "pads_size_off": pads_where(lambda r: r.size_ok is False),
        "outputs": paths or {},
    }
