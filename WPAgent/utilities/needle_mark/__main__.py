"""Command line, a thin layer over api.run():

    python -m needle_mark IMAGE [--config lec] [--out DIR] [--contrast] [--set KEY=VALUE ...] [--json]
    python -m needle_mark --folder Imaging/Wafer/BAM00 --config lec      # newest *_LEC.tif in the folder

Exit codes: 0 = analysis ran, pad count and pad sizes match the design,
            1 = analysis error (bad image / config, no pads found),
            2 = analysis ran but the pad count or the pad sizes do not match.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .api import available_configs, latest_image, run
from .config import NeedleMarkError


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        image = args.image or latest_image(args.folder, args.pattern)
        summary = run(image, args.config, out_dir=args.out, contrast=args.contrast,
                      **dict(_parse_setting(s) for s in args.set))
    except NeedleMarkError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    print(json.dumps(summary, indent=2) if args.json else _format(summary))
    return 0 if summary["ok"] else 2


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="needle_mark", description="Needle-mark analysis of a column of pads.")
    source = p.add_mutually_exclusive_group(required=True)
    source.add_argument("image", nargs="?", type=Path, help="image to analyse")
    source.add_argument("--folder", type=Path, help="analyse the newest --pattern image in this folder")
    p.add_argument("--pattern", default="*_LEC.tif", help="file pattern for --folder (default: *_LEC.tif)")
    p.add_argument("--config", help=f"built-in name {available_configs()} or JSON path; default: built-in defaults")
    p.add_argument("--out", type=Path, help="output folder (default: next to the image)")
    p.add_argument("--contrast", action="store_true", help="also write <image>_contrast.tif (what the detection sees)")
    p.add_argument("--set", action="append", default=[], metavar="KEY=VALUE",
                   help="override one config field, e.g. --set peak_factor=1.8 (repeatable)")
    p.add_argument("--json", action="store_true", help="print the summary as JSON (for scripts)")
    return p


def _parse_setting(text: str) -> tuple[str, object]:
    """'peak_factor=1.8' -> ('peak_factor', 1.8); values are JSON, else plain strings."""
    key, sep, value = text.partition("=")
    if not sep:
        raise NeedleMarkError(f"--set expects KEY=VALUE, got {text!r}")
    try:
        return key.strip(), json.loads(value)
    except json.JSONDecodeError:
        return key.strip(), value


def _format(s: dict) -> str:
    counts = ", ".join(f"{k}={v}" for k, v in s["verdict_counts"].items())
    lines = [
        f"Image : {s['image']}",
        f"Scale : {s['um_per_px']} um/px",
        f"Pads  : {s['pads_found']} found / {s['pads_expected'] or '?'} expected"
        + ("" if s["count_ok"] else "   <-- COUNT MISMATCH"),
        f"Marks : {counts}",
    ]
    for label, key in [("multiple marks", "pads_multiple_marks"), ("no mark", "pads_no_mark"),
                       ("mark at edge", "pads_at_edge"), ("size off design", "pads_size_off")]:
        if s[key]:
            lines.append(f"  {label:<16}: pads {s[key]}")
    lines += [f"{kind:<8}: {path}" for kind, path in s["outputs"].items()]
    return "\n".join(lines)


if __name__ == "__main__":
    sys.exit(main())
