#!/usr/bin/env python3
"""
scope_mode_watcher.py — client for the mosaix_test scope-mode file handshake.

mosaix_test's HsChannelPattern / HsChannelLpgbt tests, when run with
``scope_mode: true``, drive the chip output at an oscilloscope for up to
``test_duration`` seconds and publish their state to two fixed files:

    /tmp/mosaix_scope_mode.json   status (state, test type, pattern, channels,
                                  pid, start/heartbeat epoch, mode 0666)
    /tmp/mosaix_scope_mode.stop   the watching tool creates this to end early

This watcher is the *other* side of that protocol (see the "Guide for the
watching software" in the mosaix_test scope-mode notes):

  1. Poll the status file until ``state == "driving"`` with a fresh heartbeat
     (older than ~5 s ⇒ the driving process died).
  2. Capture the waveform for the channel(s) currently live, via the ported
     scope drivers in scopes/ (or log-only in dry-run).
  3. Create/touch the stop file so the run ends without waiting out
     test_duration. In TEST_ONE_BY_ONE mode this advances mosaix to the next
     channel, which republishes "driving" with a new start_time_s — the watcher
     captures again. In broadcast mode it ends the single drive.
  4. Stop when the status file reads ``state == "done"``, or on timeout, or when
     the caller signals the driving process has exited.

Ownership is strictly split, exactly as the mosaix side documents: mosaix owns
the status file, this tool owns the stop file. We never write the status file
and only ever touch the stop file, so the /tmp sticky bit is never a problem.

Standalone use (alongside a manually launched scope_mode RunTest):

    python -m oscilloscope.scope_mode_watcher --model labmaster_mcm \
        --output-dir scope_data --label L1W04_S4 --timeout 120

    # Prove the handshake logic with no scope attached:
    python -m oscilloscope.scope_mode_watcher --dry-run --timeout 30
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import logging
import os
import re
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from . import acquire

log = logging.getLogger("its3.scope")

# Fixed handshake paths — must match ScopeModeSignal in
# mosaix_test/include/utils/scope_mode_signal.h
STATUS_FILE = "/tmp/mosaix_scope_mode.json"
STOP_FILE = "/tmp/mosaix_scope_mode.stop"

# A heartbeat older than this means the driving process is gone (the mosaix
# side refreshes it every 0.5 s).
HEARTBEAT_STALE_S = 5.0


def _sanitize(name: str) -> str:
    """Make a mosaix channel name safe for a filename: HSCHA[3] -> HSCHA3."""
    return re.sub(r"[^0-9A-Za-z._-]+", "_", name).strip("_")


def _scan_point_token(scan_point: dict) -> str:
    """Build a compact, sortable filename token from the handshake's optional
    "scan_point" object (present for HsChannelPatternScanTest). Each scan point
    forwards its index, optional repeat, and the swept parameter values, e.g.
    {"scan_point":"3","repeat":"2","preEmphasisStrength":"MAX"} ->
    "pt003_rep2_preEmphasisStrengthMAX". The point index leads (zero-padded so
    files sort by point) and the swept params follow alphabetically."""
    if not scan_point:
        return ""
    parts = []
    if "scan_point" in scan_point:
        v = str(scan_point["scan_point"])
        parts.append(f"pt{v.zfill(3)}" if v.isdigit() else f"pt{v}")
    if "repeat" in scan_point:
        parts.append(f"rep{scan_point['repeat']}")
    for key in sorted(scan_point):
        if key in ("scan_point", "repeat"):
            continue
        parts.append(f"{key}{scan_point[key]}")
    return "_".join(_sanitize(p) for p in parts)


def _visa_host(visa_address: str) -> Optional[str]:
    """Extract the host from a VISA resource string, e.g.
    'TCPIP0::192.168.0.11::inst0::INSTR' -> '192.168.0.11'."""
    if not visa_address:
        return None
    parts = visa_address.split("::")
    return parts[1] if len(parts) > 1 else None


def _local_ipv4_addresses() -> list[str]:
    """Best-effort list of this host's configured IPv4 addresses (Linux `ip`)."""
    try:
        out = subprocess.run(["ip", "-o", "-4", "addr", "show"],
                             capture_output=True, text=True, timeout=3).stdout
    except (OSError, subprocess.SubprocessError):
        return []
    return re.findall(r"\binet\s+(\d+\.\d+\.\d+\.\d+)", out)


def preflight_network(visa_address: str) -> Optional[str]:
    """Best-effort check that the scope host looks reachable from a local
    interface. Returns a human-readable warning string if the scope's subnet has
    no matching local interface (the classic "forgot the host setup script /
    `sudo ip addr add 192.168.0.1/24 dev <iface>`" case), else None.

    Warn-only: never blocks a capture, since the check can't see every network
    topology (routed scopes, VPNs, etc.).
    """
    host = _visa_host(visa_address)
    if not host:
        return None
    try:
        scope_ip = ipaddress.ip_address(host)
    except ValueError:
        return None  # hostname, not a literal IP — leave DNS/routing to VISA
    if not scope_ip.is_private:
        return None  # routed/public scope — a local /24 check doesn't apply

    scope_net = ipaddress.ip_network(f"{host}/24", strict=False)
    locals_ = _local_ipv4_addresses()
    if any(ipaddress.ip_address(a) in scope_net for a in locals_):
        return None
    return (f"scope host {host} is on {scope_net} but no local interface is "
            f"configured on that subnet. Configure the scope adapter first "
            f"(e.g. `sudo ip addr add 192.168.0.1/24 dev <iface>`, or source the "
            f"oscilloscope-automation host setup script) — otherwise VISA will "
            f"time out. Local IPv4: {', '.join(locals_) or 'none found'}")


@dataclass
class ScopeCaptureConfig:
    """How the watcher should capture: which scope, where output goes, etc."""

    model: str = "labmaster_mcm"
    # Path to the scope JSON config; None -> the packaged default for `model`.
    scope_config: Optional[str] = None
    # Per-capture overrides applied on top of the scope config (KEY -> value).
    overrides: dict = field(default_factory=dict)
    points: int = -1                # -1 = use the scope config's acquire_points
    output_dir: str = "scope_data"
    label: str = ""                 # prefix for output filenames (e.g. chip name)
    dry_run: bool = False           # True = never touch a scope, log intentions
    poll_interval_s: float = 0.25   # status-file poll cadence
    skip_setup_after_first: bool = True  # re-use scope setup across channels
    connect_attempts: int = 3       # retries for the (sometimes flaky) first VXI-11 connect
    connect_backoff_s: float = 1.0  # wait between connect attempts
    skip_setup: bool = False        # True = never run initialize/vertical/trigger/acq
                                    # setup; capture with the scope's current config
    done_grace_s: float = 8.0       # standalone only: how long to wait after a fresh
                                    # 'done' for the next channel before finishing

    def resolved_scope_config_path(self) -> str:
        if self.scope_config:
            return self.scope_config
        return str(acquire.default_config_path(self.model))


class ScopeModeWatcher:
    """Watches the scope-mode handshake and captures waveforms."""

    def __init__(self, cfg: ScopeCaptureConfig):
        self.cfg = cfg
        self.n_captures = 0
        self._scope_cfg: dict = {}
        self._points: int = 0
        self._first_capture = True

    # ── status / stop file I/O ────────────────────────────────────────────

    @staticmethod
    def read_status() -> Optional[dict]:
        """Read and parse the status file. Returns None if absent or if the
        JSON is momentarily unparseable (the mosaix side rewrites it in place,
        so a reader can catch a partial write — retry on the next poll)."""
        try:
            with open(STATUS_FILE) as f:
                return json.load(f)
        except FileNotFoundError:
            return None
        except (json.JSONDecodeError, ValueError):
            return None  # partial write — try again next poll
        except OSError as exc:
            log.warning("scope: cannot read %s: %s", STATUS_FILE, exc)
            return None

    @staticmethod
    def request_stop() -> None:
        """Create/touch the stop file (mode 0666) to end the current drive."""
        try:
            fd = os.open(STOP_FILE, os.O_WRONLY | os.O_CREAT, 0o666)
            os.close(fd)
            now = time.time()
            os.utime(STOP_FILE, (now, now))
            # os.open honours umask; force 0666 so the mosaix side (possibly a
            # different user in the sticky /tmp) can always stat/replace it.
            try:
                os.chmod(STOP_FILE, 0o666)
            except OSError:
                pass
        except OSError as exc:
            log.warning("scope: could not create stop file %s: %s", STOP_FILE, exc)

    @staticmethod
    def _heartbeat_fresh(status: dict) -> bool:
        hb = status.get("heartbeat_time_s")
        if hb is None:
            return False
        return (time.time() - float(hb)) <= HEARTBEAT_STALE_S

    # ── capture ───────────────────────────────────────────────────────────

    def _output_path(self, status: dict, generation: int) -> str:
        channels = status.get("channels") or ["chan"]
        if len(channels) == 1:
            chan_tok = _sanitize(channels[0])
        else:
            chan_tok = f"broadcast_{len(channels)}ch"
        parts = [p for p in (self.cfg.label,
                             status.get("test_type", ""),
                             status.get("pattern", ""),
                             chan_tok) if p]
        name = "_".join(_sanitize(p) for p in parts)
        # For a pattern SCAN, fold the forwarded per-point info into the filename
        # so each capture is attributable to its scan point.
        scan_tok = _scan_point_token(status.get("scan_point") or {})
        if scan_tok:
            name += "_" + scan_tok
        name += "_" + time.strftime("%Y%m%d_%H%M%S")
        os.makedirs(self.cfg.output_dir, exist_ok=True)
        ext = "DRYRUN.txt" if self.cfg.dry_run else "csv"
        return os.path.join(self.cfg.output_dir, f"{name}.{ext}")

    def _connect_scope(self, ScopeClass):
        """Open the VISA session, retrying a few times — the first VXI-11 link
        can time out transiently even when the scope is healthy. Raises the last
        exception if every attempt fails."""
        attempts = max(1, int(self.cfg.connect_attempts))
        last_exc = None
        for i in range(1, attempts + 1):
            try:
                log.info("scope: connecting to %s (attempt %d/%d)",
                         self._scope_cfg.get("visa_address"), i, attempts)
                return acquire.open_scope(ScopeClass, self._scope_cfg)
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                log.warning("scope: connect attempt %d/%d failed: %s", i, attempts, exc)
                if i < attempts:
                    time.sleep(self.cfg.connect_backoff_s)
        raise last_exc

    def _capture(self, scope, status: dict, generation: int) -> None:
        """Capture one waveform for the currently-driving generation."""
        out = self._output_path(status, generation)
        channels = ", ".join(status.get("channels", []))
        scan_point = status.get("scan_point") or {}
        scan_desc = ", ".join(f"{k}={v}" for k, v in scan_point.items())
        scan_log = f" scan_point[{scan_desc}]" if scan_desc else ""
        if self.cfg.dry_run:
            with open(out, "w") as f:
                f.write("# DRY RUN — no scope contacted, no waveform captured.\n")
                f.write(f"# test_type : {status.get('test_type')}\n")
                f.write(f"# pattern   : {status.get('pattern')}\n")
                f.write(f"# channels  : {channels}\n")
                if scan_desc:
                    f.write(f"# scan_point: {scan_desc}\n")
                f.write(f"# mosaix_pid: {status.get('pid')}\n")
                f.write(f"# captured  : {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            log.info("scope: [dry-run] would capture channels [%s]%s -> %s", channels, scan_log, out)
            self.n_captures += 1
            return

        skip_setup = self.cfg.skip_setup or (self.cfg.skip_setup_after_first and not self._first_capture)
        log.info("scope: capturing channels [%s]%s (pattern %s) -> %s%s",
                 channels, scan_log, status.get("pattern"), out,
                 " (reusing setup)" if skip_setup else "")
        acquire.capture_on_open_scope(scope, self._scope_cfg, out, self._points,
                                      skip_setup=skip_setup)
        self._first_capture = False
        self.n_captures += 1
        log.info("scope: saved %s", out)

    # ── main loop ─────────────────────────────────────────────────────────

    def run(self, timeout_s: float, stop_event=None) -> dict:
        """
        Watch the handshake for up to *timeout_s* seconds.

        *stop_event* (optional threading.Event): when the caller sets it, the
        watcher returns as soon as the current poll finishes — used by the
        TestAgent to end the watcher when the mosaix subprocess has exited.

        Returns a summary dict: {captures, saw_driving, ended}.
        """
        self._scope_cfg = acquire.load_config(self.cfg.resolved_scope_config_path())
        for k, v in self.cfg.overrides.items():
            self._scope_cfg[k] = v
        self._points = acquire.resolve_points(self.cfg.points, self._scope_cfg)
        self._first_capture = True

        log.info("scope: watching %s (model=%s%s, timeout=%.0fs)",
                 STATUS_FILE, self.cfg.model,
                 ", dry-run" if self.cfg.dry_run else "", timeout_s)

        scope = None
        ScopeClass = None
        if not self.cfg.dry_run:
            ScopeClass = acquire.load_scope_class(self.cfg.model)
            warning = preflight_network(self._scope_cfg.get("visa_address", ""))
            if warning:
                log.warning("scope: network preflight — %s", warning)

        captured_generations: set = set()
        saw_driving = False
        saw_fresh = False       # have we yet seen any fresh status in THIS session?
        ended = "timeout"
        deadline = time.monotonic() + timeout_s
        done_since = None       # monotonic time a terminal 'done' was first seen
        last_stale_warn = 0.0   # throttle for the "stale driving" warning

        try:
            while time.monotonic() < deadline:
                if stop_event is not None and stop_event.is_set():
                    ended = "caller_stopped"
                    break

                status = self.read_status()
                if status is None:
                    time.sleep(self.cfg.poll_interval_s)
                    continue

                state = status.get("state")
                fresh = self._heartbeat_fresh(status)

                # A LEADING stale status (before we have seen any fresh activity) is
                # a LEFTOVER from a previous run or die. mosaix refreshes the
                # heartbeat every 0.5 s while driving and stamps it at publishDone,
                # so a minutes-old file is trivially detected. Ignoring it fixes the
                # "next die exits instantly on the old 'done'" bug. Once we HAVE seen
                # our own drive, a later stale status is interpreted by its state
                # (stale 'done' = our finished run; stale 'driving' = dead process).
                if not saw_fresh and not fresh:
                    time.sleep(self.cfg.poll_interval_s)
                    continue
                if fresh:
                    saw_fresh = True

                if state == "done":
                    # A drive finished. In TEST_ONE_BY_ONE the NEXT channel may still
                    # start (a newer 'driving'), so we do not exit on the first 'done'.
                    # In the agent the caller's stop signal (mosaix process exit) is the
                    # real terminator; standalone exits after done_grace_s with no new drive.
                    if stop_event is not None:
                        time.sleep(self.cfg.poll_interval_s)
                        continue
                    if done_since is None:
                        done_since = time.monotonic()
                    elif time.monotonic() - done_since >= self.cfg.done_grace_s:
                        log.info("scope: state=done and no new drive for %.0fs — finishing",
                                 self.cfg.done_grace_s)
                        ended = "done"
                        break
                    time.sleep(self.cfg.poll_interval_s)
                    continue

                if state != "driving":
                    time.sleep(self.cfg.poll_interval_s)
                    continue

                if not fresh:
                    # 'driving' but stale AFTER we saw our drive => the driving process
                    # died mid-run. Warn (throttled) and wait; don't capture stale.
                    if time.monotonic() - last_stale_warn > 5.0:
                        log.warning("scope: 'driving' but heartbeat is stale (>%.0fs) — "
                                    "driving process may have died", HEARTBEAT_STALE_S)
                        last_stale_warn = time.monotonic()
                    time.sleep(self.cfg.poll_interval_s)
                    continue

                done_since = None  # a live drive is (again) in progress

                # One capture per driving generation. In TEST_ONE_BY_ONE each
                # channel republishes with a new start_time_s -> new generation;
                # in a pattern SCAN each point republishes with a new scan_point.
                scan_point = status.get("scan_point") or {}
                generation = (status.get("start_time_s"),
                              tuple(status.get("channels", [])),
                              tuple(sorted(scan_point.items())))
                if generation in captured_generations:
                    # Already captured this drive; waiting for the next channel
                    # (or "done"). The stop file we touched advances mosaix on.
                    time.sleep(self.cfg.poll_interval_s)
                    continue

                saw_driving = True

                # Open the scope lazily on the first real drive so a non-scope
                # command (status file never goes "driving") never touches VISA.
                # A connect failure must NOT crash the watcher thread: log it,
                # skip this drive, and let the next channel retry a fresh connect.
                if not self.cfg.dry_run and scope is None:
                    try:
                        scope = self._connect_scope(ScopeClass)
                    except Exception as exc:  # noqa: BLE001
                        log.error("scope: could not connect to %s after %d attempt(s): %s "
                                  "— skipping capture for channels %s (drive left to run its "
                                  "test_duration; next channel will retry)",
                                  self._scope_cfg.get("visa_address"),
                                  self.cfg.connect_attempts, exc, status.get("channels"))
                        captured_generations.add(generation)  # don't re-attempt this drive in a tight loop
                        time.sleep(self.cfg.poll_interval_s)
                        continue

                try:
                    self._capture(scope, status, len(captured_generations))
                except Exception as exc:  # noqa: BLE001 — never wedge the drive
                    log.error("scope: capture failed for generation %s: %s", generation, exc)
                    # The link may be bad; drop it so the next drive reconnects fresh.
                    try:
                        scope.close()
                    except Exception:  # noqa: BLE001
                        pass
                    scope = None
                captured_generations.add(generation)

                # End this drive (advance to next channel / finish broadcast).
                self.request_stop()
        finally:
            if scope is not None:
                try:
                    scope.close()
                except Exception:  # noqa: BLE001
                    pass

        log.info("scope: watcher finished (%s) — %d capture(s), driving seen: %s",
                 ended, self.n_captures, saw_driving)
        return {"captures": self.n_captures, "saw_driving": saw_driving, "ended": ended}


# ── CLI ───────────────────────────────────────────────────────────────────────

def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Watch the mosaix_test scope-mode handshake and capture waveforms.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--model", default="labmaster_mcm",
                   choices=list(acquire.MODEL_REGISTRY),
                   help="Scope model key (default: labmaster_mcm)")
    p.add_argument("--scope-config", default=None,
                   help="Scope JSON config path (default: packaged config for --model)")
    p.add_argument("--output-dir", default="scope_data",
                   help="Directory for captured CSVs (default: scope_data)")
    p.add_argument("--label", default="",
                   help="Filename prefix, e.g. the chip name")
    p.add_argument("--points", type=int, default=-1,
                   help="Points to acquire/export; 0 = all. Default: scope config value.")
    p.add_argument("--timeout", type=float, default=120.0,
                   help="Max seconds to watch (upper bound; default 120)")
    p.add_argument("--set", metavar="KEY=VALUE", action="append", default=[],
                   help="Override a scope config key (repeatable), e.g. --set channel=C2")
    p.add_argument("--dry-run", action="store_true",
                   help="Never contact a scope; log captures and write .DRYRUN markers")
    return p


def main(argv=None) -> int:
    args = _build_parser().parse_args(argv)
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s [%(levelname)s] %(message)s",
                        datefmt="%Y-%m-%d %H:%M:%S")

    overrides = {}
    for kv in args.set:
        if "=" not in kv:
            log.error("--set must be KEY=VALUE, got: %r", kv)
            return 2
        k, v = kv.split("=", 1)
        overrides[k] = acquire.parse_override(v)

    cfg = ScopeCaptureConfig(
        model=args.model,
        scope_config=args.scope_config,
        overrides=overrides,
        points=args.points,
        output_dir=args.output_dir,
        label=args.label,
        dry_run=args.dry_run,
    )
    summary = ScopeModeWatcher(cfg).run(args.timeout)
    return 0 if summary["saw_driving"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
