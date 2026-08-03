#!/usr/bin/env python3
"""Extract unique wafer/chip/sequence entries from a production run log file and print CSV."""

import argparse
import os
import re
import shlex
import subprocess
import sys
from datetime import datetime, timedelta


DEFAULT_LOCAL_BASE = "/home/its3/mosaix_testing/software/mosaix_test_results"
DEFAULT_EOS_BASE = "/eos/project-a/aliceits3/ITS3-WP3/MOSAIX/testing"
DEFAULT_PROBER_SUBDIR = "cern_prober_mit"


# New-format: EOS path contains the folder name directly.
# NOTE: WaferTileTestingSequenceMinimal must precede WaferTileTestingSequence in the
# alternations so the longer name wins (regex alternation is ordered, leftmost-first).
PATH_PATTERN = re.compile(
    r"/(WaferPrimaryTestingSequence|WaferTileTestingSequenceMinimal|WaferTileTestingSequence|WaferHschTestingSequence|WaferPRBSTestingSequence)"
    r"/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_(BAM\d+|SEG\d+)_(L\dW\d+_S\d+)_(?:WaferPrimaryTestingSequence|WaferTileTestingSequenceMinimal|WaferTileTestingSequence|WaferHschTestingSequence|WaferPRBSTestingSequence))/"
)

# Old-format fallback: command invocation line.
# e.g.  2026-04-23 04:02:28 [INFO] [SEG0_L1W06_S4]  $ ./build/RunSequence .../wafer_primary_seq.json5 ...
INVOKE_PATTERN = re.compile(
    r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[INFO\] \[(BAM\d+|SEG\d+)_(L\dW\d+_S\d+)\].*RunSequence.*/(wafer_primary_seq|wafer_tile_seq_min|wafer_tile_seq|wafer_hsch_seq|wafer_prbs_seq)\.json5"
)

# New-format: overall sequence result line.
RESULT_PATTERN = re.compile(
    r"SUMMARY.*TestSequence: Overall result: (\S+)"
)

# PTPA: prober-level acceptance test run once per chip before its sequences.
PTPA_REPLY_PATTERN = re.compile(
    r"\[INFO\].*RunPTPAReply\s+status=(\S+)"
)

SEQ_LABEL = {
    "WaferPrimaryTestingSequence": "wafer_primary_seq",
    "WaferTileTestingSequence": "wafer_tile_seq",
    "WaferHschTestingSequence": "wafer_hsch_seq",
    "WaferTileTestingSequenceMinimal": "wafer_tile_seq_min",
    "WaferPRBSTestingSequence": "wafer_prbs_seq",
    "wafer_primary_seq": "wafer_primary_seq",
    "wafer_tile_seq": "wafer_tile_seq",
    "wafer_hsch_seq": "wafer_hsch_seq",
    "wafer_tile_seq_min": "wafer_tile_seq_min",
    "wafer_prbs_seq": "wafer_prbs_seq",
}

SEQ_FOLDER_SUFFIX = {
    "wafer_primary_seq": "WaferPrimaryTestingSequence",
    "wafer_tile_seq": "WaferTileTestingSequence",
    "wafer_hsch_seq": "WaferHschTestingSequence",
    "wafer_tile_seq_min": "WaferTileTestingSequenceMinimal",
    "wafer_prbs_seq": "WaferPRBSTestingSequence",
}


def extract_entries(log_path: str) -> tuple[
    list[tuple[str, str, str, str, str]],
    list[tuple[str, str, str]],
]:
    """Return (entries, ptpa_results).

    entries: list of (wafer, chip, seq_type, status, folder).
      status is SUCCESS / FAILURE / PARTIAL_SUCCESS / ERROR for new-format logs,
      or empty string for old-format entries where no result line is logged.

    ptpa_results: list of (chip, wafer, ptpa_status) — one entry per chip tested,
      new-format logs only (old format does not emit RunPTPAReply lines).
    """
    seen_folders: set[str] = set()
    seen_runs: set[tuple[str, str, str]] = set()
    entries: list[tuple[str, str, str, str, str]] = []

    # Maps folder_name -> index in entries list (for in-place status update).
    folder_index: dict[str, int] = {}
    # The folder whose sequence is currently executing (new format only).
    current_folder: str | None = None

    # PTPA tracking: buffer the last reply status until the chip invocation arrives.
    pending_ptpa: str | None = None
    ptpa_results: list[tuple[str, str, str]] = []
    seen_ptpa_chips: set[tuple[str, str]] = set()

    with open(log_path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            # --- Primary strategy: EOS path in SUMMARY / DEBUG lines ---
            for m in PATH_PATTERN.finditer(line):
                seq_dir = m.group(1)
                folder = m.group(2)
                chip = m.group(3)
                wafer = m.group(4)
                seq_type = SEQ_LABEL[seq_dir]
                run_key = (chip, wafer, seq_type)

                current_folder = folder

                if folder in seen_folders:
                    continue
                seen_folders.add(folder)

                if run_key in seen_runs:
                    entries = [e for e in entries if (e[1], e[0], e[2]) != run_key]
                    folder_index = {f: i for i, (_, _, _, _, f) in enumerate(entries)}
                seen_runs.add(run_key)

                idx = len(entries)
                entries.append((wafer, chip, seq_type, "", folder))
                folder_index[folder] = idx

            # --- Overall result (new format only) ---
            m = RESULT_PATTERN.search(line)
            if m and current_folder and current_folder in folder_index:
                result = m.group(1)
                idx = folder_index[current_folder]
                wafer, chip, seq_type, _, folder = entries[idx]
                entries[idx] = (wafer, chip, seq_type, result, folder)

            # --- PTPA reply: buffer status until the chip invocation is seen ---
            m = PTPA_REPLY_PATTERN.search(line)
            if m:
                pending_ptpa = m.group(1)

            # --- Invocation line: claim pending PTPA result for this chip ---
            m = INVOKE_PATTERN.match(line)
            if m:
                ts_str, chip, wafer, seq_key = m.group(1), m.group(2), m.group(3), m.group(4)
                seq_type = SEQ_LABEL[seq_key]
                run_key = (chip, wafer, seq_type)

                # Associate pending PTPA result with this chip (first invocation per chip).
                chip_key = (chip, wafer)
                if pending_ptpa is not None and chip_key not in seen_ptpa_chips:
                    ptpa_results.append((chip, wafer, pending_ptpa))
                    seen_ptpa_chips.add(chip_key)
                    pending_ptpa = None

                if run_key in seen_runs:
                    continue

                ts = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S") + timedelta(seconds=1)
                folder_ts = ts.strftime("%Y-%m-%d_%H-%M-%S")
                suffix = SEQ_FOLDER_SUFFIX[seq_key]
                folder = f"{folder_ts}_{chip}_{wafer}_{suffix}"

                if folder in seen_folders:
                    continue
                seen_folders.add(folder)
                seen_runs.add(run_key)
                idx = len(entries)
                entries.append((wafer, chip, seq_type, "", folder))
                folder_index[folder] = idx
                current_folder = folder

    return entries, ptpa_results


def build_paths(
    wafer: str,
    chip: str,
    seq_type: str,
    folder: str,
    local_base: str,
    eos_base: str,
    prober_subdir: str,
) -> tuple[str, str]:
    """Return (local_path, eos_path) for a single extracted entry."""
    seq_folder = SEQ_FOLDER_SUFFIX[seq_type]
    wafer_dir = wafer.split("_")[0]  # L1W06_S4 -> L1W06
    chip_wafer = f"{chip}_{wafer}"
    rel = os.path.join(wafer_dir, chip_wafer, prober_subdir, seq_folder, folder)
    return os.path.join(local_base, rel), os.path.join(eos_base, rel)


def resolve_folder(path: str) -> str | None:
    """If path exists, return it. Otherwise look in the parent dir for a sibling
    with a timestamp within a few seconds (the INVOKE_PATTERN +1s heuristic is approximate).
    Returns the resolved absolute path or None if no plausible match.
    """
    if os.path.isdir(path):
        return path
    parent = os.path.dirname(path)
    if not os.path.isdir(parent):
        return None
    target = os.path.basename(path)
    # Expected pattern: YYYY-MM-DD_HH-MM-SS_<rest>
    m = re.match(r"(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})_(.+)$", target)
    if not m:
        return None
    date, hh, mm, ss, rest = m.groups()
    target_ts = datetime.strptime(f"{date} {hh}:{mm}:{ss}", "%Y-%m-%d %H:%M:%S")
    best: tuple[int, str] | None = None
    for name in os.listdir(parent):
        if not name.endswith(rest):
            continue
        nm = re.match(r"(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})_", name)
        if not nm:
            continue
        nd, nh, nmm, ns = nm.groups()
        try:
            nts = datetime.strptime(f"{nd} {nh}:{nmm}:{ns}", "%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
        delta = abs(int((nts - target_ts).total_seconds()))
        if delta <= 8 and (best is None or delta < best[0]):
            best = (delta, name)
    return os.path.join(parent, best[1]) if best else None


def check_eos(
    entries: list[tuple[str, str, str, str, str]],
    local_base: str,
    eos_base: str,
    prober_subdir: str,
) -> int:
    """Print existence of each entry locally and on EOS. Returns count missing on EOS."""
    print(f"{'local':6}  {'eos':6}  wafer        chip   seq_type            folder")
    missing_eos = 0
    missing_local = 0
    fuzz_local: list[tuple[str, str]] = []  # (original, resolved)
    fuzz_eos: list[tuple[str, str]] = []
    for wafer, chip, seq_type, _status, folder in entries:
        local_path, eos_path = build_paths(
            wafer, chip, seq_type, folder, local_base, eos_base, prober_subdir
        )
        resolved_local = resolve_folder(local_path)
        resolved_eos = resolve_folder(eos_path)
        loc_ok = resolved_local is not None
        eos_ok = resolved_eos is not None
        if not loc_ok:
            missing_local += 1
        if not eos_ok:
            missing_eos += 1
        loc_exact = os.path.isdir(local_path)
        eos_exact = os.path.isdir(eos_path)
        loc_marker = "OK" if loc_exact else ("~OK" if loc_ok else "MISS")
        eos_marker = "OK" if eos_exact else ("~OK" if eos_ok else "MISS")
        print(
            f"{loc_marker:6}  "
            f"{eos_marker:6}  "
            f"{wafer:12} {chip:6} {seq_type:20} {folder}"
        )
        if loc_ok and not loc_exact:
            resolved_name = os.path.basename(resolved_local)
            print(f"        (local resolved via timestamp fuzz -> {resolved_name})")
            fuzz_local.append((folder, resolved_name))
        if eos_ok and not eos_exact:
            resolved_name = os.path.basename(resolved_eos)
            print(f"        (eos   resolved via timestamp fuzz -> {resolved_name})")
            fuzz_eos.append((folder, resolved_name))
    print()
    print(f"summary: {len(entries)} entries, {missing_local} missing locally, {missing_eos} missing on EOS")
    if fuzz_local or fuzz_eos:
        print(
            f"fuzz: {len(fuzz_local)} local match(es), {len(fuzz_eos)} eos match(es) "
            f"recovered via ±5s timestamp fuzz"
        )
        for original, resolved_name in fuzz_local:
            print(f"  [local] {original}  ->  {resolved_name}")
        for original, resolved_name in fuzz_eos:
            print(f"  [eos]   {original}  ->  {resolved_name}")
    return missing_eos


def rsync_to_eos(
    entries: list[tuple[str, str, str, str, str]],
    local_base: str,
    eos_base: str,
    prober_subdir: str,
    rsync_opts: list[str],
    dry_run: bool,
) -> int:
    """Rsync each entry's local folder to EOS. Returns number of failed transfers."""
    failures = 0
    skipped_no_local = 0
    transferred = 0
    for wafer, chip, seq_type, _status, folder in entries:
        local_path, eos_path = build_paths(
            wafer, chip, seq_type, folder, local_base, eos_base, prober_subdir
        )
        resolved = resolve_folder(local_path)
        if resolved is None:
            print(f"[skip] no local source: {local_path}", file=sys.stderr)
            skipped_no_local += 1
            continue
        if resolved != local_path:
            # Local timestamp differs (off-by-one in INVOKE_PATTERN); use the EOS name
            # that matches what's on disk, so the destination mirrors the actual folder.
            print(
                f"[note] local timestamp differs, using {os.path.basename(resolved)}",
                file=sys.stderr,
            )
            eos_path = os.path.join(os.path.dirname(eos_path), os.path.basename(resolved))

        eos_parent = os.path.dirname(eos_path)
        # rsync requires trailing slash on source to copy contents into named dest.
        # We sync the named folder itself into the parent so the dir name is preserved.
        src = resolved.rstrip("/") + "/"
        dst = eos_path.rstrip("/") + "/"

        cmd = ["rsync", *rsync_opts, src, dst]
        if dry_run:
            cmd.insert(1, "--dry-run")

        print(f"[run] {' '.join(shlex.quote(c) for c in cmd)}")
        # Ensure parent exists on EOS before rsync (rsync needs the dst dir).
        if not dry_run:
            os.makedirs(eos_parent, exist_ok=True)
            os.makedirs(eos_path, exist_ok=True)

        rc = subprocess.call(cmd)
        if rc != 0:
            print(f"[fail] rsync exited {rc} for {folder}", file=sys.stderr)
            failures += 1
        else:
            transferred += 1

    print()
    print(
        f"rsync summary: {transferred} ok, {failures} failed, "
        f"{skipped_no_local} skipped (no local source)"
    )
    return failures


def ptpa_summary(ptpa_results: list[tuple[str, str, str]]) -> str:
    if not ptpa_results:
        return "PTPA: no results found in log (old log format or no PTPA runs)"
    total = len(ptpa_results)
    passed = sum(1 for _, _, s in ptpa_results if s.lower() == "success")
    failed = total - passed
    return f"PTPA: succeeded for {passed}/{total} tested chips, failed for {failed}/{total}"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract sequence run entries from a production log file as CSV."
    )
    parser.add_argument("log_file", help="Path to the log file (e.g. log_prod_run_L1W08_S4.log)")
    parser.add_argument(
        "--header",
        action="store_true",
        default=False,
        help="Print a CSV header row",
    )
    parser.add_argument(
        "--sep",
        default=",",
        help="Column separator (default: comma)",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        default=False,
        help="Include overall sequence result as second-to-last column (new log format only)",
    )
    parser.add_argument(
        "--check-eos",
        action="store_true",
        default=False,
        help="For each extracted folder, print whether it exists locally and on EOS (no transfer).",
    )
    parser.add_argument(
        "--rsync-to-eos",
        action="store_true",
        default=False,
        help="Rsync each extracted folder from local base to EOS base (uses --ignore-existing by default).",
    )
    parser.add_argument(
        "--local-base",
        default=DEFAULT_LOCAL_BASE,
        help=f"Local test-results base directory (default: {DEFAULT_LOCAL_BASE})",
    )
    parser.add_argument(
        "--eos-base",
        default=DEFAULT_EOS_BASE,
        help=f"EOS test-results base directory (default: {DEFAULT_EOS_BASE})",
    )
    parser.add_argument(
        "--prober-subdir",
        default=DEFAULT_PROBER_SUBDIR,
        help=f"Per-chip subdirectory under <wafer>/<chip_wafer>/ (default: {DEFAULT_PROBER_SUBDIR})",
    )
    parser.add_argument(
        "--rsync-opts",
        default="-av --ignore-existing",
        help="rsync options used with --rsync-to-eos (default: '-av --ignore-existing')",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="With --rsync-to-eos, run rsync with --dry-run.",
    )
    args = parser.parse_args()

    entries, ptpa_results = extract_entries(args.log_file)

    print(ptpa_summary(ptpa_results))
    print()

    if args.check_eos or args.rsync_to_eos:
        if args.check_eos:
            check_eos(entries, args.local_base, args.eos_base, args.prober_subdir)
            print()
        if args.rsync_to_eos:
            rsync_opts = shlex.split(args.rsync_opts)
            rc = rsync_to_eos(
                entries,
                args.local_base,
                args.eos_base,
                args.prober_subdir,
                rsync_opts,
                args.dry_run,
            )
            sys.exit(1 if rc else 0)
        return

    sep = args.sep
    if args.header:
        cols = ["wafer", "chip", "seq_type"]
        if args.status:
            cols.append("status")
        cols.append("folder_name")
        print(sep.join(cols))

    fuzzy: list[tuple[str, str]] = []   # (log_folder, resolved_folder)
    missing: list[str] = []             # log_folder names with no EOS match

    for wafer, chip, seq_type, status, folder in entries:
        display_folder = folder
        if args.status:
            eos_path = build_paths(
                wafer, chip, seq_type, folder, args.local_base, args.eos_base, args.prober_subdir
            )[1]
            resolved = resolve_folder(eos_path)
            if resolved is None:
                missing.append(folder)
            elif resolved != eos_path:
                resolved_name = os.path.basename(resolved)
                fuzzy.append((folder, resolved_name))
                display_folder = resolved_name

        cols = [wafer, chip, seq_type]
        if args.status:
            cols.append(status)
        cols.append(display_folder)
        print(sep.join(cols))

    if args.status and (fuzzy or missing):
        print()
        print(
            f"fuzz summary: {len(fuzzy)} row(s) substituted with on-EOS folder name, "
            f"{len(missing)} not found on EOS"
        )
        for log_folder, resolved_name in fuzzy:
            print(f"  fuzz  {log_folder}  ->  {resolved_name}")
        for log_folder in missing:
            print(f"  miss  {log_folder}")


if __name__ == "__main__":
    main()
