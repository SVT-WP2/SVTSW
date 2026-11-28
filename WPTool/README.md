# WP tool

`wptool` is a command-line tool that runs the commands of the wafer prober (SENTIO) directly: no Kafka, no DB, no
users, no order checks. It is phase 1 of the plan [#405](https://github.com/SVT-WP2/SVTSW/issues/405)
([the plan](../Documentation/decisions/2026-11-wp-tool-phase-1.md)). WPAgent keeps running the production
measurements and does not change: the tool is a new program next to it and imports nothing from it.

**One computer drives one machine. Do not use the tool on a machine while a WPAgent listener of that machine runs
(the service, or a DEV listener), and never run two tools on one machine (D20).**

## What is in the tool

The tool is built ticket by ticket (the plan, "Tickets and order"):

| Ticket | Adds |
|---|---|
| #407 | the package, the five modes, the engine, the config, the events, the logs; `ShowStatus`, `Shutdown` |
| #408 | the driver layer on the shared SENTIO driver, the simulator (`--mock`), `Initialize`, `Disconnect`, `LocalMode`, the separation check, giving the machine back |
| #409 | the project, alignment, die and contact commands, the orientation check |
| #410 | the XY moves, the precise move, the production flows as script files |
| #411 | the Python client (`wptool.client`, `wptool.compat`) |
| #413 | the settings and heights |

Today the tool has two commands: `ShowStatus` and `Shutdown`. Every other command of WPAgent is either a later ticket
of this plan, a command of step 2 (it stays in WPAgent for now), or dropped. The tool says so when it is asked for one:

```text
wptool> MoveChuckAsic
ERROR 404: MoveChuckAsic is not in the WP tool yet: use WPAgent (step 2 of the WP tool plan).
wptool> UserLogIn
ERROR 404: UserLogIn is not a command of the WP tool: users belong to the agent (phase 2).
```

`wptool describe` lists the commands with their parameters.

## Install

Python 3.12, on Windows or on Linux. From the root of the repository, with the virtual environment in `WPTool/.venv`
(ignored by `WPTool/.gitignore`):

Windows (PowerShell):

```powershell
cd WPTool
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
wptool describe
```

Linux:

```sh
cd WPTool
python3.12 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
wptool describe
```

`requirements.txt` installs the tool from its folder (editable) with the test tools. Run `pip` from `WPTool/`: the
paths in the file are relative to the current folder.

## Every request is independent (D10)

The tool remembers nothing between requests except the open connection to the machine. So:

- The config file has only the machine (the default of `Initialize`) and the log file.
- A command gets everything it needs as parameters: the project, the alignment project, the die, the heights. No
  command uses a value that an earlier command left behind.
- What the machine knows (where the chuck is, the work area, the open project), the tool asks the machine at that
  moment. It keeps no copy of it.
- So the five modes give the same reply for the same request. `shell`, `run` and `serve` only keep the connection open
  between requests; `call` opens it for one command.

## The modes

```text
wptool describe
wptool shell  [--config FILE] [--mock] [--log-level LEVEL]
wptool run    FILE [--config FILE] [--mock] [--log-level LEVEL]
wptool serve  [--config FILE] [--mock] [--log-level LEVEL]
wptool call   [--config FILE] [--mock] [--log-level LEVEL] <Command> [key=value ...]
```

| Mode | What it does | For |
|---|---|---|
| `describe` | prints the command list as one JSON object and ends | the host, the docs |
| `shell` | reads a command line, prints the reply, waits for the next one | a person at the bench |
| `run FILE` | runs the steps of a script file in order and stops at the first error | a person, a test |
| `serve` | one JSON line in, one JSON line out | the host (the new WP agent), a test script |
| `call` | runs one command, prints its reply as one JSON line, ends | a script in any language |

Every command goes through the same engine, in every mode.

### The command line (shell and run)

A line is the command, then `key=value` pairs, or the command, then one JSON object:

```text
ShowStatus
OpenProject projectName=ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW
OpenProject projectName="ER2 test"
MoveChuckXY {"x": 100, "y": -50, "position": "Relative"}
```

- Quote a value with spaces, with `"` or `'`. A quote can start inside a word, as in `projectName="ER2 test"`.
- A backslash is a normal character, so Windows paths stay as they are: `file=C:\data\flow.yaml`,
  `file="C:\My data\flow.yaml"`.
- A value is everything after the first `=` of its word.
- The values of `key=value` are text; the tool converts them by the type of the parameter (`count=3`,
  `enable=true`, `x=-50.5`). The JSON form gives typed values directly.
- The keys `user` and `waferAgentName` are accepted and ignored (D13), so that existing scripts run unchanged.
- A key given twice is an error (400), in every form: `key=value`, the JSON form, a line of `serve`, the words of
  `call`, and the JSON and YAML script and config files. Nothing takes "the last one".
- The command name is taken as it is written: only the splitting of a line at its spaces removes spaces.

(`OpenProject` and `MoveChuckXY` above show the syntax: they come with #409 and #410.)

### shell

```text
wptool shell --config wptool.yaml
wp-tool 0.1.0: type help for the commands, exit to end.
wptool> status
OK Tool: wp-tool 0.1.0 | Machine: none, not connected
{
  "machine": null,
  "proberConnected": false
}
wptool> exit
OK Shutting down
```

- `help` lists the commands by kind; `help <Command>` shows one command with its parameters.
- `status` runs `ShowStatus`; `exit` and `quit` run `Shutdown`.
- A reply is `OK <message>` (then the other fields of the reply as JSON), or `ERROR <code>: <message>`.
- The end of the input (Ctrl+D on Linux, Ctrl+Z then Enter on Windows) and Ctrl+C at the prompt run `Shutdown`.
- **Ctrl+C while a command runs stops the tool, not only the command**: the tool gives the machine back, closes the
  connection and ends with exit code 130.

### run FILE

A script file is a plain list of steps, in YAML or JSON (a `.json` file is read as JSON, any other as YAML; UTF-8).
A step is a command line, as in the shell, or a map with `command` and `params`:

```yaml
# flow.yaml
- ShowStatus
- OpenProject projectName=ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW
- command: InitProbing
  params:
    projectName: ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW
    alignmentProject: ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW
- 'MoveChuckXY {"x": 15, "y": 0, "position": "Relative"}'
```

- In YAML, a step written as a line that contains `: ` (for example the JSON form) must be in quotes, as the last
  step above, or YAML reads it as a map.
- **Before the first step runs**, the tool checks every step: its form, that the command is a command of the tool, and
  its parameters. A file that fails stops before anything is sent to the machine, with exit code 2 and the number of
  the step. So a typo in step 30 does not stop a flow in the middle, at contact.
- Then each step runs as a request of its own, and the tool prints `[<n>/<total>] <command>` and the reply.
- The first step that fails ends the run: the tool gives the machine back and ends with exit code 1. A step
  `Shutdown` ends the run with exit code 0.
- No loops, no conditions, no variables: that is the sequencer of step 2.

### serve

The JSON mode of the [tool contract](../Documentation/Tools/tool-contract.md). One JSON object per line, UTF-8, each
line ends with `\n` (never `\r\n`). The host writes requests to the standard input and reads the standard output,
which carries only these lines. Everything for people (logs, and the text that WPAgent's code prints) goes to the
error output.

`>` is a line from the host, `<` a line from the tool:

```text
< {"event": "ready", "tool": "wp-tool", "version": "0.1.0", "contract": "0.1"}
< {"event": "status", "data": {"machine": null, "proberConnected": false}}
> {"id": "1", "command": "ShowStatus"}
< {"id": "1", "status": "Success", "data": {"message": "Tool: wp-tool 0.1.0 | Machine: none, not connected", "machine": null, "proberConnected": false}}
> {"id": "2", "command": "MoveChuckAsic", "params": {"asicId": 5}}
< {"id": "2", "status": "Error", "error": {"code": 404, "message": "MoveChuckAsic is not in the WP tool yet: use WPAgent (step 2 of the WP tool plan)."}}
> not json
< {"status": "Error", "error": {"code": 400, "message": "The line is not JSON: Expecting value: line 1 column 1 (char 0)"}}
> {"id": "3", "command": "Shutdown"}
< {"id": "3", "status": "Success", "data": {"message": "Shutting down"}}
```

- A request is `{"id", "command", "params", "context"}`; only `command` is required. `id` is a text that the tool
  copies into the reply and into the `progress` events of that request. `context` is accepted and ignored (D10).
- A blank line is not a request: the tool skips it, with no reply, so that the replies stay in the order of the
  requests. A UTF-8 BOM at the start of the input is dropped.
- One request at a time: the host waits for the reply before it sends the next one.
- A `status` event comes after a reply when the connection changed (a connect or a disconnect).
- `Shutdown` replies and the tool ends with exit code 0. The end of the input does the same without a reply.
  Ctrl+C, while a command runs or while the tool waits for a request, gives the machine back and ends with exit code
  130, without a reply.
- A host must read the error output too (or send it to a file): the tool writes one log line per request there, and
  a full pipe would block it.

### call

```text
wptool call --config wptool.yaml ShowStatus
{"status": "Success", "data": {"message": "Tool: wp-tool 0.1.0 | Machine: none, not connected", "machine": null, "proberConnected": false}}
```

- The options come before the command; every word after the command is a parameter of the command.
- Each word is one `key=value` pair: the shell of the system has already split the words and removed the quotes
  (`'projectName=ER2 test'` is one pair). A single word that starts with `{` is the JSON form of the parameters.
- The standard output has only the reply line (the line of `serve` without `id`). Logs go to the error output and the
  log file; `progress` events of a long command go to the error output as JSON lines.
- Exit code 0 for a `Success` reply, 1 for an `Error` reply (its code is in the line), 2 when the command is not a
  command of the tool, or a word cannot be read (a word without `=`, a key given twice, JSON that is not valid).
  Nothing runs for 2, and the reason is on the error output.
- `Initialize`, `Disconnect` and `Shutdown` make no sense alone: call connects and disconnects by itself (#408).

## The config file

`--config FILE`, YAML or JSON. Both keys are optional, and there are no others: every other input is a parameter of
its command (D10).

```yaml
machine:                    # the default of Initialize (and of the mode call): where SENTIO listens
  address: 192.0.2.10       # an example address; never commit a real one
  port: 35555
log: wptool.log
```

- `machine`: `address` (a text) and `port` (an integer from 1 to 65535), both needed when `machine` is given. Without
  it, `Initialize` needs `address` and `port` as parameters (or `--mock`).
- `log`: the log file, by default `wptool.log` in the working directory. A relative path is relative to the working
  directory. The file gets every log line at DEBUG.
- A wrong config stops the tool at start, with a message that names the key (for example
  `config: machine.port must be an integer from 1 to 65535`) and exit code 2.

Options of every mode except `describe`:

- `--mock`: the machine is a simulator, no hardware (#408).
- `--log-level LEVEL`: the level of the log on the error output: `DEBUG`, `INFO` (the default), `WARNING`, `ERROR`.

## Error codes

| Code | When |
|---|---|
| 400 | a parameter is missing, unknown, has the wrong type or a value that is not allowed, or the line cannot be read |
| 404 | not a command of the tool: unknown, not in the tool yet (step 2), or dropped |
| 409 | not allowed now, because of the state of the machine (the separation and contact checks, #408 and #409) |
| 500 | the command failed in the tool or on the machine |
| 503 | the machine is not reachable, or the tool is not connected |

A failed command does not block the tool: the next command runs.

## Exit codes

| Code | When |
|---|---|
| 0 | a normal end (for `call`: a `Success` reply) |
| 1 | a failed step of `run`, an `Error` reply of `call`, or any other failure |
| 2 | a wrong command line, config or script file |
| 130 | Ctrl+C while a command runs, or between the commands (`serve` waiting for a request, `run` between two steps). In the shell, Ctrl+C at the prompt is `Shutdown` and ends with 0 |
| 128 + the signal | SIGTERM (143), SIGHUP (129) or SIGBREAK (149) (#408) |

## Development

```sh
cd WPTool
pip install -r requirements.txt
python -m flake8 wptool tests
python -m pytest tests -q
wptool describe
```

The tests need no network and no prober. The test-only commands (`_Echo`, `_Fail`, `_Print`, `_Progress`, `_Wait`,
`_Interrupt`) are registered only when the environment variable `WPTOOL_TESTING=1` is set; the tests set it.
CI: [.github/workflows/wp-tool.yml](../.github/workflows/wp-tool.yml), on Linux and Windows. Notes between the
tickets: [progress.md](../Documentation/Tools/wp-tool/progress.md).
