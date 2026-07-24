"""
oscilloscope — scope data-taking for the ITS3 TestAgent.

Ported from the standalone `oscilloscope-automation` project so the ITS3
TestAgent can capture waveforms from a MOSAIX HS-channel pattern test without a
separate tool. Two pieces:

  acquire            model-agnostic single-acquisition capture → CSV
                     (thin wrappers around the drivers in scopes/)
  scope_mode_watcher client for the mosaix_test scope-mode file handshake
                     (/tmp/mosaix_scope_mode.json + .stop): waits until the
                     chip is driving a pattern, captures, and ends the run
                     early instead of waiting out test_duration.

The per-model VISA drivers live in scopes/ and their default JSON configs in
configs/ — unchanged from the upstream oscilloscope-automation project.
"""

# Lazy re-exports (PEP 562): importing a submodule eagerly here would make
# `python -m oscilloscope.<submodule>` warn ("found in sys.modules ... prior to
# execution"). Resolving on first attribute access keeps the clean public API
# (`from oscilloscope import ScopeModeWatcher`) without that warning.
_EXPORTS = {
    "MODEL_REGISTRY": "acquire",
    "capture_on_open_scope": "acquire",
    "default_config_path": "acquire",
    "load_config": "acquire",
    "load_scope_class": "acquire",
    "open_scope": "acquire",
    "run_acquisition": "acquire",
    "ScopeCaptureConfig": "scope_mode_watcher",
    "ScopeModeWatcher": "scope_mode_watcher",
    "ensure_scope_network": "scope_network",
    "resolve_interface": "scope_network",
}

__all__ = list(_EXPORTS)


def __getattr__(name):
    module_name = _EXPORTS.get(name)
    if module_name is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    import importlib

    mod = importlib.import_module(f".{module_name}", __name__)
    return getattr(mod, name)
