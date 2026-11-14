# 06. Implementation notes: how the agent is built

This file covers how the code is organised, the rules that keep it consistent, and the traps already met. What the
agent does is in [01](01-behaviour-decisions.md) (behaviour) and [04](04-runtime-and-deployment.md) (runtime). How
the schema maps onto MikroORM is in [02 §3](02-database-migration.md#3-mapping-the-schema-onto-mikroorm). Commands
and code style are in [`../README.md`](../README.md) and [`../CLAUDE.md`](../CLAUDE.md).

Until 2026-11-14 this content lived in the phase instructions of `docs/dev-plan/` (00-context, 01 to 05). The
agent was built from them, phase by phase, between 2026-11-08 and 2026-11-14. They were folded into the numbered
files and deleted on 2026-11-14; git history keeps them (the last commit with them is `92305ad4`). They describe
the layout of their time: the agent was `UI/apps/svt-db-agent-next` and the contract types were
`UI/libs/epic-api-types`.

## 1. Where to read what

| Task | Read |
|---|---|
| Any handler | `DbAgent/docs/04-request-engine.md` (generic list, create and update semantics), the entity's section in `05-request-handlers.md`, its row in [01](01-behaviour-decisions.md) and its domain in [01 §6](01-behaviour-decisions.md#6-decided-while-implementing-per-domain) |
| Envelope, headers, statuses, heartbeat | `DbAgent/docs/01-architecture.md` §4 to §8, [04 §2 and §3](04-runtime-and-deployment.md#2-kafka-transport) |
| An entity or a migration | `DbAgent/docs/03-database-schema.md` (tables, enums, S1 to S16), [02](02-database-migration.md) |
| Wafer creation | `DbAgent/docs/06-wafer-map.md` (format, validation, generation, checked against all production data) |
| Message shapes | `Documentation/Kafka/svt.db-agent.kafka.yaml` and `svt.db-agent-next.kafka.yaml`; the TypeScript in `Shared/svt-ts-types/kafka/src/db-agent/kafka-messages/` |
| Proof of behaviour against the C++ | [03](03-parity-testing.md), `../test-parity/` |

## 2. Code layout and dependency rules

```
src/
├── main.ts                 boot: app.init(), backlog skip, Kafka microservice, heartbeat, HTTP listener
├── app/                    AppModule
├── config/                 SVT_DB_AGENT_* variables, validated at boot (04 §1)
├── modules/
│   ├── dispatch/           dispatcher, handler marker, request validation helpers, pager DTO
│   ├── handlers/<domain>/  one handlers class per domain, plus its app-local request DTOs
│   ├── kafka/              transport options, controller, heartbeat, backlog skip, kafka health indicator
│   └── health/             GET /health (database, kafka)
├── db/                     the database layer, strict (src/db/tsconfig.json)
│   ├── orm/                SvtDbOrmModule, runtime options, SvtDbNamingStrategy
│   └── data/<domain>/      entities, repositories, enum values service, pure domain logic (wafer-maps/)
└── migrations/             MikroORM migrations 0 to 4 (02)
```

| Topic | Rule | Why |
|---|---|---|
| Names | classes `SvtDb…` in `src/db` (`SvtDbWaferEntity`, `SvtDbOrmModule`), files `svt-db-<thing>.<role>.ts`; the rest of the app `SvtDbAgentNext…` and `svt-db-agent-next-<thing>.<role>.ts` | a bounded context apart from the `Epic…` UI and BFF code |
| Dependencies | `src/db/data` → `src/db/orm`, `svt-ts-types`. The rest of the app → both, `svt-ts-types`, `svt-ts-types/kafka`. `src/db` imports neither `svt-ts-types/kafka` nor `modules/` (enforced by `eslint.config.mjs`). Folders are imported by relative path, through their `index.ts` | the data layer must not know the Kafka contract |
| Request DTOs | app-local `class-validator` classes, `svt-db-agent-next-<domain>.dtos.ts` next to the handlers; each `implements` its contract type, so a contract change is a compile error | decorated classes cannot live in `Shared/` (no `node_modules` there) |
| MikroORM | **7.2.x** with `@mikro-orm/nestjs` 7.1.x. Decorators from `@mikro-orm/decorators/legacy`; `OptionalProps`, `PrimaryKeyProp`, `DeferMode` from `@mikro-orm/core`; `EntityManager`, `EntityRepository` from `@mikro-orm/postgresql`. `moduleResolution: nodenext` with `skipLibCheck` (webpack still emits CommonJS) | decided 2026-11-08; v7's types are invisible to the legacy `node` resolution |
| Metadata | runtime: `ReflectMetadataProvider` (set explicitly), `emitDecoratorMetadata`, explicit entity list (`SVT_DB_ENTITIES`), and an explicit `type` on every scalar property. CLI: the TypeScript sources through `@swc-node/register`, with `tsconfig.mikro-orm.json` | the app is a webpack bundle (no globs). Vitest (esbuild) emits no metadata, hence the explicit types. The CLI note is in §6 |
| Naming | `SvtDbNamingStrategy`: `EntityCaseNamingStrategy` plus PostgreSQL's default constraint names (`_pkey`, `_key`, `_fkey`); explicit `tableName` on every entity, `schema: 'main'` | the database uses quoted camelCase identifiers and the default constraint names, so `schema:update --dump` stays empty |
| Enum columns | `string` in TypeScript, `@Enum({ nativeEnumName, items })` with `items` from the generated `svt-db-enum-values.ts` (02 §4); string-literal unions only for the values logic depends on. No TypeScript enum of the 86 ASIC family types | values are data maintained in the database; `GetAllEnums` serves them from `pg_enum` |
| Transactions | each message runs in its own MikroORM request context (opened by the dispatcher); writes in `em.transactional()` | one transaction per message (01 §1, X-1); MikroORM needs a context outside HTTP |
| Replies | the controller returns the envelope as a **string**; every error becomes an envelope (§3); NestJS's own error path is never used | WPAgent and the BFF read `status` from the body |
| Wire formats | `date` columns `YYYY-MM-DD`; timestamps ISO 8601 UTC; `json` and `text` documents as strings, byte for byte (01 §3, R-6, R-7) | |
| Enum values | read from `pg_type ⋈ pg_enum` per request, no cache | the database owner adds values live |
| Tests | unit specs `src/**/*.spec.ts` (`vitest.config.ts`, Node environment); the e2e suite `test-e2e/` against a real PostgreSQL ([`../test-e2e/README.md`](../test-e2e/README.md)); the parity suite `test-parity/` | |

## 3. The dispatcher and the handler contract

`modules/dispatch/`:

- `SvtDbAgentNextRequestDispatcher.dispatch(message)` always returns a reply `{ type, status, data, error }`, keys in
  that order: `error: { code: 0, message: '' }` on success, `data: null` and `code: -1` on failure.
  - An unknown or malformed request gets `BadRequest`.
  - `SvtDbAgentNextRequestError` carries the status a handler chose (`badRequest`, `notFound`).
  - A MikroORM unique violation becomes `BadRequest`, and so does a Postgres `22P02` (a filter value that is no
    value of its enum: `Error: "ChipBlock" is not a value of the asicFamilyType enum`).
  - Anything else becomes `UnexpectedError` with a generic message. The real error is logged, never sent.
- Reply `data` shapes: a list `{ items, totalCount }`, an entity `{ entity }`, `GetAllEnums` the map
  `{ [enumType]: string[] }` itself.
- Every handler runs inside `RequestContext.create(orm.em, …)`. Repositories therefore inject the global
  `EntityManager` and need no decorators of their own.
- A handlers class is `@Injectable() @SvtDbAgentNextHandlers()` and implements
  `getHandlerDefinitions(): { type, replyType, handle }[]`. The dispatcher discovers every marked provider
  (`DiscoveryService`) in its module-init hook. A new domain only adds its class to `SvtDbAgentNextHandlersModule`.
  `main.ts` awaits `app.init()` before the consumer starts: a record consumed earlier would find no handler.
- Request `data` is validated by name. `validateRequestData(Dto, data.create, 'data.create')` uses the app-local
  DTOs with `whitelist` and `forbidNonWhitelisted`, so unknown keys are rejected. The rest goes through the helpers
  of `svt-db-agent-next-request-validation.ts`:
  - `requireRecord`, `requireInteger`, `optionalIntegerList`, `optionalStringList`, `optionalDateTime`;
  - `requireAllowedFilterKeys`, which answers `Error: <key> is not an allowed filter.`, the C++ text;
  - `parseJsonOrBadRequest` and `jsonTextOrBadRequest` for JSON documents;
  - `optionalPager` (in the pager DTO's file): `limit 20`, `offset 0` when the pager is present.

  Enum values are checked against the live catalogue (`SvtDbEnumsService`), not against the generated snapshot.
- The Kafka controller is one `@MessagePattern('svt.db-agent.request')` method. It hands the payload to the
  dispatcher and logs type, status, duration and correlation id. It never throws: a dispatcher failure becomes an
  `UnexpectedError` envelope.

## 4. The data layer

- **Repositories.** One per aggregate, `@Injectable()`, registered in `SvtDbDataModule`, with the global
  `EntityManager` injected.
  - Lists are `findPage(filter, pager?)`: one `em.findAndCount` with `limit` and `offset` in the database, ordered
    by `id` ascending. Tests list newest first (01 §6.8). With no pager, every row comes back.
  - Writes run in `em.transactional`.
  - Reply fields that are no column (`Asic.chipId`, `Chip.familyType`, `SvtTestTemplate.testTypeId`) are computed
    in the repository, by a populated relation or one extra query per page, never one query per row.
  - Business rules live in the handlers. The exceptions are the pure functions of `wafer-maps/` and
    `chips/svt-db-chip-block-generation.ts`.
- **Location pattern** (wafers, chips, equipment):
  - `createWithLocation` writes the parent and a first history row with the note `Location at creation`.
  - `appendLocation(id, { generalLocation, date?, username, note })` writes a history row and sets the parent's
    `generalLocation` to that row's value (X-9: the row just written is current).
  - `findLocationHistory(id)` orders by `id`. The input type `SvtDbLocationInput` is in `db/data/common`.
- **Enum values service** (`SvtDbEnumsService`). It reads the catalogue on every call:

  ```sql
  SELECT t.typname AS type, e.enumlabel AS value
  FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = $1 ORDER BY t.typname, e.enumsortorder
  ```

  `getAll(names?)` answers the requested types (an unknown name answers `[]`), or every type when `names` is
  absent or empty.
- **Pure domain logic.**
  - `wafer-maps/` ports `DbAgent/docs/06-wafer-map.md` §3 and §4 literally: serial numbers and positions are
    business keys that already exist in production.
  - `generateAsics` reproduces the production rows exactly. Its unit spec regenerates a prod ER2 wafer and compares
    a digest of all 3421 dies with the fixture in `__fixtures__`, made from the dump. The wafers e2e spec does the
    same against the rows `CreateWafer` writes.
  - The validation keeps the eight documented rules and their messages.

## 5. Adding a message type or a domain

1. **Entities** in `src/db/data/<domain>/`, following [02 §3](02-database-migration.md#3-mapping-the-schema-onto-mikroorm),
   appended to `SVT_DB_ENTITIES`. Against a migrated database, `npm run db:schema:update:dump` must stay
   "Schema is up-to-date".
2. **Repository** in the same folder (§4), registered in `SvtDbDataModule`.
3. **Handlers** in `src/modules/handlers/<domain>/`, one class per domain (§3). Behaviour comes from
   `DbAgent/docs/05-request-handlers.md` and the decisions of [01](01-behaviour-decisions.md), reply shapes from
   the message classes of `svt-ts-types/kafka`. A type exists only if the Kafka contract defines it.
4. **e2e spec** `test-e2e/<domain>/<domain>.e2e-spec.ts`, with one `describe` per message type. It covers the success
   path, every reply status the handler can produce and the database rows after each write. A list also gets
   `expectListPaging` (`test-e2e/utils/list-paging.ts`). Add the message types to `dispatch/dispatch.e2e-spec.ts`.
   Seed through the agent's own `Create*` messages where one exists, otherwise through `setup.em()` or SQL; there
   are no shared fixtures.
5. Pure domain logic also gets a unit spec next to it.
6. Add parity cases for the new type ([`../test-parity/README.md`](../test-parity/README.md)) and record any
   intended difference in the registry and in 01.

## 6. Pitfalls met

- **The MikroORM CLI and the decorator metadata.** The CLI loads the TypeScript sources through
  `@swc-node/register`. With `emitDecoratorMetadata` it fails on the circular entity imports ("Cannot access
  'SvtDbWaferTypeMapEntity' before initialization"), hence `tsconfig.mikro-orm.json` without it. The runtime
  bundle needs the metadata.
- **Identity columns** diff cleanly only with `generated: 'by default as identity'` on the primary key.
  `autoincrement: true` alone makes MikroORM want `id serial`.
- **`json` columns** need `columnType: 'json'` (the default is `jsonb`). The three of them use `SvtDbJsonTextType`:
  MikroORM's `type: 'json'` parses the document and serialises it again, which loses the stored text (03 §5.1).
- **Timestamps** are `timestamp without time zone`. Declare `type: 'datetime', columnType: 'timestamp'` (MikroORM's
  PostgreSQL default is `timestamptz`). `forceUtcTimezone: true` keeps values from being shifted by the host zone.
  Sub-millisecond precision is lost in a JavaScript `Date`.
- **`date` columns** are `type: 'date'`, a `YYYY-MM-DD` string, not a `Date`.
- **Health.** Terminus's `MikroOrmHealthIndicator` reports `down` on an idle lazy connection.
  `SvtDbAgentNextDatabaseHealthIndicator` (`orm.checkConnection()` with a 3 s timeout) replaces it.
  `MikroOrmModule.forRootAsync` needs the explicit `driver: PostgreSqlDriver` next to `useFactory`.
- **Lazy connection.** MikroORM 7 always connects lazily, so the app boots with the database down and `/health`
  reports it; `ensureDatabase: false` keeps it from ever creating a database.
- **Kafka.** NestJS appends `-server` to the client and group ids unless `postfixId` is `''`. kafkajs resumes from
  a committed offset whatever `fromBeginning` says. Both are handled ([04 §2](04-runtime-and-deployment.md#2-kafka-transport)).
- **Errors through Kafka.** An exception that leaves a `@MessagePattern` method becomes a `kafka_nest-err` header
  with a serialised exception, which the Python client does not understand. The dispatcher catches everything.
- **Unique indexes created with `CREATE UNIQUE INDEX`** keep their names: `SvtTestTypeConfig_testTypeId_name_idx`
  (a type config's name is unique per test type) and `SvtTestTemplate_dutType_testTypeConfigId_idx` are declared
  with `@Unique({ name })`. Every other constraint takes the naming strategy's name.
- **Composite primary keys** of two enums (`AsicFamilyTypeBlockList`) or of a relation and an enum
  (`ProbeCardFamilyType`, `SvtTestListToEntityName`): `primary: true` on both properties plus `[PrimaryKeyProp]`.
- **Line endings.** The repository stores LF; on Windows `core.autocrlf=true` checks out CRLF. Tools that read files
  byte by byte must tolerate `\r` (MSYS `grep` strips it silently, so it cannot be used to detect it).

## 7. Notes per domain

Implementation details behind the decisions of [01 §6](01-behaviour-decisions.md#6-decided-while-implementing-per-domain).

- **Wafers.** `CreateWafer` writes the wafer, its `Location at creation` row and all ASICs (`em.insertMany`) in one
  transaction. `UpdateWaferLocation` is validated with an app-local DTO (`SvtDbAgentNextWaferLocationRecordDto`):
  the contract's record DTO had no validators on `note` and `username`, which the whitelist would reject.
- **ASICs.** `chipId` on every item comes from one extra query per page (the `Chip` rows of the page's ASIC ids).
- **Chips.** `familyType` comes from a populated `asic` relation; the `familyTypes` filter is a condition on that
  relation. The e2e harness boots the application with `SVT_DB_AGENT_FEATURE_CHIP_BLOCKS` for
  `chip-blocks.e2e-spec.ts` (`new TestSetup({ env })`); `chips.e2e-spec.ts` covers the default.
- **Wafer probing** (`db/data/wp/`). The machine reply type is `SvtDbAgentNextWpMachineWire`, because the
  TypeScript contract type lacks the two orientations. Probe cards and their family types have no create message;
  the e2e suite seeds them with SQL (`test-e2e/utils/wp-fixtures.ts`).
- **Test setups and types.** `configBody` is `@Property({ type: 'text', lazy: true })`: lists never load it, and the
  two `Get*ConfigBody` messages populate it.
- **Tests.** The two device filters are resolved through the link tables first and intersected with `ids`; the
  rest is one `findAndCount`.
