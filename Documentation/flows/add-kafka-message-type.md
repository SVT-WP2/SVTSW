# Add a message type to the DB agent

**Goal.** The DB agent serves a new message type, the contract describes it, and the UI can use it.

**Touches.** [`Documentation/Kafka`](../Kafka/SvtKafkaConventions.md), [`Shared/svt-ts-types`](../../Shared/svt-ts-types/README.md),
the [DB agent](../../DbAgentNext/docs/README.md), and the [UI workspace](../../UI/docs/RECIPES.md) (BFF, mock DB
agent, Angular UI). WPAgent or TestAgent, if they are the clients of the new message.

This page gives the order of the steps and who must change. How to do each step is in the recipe that the last
column links to.

## Before you start

- **The contract comes first.** A type exists in the code only if the contract defines it:
  [`svt.db-agent-next.kafka.yaml`](../Kafka/svt.db-agent-next.kafka.yaml). `svt.db-agent.kafka.yaml` is the
  contract of the frozen C++ agent; do not change it for a new message.
- Read the [conventions](../Kafka/SvtKafkaConventions.md): the name of a message type, the reply type
  (`<Type>Reply`), the envelope, camelCase keys.
- Decide if the message changes the schema. A schema change starts as a proposal on the schema page of the DB agent
  ([database-schema.md §8](../../DbAgentNext/docs/database-schema.md#8-how-to-change-the-schema)). The migration,
  the entities and that page are in the same pull request.
- The contract types are compiled by the UI workspace and by the DB agent. One pull request changes both sides;
  the two services deploy separately ([the layout decision](../decisions/2026-11-repository-layout.md#open)).

## Steps

| # | Service | What to change | Where (files, tables, messages) | Docs |
|---|---|---|---|---|
| 1 | Contract | Add the path `/svt.db-agent.request/<Type>` and the schemas `<Type>Message` and `<Type>ReplyMessage` | `Documentation/Kafka/svt.db-agent-next.kafka.yaml` | [conventions](../Kafka/SvtKafkaConventions.md) |
| 2 | Shared types, Kafka | In the namespace of the domain: the two members of `MessageType` (`<Type>`, `<Type>Reply`), the message class and the reply class, and the unions. Each domain has its own enum and unions; there is no global list | `Shared/svt-ts-types/kafka/src/db-agent/kafka-messages/svt-db-agent-kafka-<domain>s.ts`; a new file also in `kafka-messages/index.ts` | [RECIPES, section 1.1](../../UI/docs/RECIPES.md) |
| 3 | Shared types, HTTP | The request and response types of the HTTP side | `Shared/svt-ts-types/main/src/<domain>s/{requests,responses}/` | [RECIPES, section 1.2](../../UI/docs/RECIPES.md), [the rule of the shared types](../../Shared/svt-ts-types/README.md) |
| 4 | DB agent | The DTO class that validates the request; it implements the contract type | `DbAgentNext/src/modules/handlers/<domain>/svt-db-agent-next-<domain>.dtos.ts` | [DbAgentNext/docs/05 §5](../../DbAgentNext/docs/05-implementation-notes.md#5-adding-a-message-type-or-a-domain) |
| 5 | DB agent | The handler: one more entry `{ type, replyType, handle }` in the handlers class of the domain. A new domain also needs its entities, its repository and its module entry | `DbAgentNext/src/modules/handlers/<domain>/`, `DbAgentNext/src/db/data/<domain>/` | same, and [§3](../../DbAgentNext/docs/05-implementation-notes.md#3-the-dispatcher-and-the-handler-contract) |
| 6 | DB agent | The e2e spec: every reply status and the database rows after each write. Add the type to the dispatch spec | `DbAgentNext/test-e2e/<domain>/`, `DbAgentNext/test-e2e/dispatch/dispatch.e2e-spec.ts` | [test-e2e/README.md](../../DbAgentNext/test-e2e/README.md) |
| 7 | DB agent docs | Describe what the message does: the checks, the statuses, the rows written. Describe a new rule of an entity in the domain model | `DbAgentNext/docs/messages.md`, `DbAgentNext/docs/domain-model.md` | [the rules](../../DbAgentNext/docs/README.md#rules-for-these-pages) |
| 8 | UI workspace | The decorated DTO classes of the BFF | `UI/libs/epic/entities/src/<domain>s/dtos/` | [RECIPES, section 1.3](../../UI/docs/RECIPES.md) |
| 9 | Mock DB agent | The same message on data in memory | `UI/apps/epic-db-agent/src/modules/db-agent/` | [RECIPES, section 1.4](../../UI/docs/RECIPES.md) |
| 10 | BFF | The route: controller, service that sends the Kafka message, module. Its e2e spec | `UI/apps/epic-measure-api/src/modules/<domain>/`, `UI/apps/epic-measure-api/test-e2e/` | [RECIPES, section 1.5](../../UI/docs/RECIPES.md) |
| 11 | Angular UI | The API client and its mock, then the store and the page | `UI/libs/epic-ui/api/main/src/<domain>s/`, `UI/libs/epic-ui/api/__mock__/src/<domain>s/` | [RECIPES, section 1.6](../../UI/docs/RECIPES.md) |
| 12 | Other clients | If WPAgent or TestAgent sends the message: its client code. A client must send the headers `kafka_correlationId` and `kafka_replyTopic`. It may send `svt_userId`, the user that the request is for | `WPAgent/services/WPDbKafkaClient.py`, `TestAgent/svt_test_agent/db_client.py` | [conventions](../Kafka/SvtKafkaConventions.md) |

A message that only another agent uses (no UI) stops after step 7, plus step 12.

## Check

Run the checks of each side before the pull request:

```bash
cd DbAgentNext && npm run pre-pull-request
```

```bash
cd DbAgentNext && npm run e2e
```

```bash
cd UI && npm run pre-pull-request
```

```bash
cd UI && npm run e2e::api
```

The first two are the lint, the type check, the unit tests and the e2e suite of the DB agent (PostgreSQL on port
5500). The third is the lint and the tests of the UI workspace; its lint also checks `Shared/svt-ts-types`. The
last one is the path from HTTP through Kafka and the DB agent to PostgreSQL. The commands and what they need are
in [DbAgentNext/CLAUDE.md](../../DbAgentNext/CLAUDE.md) and [UI/CLAUDE.md](../../UI/CLAUDE.md).

## Pitfalls

- **The Angular code must not import `svt-ts-types/kafka`.** The Kafka contract is for the Node apps.
- **`Shared/` has no npm imports and no decorators.** A decorated class belongs to the service that uses it.
- **A name on the wire can differ from the name in TypeScript.** Chip blocks are `GetAllBlocks` on the wire and
  `GetAllChipBlocks` in the TypeScript enum.
- **An exception must not leave a handler through NestJS.** The dispatcher of the DB agent turns every error into
  a reply; a client in Python does not understand NestJS's own error header.
