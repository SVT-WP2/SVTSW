# epic-api-types/kafka

The Kafka contract between `epic-measure-api` (the BFF) and the DB agent (`svt-db-agent-next`, and the mock
`epic-db-agent`), as plain TypeScript. `Documentation/Kafka/svt.db-agent.kafka.yaml` (repository root) is the
authority; this is its TypeScript mirror.

It is the second entry point of `Shared/svt-ts-types` ([`../README.md`](../README.md)) and obeys the same rule as
`epic-api-types` ([`../main`](../main/README.md)): dependency-free — types, enums and plain classes only, **no**
decorators, **no** `@nestjs/*`, `class-validator`, `rxjs`, and **no** imports from `epic/*` or `epic-ui/*`
(`EPIC_API_TYPES_RESTRICTED_IMPORTS`, run by `npm run lint:shared` in `UI/`).

- The Node apps import it as `epic-api-types/kafka` (see `UI/tsconfig.base.json`).
- Angular code must not: the browser never talks to Kafka, and the message classes and enums would end up in the
  SPA bundle. `UI/eslint.config.mjs` rejects the import in `apps/epic-measure-ui` and `libs/epic-ui`.
- It imports the HTTP contract types through the alias `epic-api-types`, never the other way round.

## Layout

```
src/
├── common/                 message envelope: EpicKafkaMessage(Class), EpicKafkaReplyMessage(Class), reply status / error
└── db-agent/
    ├── kafka-messages/     one `SvtDbAgentKafka<X>` namespace per domain + the topic names (`SvtDbAgentKafka`)
    └── models/             wire types that differ from the HTTP shape, and the Kafka filters
```

## Wire types

The messages carry the `epic-api-types` types directly while the Kafka shape equals the HTTP shape
(`PageReplyMessageData<EpicAsic>`, `create: EpicAsicCreateRequest`). `db-agent/models` holds a type only where the
two differ: `EpicSvtTestEntity` (no `status` — the BFF derives it), the `*LocationUpdate` types (extra `username`),
the WP machine updates (extra `wpMachineId`), the Kafka-only `EpicSvtTestStartUpdate` / `EpicSvtTestFinishUpdate`
and the `EpicGetAll<X>QueryFilter` filters.

What needs RxJS or NestJS around the contract — `mapEpicKafkaMessageData()`, `processKafkaReplyError()`, the
decorated DTOs — stays in `UI/libs/epic/entities`.
