# 02. Database: migrations and MikroORM mapping

How the schema is built, and how the code maps it. The schema itself (every table, column, key and enum type) is
in [database-schema.md](database-schema.md), and that page is the authority for it. This page says what each
migration contains, how a migration is made and run, and how a table maps onto a MikroORM entity (MikroORM 7 with
the PostgreSQL driver and the migrations package).

The schema changes only through a migration, and a migration changes
[database-schema.md](database-schema.md#8-how-to-change-the-schema) in the same pull request.

The agent took over the database of the C++ agent. §1 and §2 are the record of that step: where the first
migration comes from, and what the later migrations change.

## 1. Baseline from the live database, not from the files

On 2026-11-08 production and dev did not share a schema: prod was
the June layout plus the Module tables and the `arriveDate` rename; dev also had the
September `SvtTestList` changes that the C++ code requires. Migration 0 is therefore the
**prod** schema, taken from `Dev/db-example/2026-11-08-backup_prod.dump`:

```bash
pg_restore --schema-only --no-owner --no-privileges -f migration0.sql Dev/db-example/2026-11-08-backup_prod.dump
```

It is the initial migration (raw SQL via `this.addSql(...)`), and migration 1 brings prod up to the dev
layout (§2). The entities match the state after the latest migration: `npm run db:schema:update:dump`
must produce an empty diff against a database at that state before a further migration is written.

How migration 0 was made (2026-11-08): `pg_restore --schema-only --no-owner --no-privileges` of the prod dump,
without the `SET`, `SELECT pg_catalog…` and comment lines. It was then made idempotent: `CREATE SCHEMA IF NOT
EXISTS`, `CREATE TABLE IF NOT EXISTS`, and the enum types and constraints wrapped in
`DO $$ BEGIN … EXCEPTION WHEN duplicate_object THEN NULL; END $$`. It runs to completion on an empty database and on
one restored from the prod dump; with migration 1 after it, both end in the same schema (`pg_dump --schema-only`,
checked 2026-11-08). Every migration is raw SQL (`this.addSql`) with `snapshot: false`, and every step is guarded,
so it is a no-op where its change is already there. An applied migration is never edited; a change is a new one.

**The agent applies the pending migrations at start.** `main.ts` calls `SvtDbOrmMigrationsService.up()` before the
Kafka consumer starts. A deploy of a version that has a new migration thus changes the schema of that environment:
dev with the master push, prod with the manual deploy.

- **The list.** The agent ships as one bundle and cannot discover files, so the migrations are the list
  `SVT_DB_MIGRATIONS` in `src/migrations/svt-db-migrations.ts`. Add each new migration to it; a unit test fails
  when one is missing.
- **A failure.** The pending migrations run in one transaction. A failure ends the start, and the schema stays as
  it was. The container then starts again and again; deploy the previous version, which works on that schema.
- **A database that does not exist.** The agent creates no database: when `SVT_DB_NAME` names a database that
  does not exist, the start ends.
- **The database user.** The user of the agent (`SVT_DB_USER` in the `.env` of the environment) must own the
  schema `main` with its tables and enum types, and must have the CREATE privilege on the database. The right to
  read and write the tables is not sufficient: the start then ends (`permission denied for database …`). In the
  dumps of 2026-11-08 the owner is `admin`.
- **No way back.** A return to an older image does not undo a migration. A migration must keep the previous
  release working.
- **Data.** Dev does not have the rows of prod. Try a migration that depends on the data on a restore of a prod
  dump before the release.

By hand, from `DbAgentNext/`: `npm run db:migration:up`, with the connection of `.env.<NODE_ENV>`; a variable that
is set in the shell wins over the file. `npm run db:migration:pending` lists what would run.

## 2. What migration 1 adds

First the September changes that dev had on 2026-11-08 and prod lacked (the test handlers of the C++ code
need them, so they also unblock the C++ agent in prod):

| Change | Status |
|---|---|
| Rename `SvtTestList.createsAt` → `createdAt` | dev has it |
| Create enums `dutEntityName` (`Asic`, `Chip`, `ChipBlock`) and `testResultStatus` (`SUCCESS`, `PARTIAL_SUCCESS`, `FAILURE`, `ERROR`) | dev has them |
| Create `SvtTestListToEntityName(testId FK, dutEntityName)` with PK `(dutEntityName, testId)` and `SvtTestListToEntityId(testId FK, dutId)` | dev has them |
| `SvtTestList.testSetupConfigId` NOT NULL + FK → `SvtTestSetupConfig`; `testResultStatus` → enum | dev has them |
| Drop `SvtAsicTestList`, `SvtChipTestList`, `SvtChipBlockTestList` (empty in prod) | dev has dropped them |
| `configBody` is `text` on `SvtTestSetupConfig` and `SvtTestTypeConfig`: prod's `json` columns are converted with `USING "configBody"::text`, which keeps the stored text verbatim. The schema file that the author of the C++ agent declares authoritative says `text` (Q27, Q31, answered 2026-11-08); this agent converted the other way until 2026-11-12 | dev has it; prod converted |

Then the changes this agent needs. The last two rows are **not migrated yet**:

| Change | Why | Visible to the running C++ agent? |
|---|---|---|
| `id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY` on `WaferLocation`, `ChipLocation`, `EquipmentLocation`, `WaferLoadedInMachine`, `ProbeCardInstalledInMachine` (and `ModuleLocation`, `SvtTestListToEntityId` if they exist) | MikroORM needs a primary key per entity, and these tables had none; the key also gives history rows a stable order | No: it never names `id` on these tables. Safe while C++ runs. |
| `SvtTestTemplate.testTypeConfigId` NOT NULL | the code treats it as required; the author of the C++ agent confirms (Q33) | Only if existing rows have NULLs (none in either dump). |
| `CANCELLED` added to enum `testResultStatus` (**migration 2**, 2026-11-08) | the UI has a Cancelled status and the contract enum mirrors the database's values ([01 §6.8](01-behaviour-decisions.md#68-svt-tests)) | No: an extra enum value is invisible to code that never writes it. |
| June-dump leftovers (**migration 3**, 2026-11-09): `ProbeCard.arrivalDate` → `arriveDate`, `pcModel` and `pcName` values | a developer database restored from the June 2026 dump still had them; migration 0 adds what is missing but cannot rename | No: guarded, a no-op on production- and dev-shaped databases. |
| `configBody` `json` → `text` on databases that ran migration 1 before 2026-11-12 (**migration 4**, 2026-11-12) | migration 1 converted to `json` until Q27/Q31 were answered; the same guarded conversion is repeated so those databases catch up | No: it reads and writes the column as text either way (dev has been `text` all along). |
| The enum type `userRole` and the table `SvtUser`, with no row, and the check `SvtUser_login_check` (the login rule of the agent: `login ~ '^[a-z0-9._-]{3,50}$'`) (**migration 5**, 2026-11-26) | the users of the installation (#392, #393); the first Admin is entered by hand, and the check keeps its login one that can log in | No: a new table and a new type. |
| Allow probe-card uninstall: a status column on `ProbeCardInstalledInMachine` (the author suggests a status such as "PC not installed", Q14) rather than a nullable `probeCardId` | decision in [01](01-behaviour-decisions.md#3-handlers); the enum values are to be agreed with the WPAgent team | Only if the C++ is still handling that message on the same DB; it never writes the new column. |
| Rename the enum type `blockType` → `chipBlockType` (Q30): `ALTER TYPE main."blockType" RENAME TO "chipBlockType"`, guarded | the author keeps the contract's name; `GetAllEnums` then answers with the key `chipBlockType` | After a restart: the C++ reads the type names at startup and would answer `chipBlockType` too; the columns keep working. **Pending**: the UI (`EpicEnumName.blockType`), the mock agent's enum list and the entities (`nativeEnumName`, `SVT_DB_ENUM_VALUES`) still say `blockType`, and all of them must change in the same step as the migration. |

Not in a migration: the Module tables stay as the baseline has them, until the feature is in scope; the
`blockType` → `chipBlockType` rename is pending (above).

## 3. Mapping the schema onto MikroORM

The rules every entity in `src/db/data` follows (MikroORM 7, decorators from `@mikro-orm/decorators/legacy`;
the setup is in [05 §2](05-implementation-notes.md#2-code-layout-and-dependency-rules)). The goal they serve:
`npm run db:schema:update:dump` against a migrated database prints "Schema is up-to-date". Run it after every entity
change.

| Schema fact | Entity code |
|---|---|
| Schema `main` | `schema: 'main'` in the ORM options, in one place (the C++ has it in four). |
| Table | `@Entity({ tableName: 'WaferType' })`; never rely on the class name. |
| Quoted camelCase identifiers (`"waferId"`) | `SvtDbNamingStrategy` (`src/db/orm`): `EntityCaseNamingStrategy`, so property names are the column names, plus PostgreSQL's default constraint names (`<table>_<cols>_key`, `_fkey`, `_pkey`). The default underscore strategy would turn `waferId` into `wafer_id`. |
| Every scalar property | declares its `type` (`'integer'`, `'string'`, `'text'`, `'date'`, …). Vitest (esbuild) emits no decorator metadata, and the entities must load under Vitest, the webpack bundle and the CLI alike. |
| `id integer GENERATED BY DEFAULT AS IDENTITY` | `@PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' }) id!: number`, with `[OptionalProps]?: 'id' \| …` **after** the decorated fields (member-ordering lint). Without `generated`, MikroORM wants `id serial`. |
| Foreign key `xId` → parent | `@ManyToOne({ entity: () => Parent, fieldName: 'xId', ref: true, deferMode: DeferMode.INITIALLY_IMMEDIATE, updateRule: 'no action', deleteRule: 'no action' })` as `Ref<Parent>`, raw id through `.id`. Every foreign key is `DEFERRABLE` with the default actions. Reference the target as `() => Parent`, never through `import type`. |
| Composite primary keys (`AsicFamilyTypeBlockList`, `ProbeCardFamilyType`, `SvtTestTypeDUTTypeList`, `SvtTestListToEntityName`) | `primary: true` on both properties (relation or enum), plus `[PrimaryKeyProp]?: ['a', 'b']`. |
| `varchar(n)`, `text` | `@Property({ type: 'string', length: n })`, `@Property({ type: 'text' })`. The two `configBody` columns are `lazy: true`: lists never load them, and the string is stored and returned verbatim. |
| Native enum (`main."wpGeneralLocation"`, …) | `@Enum({ nativeEnumName: '<type>', items: SVT_DB_ENUM_VALUES.<type> })`, TypeScript type `string` (§4). |
| `json` (`WaferTypeMap.waferMap`, `Equipment.specification`, `WaferProbeProject.local2GlobalMap`) | `@Property({ type: SvtDbJsonTextType, columnType: 'json' })`, a `string`. `SvtDbJsonTextType` (`src/db/data/common`) reads the column with `::text` and writes the string as sent, so the stored text comes back byte for byte (R-7). The handlers check that a written string is valid JSON. MikroORM's `type: 'json'` would parse and re-serialise it, and without `columnType` it wants `jsonb`. |
| `date` | `@Property({ type: 'date', nullable: true, defaultRaw: 'CURRENT_DATE' })`, a `YYYY-MM-DD` string, the wire format as it is. |
| `timestamp without time zone` (`SvtTestList`) | `@Property({ type: 'datetime', columnType: 'timestamp' })` (`createdAt` with `defaultRaw: 'CURRENT_TIMESTAMP'`); `forceUtcTimezone: true` in the options. The wire format is ISO 8601 UTC (R-6, [01 §6.8](01-behaviour-decisions.md#68-svt-tests)). |
| `boolean DEFAULT true` | `@Property({ type: 'boolean', default: true })`. |
| CHECK (`SvtUser_login_check`) | `@Check({ name, expression })` on the class. The schema diff compares the expression, so a different one shows as a change. |
| UNIQUE | `unique: true` on the property; several columns: `@Unique({ properties })` on the class. The two indexes the schema created with `CREATE UNIQUE INDEX` keep their names: `@Unique({ name: 'SvtTestTemplate_dutType_testTypeConfigId_idx', … })`, `SvtTestTypeConfig_testTypeId_name_idx`. |
| Reply fields that are no column (`Asic.chipId`, `Chip.familyType`, `SvtTestTemplate.testTypeId`) and the scalar "relations" the C++ merges (`defaultConfigId`, `dutEntityName`, `dutId`) | not entity properties: the repository computes them, by a populated relation or one query per page, and answers `null` when absent ([01 §1](01-behaviour-decisions.md#1-engine-level), X-5). |

### 3.1 Entity catalogue

The entities, in `src/db/data/<domain>/`, all listed in `SVT_DB_ENTITIES`. The columns of each table are in
[database-schema.md](database-schema.md).

| Entity (class) | Table | Key | Relations and notes |
|---|---|---|---|
| `SvtDbWaferTypeEntity` | `WaferType` | id | name UK, engineeringRun UK (enum), foundry, technology (enums); 1:0..1 `WaferTypeMap` |
| `SvtDbWaferTypeMapEntity` | `WaferTypeMap` | waferTypeId (PK+FK) | `waferMap` json, a string on the wire |
| `SvtDbWaferEntity` | `Wafer` | id | → WaferType; serialNumber UK; 3 nullable dates; generalLocation enum |
| `SvtDbWaferLocationEntity` | `WaferLocation` | id (migration 1) | → Wafer; generalLocation, date, username, note |
| `SvtDbAsicEntity` | `Asic` | id | → Wafer; serialNumber UK; familyType, quality enums; waferMapPosition; reply field `chipId` |
| `SvtDbChipEntity` | `Chip` | id | → Asic; serialNumber UK; generalLocation; reply field `familyType` (from the ASIC) |
| `SvtDbChipLocationEntity` | `ChipLocation` | id (migration 1) | → Chip |
| `SvtDbChipBlockEntity` | `ChipBlock` | id | → Chip; blockType enum; serialNumber UK |
| `SvtDbAsicFamilyTypeBlockListEntity` | `AsicFamilyTypeBlockList` | (asicFamilyType, blockType) | configuration table, maintained by hand (Q7) |
| `SvtDbWpMachineEntity` | `WaferProbeMachine` | id | serialNumber UK, name UK; 5 enums; nullable → Wafer (`loadedWaferId`), → ProbeCard (`installedProbeCardId`); two orientation enums |
| `SvtDbWpWaferLoadedInMachineEntity` | `WaferLoadedInMachine` | id (migration 1) | → Machine, → Wafer; orientation, date, username, status enum |
| `SvtDbWpProbeCardInstalledInMachineEntity` | `ProbeCardInstalledInMachine` | id (migration 1) | → Machine, → ProbeCard; orientation, date, username |
| `SvtDbWpProbeCardEntity` | `ProbeCard` | id | serialNumber UK; name (enum, UK), vendor, model, location, type enums; version, arriveDate, vendorCleaningInterval |
| `SvtDbWpProbeCardFamilyTypeEntity` | `ProbeCardFamilyType` | (probeCardId, asicFamilyType) | → ProbeCard |
| `SvtDbWpProjectEntity` | `WaferProbeProject` | id | → Machine, → WaferType; name UK; `local2GlobalMap` json |
| `SvtDbEquipmentTypeEntity` | `EquipmentType` | id | name UK |
| `SvtDbEquipmentEntity` | `Equipment` | id | → EquipmentType; name UK; `specification` json |
| `SvtDbEquipmentLocationEntity` | `EquipmentLocation` | id (migration 1) | → Equipment |
| `SvtDbSvtTestSetupEntity` | `SvtTestSetup` | id | name, generalLocation nullable |
| `SvtDbSvtTestSetupDefaultConfigEntity` | `SvtTestSetupDefaultConfig` | setupId (PK) | → Setup, nullable → SetupConfig |
| `SvtDbSvtTestSetupConfigEntity` | `SvtTestSetupConfig` | id | → Setup; name UK (global); `configBody` text; createdAt date |
| `SvtDbSvtTestTypeEntity` | `SvtTestType` | id | name UK |
| `SvtDbSvtTestTypeDutTypeEntity` | `SvtTestTypeDUTTypeList` | (dutType, testTypeId) | → TestType |
| `SvtDbSvtTestTypeConfigEntity` | `SvtTestTypeConfig` | id | → TestType; (testTypeId, name) UK; `configBody` text; createdAt date |
| `SvtDbSvtTestTemplateEntity` | `SvtTestTemplate` | id | dutType enum nullable; → TestTypeConfig; isEnabled default true; (dutType, testTypeConfigId) UK; reply field `testTypeId` |
| `SvtDbSvtTestEntity` | `SvtTestList` | id | → TestTypeConfig, → TestSetupConfig; createdAt default now; startedAt, finishedAt, pathToResult, testResultStatus enum |
| `SvtDbSvtTestDutEntityNameEntity` | `SvtTestListToEntityName` | (dutEntityName, testId) | → Test; one row per test in practice |
| `SvtDbSvtTestDutIdEntity` | `SvtTestListToEntityId` | id (migration 1) | → Test; `dutId` without a foreign key (it is polymorphic) |
| `SvtDbUserEntity` | `SvtUser` | id (migration 5) | login UK and `@Check({ name: 'SvtUser_login_check' })`; role enum `userRole`; `passwordHash` lazy (lists never load it); isActive default true; createdAt timestamp default now |

Not mapped: `WaferTypeImage` (no message uses it), `SvtTestSetupEquipList` (nothing reads or writes it until
`GetEquipmentListForTestSetup` is designed, R-1), and `Module`, `ModuleChipList`, `ModuleLocation` (modules are out of
scope, decided 2026-11-08).

## 4. Enums: keep Postgres enums

The UI and the TestAgent depend on `GetAllEnums` reflecting the **live** catalog, and the
operational workflow is "the DB owner runs `ALTER TYPE … ADD VALUE`". Native enums keep that
workflow. The agent reads them from `pg_type` ⋈ `pg_enum` on every request, from the `enumlabel`
rows (the C++ parses `enum_range()` text once, at start).

If the team later wants enum values managed through the UI, that is a new message type and a
migration to lookup tables. The author of the C++ accepts lookup tables (Q29); nothing changes
until a message to manage values exists.

The values the entities declare (`@Enum({ items })`) are a generated snapshot,
`src/db/data/enums/svt-db-enum-values.ts`. The agent serves the live catalogue, so the snapshot only keeps
`schema:update --dump` empty. Regenerate it rather than edit it, from a database that has run the latest migration:
take the `CREATE TYPE … AS ENUM` lines of `pg_dump --schema-only` (or the catalogue query of
[05 §4](05-implementation-notes.md#4-the-data-layer)), keep the declaration order, and update the source and date in
the file's comment. The snapshot of 2026-11-08 came from the prod dump, plus the two dev-only types of migration 1
and the `CANCELLED` value of migration 2. On 2026-11-26 the type `userRole` of migration 5 was added from the
catalogue of a migrated database, which had the same values for every other type.

## 5. Timestamps and history ordering

History tables record `date` at day resolution, and the C++ picks the current location by
`ORDER BY date DESC`. With the surrogate ids of migration 1 (§2) this agent orders by `id`, which
is unambiguous. The author of the C++ does not expect several relocations of one entity on one day
(Q10) and keeps `date` rather than a timestamp by decision (Q32), so the history tables keep `date`.

## 6. Transactions

Every handler runs in one `em.transactional()` block: a failed `CreateWafer` leaves no wafer, no
location row and no ASICs.

## 7. Connection and pool

The agent uses the connection pool of the driver, with its defaults (the C++ has one connection).
Requests can run at the same time; that is safe because ids come from `RETURNING` and writes are
transactional. No `statement_timeout` is set: a slow query can hold a transaction across a Kafka
rebalance.
