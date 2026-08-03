#!/usr/bin/env python3
"""
scope_network.py — configure the local USB-ethernet link to the oscilloscope.

Ported from the oscilloscope-automation host setup scripts
(setup.sh / setup_PCMITPX02.sh / setup_its3mithig-minipc0.sh). Those scripts set
the scope's USB ethernet adapter to 192.168.0.1/24 so the scope (e.g. the
LabMaster at 192.168.0.11) is reachable over VISA. This module ports the network
part only — the venv/pip part is the agent's own requirements.txt.

Interface resolution order (first hit wins):
  1. explicit --iface / iface= argument
  2. $SCOPE_IFACE environment variable
  3. per-host known map (KNOWN_HOST_IFACES, from the two host setup scripts)
  4. saved choice in oscilloscope/configs/local_iface (like setup.sh)
  5. auto-detect: the single enx* USB adapter, if exactly one is present

Setting the address needs root, so `ip addr add` runs under sudo by default
(skipped when already root, or when the address is already present).

CLI:
  python -m oscilloscope.scope_network --check          # report only, no change
  python -m oscilloscope.scope_network                  # ensure 192.168.0.1/24
  python -m oscilloscope.scope_network --iface enx... --ip 192.168.0.1/24
"""

from __future__ import annotations

import argparse
import ipaddress
import logging
import os
import re
import socket
import subprocess
from pathlib import Path
from typing import Optional

log = logging.getLogger("its3.scope.net")

DEFAULT_SCOPE_IP = "192.168.0.1/24"
SAVED_IFACE_FILE = Path(__file__).resolve().parent / "configs" / "local_iface"

# Hardcoded per-host adapters, copied from the oscilloscope-automation host
# setup scripts so a known lab host needs no detection or saved file.
KNOWN_HOST_IFACES = {
    "PCMITPX02": "enx3c18a0265b68",           # setup_PCMITPX02.sh
    "its3mithig-minipc0": "enxd8eb97b900e2",  # setup_its3mithig-minipc0.sh
}


# ── Interface discovery / inspection ──────────────────────────────────────────

def detect_usb_interfaces() -> list[str]:
    """List USB ethernet adapters (enx* names), like setup.sh's mapfile."""
    try:
        out = subprocess.run(["ip", "-o", "link", "show"],
                             capture_output=True, text=True, timeout=3).stdout
    except (OSError, subprocess.SubprocessError):
        return []
    names = re.findall(r"^\d+:\s+([^:@]+)", out, re.MULTILINE)
    return [n.strip() for n in names if n.strip().startswith("enx")]


def interface_addresses(iface: str) -> list[str]:
    """IPv4 addresses currently configured on *iface*."""
    try:
        out = subprocess.run(["ip", "-o", "-4", "addr", "show", "dev", iface],
                             capture_output=True, text=True, timeout=3).stdout
    except (OSError, subprocess.SubprocessError):
        return []
    return re.findall(r"\binet\s+(\d+\.\d+\.\d+\.\d+)", out)


def interface_exists(iface: str) -> bool:
    try:
        r = subprocess.run(["ip", "link", "show", "dev", iface],
                           capture_output=True, text=True, timeout=3)
        return r.returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def interface_has_ip(iface: str, ip_cidr: str) -> bool:
    """True if the address part of *ip_cidr* is already on *iface*."""
    want = ip_cidr.split("/")[0]
    return want in interface_addresses(iface)


# ── Interface resolution ──────────────────────────────────────────────────────

def _read_saved_iface() -> Optional[str]:
    try:
        return SAVED_IFACE_FILE.read_text().strip() or None
    except OSError:
        return None


def _save_iface(iface: str) -> None:
    try:
        SAVED_IFACE_FILE.parent.mkdir(parents=True, exist_ok=True)
        SAVED_IFACE_FILE.write_text(iface + "\n")
        log.info("scope-net: saved interface %s to %s", iface, SAVED_IFACE_FILE)
    except OSError as exc:
        log.warning("scope-net: could not save interface choice: %s", exc)


def resolve_interface(iface: Optional[str] = None) -> tuple[Optional[str], str]:
    """Resolve the scope interface. Returns (iface_or_None, reason)."""
    if iface:
        return iface, "explicit argument"

    env_iface = os.environ.get("SCOPE_IFACE")
    if env_iface:
        return env_iface, "$SCOPE_IFACE"

    host = socket.gethostname()
    if host in KNOWN_HOST_IFACES:
        return KNOWN_HOST_IFACES[host], f"known host {host}"

    saved = _read_saved_iface()
    if saved:
        return saved, f"saved {SAVED_IFACE_FILE.name}"

    detected = detect_usb_interfaces()
    if len(detected) == 1:
        return detected[0], "auto-detected (single enx* adapter)"
    if len(detected) == 0:
        return None, "no enx* USB ethernet adapter found"
    return None, f"multiple USB adapters ({', '.join(detected)}); set --iface or $SCOPE_IFACE"


# ── Ensure the address is configured ──────────────────────────────────────────

def ensure_scope_network(ip_cidr: str = DEFAULT_SCOPE_IP,
                         iface: Optional[str] = None,
                         use_sudo: bool = True,
                         save: bool = True,
                         apply: bool = True) -> dict:
    """
    Make sure *ip_cidr* is configured on the resolved scope interface.

    apply=False only checks and reports (no changes). Returns a dict:
      {ok, iface, action, message}
      action ∈ {"already_set", "added", "would_add", "noop", "error"}
    """
    resolved, reason = resolve_interface(iface)
    if not resolved:
        msg = f"could not determine scope interface: {reason}"
        log.warning("scope-net: %s", msg)
        return {"ok": False, "iface": None, "action": "error", "message": msg}

    if not interface_exists(resolved):
        msg = (f"interface {resolved} not found ({reason}). "
               f"Delete {SAVED_IFACE_FILE} or set --iface/$SCOPE_IFACE.")
        log.warning("scope-net: %s", msg)
        return {"ok": False, "iface": resolved, "action": "error", "message": msg}

    if interface_has_ip(resolved, ip_cidr):
        msg = f"{ip_cidr} already set on {resolved} ({reason})"
        log.info("scope-net: %s", msg)
        if save and apply:  # don't write the cache during a pure --check
            _save_iface(resolved)
        return {"ok": True, "iface": resolved, "action": "already_set", "message": msg}

    if not apply:
        msg = f"{ip_cidr} NOT set on {resolved} ({reason}) — would add it"
        log.info("scope-net: %s", msg)
        return {"ok": False, "iface": resolved, "action": "would_add", "message": msg}

    cmd = ["ip", "addr", "add", ip_cidr, "dev", resolved]
    if use_sudo and os.geteuid() != 0:
        cmd = ["sudo"] + cmd
    log.info("scope-net: setting %s on %s ($ %s)", ip_cidr, resolved, " ".join(cmd))
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.SubprocessError) as exc:
        msg = f"failed to run `{' '.join(cmd)}`: {exc}"
        log.error("scope-net: %s", msg)
        return {"ok": False, "iface": resolved, "action": "error", "message": msg}

    if r.returncode != 0:
        msg = f"`{' '.join(cmd)}` exited {r.returncode}: {r.stderr.strip() or r.stdout.strip()}"
        log.error("scope-net: %s", msg)
        return {"ok": False, "iface": resolved, "action": "error", "message": msg}

    if save:
        _save_iface(resolved)
    msg = f"added {ip_cidr} on {resolved} ({reason})"
    log.info("scope-net: %s", msg)
    return {"ok": True, "iface": resolved, "action": "added", "message": msg}


# ── CLI ───────────────────────────────────────────────────────────────────────

def main(argv=None) -> int:
    p = argparse.ArgumentParser(
        description="Configure the local USB-ethernet link to the oscilloscope.",
        formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    p.add_argument("--iface", default=None, help="USB ethernet adapter (default: auto)")
    p.add_argument("--ip", default=DEFAULT_SCOPE_IP,
                   help=f"CIDR to set on the adapter (default: {DEFAULT_SCOPE_IP})")
    p.add_argument("--check", action="store_true",
                   help="Report only; make no changes")
    p.add_argument("--no-sudo", action="store_true", help="Do not use sudo for `ip addr add`")
    p.add_argument("--no-save", action="store_true",
                   help="Do not save the interface choice to configs/local_iface")
    args = p.parse_args(argv)

    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s [%(levelname)s] %(message)s",
                        datefmt="%Y-%m-%d %H:%M:%S")

    detected = detect_usb_interfaces()
    log.info("scope-net: USB adapters: %s", ", ".join(detected) or "none")

    result = ensure_scope_network(ip_cidr=args.ip, iface=args.iface,
                                  use_sudo=not args.no_sudo, save=not args.no_save,
                                  apply=not args.check)
    print(f"[scope-net] {result['action']}: {result['message']}")
    return 0 if result["ok"] or result["action"] == "would_add" else 1


if __name__ == "__main__":
    raise SystemExit(main())
