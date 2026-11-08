# svt-db-agent-next: documentation

`svt-db-agent-next` is the DB agent of SVTSW: a NestJS service that serves the Kafka topic `svt.db-agent.request`
on PostgreSQL through MikroORM. It is the only service that connects to the database.

These pages describe the agent as it is. They stand alone: a reader needs no other folder to learn what the agent
stores, what it does for a request, and how it is built.

Commands, layout, Docker and CI/CD are in [`../README.md`](../README.md).

## State

- The agent implements every message type of its contract
  ([`svt.db-agent-next.kafka.yaml`](../../Documentation/Kafka/svt.db-agent-next.kafka.yaml)), each with e2e tests
  ([`../test-e2e`](../test-e2e/README.md)).
- The schema is that of [database-schema.md](database-schema.md), after five migrations.
- The agent is the DB agent of every environment. The C++ agent `svt-db-agent` is frozen and gets no support
  ([decision](../../Documentation/decisions/2026-11-db-agent-next-only.md)).
- **Dev** and **prod** run this agent: the compose files of both environments define it
  ([04 §7](04-runtime-and-deployment.md#7-swap-procedure)).

## Pages

### What the agent is

| Page | Content |
|---|---|
| [domain-model.md](domain-model.md) | The entities, their relations and their life cycles. For each rule: who enforces it, the database or the agent. The open points of the model. |
| [database-schema.md](database-schema.md) | The current schema: every table, column, key and enum type, with diagrams. How to change the schema. |
| [messages.md](messages.md) | What the agent does for each request: the rules for all messages, and for each message the checks, the statuses, the rows written and the reply. |
| [wafer-map.md](wafer-map.md) | The wafer map: its format, its validation, and the generation of the ASICs of a wafer. |
| [04-runtime-and-deployment.md](04-runtime-and-deployment.md) | Environment variables, the Kafka transport, heartbeat and health, logging, shutdown, build and versioning, where it runs, the swap procedure. |

### How it is built

| Page | Content |
|---|---|
| [02-database-migration.md](02-database-migration.md) | The migrations (what they contain, how they are made and run), how a table maps onto a MikroORM entity, the entity catalogue, the enum values in the code. |
| [05-implementation-notes.md](05-implementation-notes.md) | Where to read what, code layout and dependency rules, the dispatcher and the handler contract, the data layer, how to add a message type, the pitfalls met. |

### Why it is this way

These three pages are the record of how the agent replaced the C++ agent. They are the only pages that compare the
two agents, and they do not grow: a new feature gets no parity case and no line in a log of differences.

| Page | Content |
|---|---|
| [01-behaviour-decisions.md](01-behaviour-decisions.md) | The decisions: one row for each behaviour of the C++ agent on which this agent took a position (preserve, fix, ask), and the decisions of each domain (§6). |
| [03-parity-testing.md](03-parity-testing.md) | The parity suite: the same Kafka requests against the C++ agent and this agent. The method, the cases, the results and the questions that the results left open. |
| [differences-from-cpp.md](differences-from-cpp.md) | What changed in this agent between the fork of 2026-11-15 and 2026-11-18. Closed. |

### Outside this folder

| Where | Content |
|---|---|
| [`Documentation/Kafka/svt.db-agent-next.kafka.yaml`](../../Documentation/Kafka/svt.db-agent-next.kafka.yaml) | The Kafka contract of this agent: the authority for the message shapes. |
| [`Shared/svt-ts-types`](../../Shared/svt-ts-types/README.md) | The contract as TypeScript, compiled by this agent and by the UI workspace. |
| [`Documentation/domain-model.md`](../../Documentation/domain-model.md), [`glossary.md`](../../Documentation/glossary.md) | What the entities and the terms mean, for all services. |
| [`Documentation/flows/`](../../Documentation/flows/README.md) | Changes that touch several services, for example a new message type. |
| [`Documentation/decisions/`](../../Documentation/decisions/README.md) | The fork from the C++ agent, and why the agent is a standalone app at the top level of the repository. |
| [`Environment/README.md`](../../Environment/README.md#the-two-db-agent-services) | How the agent is deployed. |

## Rules for these pages

- **The pages describe the current state.** A pull request that changes what the agent stores or does changes the
  page in the same pull request: [domain-model.md](domain-model.md) for an entity or a rule,
  [database-schema.md](database-schema.md) for the schema, [messages.md](messages.md) for a message,
  [wafer-map.md](wafer-map.md) for the map.
- **A schema change starts as a proposal on [database-schema.md](database-schema.md).** A feature starts from its
  Story. The proposal is the change of that page. The pull request then delivers the migration, the entities and
  the page together ([database-schema.md §8](database-schema.md#8-how-to-change-the-schema)).
- **No log of differences from the C++ agent.** These pages are kept complete and current. That is sufficient: if
  a comparison with the frozen C++ agent is ever necessary, it can be made at that time from the docs of both
  agents.
- **One authority for each fact.** Message shapes: the contract. The schema: [database-schema.md](database-schema.md).
  What a message does: [messages.md](messages.md). The meaning of an entity for all services:
  `Documentation/domain-model.md`.
- **The C++ agent is not a source for this agent.** The folder `DbAgent/` holds the C++ agent, which is frozen and
  gets no support. Its docs describe its frozen state. Do not read them to learn what this agent does, and do not
  link to them from these pages. Where a page of the record compares the two agents, it states the behaviour of
  the C++ agent itself.
- **Labels.** `D-4`, `R-7`, `X-5`, `Q-H3` and *Author (Q31)* are labels of [01](01-behaviour-decisions.md): each
  names one behaviour of the C++ agent, or one answer of its author, and 01 explains it. The code, the tests and
  the contract quote them where a behaviour comes from such a decision.

## Why NestJS + MikroORM (summary of the 2026-11-05 analysis)

- The Kafka request/reply protocol the agent speaks **is NestJS's microservice convention**
  (`kafka_correlationId`, `kafka_replyTopic`, `kafka_replyPartition`, `kafka_nest-is-disposed`).
  The C++ imitates it; the Python WPAgent client was written against it.
- The typed contract for all message types already existed (today `../Shared/svt-ts-types/kafka`), and the mock
  `UI/apps/epic-db-agent` already dispatched every type over the NestJS Kafka transport, backed by in-memory
  arrays. The data layer was what was missing.
- Deployment is uniform: the compose stack pins each service by image tag in `versions.env`, so a swap of the
  image is a one-line change and a rollback is the same line.
- The team that remains knows this stack (the UI and the BFF are built on it); nobody left knows C++.
- MikroORM brings what the data layer of the C++ lacks: transactions, bound parameters, `RETURNING`,
  DB-side pagination, and a migrations folder.

Known counter-arguments, recorded so they are not forgotten: this concentrates UI, BFF and DB
agent on one maintainer; a Python agent would be maintainable by more physicists; the C++ was
possibly meant to integrate with FRED one day (one stale comment, nothing else). None of these was
judged strong enough to keep the C++, but the first two should be stated to the collaboration.

## What is the same as with the C++ agent

- The Kafka topics, the envelope and the message types. The consumers (`epic-measure-api`, WPAgent, TestAgent)
  do not change for a swap.
- The database. The agent runs on the existing schema; schema changes go through migrations
  ([02](02-database-migration.md)).
- The `SVT_DB_AGENT_*` environment variables and the heartbeat topic, so the server-side `.env` stays the same.
  The compose service is a new one (`svt-db-agent-next`, own image and health check), see
  [04 §6](04-runtime-and-deployment.md#6-build-versioning-and-where-it-runs).

## Open

| What | Where |
|---|---|
| The open points of the data model: one chip for each ASIC, chip blocks, the removal of a probe card, the order of a test, and others | [domain-model.md §8](domain-model.md#8-open-points) |
| Three questions of the parity run: `version` on probe cards, `waferTypeId` on the wafer-type map, a request without `kafka_replyPartition` | [03 §5.1](03-parity-testing.md#51-first-run-against-the-c-agent-2026-11-14), rows 3, 4 and 6 |
| The rows marked **ask** or *to be confirmed*: they change a result that a consumer sees, so the owners of the UI, WPAgent or TestAgent decide | [01](01-behaviour-decisions.md) |
| The rename of the enum type `blockType` to `chipBlockType`, and the history row of a probe-card uninstall | [02 §2](02-database-migration.md#2-what-migration-1-adds) |
| Modules: out of scope (decided 2026-11-08). The UI has no module concept, the C++ handler was never reachable, and no serial-number rule exists; the `Module*` tables are not mapped | [database-schema.md §3](database-schema.md#3-silicon) |
| A check that [database-schema.md](database-schema.md) agrees with a migrated database is done by hand; no test does it | [database-schema.md §9](database-schema.md#9-how-to-check-this-page) |
| Strict mode for the whole agent. `src/db` is `strict`; the rest is not, because the handlers have 18 errors under `strict`. 11 of them are a `string \| null` from the database assigned to a contract field typed without `null`: `createdAt` of a test and of the two kinds of configuration, `name` and `generalLocation` of a test setup, `dutType` of a template, and five fields of a wafer probe project. Four reply fields got `null` in the contract types on 2026-11-18 (`specification`, `defaultConfigId`, `dutEntityName`, `dutId`). When they are fixed, `src/db/tsconfig.json` can go | `npx tsc --noEmit -p tsconfig.app.json --strict` |
| 4 type errors in the test files (Vitest does not type-check): `svt-db-agent-next-kafka.controller.spec.ts:15`, `svt-test-setup-configs.e2e-spec.ts:74` and `:77`, `svt-tests.e2e-spec.ts:307` | `npx tsc --noEmit -p tsconfig.spec.json` |
| The two local compose files disagree on the network `svt-network--local`: the Kafka file creates it, the Postgres file expects it to exist | `Dev/docker-compose.kafka-local.yml`, `Dev/docker-compose.postgres.yml` |
| The names `DbAgentNext` and `svt-ts-types`; contract changes between two releases | [the layout decision](../../Documentation/decisions/2026-11-repository-layout.md#open) |
