# SVTSW documentation

This folder holds what spans more than one service: the system, the domain, the flows, the decisions and the
contracts between services. What one service does is documented in that service's folder, and this page says where.
The project-level document is the Google Doc linked from the [root README](../README.md).

## Owners

| Part | Owner |
|---|---|
| `Kafka/`, `WaferMap/`, `AncillaryASICs/` | leyreflores |
| this README, `system-overview.md`, `domain-model.md`, `glossary.md`, `flows/`, `decisions/` | ok-cern |

## Map

### Across services (this folder)

| Where | What | Authority for |
|---|---|---|
| [system-overview.md](system-overview.md) | the services, the topics, who talks to whom | which service owns what |
| [domain-model.md](domain-model.md) | the entities in the terms of the laboratory, how they relate, their lifecycles | what an entity means. The data model and its rules: [DbAgentNext/docs/domain-model.md](../DbAgentNext/docs/domain-model.md) |
| [glossary.md](glossary.md) | the terms | what a term means |
| [flows/](flows/README.md) | developer how-tos that touch several services ("add a new chip type") | the order of the steps across services |
| [decisions/](decisions/README.md) | dated records of decisions that span services | why things are the way they are |
| [Kafka/](Kafka/SvtKafkaConventions.md) | the conventions, and one contract per service: `svt.db-agent-next.kafka.yaml` (the DB agent: the contract to build on), `svt.wp-agent.kafka.yaml`. Two files are not contracts of the system: `svt.db-agent.kafka.yaml` (what the code of the frozen C++ DB agent does) and `svt.db-agent.kafka(ancASIC).yaml` (served by nothing) | message shapes |
| `WaferMap/` | the wafer map formats (`GlobalWaferMapFormat.txt`, `ER1MotherFormat.txt`) | the map formats |
| `AncillaryASICs/` | the ancillary ASIC datasheets | |

### Per service

| Where | What |
|---|---|
| [UI/docs](../UI/docs/ARCHITECTURE.md), [UI/CLAUDE.md](../UI/CLAUDE.md) | the Angular UI, the BFF `epic-measure-api`, the mock DB agent; recipes for adding a UI feature |
| [DbAgentNext/docs](../DbAgentNext/docs/README.md) | the DB agent `svt-db-agent-next`: the [data model](../DbAgentNext/docs/domain-model.md), the [database schema](../DbAgentNext/docs/database-schema.md) (the authority for the schema), [what it does for each message](../DbAgentNext/docs/messages.md), the [wafer map](../DbAgentNext/docs/wafer-map.md), runtime, implementation, and the record of its decisions |
| `DbAgent/` | the C++ DB agent: frozen, without support ([decision](decisions/2026-11-db-agent-next-only.md)). Its docs describe its frozen state. They look like the docs of the DB agent, and they are not a source of truth for the domain model, the schema, the contract or the behaviour. No page of the system links to them |
| [Shared/README.md](../Shared/README.md) | code compiled by more than one service (the contract types) |
| [TestAgent/docs](../TestAgent/docs/svt.test-agent.kafka) | the TestAgent's Kafka contract; [TestAgent/README.md](../TestAgent/README.md) |
| [WPAgent](../WPAgent/README.md), [SVTSupervisor](../SVTSupervisor/README.md), [ITS3TestAgent](../ITS3TestAgent/README.md) | README only so far |
| [Environment/README.md](../Environment/README.md) | deployment: compose stacks, environments, versions |
| [Dev/README.md](../Dev/README.md) | the local stack and the database dumps |

## Rules

- **Flows link down.** A flow names the services, messages, tables and files involved and links to their docs; it
  never restates how a service works inside.
- **Service docs describe the current state.** History goes to `decisions/` or stays in git.
- **One authority per fact.** Message shapes: the contract in `Kafka/`. A service's behaviour: that service's docs.
  The database schema: `DbAgentNext/docs/database-schema.md`. The meaning of the domain, and the flows: this
  folder. Where two documents disagree, the authority wins and the other is fixed.
- **The schema changes on its page first.** A feature starts from its Story. The proposal for a schema change is a
  change of `DbAgentNext/docs/database-schema.md`, and the pull request delivers the migration together with that
  page ([the steps](../DbAgentNext/docs/database-schema.md#8-how-to-change-the-schema)).
