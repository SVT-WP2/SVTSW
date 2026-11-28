# Tool contract: how a tool and its host talk

**Draft 0.1, 28 Nov 2026.** A tool is a command-line program with a list of commands for one kind of hardware or test. A
host starts it and turns it into a service. This page is everything the two agree on. The first tool is the WP tool
(`WPTool/`, plan [2026-11-wp-tool-phase-1](../decisions/2026-11-wp-tool-phase-1.md)); its host will be the new WP agent
([2026-11-wp-state](../decisions/2026-11-wp-state.md)). Every name here can still change while the contract is a draft.

## Ways to run a tool

Every tool has the same commands on the command line. `wptool` is the example.

| Command line | What it does | Who uses it |
|---|---|---|
| `wptool shell` | Reads a command, prints the reply, waits for the next one | A person at the bench |
| `wptool run flow.yaml` | Runs the commands of a script file in order and stops at the first error | A person, or a test |
| `wptool serve` | The JSON mode: one line of JSON in, one line of JSON out | The host, or a test script at the bench |
| `wptool call <Command> key=value ...` | Runs one command, prints its reply as one JSON line, ends | A script in any language |
| `wptool describe` | Prints the list of its commands as JSON and ends | The host, and whoever writes the documentation |

- `--config <file>` gives the settings of the tool (for the WP tool: the address and port of the machine, and the log
  file).
- `--mock` runs the tool without hardware, in every mode.
- A script file of `run` is a plain list of commands with their parameters, in YAML or JSON. Loops and conditions are
  not part of draft 0.1.

## The lines of the JSON mode

One message is one JSON object on one line, in UTF-8, ending with `\n` (never `\r\n`). The host writes to the
standard input of the tool and reads its standard output.

| Line | From | Fields | Meaning |
|---|---|---|---|
| Request | Host | `id`, `command`, `params`, `context` | Run this command. `id`, `params` and `context` are optional |
| Reply | Tool | `id`, `status`, `data` or `error` | The end of that request. `status` is `Success` or `Error`; `error` is `{code, message}` |
| `ready` event | Tool | `event`, `tool`, `version`, `contract` | The first line after the start |
| `status` event | Tool | `event`, `data` | The state of the tool changed |
| `progress` event | Tool | `id`, `event`, `data` | Optional news during a long command |

### The rules

1. The host makes the `id` of a request. It names that one request, not the kind of command. The tool copies it into
   the reply and into the progress events of that request.
2. Every request gets exactly one reply.
3. One request at a time. The host waits for the reply before it sends the next request.
4. The standard output carries only these lines. Everything for people goes to the error output.
5. A line that the tool cannot read gets a reply with the status `Error`, the code 400 and no `id`.
6. `Shutdown` is a command of every tool: it gives the hardware back, closes the connections and replies, and then the
   tool ends with exit code 0. The host waits 30 seconds, then ends the tool itself.
7. The end of the standard input means the same as `Shutdown`, without a reply, and the tool ends with exit code 0: the
   host closed the pipe, so it wants the tool to end. A tool that ends for any other reason ends with a code other
   than 0, and the host starts it again.

## An example session

`>` is a line from the host, `<` is a line from the tool. The address is an example address.

```text
< {"event": "ready", "tool": "wp-tool", "version": "0.1.0", "contract": "0.1"}
< {"event": "status", "data": {"machine": null, "proberConnected": false}}
> {"id": "1", "command": "Initialize", "params": {"address": "192.0.2.10", "port": 35555}}
< {"id": "1", "status": "Success", "data": {"message": "Initialized 192.0.2.10:35555", "facts": {"chuckZPositionState": "In Separation"}}}
< {"event": "status", "data": {"machine": {"address": "192.0.2.10", "port": 35555}, "proberConnected": true}}
> {"id": "2", "command": "MoveChuckXY", "params": {"x": 1200, "y": -300, "position": "Relative"}}
< {"id": "2", "status": "Success", "data": {"message": "Moved chuck to x=1200, y=-300", "facts": {"x": 1200.0, "y": -300.0}}}
> {"id": "3", "command": "MoveChuckXY", "params": {"x": "far", "y": 0, "position": "Relative"}}
< {"id": "3", "status": "Error", "error": {"code": 400, "message": "Invalid type for 'x': expected number"}}
> {"id": "4", "command": "Shutdown"}
< {"id": "4", "status": "Success", "data": {"message": "Shutting down"}}
```

The facts are shortened here; a real reply of the WP tool carries all of them.

## The command list

`describe` prints one JSON object. The host reads it at its start and uses it to check each request before the tool
sees it.

```json
{
  "tool": "wp-tool",
  "version": "0.1.0",
  "contract": "0.1",
  "commands": [
    {
      "name": "MoveChuckXY",
      "summary": "Move the chuck in X and Y",
      "level": "Developer",
      "changesMachine": true,
      "context": [],
      "params": {
        "x": {"type": "number", "required": true},
        "y": {"type": "number", "required": true},
        "position": {"type": "string", "required": true, "choices": ["Zero", "Relative", "Center"]}
      }
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `level` | The lowest role that may send the command: `User`, `Expert` or `Developer`. The host checks it. In `shell`, `run` and `call` nobody is asked |
| `changesMachine` | `true`: the host asks for a session first. `false`: a read-only command |
| `context` | The data from outside that the command needs, by name (see below) |
| `params` | The parameters, with their type, whether they are required, and their default, choices and limits when they have them. The types are `string`, `number`, `integer`, `boolean`, `object` and `array` |

A tool may add fields of its own to a command. The WP tool adds `kind` (`OFFLINE` or `MACHINE`), `movesChuck` and
`long`.

## Data from outside

A tool never fetches data: no database, no Kafka, no other service. What a command needs comes with the request.

- A tool may name what a command needs in `context`, and get it with the request.
- A tool may also take every input as a parameter and declare no context. The WP tool does that: its requests are
  independent of each other, and its only state is the connection to the machine. A request's `context` is then
  accepted and ignored.
- What a command did, and what the hardware says after it, goes into the `data` of its reply. The host records what it
  needs.

## Error codes

| Code | When |
|---|---|
| 400 | A parameter is missing, has the wrong type or a value that is not allowed, or the line is not valid JSON |
| 404 | The tool has no command with this name (also a command the tool does not have yet, with a text that says so) |
| 409 | The command is not allowed now, because of the state of the hardware (for the WP tool: the chuck is not in separation, or another tool uses the machine) |
| 500 | The command failed in the tool or on the hardware |
| 503 | The hardware is off or not reachable, or the tool is not connected to it |

The codes 401, 403 and 423 never come from a tool. They belong to the host: no session, wrong role, machine held.

## Rules for a tool

1. No Kafka, no database, no users. A tool does not know who sent a command.
2. A command runs from start to end and then replies. It does not reply half-way.
3. A tool reports every change of its state as a `status` event. The less state, the better: the WP tool keeps only its
   connection.
4. The same request gives the same result in every mode.
5. The command names and the parameter names are those that the service accepts today, where the tool takes over a
   command of a service. Where they differ from the Kafka contract of the service, the code of the service wins.
6. A tool leaves its hardware safe when it ends: on `Shutdown`, at the end of its input, on a signal, and as far as it
   can on a failure.

## Not decided yet

- How a long command is stopped in the middle, and how long the host waits for a reply.
- A shared Python helper that gives every tool these modes, or each tool writes them itself.
- Whether the level of a command stays in the tool or moves to the config of the host.
- Lines for a tool that asks for a command of another tool. Draft 0.1 has none: a supervisor calls the tools one after
  another.
