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

Both paths share the same capture plan (resolve_capture_plan), so multi-channel
and math captures behave identically from the CLI and from the watcher.

Default config paths resolve relative to this package, so it works no matter
what the caller's CWD is.

What a single acquisition exports is set by the config:

  * single channel  — `channel` (default)
  * several raw channels from ONE trigger event — `channels: ["C3", "C4"]`
  * a math trace    — `math_enable: true` with math_channel/math_source1/
                      math_source2/math_operator (LabMaster only; optionally
                      `math_save_sources` to export the two raw sources too)

When more than one trace is exported the output filename gets a per-channel
suffix, e.g. run.csv -> run_F1.csv, run_C3.csv, run_C4.csv.

CLI usage (unchanged from upstream)
-----------------------------------
python -m oscilloscope.acquire --model <model> --output <file.csv> [options]

Examples
--------
# LabMaster MCM, 1M points, 80 GSa/s (from config):
python -m oscilloscope.acquire --model labmaster_mcm --output my_waveform.csv

# LabMaster MCM, all points the scope acquired:
python -m oscilloscope.acquire --model labmaster_mcm --output my_waveform.csv --points 0

# DSA91204A with a custom config and on-the-fly overrides:
python -m oscilloscope.acquire --model dsa91204a --output dsa.csv \
    --config configs/dsa91204a_config.json \
    --set channel=CHANnel1 --set amplitude_window_v=0.8

Supported models
----------------
  labmaster_mcm   Teledyne LeCroy LabMaster MCM Zi-A / 10-36Zi-A
  dsa91204a       Keysight / Agilent DSA91204A (Infiniium 90000 series)
"""

from __future__ import annotations

import argparse
import importlib
import inspect
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


def import_class(module_path: str, class_name: str):
    mod = importlib.import_module(module_path)
    return getattr(mod, class_name)


def load_scope_class(model: str):
    """Import and return the driver class for *model*."""
    _cfg, module_path, class_name = MODEL_REGISTRY[model]
    return import_class(module_path, class_name)


def resolve_output(output_arg: str, cfg: dict) -> str:
    """Bare filenames go into the configured output_dir (default 'data').
    Paths with a directory component (e.g. 'HS1/d0.csv') are used as-is,
    with that directory created if it doesn't exist yet."""
    out_dir = os.path.dirname(output_arg)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
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


# ── Capture plan (what gets configured, acquired and exported) ────────────────

def _supports_kwarg(func, name: str) -> bool:
    """True if *func* declares an explicit *name* parameter. A driver with a
    bare **options would silently swallow the kwarg, so an explicit check is
    the only way to tell a supporting driver from a non-supporting one."""
    try:
        params = inspect.signature(func).parameters
    except (TypeError, ValueError):  # builtins / C functions
        return False
    return name in params and params[name].kind in (
        inspect.Parameter.POSITIONAL_OR_KEYWORD, inspect.Parameter.KEYWORD_ONLY)


def resolve_capture_plan(driver, cfg: dict) -> dict:
    """
    Work out — from *cfg* — what this capture configures, acquires and exports.
    *driver* is the driver class or an open driver instance (both expose
    DEFAULT_CHANNEL / set_math / initialize).

    Returns a dict:
      channel           single-channel name (legacy path)
      channels          raw channel list for a multi-channel capture, or None
      multi_channel     True for the `channels` path
      math              math settings dict, or None when math_enable is false
      acquire_channels  traces exported to CSV (order = file order)
      trigger_channel   channel handed to single_acquisition()
    """
    channel = cfg.get("channel") or driver.DEFAULT_CHANNEL
    channels_cfg = cfg.get("channels")  # optional list, e.g. ["C3", "C4"]
    math_enable = bool(cfg.get("math_enable", False))
    multi_channel = bool(channels_cfg) and not math_enable
    name = driver.__name__ if inspect.isclass(driver) else type(driver).__name__

    math = None
    if math_enable:
        if not hasattr(driver, "set_math"):
            raise RuntimeError(
                f"[acquire] math_enable=true is not supported by {name} "
                f"(no set_math() method).")
        math = {
            "channel": cfg.get("math_channel", "F1"),
            "source1": cfg.get("math_source1", "C1"),
            "source2": cfg.get("math_source2", "C2"),
            "operator": cfg.get("math_operator", "Difference"),
            "save_sources": bool(cfg.get("math_save_sources", False)),
            "hide_sources": bool(cfg.get("math_hide_sources", True)),
        }

    # Enabling more than one input channel needs initialize(channels_to_enable=...);
    # a driver without that parameter can only do the single-channel path.
    if (math or multi_channel) and not _supports_kwarg(driver.initialize, "channels_to_enable"):
        raise RuntimeError(
            f"[acquire] {name}.initialize() has no channels_to_enable parameter — "
            f"{'math_enable' if math else 'channels'} needs a driver that can enable "
            f"several input channels.")

    # Channel(s) actually acquired/exported: the math trace if math_enable
    # (plus the two raw source channels too, if math_save_sources is set —
    # all three come from the same acquisition), each channel in `channels`
    # if that's set (raw multi-channel capture from a single trigger event),
    # otherwise the single `channel`.
    if math:
        acquire_channels = [math["channel"], math["source1"], math["source2"]] \
            if math["save_sources"] else [math["channel"]]
    elif multi_channel:
        acquire_channels = list(channels_cfg)
    else:
        acquire_channels = [channel]

    return {
        "channel": channel,
        "channels": list(channels_cfg) if channels_cfg else None,
        "multi_channel": multi_channel,
        "math": math,
        "acquire_channels": acquire_channels,
        "trigger_channel": cfg.get("trigger_source")
                           or (channels_cfg[0] if multi_channel else channel),
    }


def describe_plan(plan: dict, cfg: dict) -> str:
    """One-line human description of what a plan captures (for logs/banners)."""
    math = plan["math"]
    if math:
        symbol = "-" if math["operator"] == "Difference" else f' {math["operator"]} '
        desc = (f'{math["channel"]} = {math["source1"]}{symbol}{math["source2"]}')
        if math["save_sources"]:
            desc += f' (+ raw {math["source1"]}, {math["source2"]} saved separately)'
        return desc
    if plan["multi_channel"]:
        return f'{", ".join(plan["acquire_channels"])} (raw, separate CSVs)'
    return plan["channel"]


def output_paths(plan: dict, output: str) -> list:
    """Per-trace output filenames: the bare *output* for a single trace, else
    one file per exported channel (run.csv -> run_F1.csv, run_C3.csv, ...)."""
    channels = plan["acquire_channels"]
    if len(channels) == 1:
        return [output]
    base, ext = os.path.splitext(output)
    return [f"{base}_{ch}{ext}" for ch in channels]


# ── Configure / capture on an already-open scope ──────────────────────────────

def configure_scope(scope, cfg: dict, plan: dict, n_points: int) -> None:
    """Apply the full setup: initialize → vertical (→ math) → trigger →
    acquisition, per *plan*. Skipped by capture_on_open_scope(skip_setup=True)."""
    init_options = {k: cfg[k] for k in INITIALIZE_OPTION_KEYS if k in cfg}
    math = plan["math"]

    if math:
        scope.initialize(channel=plan["channel"],
                         channels_to_enable=[math["source1"], math["source2"]],
                         **init_options)

        # Source channels need real vertical/coupling settings
        for src in (math["source1"], math["source2"]):
            scope.set_vertical(
                channel=src,
                scale_V=cfg.get("channel_scale_v"),
                amplitude_window_V=cfg.get("amplitude_window_v"),
                offset_V=cfg.get("channel_offset_v", 0.0),
                coupling=cfg.get("channel_coupling") or "DC",
            )

        scope.set_math(math_channel=math["channel"],
                       source1=math["source1"],
                       source2=math["source2"],
                       operator=math["operator"])

        # F1's V/div is derived from the source channels' scale on this
        # firmware — there's no scriptable VerScale for a math trace
        # (confirmed: app.Math.F1[.View/.Out].VerScale are all unsupported and
        # set_vertical() no-ops with a warning if called). Only attempt it if
        # explicitly configured.
        if cfg.get("math_scale_v") is not None or cfg.get("math_amplitude_window_v") is not None:
            scope.set_vertical(
                channel=math["channel"],
                scale_V=cfg.get("math_scale_v"),
                amplitude_window_V=cfg.get("math_amplitude_window_v"),
                offset_V=cfg.get("math_offset_v", 0.0),
            )

        # Hide the source channel traces so only the math trace shows on the
        # grid (trigger/math computation are unaffected by trace visibility).
        if math["hide_sources"] and hasattr(scope, "set_channel_view"):
            for src in (math["source1"], math["source2"]):
                scope.set_channel_view(src, view=False)

    elif plan["multi_channel"]:
        scope.initialize(channel=plan["channels"][0],
                         channels_to_enable=plan["channels"],
                         **init_options)

        for ch in plan["channels"]:
            scope.set_vertical(
                channel=ch,
                scale_V=cfg.get("channel_scale_v"),
                amplitude_window_V=cfg.get("amplitude_window_v"),
                offset_V=cfg.get("channel_offset_v", 0.0),
                coupling=cfg.get("channel_coupling") or "DC",
            )

    else:
        scope.initialize(channel=plan["channel"], **init_options)

        scope.set_vertical(
            channel=plan["channel"],
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

    scope.set_acquisition(sample_rate_sps=cfg.get("sample_rate_sps"), n_points=n_points)
    scope.report_errors(stage="configuration")


def capture_on_open_scope(scope, cfg: dict, output: str, n_points: int,
                          skip_setup: bool = False) -> list:
    """
    Configure (unless skip_setup) and take one acquisition on an already-open
    *scope*, saving the waveform(s) to *output*.

    Split out of run_acquisition so a caller can keep one VISA session open and
    capture several drives in a row (skip_setup=True after the first, when the
    vertical/math/trigger/acquisition setup is already applied).

    Returns the list of files written — one per exported trace, so a math or
    multi-channel capture returns several (see output_paths()).
    """
    plan = resolve_capture_plan(scope, cfg)

    if skip_setup:
        print("[acquire] Skipping setup — using current scope configuration.")
    else:
        configure_scope(scope, cfg, plan, n_points)

    scope.single_acquisition(
        channel=plan["trigger_channel"],
        timeout_s=float(cfg.get("acquisition_timeout_s", 10.0)),
        force_trigger=bool(cfg.get("force_trigger", True)),
    )

    saved_files = output_paths(plan, output)
    for ch, ch_output in zip(plan["acquire_channels"], saved_files):
        scope.save_waveform_csv(ch_output, channel=ch, n_points=n_points)
    scope.report_errors(stage="acquisition")
    return saved_files


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


# ── Generic acquisition flow (open → configure → capture → close) ─────────────

def run_acquisition(ScopeClass, cfg: dict, output: str, cli_points: int,
                    skip_setup: bool = False) -> None:
    """
    Model-agnostic single-acquisition capture:

      connect → [initialize → set_vertical (→ set_math) → set_trigger →
                 set_acquisition] → single_acquisition → save_waveform_csv
              → error check

    skip_setup=True skips everything up to single_acquisition, useful when
    the scope is already configured from a previous run.

    math_enable (config key, LabMaster only): when true, acquisition and
    export happen on a math function trace (math_channel, e.g. 'F1') defined
    as math_source1 <math_operator> math_source2 (e.g. C1 - C2), instead of
    on a single raw channel. Both source channels are enabled and the
    trigger stays on a real channel (trigger_source in the config).

    channels (config key): a list of raw channels captured from one trigger
    event and exported to one CSV each. Ignored when math_enable is true.
    """
    plan = resolve_capture_plan(ScopeClass, cfg)
    n_points = resolve_points(cli_points, cfg)
    srate = cfg.get("sample_rate_sps")

    print(f'\n[acquire] Model : {ScopeClass.MODEL}')
    print(f'          VISA  : {cfg["visa_address"]}')
    print(f'          Chan  : {describe_plan(plan, cfg)}')
    print(f'          Rate  : {f"{srate/1e9:.1f} GSa/s" if srate else "AUTO"} | '
          f'Points: {n_points if n_points else "all/auto"}')
    print(f'          Output: {output}\n')

    with open_scope(ScopeClass, cfg) as scope:
        saved_files = capture_on_open_scope(scope, cfg, output, n_points,
                                            skip_setup=skip_setup)

    print(f'\n[acquire] Done. CSV saved to: {", ".join(saved_files)}')


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
