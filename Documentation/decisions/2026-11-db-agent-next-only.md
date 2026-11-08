# 2026-11: svt-db-agent-next is the DB agent everywhere

**Decided 2026-11-18** (ok-cern). Three decisions, which complete [the fork of 2026-11-15](2026-11-db-agent-clone.md).

## 1. One DB agent

`svt-db-agent-next` ([`DbAgentNext/`](../../DbAgentNext/README.md)) is the DB agent of every environment. The C++
agent (`DbAgent/`) is frozen and gets no support: no fix, no release, no deployment to a new place. It is not
kept as a second way to run the system.

This replaces two points of the fork note: "going back to the C++ stays possible" as a goal, and the rule that a
change of `svt-db-agent-next` must say what the C++ agent would need.

## 2. The docs of the DB agent stand alone

[`DbAgentNext/docs`](../../DbAgentNext/docs/README.md) describes the agent in full: the domain model, the database
schema, what the agent does for each message, and the wafer map. No living document refers to the docs of the C++
agent. `DbAgent/docs` describes the frozen state of the C++ agent, and it is not a source of truth for the domain
model, the schema, the contract or the behaviour of the system.

## 3. The schema is the page `database-schema.md`

[`DbAgentNext/docs/database-schema.md`](../../DbAgentNext/docs/database-schema.md) is the authority for the database
schema. The migrations of `DbAgentNext/src/migrations` build exactly that schema.

- The schema file that was maintained by hand, `Documentation/DB/DBTables/SVT_DB_Tables_SourceOfTruth.txt`, is not
  maintained. It moved to `DbAgent/docs/DBTables/` and is frozen with the C++ agent. This closes the open
  question of the fork note about the schema authority.
- **How the schema changes.** A feature starts from its Story (a GitHub issue). The proposal for the schema is a
  change of `database-schema.md`. The pull request delivers the migration, the entities and that page together, so
  the page is always the current schema
  ([the steps](../../DbAgentNext/docs/database-schema.md#8-how-to-change-the-schema)).
- **No log of differences.** A change of the agent is not recorded as a difference from the C++ agent:
  [`DbAgentNext/docs/differences-from-cpp.md`](../../DbAgentNext/docs/differences-from-cpp.md) is closed. It is
  probable that the C++ agent is never continued, so a log for each change is work without a use. The docs of the
  DB agent are kept complete instead. If a comparison is ever necessary, it can be made at that time from
  `DbAgent/docs` and `DbAgentNext/docs`.

## What does not change

- The frozen C++ code and its docs stay in the repository, as a record.
- The decisions of [`DbAgentNext/docs/01`](../../DbAgentNext/docs/01-behaviour-decisions.md) and the parity run stay
  as the record of how the agent replaced the C++ agent. A new feature gets no parity case.

## Not done yet

| What | Where |
|---|---|
| The local stack builds the C++ agent | `Dev/docker-compose.swtsw.yml`, `Dev/docker-compose.swtsw.no-ui.yml` |
| The contract of the C++ agent is next to the living contracts | `Documentation/Kafka/svt.db-agent.kafka.yaml` |
| The freeze tag of the C++ code | [the fork note](2026-11-db-agent-clone.md#the-state-at-the-fork) |
| The owner of the database and of `Documentation/DB` (ycorrales, leyreflores) must know that the schema file moved | |
