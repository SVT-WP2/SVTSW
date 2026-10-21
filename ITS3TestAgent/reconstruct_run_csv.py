#!/usr/bin/env python3
"""Reconstruct the extract_run_csv.py CSV from the run folders on EOS.

Used when the production log is gone: walk <eos_base>/<wafer_dir>/<chip>_<wafer>/
<prober_subdir>/<Sequence>/<timestamped_run>/ and read the outcome out of each
sequence_summary.txt instead of out of the log.

Output columns match `extract_run_csv.py --header --status`:
    wafer,chip,seq_type,status,folder_name
"""

import argparse
import os
import re
import sys
from datetime import datetime

DEFAULT_EOS_BASE = "/eos/project-a/aliceits3/ITS3-WP3/MOSAIX/testing"
DEFAULT_PROBER_SUBDIR = "cern_prober_mit"

# Same mapping extract_run_csv.py uses, plus the lpGBT sequence that the log
# extractor does not know about (add with --include-lpgbt).
SEQ_LABEL = {
    "WaferPrimaryTestingSequence": "wafer_primary_seq",
    "WaferTileTestingSequence": "wafer_tile_seq",
    "WaferTileTestingSequenceMinimal": "wafer_tile_seq_min",
    "WaferHschTestingSequence": "wafer_hsch_seq",
    "WaferPRBSTestingSequence": "wafer_prbs_seq",
    "AdcSequence": "ADC_seq",
}
LPGBT_SEQ = {"WaferLpgbtTestingSequence_5x": "wafer_lpgbt_seq_5x"}

CHIP_DIR_PATTERN = re.compile(r"^(BAM\d+|SEG\d+)_(L\dW\d+_S\d+)$")
RUN_DIR_PATTERN = re.compile(
    r"^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})_(BAM\d+|SEG\d+)_(L\dW\d+_S\d+)_(\w+)$"
)
OUTCOME_PATTERN = re.compile(r"^Sequence Outcome:\s*(\S+)\s*$", re.MULTILINE)


def run_ts(folder: str) -> datetime | None:
    m = RUN_DIR_PATTERN.match(folder)
    if not m:
        return None
    date, hh, mm, ss = m.group(1), m.group(2), m.group(3), m.group(4)
    return datetime.strptime(f"{date} {hh}:{mm}:{ss}", "%Y-%m-%d %H:%M:%S")


def read_outcome(run_path: str) -> str:
    """Sequence Outcome from sequence_summary.txt, or a marker if unavailable."""
    summary = os.path.join(run_path, "sequence_summary.txt")
    if not os.path.isfile(summary):
        return "NO_SUMMARY"
    with open(summary, encoding="utf-8", errors="replace") as fh:
        m = OUTCOME_PATTERN.search(fh.read())
    return m.group(1) if m else "NO_OUTCOME"


def collect(wafer_root: str, prober_subdir: str, seq_map: dict[str, str], since: datetime | None):
    """Return list of (ts, wafer, chip, seq_type, status, folder) — latest run per (chip, seq)."""
    latest: dict[tuple[str, str], tuple[datetime, str, str, str, str]] = {}
    for chip_dir in sorted(os.listdir(wafer_root)):
        cm = CHIP_DIR_PATTERN.match(chip_dir)
        if not cm:
            continue
        chip, wafer = cm.group(1), cm.group(2)
        seq_root = os.path.join(wafer_root, chip_dir, prober_subdir)
        if not os.path.isdir(seq_root):
            continue
        for seq_dir in sorted(os.listdir(seq_root)):
            seq_type = seq_map.get(seq_dir)
            if seq_type is None:
                continue
            for run in sorted(os.listdir(os.path.join(seq_root, seq_dir))):
                run_path = os.path.join(seq_root, seq_dir, run)
                if not os.path.isdir(run_path):
                    continue
                ts = run_ts(run)
                if ts is None or (since is not None and ts < since):
                    continue
                key = (chip, seq_type)
                if key in latest and latest[key][0] >= ts:
                    continue
                latest[key] = (ts, wafer, seq_type, run_path, run)

    rows = []
    for (chip, _seq), (ts, wafer, seq_type, run_path, run) in latest.items():
        rows.append((ts, wafer, chip, seq_type, read_outcome(run_path), run))
    rows.sort(key=lambda r: r[0])
    return rows


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("wafer", help="Wafer dir on EOS, e.g. L2W24")
    p.add_argument("--eos-base", default=DEFAULT_EOS_BASE)
    p.add_argument("--prober-subdir", default=DEFAULT_PROBER_SUBDIR)
    p.add_argument("--since", help="Only runs at/after this time, e.g. 2026-08-19 (default: all)")
    p.add_argument("--chips", help="Comma-separated chip filter, e.g. SEG0,SEG1,BAM00")
    p.add_argument("--include-lpgbt", action="store_true",
                   help="Also emit WaferLpgbtTestingSequence_5x rows (not known to extract_run_csv.py)")
    p.add_argument("--header", action="store_true")
    p.add_argument("--sep", default=",")
    args = p.parse_args()

    since = None
    if args.since:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                since = datetime.strptime(args.since, fmt)
                break
            except ValueError:
                continue
        if since is None:
            sys.exit(f"unparseable --since: {args.since}")

    seq_map = dict(SEQ_LABEL)
    if args.include_lpgbt:
        seq_map.update(LPGBT_SEQ)

    wafer_root = os.path.join(args.eos_base, args.wafer)
    if not os.path.isdir(wafer_root):
        sys.exit(f"no such wafer dir: {wafer_root}")

    rows = collect(wafer_root, args.prober_subdir, seq_map, since)
    if args.chips:
        keep = {c.strip() for c in args.chips.split(",")}
        rows = [r for r in rows if r[2] in keep]

    if args.header:
        print(args.sep.join(["wafer", "chip", "seq_type", "status", "folder_name"]))
    for _ts, wafer, chip, seq_type, status, folder in rows:
        print(args.sep.join([wafer, chip, seq_type, status, folder]))


if __name__ == "__main__":
    main()
