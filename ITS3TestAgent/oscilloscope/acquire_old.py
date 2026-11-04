#!/usr/bin/env python3
"""
acquire.py — Single-acquisition waveform capture → CSV.

Ported from the standalone oscilloscope-automation project into the ITS3
TestAgent. The acquisition flow is completely model-agnostic: every scope
driver in scopes/ derives from scopes.instrument.Instrument and implements the
uniform driver API (initialize, set_vertical, set_trigger, set_acquisition,
single_acquisition, save_waveform_csv, check_errors). All instrument
parameters live in the per-model JSON configs in configs/.

Compared to the upstream tool this version is import-friendly: the connect →
configure → capture flow is split so a caller (the scope-mode watcher) can
hold a single open VISA session and capture several channels back to back:

    open_scope(...)         -> a connected driver (context manager)
    capture_on_open_scope() -> configure (optional) + single acquisition + CSV
    run_acquisition(...)    -> the original open-configure-capture-close flow

Default config paths resolve relative to this package, so it works no matter
what the caller's CWD is.

CLI usage (unchanged from upstream)
-----------------------------------
python -m oscilloscope.acquire --model <model> --output <file.csv> [options]
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
from pathlib import Path

# ── Package locations ─────────────────────────────────────────────────────────

PACKAGE_DIR = Path(__file__).resolve().parent
CONFIGS_DIR = PACKAGE_DIR / "configs"

# ── Model registry ────────────────────────────────────────────────────────────
# model key → (default config filename in configs/, driver module, driver class)

MODEL_REGISTRY = {
    "labmaster_mcm": (
        "labmaster_mcm_config.json",
        "oscilloscope.scopes.labmaster_mcm_utils",
        "LabMasterMCM",
    ),
    "dsa91204a": (
        "dsa91204a_config.json",
        "oscilloscope.scopes.dsa91204a_utils",
        "DSA91204A",
    ),
}

# Config keys forwarded as options to driver.initialize()
INITIALIZE_OPTION_KEYS = ("default_setup", "reset", "autoscale")


# ── Helpers ───────────────────────────────────────────────────────────────────

def default_config_path(model: str) -> Path:
    """Absolute path to the packaged default config for *model*."""
    return CONFIGS_DIR / MODEL_REGISTRY[model][0]


def load_config(path: str) -> dict:
    with open(path) as f:
        cfg = json.load(f)
    # Strip comment keys (start with '_')
    return {k: v for k, v in cfg.items() if not k.startswith("_")}


def load_scope_class(model: str):
    """Import and return the driver class for *model*."""
    _cfg, module_path, class_name = MODEL_REGISTRY[model]
    mod = importlib.import_module(module_path)
    return getattr(mod, class_name)


def resolve_output(output_arg: str, cfg: dict) -> str:
    """Bare filenames go into the configured output_dir (default 'data')."""
    if os.path.dirname(output_arg):
        return output_arg
    out_dir = cfg.get("output_dir", "data")
    os.makedirs(out_dir, exist_ok=True)
    return os.path.join(out_dir, output_arg)


def parse_override(value: str):
    """Parse a --set value: JSON literal if possible, else raw string."""
    try:
        return json.loads(value)
    except (json.JSONDecodeError, ValueError):
        return value


def resolve_points(cli_points: int, cfg: dict) -> int:
    """CLI --points (>= 0) overrides the config value; -1 = use config."""
    return cli_points if cli_points >= 0 else int(cfg.get("acquire_points") or 0)


# ── Connection ────────────────────────────────────────────────────────────────

def open_scope(ScopeClass, cfg: dict):
    """
    Construct the driver from *cfg* and open its VISA session.

    Returned object is a context manager (closes on exit) — use it as::

        with open_scope(ScopeClass, cfg) as scope:
            capture_on_open_scope(scope, cfg, "ch.csv", n_points)
    """
    scope = ScopeClass(cfg["visa_address"], timeout_ms=int(cfg.get("timeout_ms", 15000)))
    scope.open()
    return scope


# ── Capture on an already-open scope ──────────────────────────────────────────

def capture_on_open_scope(scope, cfg: dict, output: str, n_points: int,
                          skip_setup: bool = False) -> str:
    """
    Configure (unless skip_setup) and take one acquisition on an already-open
    *scope*, saving the waveform to *output*.

    Split out of run_acquisition so a caller can keep one VISA session open and
    capture several channels in a row (skip_setup=True after the first, when the
    vertical/trigger/acquisition setup is already applied).

    Returns *output*.
    """
    channel = cfg.get("channel") or scope.DEFAULT_CHANNEL
    srate = cfg.get("sample_rate_sps")
    init_options = {k: cfg[k] for k in INITIALIZE_OPTION_KEYS if k in cfg}

    if skip_setup:
        print("[acquire] Skipping setup — using current scope configuration.")
    else:
        scope.initialize(channel=channel, **init_options)

        scope.set_vertical(
            channel=channel,
            scale_V=cfg.get("channel_scale_v"),
            amplitude_window_V=cfg.get("amplitude_window_v"),
            offset_V=cfg.get("channel_offset_v", 0.0),
            coupling=cfg.get("channel_coupling") or "DC",
        )

        trigger_kwargs = {"level_V": cfg.get("trigger_level_v", 0.0)}
        if cfg.get("trigger_source"):
            trigger_kwargs["source"] = cfg["trigger_source"]
        if cfg.get("trigger_slope"):
            trigger_kwargs["slope"] = cfg["trigger_slope"]
        scope.set_trigger(**trigger_kwargs)

        scope.set_acquisition(sample_rate_sps=srate, n_points=n_points)
        scope.report_errors(stage="configuration")

    scope.single_acquisition(
        channel=channel,
        timeout_s=float(cfg.get("acquisition_timeout_s", 10.0)),
        force_trigger=bool(cfg.get("force_trigger", True)),
    )

    scope.save_waveform_csv(output, channel=channel, n_points=n_points)
    scope.report_errors(stage="acquisition")
    return output


# ── Generic acquisition flow (open → configure → capture → close) ─────────────

def run_acquisition(ScopeClass, cfg: dict, output: str, cli_points: int,
                    skip_setup: bool = False) -> None:
    """
    Model-agnostic single-acquisition capture:

      connect → [initialize → set_vertical → set_trigger → set_acquisition]
              → single_acquisition → save_waveform_csv → error check

    skip_setup=True skips everything up to single_acquisition, useful when
    the scope is already configured from a previous run.
    """
    channel = cfg.get("channel") or ScopeClass.DEFAULT_CHANNEL
    n_points = resolve_points(cli_points, cfg)
    srate = cfg.get("sample_rate_sps")

    print(f'\n[acquire] Model : {ScopeClass.MODEL}')
    print(f'          VISA  : {cfg["visa_address"]}')
    print(f'          Chan  : {channel}')
    print(f'          Rate  : {f"{srate/1e9:.1f} GSa/s" if srate else "AUTO"} | '
          f'Points: {n_points if n_points else "all/auto"}')
    print(f'          Output: {output}\n')

    with open_scope(ScopeClass, cfg) as scope:
        capture_on_open_scope(scope, cfg, output, n_points, skip_setup=skip_setup)

    print(f'\n[acquire] Done. CSV saved to: {output}')


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(
        description="Single-acquisition waveform capture → CSV",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--model", required=True, choices=list(MODEL_REGISTRY),
                   help="Scope model key")
    p.add_argument("--output", required=True,
                   help="Output CSV filename (bare names go to output_dir)")
    p.add_argument("--points", type=int, default=-1,
                   help="Points to acquire/export; 0 = all. Default: config value.")
    p.add_argument("--config",
                   help="Override path to the JSON config for this model")
    p.add_argument("--set", metavar="KEY=VALUE", action="append", default=[],
                   help="Override a config key, e.g. --set channel=C2 "
                        "--set amplitude_window_v=0.8 --set force_trigger=false")
    p.add_argument("--skip-setup", action="store_true",
                   help="Skip initialize/vertical/trigger/acquisition setup and "
                        "go straight to arm+capture. Use when scope is already configured.")
    return p.parse_args()


def main():
    args = parse_args()

    cfg_path = args.config or str(default_config_path(args.model))
    if not os.path.exists(cfg_path):
        print(f"[error] Config file not found: {cfg_path}")
        sys.exit(1)
    cfg = load_config(cfg_path)

    for kv in args.set:
        if "=" not in kv:
            print(f"[error] --set argument must be KEY=VALUE, got: {kv!r}")
            sys.exit(1)
        k, v = kv.split("=", 1)
        cfg[k] = parse_override(v)
        print(f"[config override] {k} = {cfg[k]!r}")

    if "visa_address" not in cfg:
        print('[error] Config must define "visa_address"')
        sys.exit(1)

    output = resolve_output(args.output, cfg)
    ScopeClass = load_scope_class(args.model)
    try:
        run_acquisition(ScopeClass, cfg, output, args.points,
                        skip_setup=args.skip_setup)
    except RuntimeError as exc:
        print(f"\n[acquire] ERROR: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
