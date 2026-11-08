# Phase 2: MikroORM setup, migrations baseline, pilot entity

**Goal.** `libs/svt-db/orm` provides a `SvtDbOrmModule` that the app imports with its configuration;
the MikroORM CLI works from the workspace for migrations; migration 0 (production baseline) and
migration 1 (dev layout plus surrogate ids) exist and run against a restored production dump; one
pilot entity (`WaferType` with its `WaferTypeMap`) proves entity → module → query → migration diff
end to end; `/health` reports the database.

**Read first.** [00-context.md](00-context.md) §6, §9, §12. `../02-database-migration.md` (the
migration content). `DbAgent/docs/03-database-schema.md` §1, §5, §6. Rentaly's
`libs/api/db/src/database.module.ts` and `mikro-orm.config.ts` are the pattern to mirror, if that
repository is available; the essentials are reproduced below.

## Paths this phase may touch

- `UI/libs/svt-db/orm/**` (new), `UI/libs/svt-db/data/**` (new, pilot entity only)
- `UI/apps/svt-db-agent-next/**` (module wiring, migrations folder, CLI config, health indicator)
- `UI/package.json` (dependencies, scripts, `mikro-orm` CLI section), `UI/package-lock.json`, `UI/tsconfig.base.json` (aliases)

## Dependencies

Add to `dependencies`: `@mikro-orm/core`, `@mikro-orm/postgresql`, `@mikro-orm/nestjs`,
`@mikro-orm/migrations`, `pg`. Add to `devDependencies`: `@mikro-orm/cli`, `@mikro-orm/reflection`,
`ts-node` (already present), `tsconfig-paths` (already present). Use one MikroORM version for all
`@mikro-orm/*` packages (rentaly uses 6.6.x with `@mikro-orm/nestjs` 6.1.x and NestJS 11; check the
current compatible versions, then pin exact versions as the workspace does). `npm i` must succeed
without `--force`.

## Files to create

```
libs/svt-db/orm/
├── eslint.config.mjs            extends root; forbid imports of @angular/*, @ngrx/*, rxjs, epic-ui/*, epic/*, @env (as epic-api-types does for its layer)
├── project.json                 name svt-db-orm, tags ["svt-db"], targets lint + test (vitest run --dir libs/svt-db/orm)
├── tsconfig.json / tsconfig.lib.json / tsconfig.spec.json   as libs/epic-api-types, with experimentalDecorators + emitDecoratorMetadata
├── package.json                 as libs/epic-api-types
└── src/
    ├── index.ts
    ├── models/
    │   ├── svt-db-orm-config.models.ts      SVT_DB_ORM_CONFIG token; type SvtDbOrmConfig { host, port, user, password, dbName, schema, debug: boolean }
    │   └── index.ts
    ├── services/
    │   ├── svt-db-orm-config.service.ts     @Injectable, returns a copy of the config (rentaly's DatabaseConfigService)
    │   └── index.ts
    ├── svt-db-orm-options.ts                buildSvtDbOrmOptions(config, entities): shared runtime options (see below)
    ├── svt-db-orm.module.ts                 SvtDbOrmModule.forRoot({ useFactory, inject, entities }) and forFeature(entities)
    └── svt-db-orm.module.spec.ts            (unit: buildSvtDbOrmOptions sets schema, naming strategy, driver)

libs/svt-db/data/                            created here with the pilot only; phase 3 fills it
├── eslint.config.mjs, project.json (svt-db-data), tsconfig.*, package.json   as above
└── src/
    ├── index.ts
    ├── enums/
    │   ├── svt-db-enum-values.ts            generated: const SVT_DB_ENUM_VALUES = { engineeringRun: [...], foundryName: [...], waferTech: [...], ... } from the prod dump (03 §6)
    │   └── index.ts
    └── wafer-types/
        ├── svt-db-wafer-type.entity.ts
        ├── svt-db-wafer-type-map.entity.ts
        ├── svt-db-wafer-types.repository.ts  thin wrapper over EntityRepository for list/get (phase 3 defines the common repository shape; keep this minimal)
        └── index.ts

apps/svt-db-agent-next/
├── mikro-orm.config.ts                      CLI config (see below)
└── src/
    ├── migrations/
    │   ├── Migration20261108000000_baseline_prod.ts
    │   └── Migration20261108000001_dev_layout_and_surrogate_ids.ts
    └── modules/health/svt-db-agent-next-health.controller.ts   + MikroOrmHealthIndicator (@nestjs/terminus) → "database"
```

## Runtime options (`buildSvtDbOrmOptions`)

```ts
{
    driver: PostgreSqlDriver,
    host, port, user, password, dbName,
    schema: 'main',
    namingStrategy: EntityCaseNamingStrategy,
    entities,                                   // explicit classes, passed in by the app; no globs
    discovery: { disableDynamicFileAccess: true, warnWhenNoEntities: false },
    forceUtcTimezone: true,
    allowGlobalContext: false,
    registerRequestContext: false,              // MikroOrmModule option: no HTTP middleware; handlers create their own context (phase 4)
    debug: config.debug,
    migrations: { tableName: 'mikro_orm_migrations', path: 'migrations', pathTs: 'src/migrations', snapshot: false },
}
```

`SvtDbOrmModule.forRoot` wraps `MikroOrmModule.forRootAsync` exactly like rentaly's
`DatabaseModule.forRoot` (a `useFactory`/`inject` pair producing `SvtDbOrmConfig`, a config service,
`driver: PostgreSqlDriver`), plus an `entities` argument that the app fills with the full entity
list exported by `svt-db/data`. `forFeature` delegates to `MikroOrmModule.forFeature`.

## CLI config (`apps/svt-db-agent-next/mikro-orm.config.ts`)

Mirrors rentaly's root `mikro-orm.config.ts`: `dotenv` loads `apps/svt-db-agent-next/.env.<NODE_ENV>`,
`defineConfig` from `@mikro-orm/postgresql` with the same connection and `schema: 'main'`,
`namingStrategy: EntityCaseNamingStrategy`, `metadataProvider: TsMorphMetadataProvider`,
`entitiesTs: ['libs/svt-db/data/src/**/*.entity.ts']`, `entities: ['dist/libs/svt-db/data/**/*.entity.js']`,
`migrations: { tableName: 'mikro_orm_migrations', pathTs: 'apps/svt-db-agent-next/src/migrations', path: 'dist/apps/svt-db-agent-next/migrations', snapshot: false }`,
`baseDir: __dirname` adjusted to the workspace root. Register it in `UI/package.json`:

```json
"mikro-orm": { "useTsNode": true, "tsConfigPath": "./tsconfig.base.json", "configPaths": ["./apps/svt-db-agent-next/mikro-orm.config.ts"] }
```

and add scripts: `db-next:migration:create`, `db-next:migration:up`, `db-next:migration:down`,
`db-next:migration:pending`, `db-next:schema:update:dump` (`mikro-orm schema:update --dump --safe`),
each `mikro-orm <command>`.

## Migrations

Both are **raw SQL** (`this.addSql(...)`), as rentaly's first migration. `snapshot: false` so no
snapshot file is generated for them.

**Migration 0, production baseline.** Produce the DDL with
`pg_restore --schema-only --no-owner --no-privileges -f - Dev/db-example/2026-11-08-backup_prod.dump`,
drop the `SET`, `SELECT pg_catalog…` and comment lines, keep `CREATE SCHEMA`, `CREATE TYPE`,
`CREATE TABLE`, identity `ALTER TABLE … ADD GENERATED`, constraints and indexes. Make it
**idempotent**: `CREATE SCHEMA IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, enum types wrapped in
`DO $$ BEGIN CREATE TYPE … ; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`, constraints
wrapped in the same `DO` pattern (`duplicate_object` / `duplicate_table`). It must run to completion
both on an empty database and on a database restored from the prod dump.

**Migration 1, dev layout and surrogate ids.** From `../02-database-migration.md` §2, in this order:

1. `ALTER TABLE main."SvtTestList" RENAME COLUMN "createsAt" TO "createdAt"` (guard with a
   `DO` block checking `information_schema.columns`).
2. Create enums `dutEntityName` (`Asic`, `Chip`, `ChipBlock`) and `testResultStatus` (`SUCCESS`,
   `PARTIAL_SUCCESS`, `FAILURE`, `ERROR`) if absent.
3. Create `SvtTestListToEntityName("testId" int NOT NULL REFERENCES main."SvtTestList"(id) DEFERRABLE, "dutEntityName" main."dutEntityName" NOT NULL, PRIMARY KEY ("dutEntityName","testId"))`
   and `SvtTestListToEntityId("testId" int NOT NULL REFERENCES … DEFERRABLE, "dutId" int NOT NULL)` if absent.
4. `SvtTestList.testSetupConfigId` NOT NULL and FK → `SvtTestSetupConfig(id)` DEFERRABLE (guarded;
   the table is empty in prod); `testResultStatus` → `main."testResultStatus"`
   (`USING "testResultStatus"::main."testResultStatus"`, guarded by current type).
5. Drop `SvtAsicTestList`, `SvtChipTestList`, `SvtChipBlockTestList` **only if empty**
   (`DO` block with a row-count check; otherwise raise).
6. `configBody` columns of `SvtTestSetupConfig` and `SvtTestTypeConfig`: `json` (guarded; converts
   dev's `text` with `USING "configBody"::json`).
7. Add `id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY` to `WaferLocation`, `ChipLocation`,
   `EquipmentLocation`, `ModuleLocation`, `WaferLoadedInMachine`, `ProbeCardInstalledInMachine`,
   `SvtTestListToEntityId` (guarded by column existence).
8. `SvtTestTemplate.testTypeConfigId` NOT NULL (guarded; no NULLs exist in either dump).

Not in this phase (pending answers): probe-card uninstall support, `timestamptz` on history dates.

## Pilot entity

```ts
@Entity({ tableName: 'WaferType' })
export class SvtDbWaferTypeEntity {

    [OptionalProps]?: 'id'

    @PrimaryKey({ autoincrement: true })
    id!: number

    @Property({ length: 50, unique: true })
    name!: string

    @Enum({ nativeEnumName: 'engineeringRun', items: () => SVT_DB_ENUM_VALUES.engineeringRun, unique: true })
    engineeringRun!: string

    @Enum({ nativeEnumName: 'foundryName', items: () => SVT_DB_ENUM_VALUES.foundryName })
    foundry!: string

    @Enum({ nativeEnumName: 'waferTech', items: () => SVT_DB_ENUM_VALUES.waferTech })
    technology!: string

    @OneToOne(() => SvtDbWaferTypeMapEntity, map => map.waferType, { nullable: true })
    map?: SvtDbWaferTypeMapEntity

}
```

`SvtDbWaferTypeMapEntity`: `tableName: 'WaferTypeMap'`, `@OneToOne(() => SvtDbWaferTypeEntity, { primary: true, fieldName: 'waferTypeId', owner: true })`,
`@Property({ type: 'json' }) waferMap!: unknown`. Confirm the generated SQL names
(`"waferTypeId"`, `main."WaferType"`) in the debug log.

## Steps

1. Dependencies, aliases (`svt-db/orm`, `svt-db/data` in `tsconfig.base.json`), lib skeletons.
2. `svt-db/orm`: options builder, module, config models and service; unit test.
3. CLI config and npm scripts; `npm run db-next:migration:pending` connects (fails only on
   "no migrations", not on config).
4. Generate `svt-db-enum-values.ts` from `Dev/db-example/2026-11-08-backup_prod.dump`
   (`pg_restore --schema-only` → the `CREATE TYPE … AS ENUM` lines; preserve order). Add the two
   dev-only enums from migration 1. Keep a comment with the source and date.
5. Pilot entities and repository; export the entity list `SVT_DB_ENTITIES` from `svt-db/data`
   (phase 3 appends to it).
6. Wire `SvtDbOrmModule.forRoot({ useFactory: (c) => c.get('database'), inject: [ConfigService], entities: SVT_DB_ENTITIES })`
   into `AppModule`; health indicator `MikroOrmHealthIndicator.pingCheck('database')`.
7. Migrations 0 and 1 as described; run them.
8. Integration test `libs/svt-db/data/src/wafer-types/svt-db-wafer-types.repository.spec.ts`
   (`// @vitest-environment node`, skipped without `SVT_DB_AGENT_TEST_DB_URL`): init MikroORM with
   the pilot entities, `findAll` WaferType with `populate: ['map']`, expect the ER2 row and a parseable
   map.

## Acceptance criteria

On a database restored from `2026-11-08-backup_prod.dump` (00-context §6):

```bash
cd UI && npm run db-next:migration:up          # applies 0 (no-op on the restored schema) and 1
```

then `npm run db-next:schema:update:dump` prints **no statements for `WaferType` and
`WaferTypeMap`** (statements about tables not yet modelled are expected and ignored in this phase;
if the enum or identity handling produces diffs for the pilot tables, apply the fallbacks in
[00-context.md §12](00-context.md#12-known-pitfalls) until it is clean). On an **empty** database
`npm run db-next:migration:up` succeeds too and produces the same schema.

```bash
cd UI && npm run lint && npx nx build svt-db-agent-next && npm test
cd UI && SVT_DB_AGENT_TEST_DB_URL=postgresql://postgres:postgres@localhost:5500/svt_sw_db npx nx test svt-db-data
```

`npm run start::db-agent-next` then `curl localhost:7676/health` shows `database: { status: 'up' }`;
with a wrong DB password the app logs the error and `/health` reports `down`.

## Ask before…

- changing the migration 1 content beyond what `../02-database-migration.md` lists;
- running any migration against a database that is not local.

## Hand-off to phase 3

Record in the PR: the exact MikroORM versions, whether `@Enum({ nativeEnumName })` or the
`columnType` fallback was needed, whether identity columns diffed cleanly, and the final shape of
`SvtDbOrmModule.forRoot`.

## Outcome (done 2026-11-08)

- Versions: first delivered on MikroORM **6.6.17** / `@mikro-orm/nestjs` 6.1.2, then **upgraded the same
  day to 7.2.8 / 7.1.0** (plus `@mikro-orm/decorators` 7.2.8), `pg` 8.23.1, `dotenv` 16.4.7 (the version
  `@nestjs/config` already ships). What the v7 upgrade changed:
  - MikroORM 7 is ESM-first and needs **Node ≥ 22.17** (`engines` in `UI/package.json`, `NODE_VERSION: '22'`
    in the agent's workflows, `node:22-alpine` image). The CommonJS bundle still works through Node's
    `require(esm)`.
  - Decorators come from `@mikro-orm/decorators/legacy`; `ReflectMetadataProvider` (same package) is set
    explicitly in the runtime options. `connect` and `discovery.disableDynamicFileAccess` are gone
    (connections are always lazy; entities are classes).
  - The app and the `svt-db/*` libs use `module`/`moduleResolution: nodenext` + `skipLibCheck` (the
    legacy `node` resolution cannot see v7's `exports` subpaths, which surfaced as a bogus
    `SqlSchemaGenerator` type error in `MikroOrmModule.forRootAsync`). The rest of the workspace is untouched.
  - `MikroOrmModule.forRootAsync` needs the explicit `driver: PostgreSqlDriver` next to `useFactory`.
  - CLI: `preferTs: true` replaces `useTsNode`; the TypeScript loader is auto-detected (`swc`, via the
    workspace's `@swc-node/register`).
  - Terminus's `MikroOrmHealthIndicator` reports `down` on an idle lazy connection; `/health` uses the app's
    own `SvtDbAgentNextDatabaseHealthIndicator` (`orm.checkConnection()` with a 3 s timeout) instead.
  - The migrations themselves did not change; only MikroORM's `mikro_orm_migrations` table definition
    differs slightly (`NOT NULL`, `timestamp(6)`).
- `@Enum({ nativeEnumName, items })` diffs cleanly against the `main."<type>"` enums; no `columnType`
  fallback needed.
- Identity columns did **not** diff cleanly with `autoincrement: true` alone (MikroORM wanted to re-add
  `id serial`); `generated: 'by default as identity'` on the primary key fixes it. `json` columns need
  `columnType: 'json'` (default would be `jsonb`).
- Constraint names: added `SvtDbNamingStrategy` (`svt-db/orm`) producing PostgreSQL's default
  `_pkey` / `_key` / `_fkey` names, so entities need no explicit constraint names. Relations declare
  `deferMode: INITIALLY_IMMEDIATE` and `no action` rules to match the `DEFERRABLE` FKs.
- Every scalar property declares `type` explicitly: Vitest (esbuild) emits no decorator metadata.
  Database specs use `const describeWithDatabase = url ? describe : describe.skip` (the Angular zone
  setup rejects `describe.skipIf` and the options form).
- `SvtDbOrmModule.forRoot({ useFactory, inject, entities })` → `MikroOrmModule.forRootAsync` with
  `registerRequestContext: false`, `connect: false`, `ensureDatabase: false` (the app boots with the
  database down and `/health` reports it); `forFeature(entities)` delegates to `MikroOrmModule.forFeature`.
- Verified on a private PostgreSQL 17 instance: both migrations apply on the restored prod dump and on an
  empty database, the two resulting schemas are byte-identical (`pg_dump --schema-only`), and
  `schema:update --dump --safe` reports "Schema is up-to-date" on both. `/health` → `database: up`, and
  `503` with `Not connected to database` when the port is wrong.
- Not done here: running the migrations against the **dev server's** database and wiring a migration
  step into the container start (`node main.js` does not migrate). Operations decision for phase 4 / the
  runtime notes.
