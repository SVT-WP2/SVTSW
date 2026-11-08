# Phase 3: the data layer

**Goal.** `libs/svt-db/data` models every table of [00-context.md §10](00-context.md#10-entity-catalogue),
exposes repositories with the list/get/create/update operations the handlers will need, an
enum-values service that reads `pg_enum`, and the two pieces of pure domain logic (wafer-map
validation, ASIC generation) with unit tests. After this phase `schema:update --dump` against a
migrated database prints nothing.

**Read first.** [00-context.md](00-context.md) §9–§12. `DbAgent/docs/03-database-schema.md` §3
(every column), `04-request-engine.md` §3–§6 (what reads and writes must support),
`06-wafer-map.md` (the algorithms), `../02-database-migration.md` §3 (MikroORM mapping table).
Phase 2's PR description (what worked for enums and identity).

## Paths this phase may touch

- `UI/libs/svt-db/data/**`
- `UI/apps/svt-db-agent-next/src/app/app.module.ts` (entity list only), `UI/apps/svt-db-agent-next/src/migrations/**` (only if a mapping forces a correction; say so in the PR)

## Layout

```
libs/svt-db/data/src/
├── index.ts                      exports everything below + SVT_DB_ENTITIES (all entity classes) + SvtDbDataModule
├── svt-db-data.module.ts         SvtDbDataModule: SvtDbOrmModule.forFeature(SVT_DB_ENTITIES) + all repositories/services as providers and exports
├── common/
│   ├── svt-db-list-query.models.ts        type SvtDbPager { limit, offset }; type SvtDbPage<T> { items: T[], totalCount: number }; type SvtDbListOptions { pager?, orderBy? }
│   ├── svt-db-wire-format.ts              toWireDate(value: string|null), toWireTimestamp(value: Date|null) → ISO 8601 UTC, toWireJson(value) → string; one place for 00-context §11 formats
│   ├── svt-db-base.repository.ts          abstract class with findPage(where, options) → SvtDbPage (findAndCount), findOneById, requireById (throws SvtDbNotFoundError), createAndFlush, updateAndFlush
│   ├── svt-db-errors.ts                   SvtDbNotFoundError, SvtDbValidationError (message + optional field), mapped to statuses by the agent in phase 4
│   └── index.ts
├── enums/
│   ├── svt-db-enum-values.ts              generated (phase 2); items for @Enum
│   ├── svt-db-enum-literals.ts            string-literal unions used by logic: SvtDbAsicQuality, SvtDbWaferInMachineStatus, SvtDbDutEntityName, SvtDbWaferMapOrientation
│   ├── svt-db-enums.service.ts            getEnumTypes(): string[]; getEnumValues(type): string[]; getAll(names?): Record<string, string[]>; queries pg_type ⋈ pg_enum for schema main via em.getConnection().execute, ordered by enumsortorder
│   ├── svt-db-enums.service.spec.ts       (db-gated) the 19 prod types are returned; values match SVT_DB_ENUM_VALUES
│   └── index.ts
├── wafer-types/                           entities + repository from phase 2, plus WaferTypeImage
├── wafers/                                Wafer, WaferLocation; repository with location history helpers (see "Location pattern")
├── asics/                                 Asic; repository exposes virtual chipId via a join (QueryBuilder leftJoin Chip) in list and get
├── chips/                                 Chip, ChipLocation, ChipBlock, AsicFamilyTypeBlockList; repository with virtual familyType
├── modules/                               Module, ModuleChipList, ModuleLocation
├── probing/                               WaferProbeMachine, WaferLoadedInMachine, ProbeCardInstalledInMachine, ProbeCard, ProbeCardFamilyType, WaferProbeProject
├── equipment/                             EquipmentType, Equipment, EquipmentLocation
├── test-setups/                           SvtTestSetup, SvtTestSetupEquipList, SvtTestSetupDefaultConfig, SvtTestSetupConfig
├── test-types/                            SvtTestType, SvtTestTypeDUTTypeList, SvtTestTypeConfig, SvtTestTemplate (virtual testTypeId via join)
├── tests/                                 SvtTestList, SvtTestListToEntityName, SvtTestListToEntityId
└── wafer-maps/                            pure functions, no ORM imports
    ├── svt-db-wafer-map.models.ts         the map JSON types (06 §2)
    ├── svt-db-wafer-map-validation.ts     validateWaferMap(text, knownFamilyTypes): { ok: true } | { ok: false, errors: string[] }  (06 §3, plus the gaps listed there as additional checks behind a `strict` flag)
    ├── svt-db-asic-generation.ts          generateAsics(waferId, waferSN, map): SvtDbGeneratedAsic[]  (06 §4, exactly)
    ├── svt-db-wafer-map-validation.spec.ts
    ├── svt-db-asic-generation.spec.ts     fixtures: Configurations/WaferTypeMappings/*.json; expected: 06 §5 worked examples; plus a db-gated test regenerating every wafer of the restored dump and comparing with the Asic rows (12/12 prod wafers must match)
    └── index.ts
```

One folder per domain, each with `entities/`? Keep it flat: `svt-db-<name>.entity.ts`,
`svt-db-<name>.repository.ts`, `index.ts` per folder. Class names as in the catalogue.

## Mapping rules (apply to every entity)

| Schema fact | Entity code |
|---|---|
| imports | decorators (`Entity`, `Property`, `Enum`, `OneToOne`, …) from `@mikro-orm/decorators/legacy`; `OptionalProps`, `PrimaryKeyProp`, `DeferMode`, `Collection`, `Ref` from `@mikro-orm/core`; `EntityRepository`, `MikroORM`, `EntityManager` from `@mikro-orm/postgresql` (MikroORM 7) |
| table | `@Entity({ tableName: 'WaferType' })`; never rely on the class name |
| every scalar property | declares its `type` explicitly (`type: 'integer'`, `'string'`, `'text'`, `'json'`, `'date'`, …): Vitest's esbuild emits no decorator metadata, the webpack bundle and the ts-morph CLI do, and the entities must load under all three (phase 2 finding) |
| `id` identity | `@PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' }) id!: number`, `[OptionalProps]?: 'id' | …defaults…` **after** the decorated fields (member-ordering lint). `generated` is what keeps the schema diff empty against `GENERATED BY DEFAULT AS IDENTITY` columns (phase 2 finding) |
| FK column `xId` → parent | `@ManyToOne(() => Parent, { fieldName: 'xId', deleteRule: 'no action' })` and, when a handler needs the raw id without loading the parent, also `@Property({ persist: false }) get xId(): number { return this.parent.id }` or use `ref: true` wrappers. Keep **one** style across the lib (recommended: `ref: true` and `.id`). |
| composite PK link tables | `@ManyToOne({ primary: true })` on both columns, `[PrimaryKeyProp]?: ['a', 'b']` |
| `varchar(n)` | `@Property({ length: n })` |
| `text` | `@Property({ type: 'text' })` |
| native enum | `@Enum({ nativeEnumName: '<type>', items: SVT_DB_ENUM_VALUES.<type> })`, TS type `string` (or the literal union for the four behaviour-relevant ones); diffs cleanly against the `main."<type>"` types (phase 2 finding) |
| `json` | `@Property({ type: 'json', columnType: 'json' }) value!: unknown` (the wire layer stringifies; without `columnType` MikroORM wants `jsonb`) |
| `date` | `@Property({ type: 'date', nullable, defaultRaw: 'CURRENT_DATE' })` → string `YYYY-MM-DD` |
| `timestamp without time zone` | `@Property({ type: 'Date', columnType: 'timestamp', nullable })`; `createdAt` with `defaultRaw: 'CURRENT_TIMESTAMP'` |
| `boolean DEFAULT true` | `@Property({ default: true })` |
| UNIQUE | `unique: true` on the property; multi-column: `@Unique({ properties: [...] })` on the class. `SvtDbNamingStrategy` produces PostgreSQL's default names (`<table>_<cols>_key`, `_fkey`, `_pkey`), so no explicit names, **except** the two indexes the schema created with `CREATE UNIQUE INDEX` (`SvtTestTemplate_dutType_testTypeConfigId_idx`, `SvtTestTypeConfig_testTypeId_name_idx`): `@Unique({ name: '…_idx', properties })` |
| FK details | `deferMode: DeferMode.INITIALLY_IMMEDIATE, updateRule: 'no action', deleteRule: 'no action'` on every relation (all FKs are `DEFERRABLE` with default actions); the pilot `SvtDbWaferTypeMapEntity` shows the pattern |
| virtual reply fields (`Asic.chipId`, `Chip.familyType`, `SvtTestTemplate.testTypeId`) | **not** entity properties; computed in the repository's list/get queries (`qb.leftJoinAndSelect` or a `@Formula`), returned on the repository's result type |

Verify with `npm run db-next:schema:update:dump` after each domain; the goal is an empty diff.

## Repository contract

Every aggregate repository extends `SvtDbBaseRepository<T>` and adds the domain queries phase 4
needs. Keep them **thin and explicit**; business rules live in phase 4's services except the pure
functions in `wafer-maps/`.

| Repository | Beyond the base |
|---|---|
| `SvtDbWaferTypesRepository` | `findWithMap(id)`; `createWithMap(data, mapText)` in one transaction |
| `SvtDbWafersRepository` | location helpers (below); `findPage` with `ids` |
| `SvtDbAsicsRepository` | `findPage(filter: { ids, waferId, chipId, serialNumber, familyTypes, quality }, pager)` with the LEFT JOIN to Chip for `chipId`; `insertMany(asics)` for wafer creation (one `INSERT … VALUES` batch, inside the caller's transaction) |
| `SvtDbChipsRepository` | `findPage(filter: { ids, generalLocation, serialNumber, familyTypes })` with the join to Asic for `familyType`; location helpers |
| `SvtDbChipBlocksRepository` | `findPage(filter: { ids, chipId, chipBlockTypes, serialNumber })`; `findBlockTypesForFamily(familyType)` |
| `SvtDbWaferProbeMachinesRepository` | `findPage({ ids })`; `recordWaferLoaded(machineId, waferId, orientation, status)`; `recordProbeCardInstalled(...)` |
| `SvtDbProbeCardsRepository` | `findPage({ ids })` with `asicFamilyTypes: string[]` populated |
| `SvtDbWaferProbeProjectsRepository` | `findPage({ ids })` |
| `SvtDbEquipmentRepository`, `SvtDbEquipmentTypesRepository` | `findPage({ ids })`; location helpers on equipment |
| `SvtDbTestSetupsRepository` | `findPage({ ids })` with `defaultConfigId: number | null` from `SvtTestSetupDefaultConfig`; `setDefaultConfig(setupId, configId)` (upsert); `findEquipment(setupId)` returning equipment rows |
| `SvtDbTestSetupConfigsRepository`, `SvtDbTestTypeConfigsRepository` | `findPage({ ids, setupId | testTypeId })` **without** `configBody`; `findBody(id)` |
| `SvtDbTestTypesRepository` | `findPage({ ids, dutTypes })` with `dutTypes: string[]` populated; `addDutTypes(id, dutTypes)`; `replaceDutTypes(id, dutTypes)` |
| `SvtDbTestTemplatesRepository` | `findPage({ ids, dutTypes })` with virtual `testTypeId` |
| `SvtDbTestsRepository` | `findPage(filter)` with every contract filter: `ids`, `dutEntityNames`, `dutId`, `testResultStatuses`, `testTypeConfigIds`, `testSetupConfigIds`, `createdAtFrom/To`, `startedAtFrom/To`, `finishedAtFrom/To` (from inclusive, to exclusive); `dutEntityName` and `dutId` joined as scalars (`null` when absent) |

**Location pattern** (wafers, chips, equipment, modules), one mixin or helper used by all four:
`appendLocation(entityId, { generalLocation, date?, username, note })` inserts the history row and
sets the parent's `generalLocation` to **that** row's value (not "newest by date", decision in
`../01-behaviour-decisions.md` §3); `createWithInitialLocation(data)` inserts the parent and a
history row with note `Location at creation`; `findLocationHistory(entityId)` ordered by `id`.
All inside the caller's transaction.

## Enum values service

Reads live from the catalog, no cache:

```sql
SELECT t.typname AS type, e.enumlabel AS value
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = $1 ORDER BY t.typname, e.enumsortorder
```

`getAll(names?)` returns `{ [type]: values[] }` for the requested names (unknown name → `[]`), or
every type when `names` is empty or absent.

## Pure domain logic

Port `DbAgent/docs/06-wafer-map.md` §3 and §4 **literally**; the serial-number and position rules
are business keys that already exist in production. The generation spec must assert the two worked
examples in 06 §5 and, when a database is available, regenerate every wafer of the restored prod
dump and compare the full set of `(serialNumber, waferMapPosition, familyType, quality)` with the
`Asic` rows: 12 of 12 wafers must match (the C++ output was verified this way). Validation keeps
the eight documented rules and their messages; the additional checks (indices outside
`ExistingAsics`, duplicates, out-of-range, serial-number collisions) run only when `strict` is
true, so the agent can enable them later without changing behaviour now.

## Tests

- Unit: `wafer-maps/*.spec.ts` (fixtures from `Configurations/WaferTypeMappings`), `svt-db-wire-format.spec.ts`,
  repository filter-to-query builders where they are pure.
- DB-gated (`SVT_DB_AGENT_TEST_DB_URL`): one spec per domain that loads one page of each entity
  from the restored dump without error and spot-checks a known row (prod: wafer type `ER2`,
  wafer `HS02695-15C6` with 3421 ASICs, probe card `MVP251669H`, machine `WPMIT`); the enums
  service spec; the regeneration spec.

## Acceptance criteria

```bash
cd UI && npm run lint && npm test && npx nx build svt-db-agent-next
cd UI && npm run db-next:schema:update:dump        # against the migrated prod dump: prints no statements
cd UI && SVT_DB_AGENT_TEST_DB_URL=postgresql://postgres:postgres@localhost:5500/svt_sw_db npx nx test svt-db-data
```

The last command runs the DB-gated specs including the 12-of-12 regeneration. `SVT_DB_ENTITIES`
contains every class of the catalogue; `SvtDbDataModule` is imported by `AppModule` and the app
still boots and reports `database: up`.

## Ask before…

- adding a column or table that the catalogue does not list;
- changing a wire format in `svt-db-wire-format.ts`.

## Hand-off to phase 4

Record in the PR: the final repository method list per aggregate, any catalogue correction, and
the result of the regeneration test.
