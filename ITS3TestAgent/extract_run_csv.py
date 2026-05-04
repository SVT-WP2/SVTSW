#!/usr/bin/env python3
"""Extract unique wafer/chip/sequence entries from a production run log file and print CSV."""

import argparse
import re
from datetime import datetime, timedelta


# New-format: EOS path contains the folder name directly.
PATH_PATTERN = re.compile(
    r"/(WaferPrimaryTestingSequence|WaferTileTestingSequence)"
    r"/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_(BAM\d+|SEG\d+)_(L1W\d+_S\d+)_(?:WaferPrimaryTestingSequence|WaferTileTestingSequence))/"
)

# Old-format fallback: command invocation line.
# e.g.  2026-04-23 04:02:28 [INFO] [SEG0_L1W06_S4]  $ ./build/RunSequence .../wafer_primary_seq.json5 ...
INVOKE_PATTERN = re.compile(
    r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[INFO\] \[(BAM\d+|SEG\d+)_(L1W\d+_S\d+)\].*RunSequence.*/(wafer_primary_seq|wafer_tile_seq)\.json5"
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
    "wafer_primary_seq": "wafer_primary_seq",
    "wafer_tile_seq": "wafer_tile_seq",
}

SEQ_FOLDER_SUFFIX = {
    "wafer_primary_seq": "WaferPrimaryTestingSequence",
    "wafer_tile_seq": "WaferTileTestingSequence",
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

    return entries, ptpa_results


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
    args = parser.parse_args()

    entries, ptpa_results = extract_entries(args.log_file)

    print(ptpa_summary(ptpa_results))
    print()

    sep = args.sep
    if args.header:
        cols = ["wafer", "chip", "seq_type"]
        if args.status:
            cols.append("status")
        cols.append("folder_name")
        print(sep.join(cols))

    for wafer, chip, seq_type, status, folder in entries:
        cols = [wafer, chip, seq_type]
        if args.status:
            cols.append(status)
        cols.append(folder)
        print(sep.join(cols))


if __name__ == "__main__":
    main()
