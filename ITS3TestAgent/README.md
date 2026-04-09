# ITS3 TestAgent

Runs ITS3 test sequences on a list of chips defined in a CSV file.

## Files

| File | What it is |
|---|---|
| `its3_test_agent_config.json` | Config: paths, command templates |
| `run_list.csv` | Which chips to test, with WPAgent die coordinates |
| `its3_test_agent.py` | The runner script |

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