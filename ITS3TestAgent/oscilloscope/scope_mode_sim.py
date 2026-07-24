#!/usr/bin/env python3
"""
scope_mode_sim.py — simulate the mosaix_test scope-mode side of the handshake.

This is a faithful Python re-implementation of what a mosaix_test
HsChannelPattern run in ``scope_mode: true`` does to the two handshake files —
mirroring ScopeModeSignal (mosaix_test/src/utils/scope_mode_signal.cpp) and the
pattern test's per-channel driving loop. It lets you exercise the ITS3 TestAgent
scope watcher end to end with no chip, no readout hardware, and no oscilloscope.

For each channel (TEST_ONE_BY_ONE) or once for all channels (broadcast) it:
  1. publishDriving(): clears the stop file, writes state="driving" with a fresh
     start_time_s and the current channel list, mode 0666.
  2. sleepUnlessStopped(test_duration): refreshes the heartbeat every 0.5 s until
     either the stop file appears (external capture done) or test_duration
     elapses — whichever comes first.
  3. On the last channel, publishDone(): writes state="done".

Usage:
    python -m oscilloscope.scope_mode_sim --mode one_by_one \
        --channels "HsChannel_HSCHA[0]" "HsChannel_HSCHA[3]" \
        --test-duration 10 --pattern PRBS31
"""

from __future__ import annotations

import argparse
import json
import os
import time

STATUS_FILE = "/tmp/mosaix_scope_mode.json"
STOP_FILE = "/tmp/mosaix_scope_mode.stop"
STOP_POLL_INTERVAL_S = 0.5  # matches ScopeModeSignal::STOP_POLL_INTERVAL_S


class ScopeModeSignalSim:
    """Python twin of the C++ ScopeModeSignal."""

    def __init__(self, test_type: str, pattern: str, channels: list[str],
                 scan_point: dict | None = None):
        self.test_type = test_type
        self.pattern = pattern
        self.channels = channels
        self.scan_point = scan_point  # optional per-drive scan-point label (pattern scan)
        self.start_epoch = 0
        self._done = False

    def _write_status(self, state: str) -> None:
        status = {
            "state": state,
            "test_type": self.test_type,
            "pattern": self.pattern,
            "channels": self.channels,
            "pid": os.getpid(),
            "start_time_s": int(self.start_epoch),
            "heartbeat_time_s": int(time.time()),
        }
        if self.scan_point:
            status["scan_point"] = self.scan_point
        # In-place truncate + chmod 0666, exactly like the C++ side.
        with open(STATUS_FILE, "w") as f:
            json.dump(status, f, indent=2)
            f.write("\n")
        os.chmod(STATUS_FILE, 0o666)

    def publish_driving(self) -> None:
        try:
            os.unlink(STOP_FILE)  # best effort (sticky /tmp: may fail if not owner)
        except FileNotFoundError:
            pass
        except OSError:
            pass
        self.start_epoch = int(time.time())
        self._write_status("driving")

    def heartbeat(self) -> None:
        self._write_status("driving")

    def publish_done(self) -> None:
        self._write_status("done")
        self._done = True

    def _stop_requested(self) -> bool:
        try:
            st = os.stat(STOP_FILE)
        except FileNotFoundError:
            return False
        # Ignore a stale stop file predating this drive (mtime + 1s slack).
        return st.st_mtime + 1 >= self.start_epoch

    def sleep_unless_stopped(self, seconds: float) -> bool:
        """Returns True if a stop was requested, False if the full time elapsed."""
        end = time.monotonic() + seconds
        while True:
            if self._stop_requested():
                return True
            remaining = end - time.monotonic()
            if remaining <= 0:
                return False
            time.sleep(min(remaining, STOP_POLL_INTERVAL_S))
            self.heartbeat()


def run(mode: str, channels: list[str], test_type: str, pattern: str,
        test_duration: float, scan_points: int = 0) -> None:
    # A "drive" = one publish_driving/sleep/done cycle, with an optional
    # scan_point label. Broadcast: one drive, all channels. One-by-one: one drive
    # per channel. Scan: one drive per point (on the first channel), each with a
    # scan_point object (mirrors HsChannelPatternScanTest).
    scan_labels: list[dict | None]
    if scan_points > 0:
        test_type = "HsChannelPatternScanTest"
        drives = [[channels[0]] for _ in range(scan_points)]
        pre = ["MIN", "MED", "MAX"]
        scan_labels = [{"scan_point": str(i + 1),
                        "preEmphasisStrength": pre[i % 3],
                        "dllChargePumpCurrent": str(i % 8)}
                       for i in range(scan_points)]
    elif mode == "broadcast":
        drives = [channels]
        scan_labels = [None]
    else:
        drives = [[ch] for ch in channels]
        scan_labels = [None] * len(channels)

    print(f"[sim] {test_type} scope_mode ({'scan' if scan_points else mode}) — pattern {pattern}, "
          f"{len(drives)} drive(s), test_duration={test_duration}s")
    print(f"[sim] status: {STATUS_FILE}  stop: {STOP_FILE}")

    for i, drive_channels in enumerate(drives):
        sig = ScopeModeSignalSim(test_type, pattern, drive_channels, scan_labels[i])
        sig.publish_driving()
        extra = f" scan_point={scan_labels[i]}" if scan_labels[i] else ""
        print(f"[sim] driving {drive_channels}{extra} (up to {test_duration}s) ...")
        stopped = sig.sleep_unless_stopped(test_duration)
        reason = "external stop" if stopped else "test_duration elapsed"
        print(f"[sim]   {drive_channels}: drive ended ({reason})")
        if i == len(drives) - 1:
            sig.publish_done()
            print("[sim] published state=done")


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--mode", choices=["one_by_one", "broadcast"], default="one_by_one")
    p.add_argument("--channels", nargs="+",
                   default=["HsChannel_HSCHA[0]", "HsChannel_HSCHA[3]", "HsChannel_HSCHA[7]"])
    p.add_argument("--test-type", default="HsChannelPattern")
    p.add_argument("--pattern", default="PRBS31")
    p.add_argument("--test-duration", type=float, default=10.0,
                   help="Upper bound per drive; the watcher normally stops it sooner")
    p.add_argument("--scan-points", type=int, default=0,
                   help="Simulate a pattern SCAN: drive N points (on the first channel), "
                        "each forwarding a scan_point label")
    args = p.parse_args(argv)
    run(args.mode, args.channels, args.test_type, args.pattern, args.test_duration,
        scan_points=args.scan_points)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
