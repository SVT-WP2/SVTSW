# CLAUDE.md — DbAgent (the C++ DB agent, frozen)

**This folder is frozen since 2026-11-15.** Development of the DB agent continues in
[`../DbAgentNext`](../DbAgentNext/CLAUDE.md), the NestJS re-implementation. The decision, the rules while
both agents exist, and the way back to the C++ are in
[`../Documentation/decisions/2026-11-db-agent-clone.md`](../Documentation/decisions/2026-11-db-agent-clone.md).

## Rules

- **Do not change the code** (`app/`, `common/`, `configs/`, the build and Docker files), not even for a
  bug. A bug of the C++ agent waits for the swap to the re-implementation.
- **A new feature, a new message type, a schema change: `../DbAgentNext`, never here.**
- **Do not use this folder as the source of truth for the system under development.** `docs/` and
  `../Documentation/Kafka/svt.db-agent.kafka.yaml` describe the frozen C++ agent. They look like the
  docs of `../DbAgentNext` because the re-implementation started as a copy of this behaviour: the same
  entities, relations, tables and message types. They are a snapshot, and the re-implementation moves
  away from it. For a question about the system under development, read:

  | Subject | Read | Do not read |
  |---|---|---|
  | The domain model, the terms | `../DbAgentNext/docs/domain-model.md`, `../Documentation/domain-model.md`, `../Documentation/glossary.md` | `docs/02-domain-model.md` |
  | The database schema | `../DbAgentNext/docs/database-schema.md`, `../DbAgentNext/src/migrations` | `docs/03-database-schema.md`, `docs/DBTables/` |
  | The Kafka contract | `../Documentation/Kafka/svt.db-agent-next.kafka.yaml` | `../Documentation/Kafka/svt.db-agent.kafka.yaml` |
  | What the agent does for a request | `../DbAgentNext/docs/messages.md` | `docs/04-request-engine.md`, `docs/05-request-handlers.md` |
  | The wafer map and the ASIC generation | `../DbAgentNext/docs/wafer-map.md` | `docs/06-wafer-map.md` |
  | The reasons for a behaviour | `../DbAgentNext/docs` | `docs/07-contract-drift-and-quirks.md` |

- **Change `docs/` and the C++ contract only to correct a statement that does not agree with the frozen
  code.** Do not describe the re-implementation there. Check a correction against the code and against
  the recorded replies of the C++ agent (`../DbAgentNext/test-parity/snapshots/cpp.json`).
- **Do not rename or renumber** the ids of `docs/07` (`D-…`, `R-…`, `X-…`), the quirk ids (`Q-H3`, …) or
  the question numbers of `docs/08`: both Kafka contracts and `../DbAgentNext/docs` quote them.

## When this folder is the right place

The C++ agent gets no support since 2026-11-18: no fix, no release, no new deployment
(`../Documentation/decisions/2026-11-db-agent-next-only.md`). This folder is the right place for one thing only:
to learn what the C++ agent did for a request, if the two agents are ever compared. Read
[docs/README.md](docs/README.md) and the parity suite in `../DbAgentNext/test-parity`. No log of differences is kept.
