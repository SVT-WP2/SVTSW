# e2e testing and the slice-by-slice delivery of phases 3 and 4

**Decision (2026-11-08).** Phases 3 (data layer) and 4 (Kafka handlers) are delivered together, **one
vertical slice at a time**: the entities and repository of a domain, its message handlers, and an e2e
spec that drives every message of the slice against a real PostgreSQL database and asserts the rows.
The first slice (wafer types + enums) and the harness exist; this page is the contract for the rest.

Why: the C++ agent's behaviour is defined per message, and the only proof that a slice behaves is a
test that sends the message and looks at the database, as rentaly's `test-e2e` suite does for its HTTP
API. Building all 34 entities first and all 55 handlers afterwards would postpone that proof to the end.

## 1. The harness

`UI/apps/svt-db-agent-next/test-e2e/` (README there), run with `npm run e2e::db-agent-next`
(`nx test-e2e svt-db-agent-next`, config `apps/svt-db-agent-next/vitest.e2e.config.ts`).

| Piece | What it does |
|---|---|
| `utils/test-setup.ts` `TestSetup` | `init()` boots the real `AppModule` with `@nestjs/testing` against the database of `.env.test` and applies `src/migrations` to it; `clearDatabase()` truncates every table of `main` (identities restarted); `send(message)` hands a request envelope to `SvtDbAgentNextRequestDispatcher` and returns the reply envelope, both after a JSON round trip; `em()` / `query()` for seeding and assertions. |
| `utils/e2e-env.ts` | `setupFiles`: `NODE_ENV=test`, loads the app's `.env.test.local` (git-ignored, personal credentials) then `.env.test`, refuses any database whose name does not end with `_e2e_test`. |
| `vitest.e2e.config.ts` | Node environment, **swc** transform (NestJS needs `design:paramtypes` metadata; esbuild emits none), aliases from `tsconfig.base.json`, sequential files, 30 s timeouts. Specs are `test-e2e/**/*.e2e-spec.ts`, which the unit config's `*.spec.ts` glob never matches. |

Kafka is **not** in the loop: `send()` calls the dispatcher the Kafka controller (phase 4) delegates to,
so a spec covers everything the agent does with a message except the transport. That is deliberate:
the transport is NestJS's `ServerKafka`, the protocol is its own request/reply convention, and a broker
in the test loop would make the suite slow and flaky for no coverage of our code. A broker-backed smoke
test (one message end to end, env-gated like rentaly's live R2 specs) is a later, separate addition.

Database: `localhost:5500`, `postgres`/`postgres`, **`svt_sw_db_e2e_test`** (the compose Postgres of
`Dev/docker-compose.postgres.yml`; create the database once). A developer whose instance differs (e.g. a
native PostgreSQL on 5432) overrides the keys in the git-ignored `.env.test.local`. CI provides the same
through a `postgres:17` service container in `db-agent-next.yml`.

Seeding: no shared fixtures. Each test creates what it needs, through the agent's own messages when a
`Create*` message exists (that also tests the message), otherwise through `setup.em()` or SQL.

## 2. The dispatcher and the handler contract

`apps/svt-db-agent-next/src/modules/dispatch/`:

- `SvtDbAgentNextRequestDispatcher.dispatch(message)` → always a reply `{ type, status, data, error }`
  (`error: { code: 0, message: '' }` on success, `data: null` and `code: -1` on failure). Unknown or
  malformed requests get `BadRequest`; `SvtDbAgentNextRequestError` carries the status a handler chose
  (`badRequest`, `notFound`); a MikroORM unique violation becomes `BadRequest`; anything else becomes
  `UnexpectedError` with a generic message (the real error is logged, never sent).
- Every handler runs inside `RequestContext.create(orm.em, …)`, so repositories inject the global
  `EntityManager` from `@mikro-orm/postgresql` and need no decorators of their own.
- A handlers class is `@Injectable() @SvtDbAgentNextHandlers()` and implements
  `getHandlerDefinitions(): { type, replyType, handle }[]`; the dispatcher discovers every marked
  provider (`DiscoveryService`), so a new domain only adds its class to
  `SvtDbAgentNextHandlersModule`.
- Request `data` is validated by name: `validateRequestData(Dto, data.create, 'data.create')` with the
  contract DTOs of `epic/entities` (`whitelist` + `forbidNonWhitelisted`, so unknown keys are rejected),
  `requireRecord` / `requireInteger` / `optionalIntegerList` for the rest. Enum values are checked
  against the live catalog (`SvtDbEnumsService`), not the generated snapshot.

The Kafka controller of phase 4 becomes one method:
`@MessagePattern(Request) handle(@Payload() message) { return JSON.stringify(await this.dispatcher.dispatch(message)) }`.

## 3. A slice, step by step

1. **Entities** for the domain's tables in `libs/svt-db/data/src/<domain>/`, following
   [03-data-layer.md](03-data-layer.md) (explicit `type`, `generated` identity, `SvtDbNamingStrategy`
   names, FK rules), appended to `SVT_DB_ENTITIES`. `npm run db-next:schema:update:dump` must stay
   "Schema is up-to-date".
2. **Repository** in the same folder (`EntityManager` injected, `em.transactional` for writes, DB-side
   paging and filters), registered in `SvtDbDataModule`.
3. **Handlers** in `apps/svt-db-agent-next/src/modules/handlers/<domain>/`, one class per domain,
   behaviour from `DbAgent/docs/05-request-handlers.md` and the decisions of
   [../01-behaviour-decisions.md](../01-behaviour-decisions.md); reply shapes from the message classes.
4. **e2e spec** `test-e2e/<domain>/<domain>.e2e-spec.ts`: one `describe` per message type; the success
   path, every reply status the handler can produce, and the database rows after each write. Add the
   message types to `dispatch/dispatch.e2e-spec.ts`.
5. Pure domain logic (wafer-map validation, ASIC generation) also gets a unit spec next to it.

Order of slices (dependencies first): wafer types + enums (done) → wafers with location history and ASIC
generation (done) → ASICs (done) → chips + chip blocks (done) → wafer-probe machines, probe cards,
projects (done) → equipment types + equipment (done) → SVT test setups/configs, test types/configs,
templates (done) → SVT tests (done). Modules are **out of scope** (decided 2026-11-08: the UI has no such
concept and the C++ handler was never reachable); their tables stay unmapped.

## 4. Findings from the first slice

- MikroORM 7 + Vitest: unit specs that load decorated classes need explicit `type`s (no metadata);
  the e2e runner needs swc for NestJS injection. Both are in place.
- `json` columns come back parsed (`pg` parses `json`), so `GetWaferTypeMap` returns
  `JSON.stringify(stored)`: same JSON, not byte-identical to the uploaded text (the C++ returned the
  stored text verbatim). No client compares the text.
- `CreateWaferType` validates enum values before inserting (clear `BadRequest` instead of a driver
  error) and tolerates the extra top-level `data.waferMap` key the C++ demanded (D-7).

## 5. Findings from the wafers slice

- `generateAsics` (`libs/svt-db/data/src/wafer-maps`) reproduces the production rows exactly: the unit spec
  regenerates a prod ER2 wafer and compares a digest of all 3421 dies with the fixture in `__fixtures__`
  (generated from the dump), and the e2e spec does the same against the rows `CreateWafer` writes.
- `CreateWafer` is one transaction: wafer, `Location at creation` row and all ASICs (`em.insertMany`); a
  duplicate wafer or ASIC serial number leaves nothing behind (the C++ left partial writes).
- `CreateWafer` requires `generalLocation` (`BadRequest` when `null`): the C++ failed too, on the location
  row's `NOT NULL`, but after inserting the wafer. It also rejects an unknown wafer type or a type without
  a map before writing.
- The location pattern (`appendLocation`, `findLocationHistory` ordered by `id`, the written row becomes the
  current location) is in `SvtDbWafersRepository`; chips, equipment and modules reuse it.
- `UpdateWaferLocation` is validated with an app-local DTO (`SvtDbAgentNextWaferLocationRecordDto`): the
  contract's record DTO has no validators on `note` and `username`, which the whitelist would reject.
- Lists take `data.pager` (`optionalPager`, defaults `limit 20`, `offset 0` when present) and answer
  `{ items, totalCount }` counted database-side; location histories carry `totalCount` too.

## 6. Findings from the ASICs slice

- `GetAllAsics` implements every contract filter: `ids`, `waferId`, `chipId` (Q-H4 fixed: the chip is
  looked up and its ASIC id intersected with `ids`), `familyTypes`, `quality`, and `serialNumber` as a
  **case-insensitive substring** (`ILIKE`, wildcards escaped), the way the contract describes it; the C++
  only did equality.
- `chipId` on every item comes from one extra query per page (`Chip` rows for the page's ASIC ids), not
  from a join; `SvtDbChipEntity` exists for that and is extended by the chips slice.
- Unknown `filter` keys are rejected with the C++ text `Error: <key> is not an allowed filter.`
  (`requireAllowedFilterKeys`), now also on `GetAllWafers` and `GetAllWaferTypes`.
- `CreateAsic` checks `asicFamilyType` and `asicQuality` against the live catalog and the wafer's
  existence before inserting; the reply carries `chipId: null`.

## 7. Findings from the chips + chip blocks slice

- Entities `Chip`, `ChipLocation`, `ChipBlock` and `AsicFamilyTypeBlockList` (composite primary key of two
  enums: `@Enum({ primary: true })` twice plus `[PrimaryKeyProp]`); the schema diff stays empty.
- `GetAllChips` items are the contract's `{ id, serialNumber, generalLocation, familyType }`; `familyType`
  comes from a populated `asic` relation and the `familyTypes` filter is a condition on that relation
  (D-5, Q-H3 fixed). The C++ also sent `asicId`, which the contract's `ChipDto` does not list, so it is not
  sent; the ASIC of a chip is `GetAllAsics { filter: { chipId } }`. An empty `ids` / `familyTypes` list
  means "all", as the contract says (now also in the ASICs repository).
- **One chip per ASIC.** `CreateChip` and `CreateManyChips` reject an ASIC that already has a chip
  (`BadRequest`: `Asic 1 already has a chip (1)`) and an ASIC listed twice in one request. The database has
  no unique constraint on `Chip.asicId` and the C++ did not check, but `Asic.chipId` on the wire is a single
  value, so a second chip would be invisible. New behaviour, to be confirmed by the author.
- `CreateManyChips` is one transaction (chips, location rows, blocks): a duplicate serial number leaves
  nothing behind. The reply lists the chips created, with `totalCount` (R-2, Q-H6); the extra top-level
  `data.items` key the C++ demanded is tolerated (D-8); an empty `items` list succeeds with an empty reply,
  a missing one is a `BadRequest`.
- **Chip blocks are behind `SVT_DB_AGENT_FEATURE_CHIP_BLOCKS`** (default off, `true`/`1` enables). When on,
  a new chip gets one `ChipBlock` row per `AsicFamilyTypeBlockList` entry of its ASIC's family type, named
  `<blockType>_<chipSerialNumber>` (`generateChipBlocks`, the rule of the never-executed C++ code). The three
  dev rows are named differently (`SLDO_AncMPW2-W1_0_0`), hence the flag (Q6). The e2e harness boots the
  application with the flag for `chip-blocks.e2e-spec.ts` (`new TestSetup({ env })`); `chips.e2e-spec.ts`
  covers the default. `GetAllBlocks` (the contract's `GetAllChipBlocks`, never implemented in C++) lists the
  rows with the filters `ids`, `chipId`, `chipBlockTypes`, `serialNumber` (substring) and the pager.
- `UpdateChip` exists in the C++ code only (not in the contract, `01-behaviour-decisions.md` "ask"): not
  implemented until the contract has it.
- Location history: the wafer pattern reused (`appendLocation`, `findLocationHistory`, first row
  `Location at creation`); `SvtDbLocationInput` and that note moved to `libs/svt-db/data/src/common`.

## 8. Findings from the wafer-probe slice (machines, probe cards, projects)

- Entities `WaferProbeMachine`, `ProbeCard`, `ProbeCardFamilyType` (composite key of a relation and an
  enum), `WaferLoadedInMachine`, `ProbeCardInstalledInMachine`, `WaferProbeProject` in
  `libs/svt-db/data/src/wp/`; the schema diff stays empty. Lists take `filter.ids` only (no pager in the
  contract) and answer `{ items, totalCount }`.
- **Machine reply carries the orientations.** The Kafka yaml's `WaferProbeMachineDto` requires
  `loadedWaferOrientation` and `installedProbeCardOrientation` and WPAgent reads them, but the TypeScript
  `EpicWpMachine` of `epic-api-types` does not list them. The agent sends them (typed as
  `SvtDbAgentNextWpMachineWire`); the contract type should gain the two fields.
- **Probe cards carry `asicFamilyTypes`** from `ProbeCardFamilyType` (R-3, Q-H15 fixed), in the enum's
  order; the yaml's `ProbeCardDto` requires it, the TypeScript `EpicWpProbeCard` lacks it. There is no
  message to create a probe card or its family types (`CreateProbeCard` is code-only, decisions §1
  "ask"); the e2e seeds them with SQL (`test-e2e/utils/wp-fixtures.ts`).
- **Wafer swap writes both rows** (X-8 fixed): `UpdateWpMachineLoadedWafer` with a wafer already loaded
  writes `Unloaded` for it (orientation `null`, as the C++ did), then `Loaded` for the new one. Loading
  needs an existing wafer and an orientation; unloading (`loadedWaferId: null`) with nothing loaded is a
  `BadRequest`, as in the C++. The payload is validated with an app-local DTO: the `epic/entities` DTO
  lacks `wpMachineId` and the TypeScript type lacks `loadedWaferOrientation`, which WPAgent sends.
- **Probe-card uninstall works but leaves no history row** (D-13): `installedProbeCardId: null` clears
  the machine's two columns; `ProbeCardInstalledInMachine.probeCardId` is NOT NULL and the table has no
  status column, so the uninstall itself is not recorded until the schema change of
  [02-database-migration.md](../02-database-migration.md) §2 is agreed with the WPAgent team (the C++
  failed the whole request). The install orientation is optional (dev data has `NULL`s).
- `UpdateWaferProbeMachine` validates `data.update` with the contract DTO, whose six fields are all
  required (the C++ accepted any subset); `generalLocation` is updatable here, there is no location
  history for machines.
- `CreateWaferProbeProject`: `local2GlobalMap` must be a string holding valid JSON (R-7: an object is a
  `BadRequest`, the C++ silently stored `NULL`); it is stored in the `json` column and re-serialised in
  replies, so the text may differ in whitespace from what was sent. Machine, wafer type and both enum
  values are checked before the insert.

## 9. Findings from the equipment slice (equipment types, equipment)

- Entities `EquipmentType`, `Equipment` and `EquipmentLocation` in `libs/svt-db/data/src/equipment/`; the
  schema diff stays empty. The location pattern of wafers and chips is reused unchanged (`Location at
  creation` row on create, `appendLocation`, history ordered by `id`).
- `CreateEquipment` is validated with an app-local DTO (`SvtDbAgentNextEquipmentCreateDto`): the Kafka
  yaml's `EquipmentCreateDto` marks `specification` nullable and the C++ accepted `null`, while the
  `epic/entities` DTO requires a string. A string must hold valid JSON (R-7: an object is a `BadRequest`,
  the C++ silently stored `NULL`); `null` is stored as `NULL` and comes back as `null`. The equipment type
  must exist and the location must be an enum value, both checked before the insert.
- `GetAllEquipment` and `GetAllEquipmentTypes` take `filter.ids` only (no pager in the contract) and
  answer `{ items, totalCount }`; `specification` is re-serialised from the `json` column.
- `UpdateEquipment` exists in the C++ code only (not in the contract, decisions §1 "ask"): not
  implemented until the contract has it. `GetEquipmentListForTestSetup` belongs to the test-setup slice
  (its data is `SvtTestSetupEquipList`, R-1 still open).

## 10. Findings from the SVT test-setup slice (setups, setup configs, types, type configs, templates)

- Entities in `libs/svt-db/data/src/svt-test-setups/` (`SvtTestSetup`, `SvtTestSetupConfig`,
  `SvtTestSetupDefaultConfig`) and `svt-test-types/` (`SvtTestType`, `SvtTestTypeDUTTypeList`,
  `SvtTestTypeConfig`, `SvtTestTemplate`); the schema diff stays empty. Two `CREATE UNIQUE INDEX`es need
  their names declared (`@Unique({ name })`): a type config's name is unique **per test type**
  (`SvtTestTypeConfig_testTypeId_name_idx`, while a setup config's name is unique globally) and a template's
  DUT type + configuration pair is unique (`SvtTestTemplate_dutType_testTypeConfigId_idx`).
- **Config bodies round-trip byte for byte.** `configBody` is a `json` column mapped with
  `SvtDbJsonTextType` (`libs/svt-db/data/src/common`): the string is written as is (PostgreSQL's `json`
  keeps the text, `jsonb` would not) and selected with `::text` (`convertToJSValueSQL`), so indentation
  and key order survive, as with the C++. The property is `lazy`: lists never load it, the two
  `Get*ConfigBody` messages populate it. Handlers still `JSON.parse` the text first, so an invalid document
  is a `BadRequest` and an object a validation error (R-7), never a PostgreSQL error.
- `GetAllSvtTestSetups` lists a setup without a default-config row with `defaultConfigId: null` (Q-R2,
  Q-H13: the C++ failed the whole list); `UpdateSvtTestSetup` creates that row when it is missing (Q-U1)
  and rejects a config that does not belong to the setup (new check: a default from another setup makes no
  sense). `CreateSvtTestSetup` is one transaction (setup, config, default row); a duplicate config name
  leaves nothing behind. A missing nested `defaultConfig` / `testTypeConfig` is a `BadRequest`: the contract
  DTOs declare them `@ValidateNested()` without `@IsDefined()`, so the handler checks presence itself.
- `GetAllSvtTestTypes`: the `dutTypes` filter works (D-4, Q-H9 fixed: a type matches when it has any of
  them); a type without DUT types lists `dutTypes: []` (R-4). DUT types come back in the enum's order and
  duplicates in a request are collapsed.
- **`UpdateSvtTestType` takes the contract shape and replaces the list** (D-1): `data.id` +
  `data.update.dutTypes`, and the DUT types become exactly that list (an empty list clears them). The C++
  read `data.testTypeId` / `data.dutTypes` and only appended, which no client sends (the BFF uses the
  contract shape, so the operation never worked end to end). Replace is what a PATCH with the full list
  means for the UI; **to be confirmed by the author** (the decision row asked for add-only vs replace).
- `Get*ConfigBody` with an unknown id is `NotFound` (Q-H20; the C++ replied Success with `entity: {}`).
  `Create*Config` requires the `note` key (may be `null`), as the contract DTO's `@ValidateIf` does; the
  nested config of `CreateSvtTestSetup` / `CreateSvtTestType` may omit it.
- `CreateSvtTestTemplate` honours `isEnabled` (D-12, Q-H17: the C++ dropped it); `testTypeId` on the wire
  comes from the template's configuration; a NULL `isEnabled` (never written by the agent) reads as the
  database default `true`.
- `GetEquipmentListForTestSetup` is still not implemented: it exists in the yaml only (no TypeScript message
  class), its reply shape is open (R-1, Q-H11) and nothing writes `SvtTestSetupEquipList`.

## 11. Findings from the SVT tests slice (`SvtTestList`)

- Entities `SvtTestList`, `SvtTestListToEntityName` (composite key of the enum and the test) and
  `SvtTestListToEntityId` (surrogate `id` from migration 1) in `libs/svt-db/data/src/svt-tests/`; the
  schema diff stays empty with `type: 'datetime', columnType: 'timestamp'` for the three naive timestamps.
- **Every contract filter works** (Q-H12: the C++ had `ids` only): `ids`, `dutEntityNames`, `dutId` (meant
  to be combined with the names), `testResultStatuses`, `testTypeConfigIds`, `testSetupConfigIds` and the
  six timestamp bounds (`From` inclusive, `To` exclusive, ISO 8601; a NULL timestamp never matches). The
  two device filters are resolved through the link tables first and intersected with `ids`; the rest is one
  `findAndCount`. Lists come **newest first** (`id desc`): the UI grid keeps the order it receives and
  documents it as newest first. A test missing a link row lists with `null`s (Q-R2).
- **Timestamps are ISO 8601 UTC on the wire** (R-6: the contract says so, the C++ sent PostgreSQL text).
  Columns are `timestamp without time zone`, read and written as UTC (`forceUtcTimezone`); a client's
  `2026-03-01T10:15:30Z` is stored as `2026-03-01 10:15:30` and comes back as `2026-03-01T10:15:30.000Z`.
  Sub-millisecond precision is lost (JavaScript `Date`).
- `UpdateSvtTestStart` and `UpdateSvtTestFinish` now have message classes and DTOs in `epic/entities`
  (`SvtDbAgentKafkaSvtTests`, `EpicSvtTestStartUpdateDto`, `EpicSvtTestFinishUpdateDto`); nothing in this
  repository sends them yet (TestAgent and SVTSupervisor have no reference). The agent validates
  `testResultStatus` with the contract enum and, as a drift check, against the live database enum, and only
  logs out-of-order transitions (decision: TestAgent drives the state machine).
- **Result status: one vocabulary, decided 2026-11-08.** `EpicSvtTestResultStatus` now mirrors the
  PostgreSQL enum `testResultStatus`: `SUCCESS`, `PARTIAL_SUCCESS`, `FAILURE`, `ERROR` (created by
  migration 1 as on dev; the test agents' run logs use the same words) plus `CANCELLED`, which
  **migration 2** adds for the UI's Cancelled status. The enum's earlier values (`None`, `Completed`,
  `Failed`, `Cancelled`) never existed in any database. A test without a result has
  `testResultStatus: null` (so do `startedAt`, `finishedAt` and `pathToResult` until reached), and `null` in
  the `testResultStatuses` filter selects those tests. The BFF derives the UI status from it (`SUCCESS`,
  `PARTIAL_SUCCESS` → Completed; `FAILURE`, `ERROR` → Failed; `CANCELLED` → Cancelled; `null` → Pending;
  nothing stored resolves to Running yet). The yaml declares the `SvtTestResultStatus` enum component and
  references it from the test DTO, the finish-update DTO and the list filter. The enum snapshot
  `svt-db-enum-values.ts` lists `CANCELLED` too, so the schema diff stays empty once migration 2 has run.
- `CreateSvtTest` checks that the device exists in the table its `dutEntityName` names (ASIC, chip or
  chip block; no foreign key can) and that both configs exist, then writes the test and its two link rows in
  one transaction; `createdAt` comes back from the database default.
