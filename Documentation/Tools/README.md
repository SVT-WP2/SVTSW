# Tools

Command-line tools that drive one kind of hardware or test, with no Kafka, no database and no users, and the contract
by which a host (an agent) runs them.

| Page | What |
|---|---|
| [tool-contract.md](tool-contract.md) | How a tool and its host talk: the modes, the JSON lines, the command list, the error codes, the rules |
| [wp-tool/](wp-tool/README.md) | The WP tool (`WPTool/`): where to start when you work on one of its tickets, and the progress notes between tickets |
| [wpagent-command-inventory/](wpagent-command-inventory/README.md) | What each command of WPAgent does, with file and line: the reference for the commands of the WP tool |

The decisions behind them: [2026-11-wp-tool-phase-1](../decisions/2026-11-wp-tool-phase-1.md) (the WP tool, its
scope and its tickets) and [2026-11-wp-state](../decisions/2026-11-wp-state.md) (which part of the prober's state
lives where, and how the WP tool fits under the new WP agent).
