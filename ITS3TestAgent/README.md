# ITS3 TestAgent

Runs ITS3 test sequences on a list of chips defined in a CSV file.

## Files

| File | What it is |
|---|---|
| `its3_test_agent_config.json` | Config: paths, command templates |
| `its3_test_agent_config_scope.json` | Example config with scope data-taking enabled |
| `run_list.csv` | Which chips to test, with WPAgent die coordinates |
| `its3_test_agent.py` | The runner script |
| `oscilloscope/` | Ported scope data-taking + scope-mode handshake client |

## Quick start

1. Create and activate the Python virtual environment (one-time setup):

```bash
cd ITS3TestAgent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Edit `its3_test_agent_config.json` — set paths and command templates.
3. Edit `run_list.csv` — set TEST=yes/no for each chip.
4. Run:

```bash
# activate the venv (if not already active)
source .venv/bin/activate

# dry-run (prints commands, skips prober moves)
python3 its3_test_agent.py L1W04_S4 --dry-run

# real run
python3 its3_test_agent.py L1W04_S4

# with logging to file
python3 its3_test_agent.py L1W04_S4 --log-file run.log
```

> **Note:** The `.venv/` directory is not committed to git — only `requirements.txt` is tracked.

## How it works

1. Runs **Initialization** commands once (e.g. `set_daq.py`).
2. Reads `run_list.csv`.
3. For each chip with `TEST=yes`, constructs the chip name
   (`DIE` + `_` + `wafer`, e.g. `BAM16_L1W04_S4`) and runs
   every **Sequence** command with `{chip_name}` substituted.

## Config template variables

These placeholders in command strings get replaced automatically:

| Variable | Source |
|---|---|
| `{chip_name}` | built from CSV `DIE` + config `wafer` |
| `{die}` | CSV `DIE` column |
| `{setup_config}` | from config |
| `{power_profile}` | from config |
| `{variant}` | from config |
| `{output}` | from config |
| `{build_dir}` | from config |
| `{wafer}` | from config |

## CSV format

```
DIE,WP,TEST
BAM00,"[0,-1]",yes
SEG2,"[2,3]",no
```

- `DIE`: chip die name (BAM00–BAM19, SEG0–SEG4)
- `WP`: die coordinates for WPAgent (reserved for future use)
- `TEST`: `yes` or `no`

## Scope data-taking (oscilloscope integration)

The `oscilloscope/` package is the [oscilloscope-automation](../../oscilloscope-automation)
tool ported into the agent, plus a client for the **scope-mode file handshake**
that `mosaix_test` publishes when a `HsChannelPattern` / `HsChannelLpgbt` test
runs with `scope_mode: true`.

While a scope-mode test drives a pattern, `RunTest` maintains
`/tmp/mosaix_scope_mode.json` (state `driving`/`done`, test type, pattern, live
channels, PID, heartbeat) and watches for `/tmp/mosaix_scope_mode.stop`. The
agent's watcher polls the status file, captures a waveform for each driven
channel via the ported scope drivers, and then touches the stop file so the run
ends **without waiting out `test_duration`**. In `TEST_ONE_BY_ONE` mode the
handshake republishes per channel, so the watcher captures one waveform per
channel; in broadcast mode it captures once for the single drive.

### Enable it

Add a `scope_capture` block to the agent config (see
`its3_test_agent_config_scope.json`):

```json
"scope_capture": {
  "enabled": true,
  "model": "labmaster_mcm",                 // or "dsa91204a"
  "scope_config": "oscilloscope/configs/labmaster_mcm_config.json",
  "output_dir": "scope_data",                // captured CSVs (prefixed by chip name)
  "points": -1,                              // -1 = use scope config; 0 = all points
  "dry_run": false,                          // true = never touch VISA, just log
  "timeout_s": 3600,                         // upper bound on the watcher
  "trigger_when_cmd_contains": ["pattern_prbs31_10gbps_scope", "scope"]
}
```

`trigger_when_cmd_contains` limits which Sequence commands get a watcher (omit it
to watch every command — harmless, since the watcher only acts on a fresh
`driving` state and otherwise idles). Point a Sequence entry at a scope-mode test
config, e.g. `Configs/TestConfigs/HsChannel/pattern_prbs31_10gbps_scope.json5`
(`scope_mode: true`).

Scope capture needs `pyvisa` + `pyvisa-py` (in `requirements.txt`); the agent
imports the package lazily, so a machine without them still runs non-scope tests.

### Prerequisites for real (non-dry-run) capture

For a real capture the scope must be reachable over VISA, which on the lab hosts
means the USB ethernet adapter carrying the scope link is set to `192.168.0.1/24`.
The network setup from the `oscilloscope-automation` `setup_*.sh` scripts is
ported into the agent as `oscilloscope/scope_network.py` (+ the source-able
`setup_scope_network.sh`). The interface is resolved automatically: explicit
`--iface`/config > `$SCOPE_IFACE` > a per-host map (the hardcoded adapters from
the two host setup scripts) > a saved `oscilloscope/configs/local_iface` > the
single `enx*` adapter if only one is present.

One-shot setup (network + agent venv + deps), source it to keep the venv active:

```bash
source setup_scope_network.sh                 # auto-resolve interface
source setup_scope_network.sh --iface enxAABBCC   # or force one
```

Or just the network part:

```bash
python -m oscilloscope.scope_network            # ensure 192.168.0.1/24 (uses sudo)
python -m oscilloscope.scope_network --check    # report only, no changes
```

Setting the address needs root, so `ip addr add` runs under `sudo` (skipped when
already set or already root). The agent can also do this itself before the first
real capture — add a `network` block to `scope_capture` (see
`its3_test_agent_config_scope.json`):

```json
"network": { "ensure": true, "iface": null, "ip": "192.168.0.1/24", "use_sudo": true }
```

This runs at most once per agent run and only for non-dry-run captures; a failed
setup warns but never aborts the test. As a further guard, the watcher does a
best-effort preflight and warns clearly if the scope's subnet has no matching
local interface, instead of leaving you with an opaque VISA timeout.

Also install the scope dependencies into the agent's own venv (the agent uses
its `.venv`, not the scope tool's `venv/`) — `setup_scope_network.sh` does this,
or manually:

```bash
source .venv/bin/activate && pip install -r requirements.txt
```

### Standalone / demo

```bash
# Run the watcher next to a manually launched scope_mode RunTest:
python -m oscilloscope.scope_mode_watcher --model labmaster_mcm \
    --output-dir scope_data --label L1W04_S4_BAM03 --timeout 120

# Prove the whole handshake with no chip and no scope:
python -m oscilloscope.scope_mode_sim --mode one_by_one \
    --channels "HsChannel_HSCHA[0]" "HsChannel_HSCHA[3]" --test-duration 15 &
python -m oscilloscope.scope_mode_watcher --dry-run --timeout 30
```

One scope-mode run per machine is supported at a time (the `/tmp` paths are
fixed) — the same constraint the mosaix side documents.