# 00. Context for every phase

Read this once, fully, before any phase. Paths are relative to the repository root (`SVTSW/`)
unless they start with `UI/`-relative names in code blocks.

## 1. What is being built, in one paragraph

The SVT DB Agent is a Kafka request/reply service in front of the project's PostgreSQL database.
Clients (`UI/apps/epic-measure-api`, the Python WPAgent and TestAgent) send
`{ type, data }` messages to `svt.db-agent.request` and read the correlated reply from
`svt.db-agent.request.reply`. The current implementation is C++ (`DbAgent/`), written by one
person who has left; its behaviour is documented in `DbAgent/docs`. `SvtDbAgentNext` re-implements
it in NestJS with MikroORM, inside this workspace, keeping the Kafka contract, the topics, the
environment variables and the database, so that swapping the container image is the whole
deployment.

## 2. Repository map

| Path | What it is |
|---|---|
| `DbAgent/` | the C++ agent (reference behaviour; do not modify) |
| `DbAgent/docs/` | **the behavioural specification**: 01 architecture, 02 domain model, 03 schema, 04 generic engine, 05 handlers, 06 wafer map, 07 drift and quirks, 08 open questions |
| `Documentation/Kafka/svt.db-agent.kafka.yaml` | the Kafka contract (OpenAPI-style, 55 message types); `SvtKafkaConventions.md` next to it |
| `Documentation/DB/DBTables/SVT_DB_Tables_SourceOfTruth.txt` | hand-maintained schema doc (dbdiagram text); matches the dev database |
| `Dev/db-example/` | database dumps: `2026-11-08-backup_prod.dump` (production), `2026-11-08-backup.dump` (dev), plus a README on how to read and restore them |
| `Dev/docker-compose.kafka-local.yml`, `Dev/docker-compose.postgres.yml` | local Kafka and Postgres (see §6) |
| `Configurations/WaferTypeMappings/*.json` | real wafer type maps (test fixtures for the ASIC generation) |
| `UI/` | this Nx workspace: Angular UI, NestJS BFF, the mock agent, shared libs |
| `UI/apps/epic-db-agent/` | the **mock** DB agent: NestJS Kafka microservice backed by in-memory arrays; its controller dispatch is the model for the real one |
| `UI/apps/epic-measure-api/` | the BFF; the Kafka **client** of the agent |
| `UI/libs/epic-api-types/` | plain TS, no framework imports: `main/` shared HTTP/wire types, alias `epic-api-types`; `kafka/` Kafka message classes and envelope types, alias `epic-api-types/kafka` |
| `UI/libs/epic/entities/` | Node-only: decorated DTOs, RxJS / NestJS helpers around the Kafka contract; alias `epic/entities` |
| `UI/docs/db-agent-clone/` | migration notes: 01 behaviour decisions, 02 database migration, 03 parity testing, 04 runtime and deployment; this `dev-plan/` folder |
| `WPAgent/services/WPDbKafkaClient.py` | a second client of the agent (6 message types); shows the Python side of the protocol |

## 3. What to read for which task

| Task | Read |
|---|---|
| Any handler | `DbAgent/docs/04-request-engine.md` (generic list/create/update semantics), then the entity's section in `05-request-handlers.md`, then its row in `../01-behaviour-decisions.md` |
| Envelope, headers, statuses, heartbeat | `DbAgent/docs/01-architecture.md` §4–§8 |
| Any entity or migration | `DbAgent/docs/03-database-schema.md` (tables, enums, S1–S16 discrepancies, data snapshot) and `../02-database-migration.md` |
| Wafer creation | `DbAgent/docs/06-wafer-map.md` (format, validation, generation algorithm, verified against all production data) |
| Message shapes | `Documentation/Kafka/svt.db-agent.kafka.yaml`; the TypeScript mirror in `UI/libs/epic-api-types/kafka/src/db-agent/kafka-messages/*.ts` |
| What the mock does today | `UI/apps/epic-db-agent/src/modules/db-agent/controllers/epic-db-agent-wafers.controller.ts` (one `switch` over all types) and `services/*.ts` |
| Workspace rules | `UI/CLAUDE.md`, `UI/docs/ARCHITECTURE.md`, `UI/docs/RECIPES.md` |
| Reference NestJS + MikroORM project | `G:\www\rentaly\rentaly` (outside this repo, may not be present on every machine): `libs/api/db/src/database.module.ts`, `mikro-orm.config.ts`, `apps/rentaly-api/src/migrations/`, `libs/api/auth/src/` as a domain lib |

## 4. Workspace conventions that apply to Node code

From `UI/CLAUDE.md`, enforced by ESLint (`npm run lint`, fix with `npm run lint:fix`):

- 4-space indent, single quotes, **no semicolons**, trailing commas on multiline, Stroustrup
  braces, `max-len` 140.
- `padded-blocks: { classes: always }`: a blank line after `{` of a class and before its `}`.
- Type and interface members have **no delimiter** (no `;` or `,` between members).
- `import/order`: alphabetised, blank line between groups, **two blank lines** before the first
  declaration after the imports.
- `id-denylist: ['e']`: never name anything `e` (`error`, `event`).
- Member ordering enforced: static, decorated, instance, abstract; fields before constructor
  before methods.
- Every folder has an `index.ts` barrel; import siblings through barrels, never deep paths.
- Never import across libs by relative path; use the `tsconfig.base.json` aliases. The app's own
  folders (`src/db/orm`, `src/db/data`) are imported by relative path, through their barrels.
- `epic-api-types` must stay framework-free (lint-enforced). Do not add decorators or Node code to
  it.
- Line endings: the repository stores LF; on Windows `core.autocrlf=true` checks files out as
  CRLF and prints "LF will be replaced by CRLF" warnings for files written with LF. Both are fine;
  do not convert files by hand and do not add `eol` attributes (only shell scripts and the server
  files under `Environment/` are forced to LF by `.gitattributes`). Tools that read files
  byte-wise must tolerate `\r` (MSYS `grep` strips it silently, so it cannot be used to detect it).
- Dependencies must satisfy the Angular 21 peer ranges so that plain `npm i` resolves. After adding
  packages run `npm i` without `--force` and make sure it succeeds.

Project configuration patterns to copy: `UI/apps/epic-db-agent/project.json`, `webpack.config.js`,
`tsconfig.*.json`, `eslint.config.mjs`, `.env.*` for an app; `UI/libs/epic-api-types/main/project.json`
and `eslint.config.mjs` for a lib with lint and test targets.

## 5. Build, run and test facts

- Nx 22, Node **≥ 22.17** (MikroORM 7 is ESM-first and requires it; `engines` in `UI/package.json` says
  `^22.17.0 || >=24.0.0`), npm. Apps build with webpack through
  `NxAppWebpackPlugin` (`compiler: 'tsc'`, `target: 'node'`, `generatePackageJson: true`);
  `nx serve <app>` runs `@nx/js:node` on the build output. `tsconfig.app.json` of the mock already
  sets `experimentalDecorators`, `emitDecoratorMetadata`, `module: commonjs`, `target: es2021`.
- Scripts live in `UI/package.json` (`start::db-agent`, `build::db-agent` are the mock's; add
  `start::db-agent-next`, `build::db-agent-next`).
- Tests: Vitest from the **single root** `UI/vitest.config.ts`. Its default environment is
  `jsdom` with the Angular plugin; Node-only specs start with `// @vitest-environment node`.
  `nx test <project>` runs `vitest run --dir <project root>`. Database tests must be skipped when
  `SVT_DB_AGENT_TEST_DB_URL` is unset: alias `const describeWithDatabase = url ? describe : describe.skip`
  (the Angular zone setup wraps `describe` and rejects both `describe.skipIf` and the `{ skip }` options
  form; see `apps/svt-db-agent-next/src/db/data/wafer-types/svt-db-wafer-types.repository.spec.ts`).
- `@nestjs/microservices` is currently a **devDependency** in `UI/package.json`; the agent ships
  it, so phase 1 moves it to `dependencies`.
- After pulling a branch that bumps Angular or Nx: `npx nx reset && rm -rf .angular/cache`.

## 6. Local infrastructure

From `UI/`'s sibling folder `Dev/` (see `Dev/README.md`):

```bash
docker compose -f Dev/docker-compose.kafka-local.yml up -d      # Kafka: localhost:9085 for host processes, Kafka UI http://localhost:8087
```

```bash
docker compose -f Dev/docker-compose.postgres.yml up -d          # Postgres 17: localhost:5500, user postgres / postgres, database svt_sw_db
```

Restore the production snapshot into it (pg_restore 17 reads the pg_dump 18 archives):

```bash
pg_restore --no-owner --no-privileges -h localhost -p 5500 -U postgres -d svt_sw_db Dev/db-example/2026-11-08-backup_prod.dump
```

The dev dump (`2026-11-08-backup.dump`) has the newer schema and fixtures for chips, tests and
setups; restore it into a **separate** database (the schemas conflict). The broker is configured
for 50 MiB messages. The mock agent's `.env.development` uses `KAFKA_BROKER=localhost:9085`.

## 7. Configuration the agent must honour

Names are those of the C++ container (`Environment/*/docker-compose-svtsw-*.yml`) so the compose
files need no change.

| Variable | Meaning | Local default (`.env.development`) |
|---|---|---|
| `SVT_DB_AGENT_DB_HOST`, `_DB_PORT`, `_DB_USER`, `_DB_PASS`, `_DB_NAME`, `_DB_SCHEMA` | PostgreSQL connection; schema is `main` | `localhost`, `5500`, `postgres`, `postgres`, `svt_sw_db`, `main` |
| `SVT_DB_AGENT_KAFKA_SERVER`, `_KAFKA_PORT` | broker host and port, joined into `bootstrap.servers` | `localhost`, `9085` |
| `SVT_DB_AGENT_LOGGER_FILE_PATH`, `_LOGGER_TERM_VERBOSITY`, `_LOGGER_FILE_VERBOSITY` | accepted for compatibility; the clone logs to stdout; verbosity maps `PRODUCTION`/`STANDARD`/`VERBOSE`/`DEBUG` onto Nest log levels | unset |
| `SVT_DB_AGENT_HTTP_PORT` | new: the `/health` HTTP port | `7676` |
| `SVT_DB_AGENT_FEATURE_CHIP_BLOCKS` | new, optional: `true`/`1` makes `CreateChip`/`CreateManyChips` write the chip's `ChipBlock` rows from `AsicFamilyTypeBlockList` (Q6, unconfirmed naming) | unset (off) |
| `NODE_ENV` | selects `.env.<NODE_ENV>` as in the other apps | `development` |

All are read through `@nestjs/config` and validated at boot (class-validator on an env class, as in
rentaly's `apps/rentaly-api/src/config`); a missing DB variable is a startup error.

## 8. The Kafka protocol, in one page

Full detail: `DbAgent/docs/01-architecture.md` §4–§5. The protocol **is** NestJS's Kafka
request/reply convention, so `Transport.KAFKA` with `@MessagePattern('svt.db-agent.request')`
is the natural fit; the mock already does this.

- Request topic `svt.db-agent.request`, reply topic `svt.db-agent.request.reply`, heartbeat topic
  `svt.db-agent.heartbeat`. One partition each. Consumer group **`svt.db-agent.request`** (same as
  the C++, so a deployment swap is a plain consumer handover).
- Request headers: `kafka_correlationId`, `kafka_replyTopic`, `kafka_replyPartition`. Reply
  headers: `kafka_correlationId`, `kafka_replyPartition`, `kafka_nest-is-disposed`. NestJS sets
  all of these itself.
- Request value: `{ "type": "<MessageType>", "data": { … } }`. Reply value, keys in this order:
  `{ "type": "<MessageType>Reply", "status": "Success" | "BadRequest" | "NotFound" | "UnexpectedError", "data": … | null, "error": { "code": number, "message": string } }`.
  Success: `error = { code: 0, message: '' }`. Failure: `data = null`, `code = -1` until codes are
  defined.
- Reply `data` shapes: list `{ items: T[], totalCount: number }`; entity `{ entity: T }`; enums
  `{ [enumType]: string[] }` (no wrapper). Location-history lists have no `totalCount` today.
- **Errors must be replies**, never thrown out of the handler: NestJS would otherwise send a
  `kafka_nest-err` header with a serialised exception, which the Python client does not understand.
- Heartbeat: `{ "timestamp": "<epoch seconds>.<6 decimals>" }` as a **string**, every 2 s, no
  headers. The Docker healthcheck consumes it.
- Replies gzip-compressed (`CompressionTypes.GZIP`); consumer `maxBytesPerPartition` 10 MiB,
  `maxBytes` 50 MiB (copy from the mock's `main.ts`).

Message classes and unions for all 55 types: `UI/libs/epic-api-types/kafka/src/db-agent/kafka-messages/`
(`SvtDbAgentKafkaWafers.MessageType`, `GetAllWafersMessage`, `GetAllWafersReplyMessage`, …);
envelope types in `UI/libs/epic-api-types/kafka/src/common/` (`EpicKafkaReplyStatus`,
`EpicKafkaReplyMessageClass`).

## 9. Database facts for the data layer

Full detail: `DbAgent/docs/03-database-schema.md`; migration plan: `../02-database-migration.md`.

- Schema `main`; **quoted camelCase identifiers** (`"waferId"`, `main."WaferType"`).
- Surrogate keys `id integer GENERATED BY DEFAULT AS IDENTITY` on every top-level entity.
- 19 native enum types in prod, 21 in dev (`dutEntityName`, `testResultStatus` are dev-only until
  migration 1). Values are identical in prod, dev and the schema doc. The list with values:
  `DbAgent/docs/03-database-schema.md` §6.
- `json` columns: `WaferTypeMap.waferMap`, `Equipment.specification`, `WaferProbeProject.local2GlobalMap`.
  `SvtTestSetupConfig.configBody` and `SvtTestTypeConfig.configBody` are `text` (prod had `json`;
  migration 1 converts it since 2026-11-12, after Q27/Q31). On the wire they are all **strings**.
- `date` columns (day resolution, `DEFAULT CURRENT_DATE`) on history and config tables;
  `timestamp without time zone` on `SvtTestList` (`createdAt`, `startedAt`, `finishedAt`).
- History tables without a primary key (`WaferLocation`, `ChipLocation`, `EquipmentLocation`,
  `ModuleLocation`, `WaferLoadedInMachine`, `ProbeCardInstalledInMachine`, dev `SvtTestListToEntityId`);
  migration 1 adds `id` to them.
- **Prod and dev differ**: prod still has `SvtTestList.createsAt`, nullable `testSetupConfigId`
  without FK, `varchar` `testResultStatus` and the three old link tables; dev has `createdAt`, the
  FK, the enum and `SvtTestListToEntityName/Id`. Migration 1 brings prod to the dev layout. Until
  it runs in prod, the clone cannot serve the test messages there (neither can the C++ on `master`).
- Every foreign key is `DEFERRABLE`. No triggers, views or functions.

## 10. Entity catalogue

Dev layout after migration 1. "Virtual" fields are reply fields computed by join, not columns.
Column details: `DbAgent/docs/03-database-schema.md` §3.

| Entity (class) | Table | Key | Relations and notes |
|---|---|---|---|
| `SvtDbWaferTypeEntity` | `WaferType` | id | name UK, engineeringRun UK (enum), foundry, technology (enums); 1:0..1 `WaferTypeMap`, `WaferTypeImage` |
| `SvtDbWaferTypeMapEntity` | `WaferTypeMap` | waferTypeId (PK+FK) | `waferMap` json (string on the wire) |
| `SvtDbWaferTypeImageEntity` | `WaferTypeImage` | waferTypeId (PK+FK) | `imageBase64String` text; unused by any message |
| `SvtDbWaferEntity` | `Wafer` | id | → WaferType; serialNumber UK; 3 nullable dates; generalLocation enum |
| `SvtDbWaferLocationEntity` | `WaferLocation` | id (new) | → Wafer; generalLocation, date, username, note |
| `SvtDbAsicEntity` | `Asic` | id | → Wafer; serialNumber UK; familyType, quality enums; waferMapPosition; virtual `chipId` (LEFT JOIN Chip) |
| `SvtDbChipEntity` | `Chip` | id | → Asic; serialNumber UK; generalLocation; virtual `familyType` (from Asic) |
| `SvtDbChipLocationEntity` | `ChipLocation` | id (new) | → Chip |
| `SvtDbChipBlockEntity` | `ChipBlock` | id | → Chip; blockType enum; serialNumber UK |
| `SvtDbAsicFamilyTypeBlockListEntity` | `AsicFamilyTypeBlockList` | (asicFamilyType, blockType) | configuration table |
| ~~`SvtDbModuleEntity`, `SvtDbModuleChipListEntity`, `SvtDbModuleLocationEntity`~~ | `Module`, `ModuleChipList`, `ModuleLocation` | — | **not mapped**: modules are out of scope (decided 2026-11-08) |
| `SvtDbWaferProbeMachineEntity` | `WaferProbeMachine` | id | serialNumber UK, name UK; 5 enums; nullable → Wafer (`loadedWaferId`), → ProbeCard (`installedProbeCardId`), two orientation enums |
| `SvtDbWaferLoadedInMachineEntity` | `WaferLoadedInMachine` | id (new) | → Machine, → Wafer; orientation, date, username, status enum |
| `SvtDbProbeCardInstalledInMachineEntity` | `ProbeCardInstalledInMachine` | id (new) | → Machine, → ProbeCard; orientation, date, username |
| `SvtDbProbeCardEntity` | `ProbeCard` | id | serialNumber UK; name (enum, UK), vendor, model, location, type enums; version, arriveDate, vendorCleaningInterval |
| `SvtDbProbeCardFamilyTypeEntity` | `ProbeCardFamilyType` | (probeCardId, asicFamilyType) | → ProbeCard |
| `SvtDbWaferProbeProjectEntity` | `WaferProbeProject` | id | → Machine, → WaferType; name UK; local2GlobalMap json |
| `SvtDbEquipmentTypeEntity` | `EquipmentType` | id | name UK |
| `SvtDbEquipmentEntity` | `Equipment` | id | → EquipmentType; name UK; specification json |
| `SvtDbEquipmentLocationEntity` | `EquipmentLocation` | id (new) | → Equipment |
| `SvtDbTestSetupEntity` | `SvtTestSetup` | id | name, generalLocation nullable |
| `SvtDbTestSetupEquipListEntity` | `SvtTestSetupEquipList` | (setupId, equipId) | → Setup, → Equipment; no message writes it |
| `SvtDbTestSetupDefaultConfigEntity` | `SvtTestSetupDefaultConfig` | setupId (PK) | → Setup, nullable → SetupConfig |
| `SvtDbTestSetupConfigEntity` | `SvtTestSetupConfig` | id | → Setup; name UK (global); configBody text; createdAt date |
| `SvtDbTestTypeEntity` | `SvtTestType` | id | name UK |
| `SvtDbTestTypeDutTypeListEntity` | `SvtTestTypeDUTTypeList` | (dutType, testTypeId) | → TestType |
| `SvtDbTestTypeConfigEntity` | `SvtTestTypeConfig` | id | → TestType; (testTypeId, name) UK; configBody text; createdAt date |
| `SvtDbTestTemplateEntity` | `SvtTestTemplate` | id | dutType enum nullable; → TestTypeConfig (nullable in DB); isEnabled default true; (dutType, testTypeConfigId) UK; virtual `testTypeId` |
| `SvtDbTestEntity` | `SvtTestList` | id | → TestTypeConfig; → TestSetupConfig; createdAt default now; startedAt, finishedAt, pathToResult, testResultStatus enum |
| `SvtDbTestToEntityNameEntity` | `SvtTestListToEntityName` | (dutEntityName, testId) | → Test; one row per test in practice |
| `SvtDbTestToEntityIdEntity` | `SvtTestListToEntityId` | id (new) | → Test; `dutId` without FK (polymorphic) |

## 11. Decisions that shape the implementation

Condensed from `../01-behaviour-decisions.md`; that file is authoritative and has the reasoning.

- One transaction per message; `RETURNING id`; bound parameters; DB-side `LIMIT`/`OFFSET`/`COUNT`;
  no 5000-row cap; relations by join or `populate`, never N+1.
- Validation by name with `class-validator` on the request `data` (optional means optional);
  booleans and nulls handled properly; unknown keys rejected.
- A scalar relation with no row yields `null`, not an error.
- Filters: implement every filter the contract declares, including the `GetAllSvtTests` date ranges.
  `null`/`true`/object filter values → `BadRequest`. Empty array filter: keep today's behaviour
  (no filter) until asked.
- Statuses: `BadRequest` for validation, `NotFound` for a missing id, `UnexpectedError` for DB and
  infrastructure errors. `error.message` without source locations or SQL.
- Reply field names and shapes follow the **contract** where it is unambiguous, and the C++ where
  the contract is silent. The known contract-vs-code conflicts and their resolution are the rows
  of `../01-behaviour-decisions.md` §3.
- Enum values are read from `pg_enum` per request. `GetAllEnums` accepts `data.enumNames`,
  `data.enumsNames` and `data.filter.enumNames`; absent means all.
- Dates: `YYYY-MM-DD` for `date` columns; ISO 8601 UTC for timestamps (see the plan README).
- JSON columns are strings on the wire; an object in a request is rejected with `BadRequest`.

## 12. Known pitfalls

- **MikroORM in a webpack bundle**: list entities explicitly (no globs) in the runtime config, set
  `discovery: { disableDynamicFileAccess: true }`, keep `ReflectMetadataProvider` (default) and
  `emitDecoratorMetadata: true`. Reference relation targets as `() => SvtDbWaferEntity`, never via
  `import type`. Use `TsMorphMetadataProvider` only in the CLI config.
- **Request context outside HTTP**: with `allowGlobalContext: false` (default), using the injected
  `EntityManager` without a context throws. Put `@CreateRequestContext()` on every message
  handler (the class needs `private readonly orm: MikroORM` injected) or fork explicitly.
- **Identifiers**: `EntityCaseNamingStrategy` keeps property names as column names but also uses
  the class name as the table name, so every entity sets `tableName` explicitly.
- **Identity columns**: `@PrimaryKey({ autoincrement: true })`. If `schema:update --dump` reports
  a difference between `serial` and `GENERATED BY DEFAULT AS IDENTITY`, keep migration 0 raw and
  declare the column with `columnType: 'integer'` plus `defaultRaw` so the diff is empty.
- **Timestamps**: the DB uses `timestamp without time zone`; declare `columnType: 'timestamp'`
  (MikroORM's PG default is `timestamptz`) and set `forceUtcTimezone: true` so values are not
  shifted by the host zone.
- **`date` columns** must be `type: 'date'` (string `YYYY-MM-DD`), not `Date`.
- **Enum types**: if `@Enum({ nativeEnumName })` makes `schema:update --dump` noisy against the
  restored dump, fall back to `@Property({ type: 'string', columnType: '"<enumType>"' })` and
  leave the enum types to raw migrations. Verify, do not assume.
- **`EpicSvtTestResultStatus`** in `epic-api-types` has values `None/Completed/Failed/Cancelled`;
  the DB enum `testResultStatus` has `SUCCESS/PARTIAL_SUCCESS/FAILURE/ERROR`. Do not use the TS
  enum for the column; this is open question Q25.
- **NestJS Kafka errors** become `kafka_nest-err` headers unless caught; catch everything in the
  dispatcher.
- **Vitest root config** is jsdom + Angular; add `// @vitest-environment node` to Node specs.
- **`npm i --force`** hides peer conflicts; never need it. Mock `.env.*` files are committed; do
  not put secrets in them.

## 13. Open questions that may change the plan

The author answered `DbAgent/docs/08-questions-for-the-author.md` on 2026-11-08: 30 questions are resolved, 13
are still open, and the status table at the top of that file lists them. The phases ran on the assumptions
below; the last column says what came of each.

| Question | Assumption used by the phases | Outcome |
|---|---|---|
| Q6 chip block naming | `<blockType>_<chipSN>` as in the code; generation implemented but **disabled by a config flag** until confirmed | Resolved: the dev rows were test data and no naming is defined yet; the flag stays off until a user defines it. |
| Q9 module design | **dropped** (2026-11-08): the UI has no module concept; no entities, no messages | Dropped. |
| Q21, Q24 DUT model | dev layout: one `SvtTestListToEntityName` and one `SvtTestListToEntityId` row per test | Q21 resolved (`dutEntityName` + `dutId` identify the device); Q24 open (several DUTs per test, a test without a setup config). |
| Q25 result status | DB enum values `SUCCESS/PARTIAL_SUCCESS/FAILURE/ERROR` | Open; the agent uses the database enum plus `CANCELLED` (migration 2). |
| Q27 configBody type | ~~`json`~~ `text` (answered 2026-11-08: the schema doc is authoritative, Q31); strings on the wire | Resolved: `text` (migration 4 for databases migrated earlier). |
| Q31 prod schema | migration 1 is written; when it runs in prod is an operations decision | Resolved: the schema doc is authoritative; when migrations 1–4 run in prod is still an operations decision. |
