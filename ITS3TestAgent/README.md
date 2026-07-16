# ITS3 TestAgent

Runs ITS3 test sequences on a list of chips defined in a CSV file.

Usable two ways:

- **CLI** — `python3 its3_test_agent.py L1W04_S4`, as always.
- **Kafka command agent** — `python3 main.py listen`, so the UI can start/stop
  runs and poll progress. Same runner underneath; see
  [Running as a service](#running-as-a-service-ui-control).

## Files

| File | What it is |
|---|---|
| `its3_test_agent_config.json` | Config: paths, command templates |
| `run_list.csv` | Which chips to test, with WPAgent die coordinates |
| `its3_test_agent.py` | The runner core (also the standalone CLI) |
| `run_state.py` | Run/chip state model shared by the runner and the service |
| `main.py` | Entrypoint: `listen` (service) or `run` (one-shot) |
| `service/` | Kafka command surface (listener, dispatch, registry, models) |
| `contract/` | Generated OpenAPI contract + its generator |

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

---

## Running as a service (UI control)

Instead of one CLI run, the agent can stay up as a **Kafka command agent** —
the same pattern as WPAgent (`main.py listen`) and the TestAgent — so the UI can
drive it:

```bash
source .venv/bin/activate
python3 main.py listen                       # uses kafka_broker from the config
python3 main.py listen --config its3_test_agent_config_thinned.json
```

The broker comes from the config the listener boots with. A `StartRun` may name
a different config for the *run*, but the Kafka link is fixed for the lifetime
of the listener.

### Topics

| Topic | Purpose |
|---|---|
| `svt.its3-test-agent.request` | commands in |
| `svt.its3-test-agent.request.reply` | replies out |
| `svt.its3-test-agent.heartbeat` | `{timestamp, agent}` every 2s; a beat older than 6s means down |
| `svt.its3-test-agent.status` | reserved for progress streaming — not produced yet |

### Commands

| Command | `data` | Reply `data` |
|---|---|---|
| `StartRun` | `{wafer, config?, dryRun?}` | `{runId, state, wafer}` |
| `StopRun` | `{}` | `{runId, state, stopRequested}` |
| `GetStatus` | `{}` | `{state, wafer, runId, currentChip, done, total, chips[], …}` |

Message envelope follows [SvtKafkaConventions.md](../Documentation/Kafka/SvtKafkaConventions.md)
and mirrors WPAgent's dialect:

```jsonc
// -> svt.its3-test-agent.request
//    headers: kafka_correlationId, kafka_replyTopic, kafka_replyPartition
{ "type": "StartRun", "data": { "wafer": "L1W04_S4", "dryRun": false } }

// <- svt.its3-test-agent.request.reply
{ "type": "StartRunReply", "status": "Success",
  "data": { "runId": "6b1f3c22-…", "state": "INITIALIZING", "wafer": "L1W04_S4" } }
```

Errors use the WPAgent status values (`BadRequest`, `NotFound`,
`UnexpectedError`) with `{"error": {"message": "…"}}` instead of `data`.

### Run and chip states

```
run :  IDLE → INITIALIZING → RUNNING → STOPPING → DONE | FAILED
chip:  PENDING | RUNNING | PASS | FAIL | SKIP
```

- Only **one run** at a time — the prober and DAQ are exclusive, so `StartRun`
  while a run is active is rejected with `BadRequest` rather than queued.
- `StartRun` returns as soon as the run is accepted; poll `GetStatus` for
  progress.
- `StopRun` returns once the stop is *requested*. It terminates the running
  command, then still parks the prober and logs out, so the run reaches `DONE`
  a little later. A run stopped part-way ends in `DONE` with the interrupted
  chip marked `FAIL`.

## The contract (Swagger)

`contract/svt.its3-test-agent.kafka.yaml` is an OpenAPI 3.0 document describing
the Kafka messages — same convention as `WPAgent/svt.wp-agent.yaml` and
`TestAgent/docs/svt.test-agent.kafka`. Paste it into
<https://editor-next.swagger.io> to browse it.

**It is generated — never hand-edit it:**

```bash
python3 contract/generate_contract.py
```

It is built from the Pydantic models in `service/models.py` plus the registry in
`service/commands.py`, so the docs cannot drift from the code. To add a command:

1. add its request/reply models to `service/models.py`
2. add a `CommandSpec` to `COMMANDS` in `service/commands.py`, naming the
   `RunManager` method that implements it
3. re-run the generator

The listener picks it up from the same registry — no YAML, no dispatch wiring.

### Not yet implemented

- **Config / run-list management** (`GetConfig`, `SetRunList`, …) — add to the
  registry as above when needed.
- **Progress streaming** on `svt.its3-test-agent.status`. The per-chip status is
  already tracked; streaming it is an extra `produce` call, not a refactor.
  Until then the UI polls `GetStatus`.