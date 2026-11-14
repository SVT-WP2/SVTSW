# 01. Behaviour decisions: preserve, fix, or ask

Every behaviour of the current agent that a re-implementation has to take a position on. The
behaviour itself is described in [DbAgent/docs](../../DbAgent/docs/README.md); ids (`Q-…`,
`D-…`, `R-…`, `X-…`, `S…`) refer to the markers there, chiefly
[07-contract-drift-and-quirks.md](../../DbAgent/docs/07-contract-drift-and-quirks.md).

- **preserve**: reproduce exactly, for compatibility.
- **fix**: implement the contract or the apparent intent instead.
- **ask**: changes a consumer-visible result; the consumer owners decide.

Recommendations are in the last column and are proposals.

On 2026-11-08 the C++ author answered
[DbAgent/docs/08-questions-for-the-author.md](../../DbAgent/docs/08-questions-for-the-author.md)
(branch `370-db-documentation`, commit `1bf4153a`; carried into the rest of `DbAgent/docs` on that
branch on 2026-11-12). The rows an answer touches cite it as *Author (Qn)* and were updated on
2026-11-12.

## 1. Engine-level

| Topic | Today | Options | Recommendation |
|---|---|---|---|
| Transactions ([X-1](../../DbAgent/docs/04-request-engine.md#7-transaction-semantics)) | autocommit per statement; multi-step handlers leave partial writes | preserve / one transaction per handler | **fix**: one transaction per handler. No consumer depends on partial writes. |
| SQL literals ([X-2](../../DbAgent/docs/04-request-engine.md#9-sql-generation-rules)) | string concatenation, no escaping | n/a | **fix**: ORM / bound parameters. Also stops `'` in serial numbers from breaking requests. |
| New ids ([X-3](../../DbAgent/docs/04-request-engine.md#5-create)) | `SELECT MAX(id)` after INSERT | n/a | **fix**: `RETURNING id` (MikroORM does this). |
| Pagination and relations ([X-4](../../DbAgent/docs/04-request-engine.md#45-page), R-13) | all rows fetched, N+1 relation queries, in-memory slice, empty list above 5000 rows | preserve the 5000 cap / real `LIMIT OFFSET` + `COUNT` | **fix**; drop the 5000 cap. Unpaged requests still return all rows. |
| Scalar relation with zero rows ([X-5](../../DbAgent/docs/04-request-engine.md#44-mergerelations)) | exception, whole list fails | throw / `null` | **fix**: `null` for the field. |
| Required-count check ([Q-C3](../../DbAgent/docs/04-request-engine.md#5-create), D-9, D-10, D-11) | only the number of keys is checked; optional fields must be present | preserve / validate by name | **fix**: DTO validation by name (`class-validator`); optional means optional. Loosening only, no client breaks. |
| Booleans on create ([Q-C1](../../DbAgent/docs/04-request-engine.md#5-create), D-12) | dropped from INSERT | n/a | **fix**. |
| Null, boolean, object filter values ([Q-F1](../../DbAgent/docs/04-request-engine.md#43-selectentries--where-generation)) | silently ignored | preserve / reject | **fix**: reject with `BadRequest` (a `null` filter that matches everything is a trap). |
| Empty-array filter | ignored (all rows) | preserve / match nothing | **ask**: the UI may rely on "empty selection = no filter". |
| Relation-table update without row ([Q-U1](../../DbAgent/docs/04-request-engine.md#6-update), X-13) | updates 0 rows, replies `Success` | preserve / upsert | **fix**: upsert. *Status:* `UpdateSvtTestSetup` creates the default-config row (§6.7). |
| `int8` decoding ([X-14](../../DbAgent/docs/04-request-engine.md#3-reading-rows-from-postgresql)) | 32-bit | n/a | irrelevant with an ORM; note that JS numbers are safe to 2^53. |
| Entity key order (R-14) | alphabetical | n/a | irrelevant. |

## 2. Envelope and errors

| Topic | Today | Options | Recommendation |
|---|---|---|---|
| Malformed payload ([X-10](../../DbAgent/docs/01-architecture.md#7-failure-and-recovery-behaviour)) | process exits on non-JSON; missing `type`/`data` undefined; non-string `type` exits | n/a | **fix**: reply `BadRequest` in all cases; never crash on input. |
| Statuses (R-8) | only `Success` / `BadRequest` | preserve / use the contract's four | **fix**: `NotFound` for a missing id, `UnexpectedError` for DB and infrastructure errors, `BadRequest` for validation. Check `processKafkaReplyError()` in `epic-measure-api` maps all four. |
| `error.message` (R-9) | `[file:line]\n` prefix, SQL statements echoed | n/a | **fix**: message only; no source locations, no SQL. Keep the verbatim validation texts from [04 §8](../../DbAgent/docs/04-request-engine.md#8-errors) where a client may match on them (none known). |
| `error.code` | always `-1` on failure, `0` on success | preserve / define codes | **ask**: define codes in the contract; keep `-1` until then. |
| Reply topic | fixed `svt.db-agent.request.reply`; `kafka_replyTopic` header ignored | preserve / honour header | **preserve** the fixed topic (every client sends the same value anyway); honouring the header is harmless if NestJS does it by default. |
| Required headers | `kafka_correlationId`, `kafka_replyPartition` | n/a | **preserve** (NestJS does the same). |
| Compression | none | none / gzip | **fix**: gzip, as the mock already does. Broker limits are on the compressed batch. |

## 3. Handlers

| Topic | Today | Options | Recommendation |
|---|---|---|---|
| `GetAllChipBlocks`, Module messages (07 §1) | not implemented | n/a | **fix**: implement `GetAllChipBlocks` (the UI calls it). Module: see README open question 3. |
| `UpdateChip`, `UpdateEquipment`, `CreateProbeCard` (07 §1) | code only, not in contract | drop / add to contract | **decided** (Author Q37: add them to the contract only if a consumer uses them; none does): not implemented, not in the contract, added on demand. No longer an open item (2026-11-12). |
| `GetAllSvtTests` filters (D-3) | `ids` only | preserve / implement | **fix**: implement all contract filters including the date ranges. |
| `GetAllSvtTestTypes.dutTypes` (D-4, Q-H9) | no-op | n/a | **fix**. *Status:* done, any-match (§6.7); Author (Q22) confirms: a test type matches when it is associated with any of the given DUT types. |
| `GetAllChips.familyTypes` (D-5, Q-H3), `GetAllAsics.chipId` (D-6, Q-H4) | error | n/a | **fix**. |
| `CreateWaferType` extra key `data.waferMap` (D-7), `CreateManyChips` extra key `data.items` (D-8) | required | preserve / drop | **fix**: accept the contract shape; tolerate the extra keys. |
| `UpdateSvtTestType` shape (D-1, Q-H10) | `data.testTypeId`, `data.dutTypes` | code shape / contract shape | **ask**: contract shape, after checking no client sends the code shape. Also decide add-only vs replace semantics. *Status:* contract shape (the BFF is the only client and uses it) with **replace** semantics, to be confirmed (§6.7). Author (Q22) answered the filter semantics only; the request shape and add-only vs replace stay open. |
| `GetEquipmentListForTestSetup` reply (R-1, Q-H11) | `(setupId, equipId)` pairs | pairs / `EquipmentDto[]` | **defer** (Author Q19: `SvtTestSetupEquipList` is not populated, future development): not implemented in the clone (the yaml has the message, the TypeScript contract does not). When the feature is designed, answer the contract shape (`EquipmentDto[]`) and add a message to set the list. |
| `CreateManyChips` reply (R-2, Q-H6) | all chips | all / created | **fix**: created chips. |
| `asicFamilyTypes` on probe cards (R-3, Q-H15) | absent | omit / read `ProbeCardFamilyType` | **fix**: read it; add a way to write it. *Status:* read (§6.5); no write message in the contract yet. |
| `dutType: []` key on empty relation (R-4, Q-R1) | wrong key | n/a | **fix**: `dutTypes: []`. *Status:* done. |
| Chip block generation ([X-7](../../DbAgent/docs/05-request-handlers.md#5-chip), Q-H5) | never runs | leave inert / implement the apparent rule | **ask**: the code's rule is `<blockType>_<chipSN>`, but the three existing dev `ChipBlock` rows use `<blockType without family prefix>_<chipSN>` (`SLDO_AncMPW2-W1_0_0`). Confirm the naming and that `AsicFamilyTypeBlockList` is maintained (3 rows in dev, 0 in prod) before enabling it. *Status:* implemented with the code's rule behind `SVT_DB_AGENT_FEATURE_CHIP_BLOCKS` (default off); see §6.4. Author (Q6): the dev rows were test data and no naming is defined yet; a future user defines it, and the flag stays off until then. Author (Q7): the developer user maintains `AsicFamilyTypeBlockList` by hand. |
| Machine wafer swap history ([X-8](../../DbAgent/docs/05-request-handlers.md#7-waferprobemachine), Q-H8a) | one `Loaded` row, no `Unloaded` | preserve / fix | **preserve** (Author Q13: in a swap the `Loaded` row implies that the previous wafer was unloaded; one row by design). An `Unloaded` row is written only on an explicit unload (`loadedWaferId: null`). *Status:* the clone wrote `Unloaded` + `Loaded` on a swap until 2026-11-12; now one `Loaded` row, as the C++. The explicit row comes back only if the WPAgent team asks for it. |
| Uninstall probe card (D-13, Q-H8b) | fails on `NOT NULL` | preserve / allow | **fix**: needs a schema change; Author (Q14) suggests a status such as "PC not installed" on the history table rather than a nullable `probeCardId` (see [02](02-database-migration.md)). Agree the column with the WPAgent team. *Status:* the uninstall clears the machine's columns and succeeds; no history row until the schema change (§6.5). |
| Current location after `Update*Location` ([X-9](../../DbAgent/docs/05-request-handlers.md#1-shared-pattern-location-tracked-entities), Q-H7) | newest by `date` (day resolution) | preserve / use the row just inserted | **fix**: the row just written is the current location. Author (Q10): several relocations of one entity on one day are not expected, and (Q32) history keeps `date` by decision, so `timestamptz` is off the table ([02 §5](02-database-migration.md#5-timestamps-and-history-ordering)). |
| `isEnabled` on `CreateSvtTestTemplate` (D-12, Q-H17) | dropped | n/a | **fix**. *Status:* done. |
| `Get*ConfigBody` unknown id ([X-12](../../DbAgent/docs/05-request-handlers.md#12-svttestsetupconfig-and-svttesttypeconfig), Q-H20) | `Success` with `entity: {}` | preserve / `NotFound` | **fix**: `NotFound`. *Status:* done. |
| Enum cache ([X-11](../../DbAgent/docs/05-request-handlers.md#16-enums), Q-H14) | loaded at startup, never refreshed; naive `enum_range` parsing | per-request query / short TTL / startup | **fix**: query `pg_enum` per request (cheap) or cache with a short TTL. Use `enumlabel` rows, not `enum_range` text. Author (Q29): a lookup table would be acceptable later ([02 §4](02-database-migration.md#4-enums-keep-postgres-enums)). |
| `GetAllEnums` request key (D-2) | reads `data.enumNames`; contract `enumsNames`; UI sends `filter.enumNames` | pick one | **ask**: fix the contract typo and accept `filter.enumNames`; keep returning everything when no names are given. |
| Enum names `chipBlockType` vs `blockType` (R-11, S15) | DB says `blockType` | rename DB type / rename in contract | **fix** (Author Q30: `chipBlockType` survives): the wire name is `chipBlockType` (done for `GetAllChipBlocks`); the DB type `blockType` is to be renamed `chipBlockType`, which also renames the key `GetAllEnums` returns. *Status:* rename migration pending ([02 §2](02-database-migration.md#2-what-migration-1-adds)): the UI (`EpicEnumName.blockType`), the mock agent and the entities still use `blockType`, and all must change in one step. |
| Date and timestamp formats (R-6) | Postgres text (`YYYY-MM-DD`, `YYYY-MM-DD HH:MM:SS.ffffff`) | preserve / ISO 8601 UTC | **ask**: the contract says ISO 8601; the UI parses today's format. Coordinate the switch, or emit ISO and verify the UI's parsing accepts both. *Status:* dates stay `YYYY-MM-DD`; `SvtTestList` timestamps are ISO 8601 UTC (the UI mocks already produce ISO; §6.8). |
| JSON fields on the wire (R-7) | strings; objects silently dropped on write (except `configBody`) | strings / objects | **preserve** strings on the wire for now (WPAgent and the UI expect strings); **fix** by rejecting objects with `BadRequest` instead of dropping them. `configBody` is a `text` column since 2026-11-12 (row below); the clone still accepts only a string holding valid JSON for it. |
| Location `username` | never written by `Create*` (NULL); written by `Update*Location` | n/a | **preserve**; Author (Q11): the user feature is not implemented yet, to be reviewed once the GUI supplies a user. |
| Test state machine | not enforced | preserve / enforce | **preserve** (TestAgent drives it); log out-of-order transitions. *Status:* done. `testResultStatus` is one enum end to end (the database's values plus `CANCELLED` from migration 2, `null` for no result yet; yaml, TypeScript contract, BFF and UI aligned 2026-11-08, §6.8). |
| `configBody` column type (S10, Q27, Q31) | `json` in prod, `text` in dev; the body is opaque | json / text | **fix**: `text`. Author (Q31): `Documentation/DB/DBTables/SVT_DB_Tables_SourceOfTruth.txt` is the authoritative schema and says `text`; prod's `json` is outdated (Q27). Migration 1 converts `json` to `text` (migration 4 for databases migrated earlier); the clone stores and returns the string byte for byte and still requires valid JSON on write. *Status:* done 2026-11-12. |
| `UpdateSvtTestSetup` with a config of another setup (Q20) | only the pointer changes; no ownership check | preserve / reject | **fix** (Author Q20: the default config is what the TestAgent loads for the setup and must belong to it): `BadRequest` when `defaultConfigId` belongs to another setup. *Status:* done; e2e in `test-e2e/svt-test-setups`. |

## 4. Schema-affecting items

Decisions that change the database are listed with their migration consequences in
[02-database-migration.md](02-database-migration.md): surrogate ids on history tables, the
probe-card uninstall, `testResultStatus` as enum or varchar, history `date` resolution, the
`configBody` type (`text`, Q27/Q31), the `blockType` → `chipBlockType` enum rename (Q30, pending)
and the S1–S16 discrepancies.

## 5. Behaviour notes collected while documenting the C++

Observations that are not decisions but matter for the implementation.

- The 16-entity dispatch and the three generic algorithms in
  [04](../../DbAgent/docs/04-request-engine.md) map one to one onto the mock's structure in
  `apps/epic-db-agent` (one controller `switch`, one service per domain). Replacing the in-memory
  arrays with repositories keeps that structure.
- The verbatim error texts in [04 §8](../../DbAgent/docs/04-request-engine.md#8-errors) are not
  matched by any known client; they do not need to be reproduced.
- The ASIC generation algorithm in [06 §4](../../DbAgent/docs/06-wafer-map.md#4-asic-generation-algorithm)
  is the only place where exact reproduction matters down to the string: serial numbers are
  business keys that already exist in the database for every registered wafer.
- Wafer map validation ([06 §3](../../DbAgent/docs/06-wafer-map.md#3-validation-checkwafertypemap))
  leaves gaps (indices outside `ExistingAsics`, duplicates, out-of-range indices, serial-number
  collisions). Adding those checks is a strict tightening and safe.
- `SvtTestSetupEquipList` and `ProbeCardFamilyType` have no write path today. The clone will need
  messages for them or they stay hand-maintained. Author: the equipment list is future development
  and the table is not populated (Q19); probe cards and their family types are entered with psql (Q16).
- The contract's `svt.db-agent.kafka(ancASIC).yaml` and the TestAgent's own message names
  (`GetAllTests`, …) are not served by anything. One contract should survive.

## 6. Decided while implementing, per domain

What the clone settled while each domain was built (2026-11-08 to 2026-11-14), beyond the rows above. Each domain
has its e2e spec under `test-e2e/<domain>/`. Where the C++ answers differently, the parity registry
(`../test-parity/utils/parity-known-differences.ts`) cites the item. Items marked *to be confirmed* still need the
author or a consumer owner. The implementation side is in [06 §7](06-implementation-notes.md#7-notes-per-domain).

All lists take `data.pager` (`limit 20` and `offset 0` when the pager is present; no pager returns every row) and
answer `{ items, totalCount }`, counted in the database. Location histories carry `totalCount` too. Since
2026-11-14 that holds for every list ([03 §5.1](03-parity-testing.md#51-first-run-against-the-c-agent-2026-11-14), row 1).

### 6.1 Wafer types

- `CreateWaferType` checks the enum values before inserting: a clear `BadRequest` instead of a driver error. It
  tolerates the extra top-level `data.waferMap` key the C++ demanded (D-7).
- `GetWaferTypeMap` returns the stored text byte for byte, as the C++ does (since 2026-11-14; until then it was a
  re-serialised copy, [03 §5.1](03-parity-testing.md#51-first-run-against-the-c-agent-2026-11-14), row 2).

### 6.2 Wafers

- `CreateWafer` is one transaction: a duplicate wafer or ASIC serial number leaves nothing behind (the C++ left
  partial writes, X-1).
- `CreateWafer` requires `generalLocation` (`BadRequest` when `null`). The C++ failed too, on the location row's
  `NOT NULL`, but only after inserting the wafer. The clone also rejects an unknown wafer type, or a type without a
  map, before writing.

### 6.3 ASICs

- `GetAllAsics` implements every contract filter:
  - `ids`, `familyTypes` and `quality`;
  - `waferId`;
  - `chipId` (Q-H4: the chip is looked up and its ASIC id intersected with `ids`);
  - `serialNumber` as a **case-insensitive substring** (`ILIKE`, wildcards escaped), as the contract describes it.
    The C++ only did equality.
- Unknown `filter` keys are rejected with the C++ text `Error: <key> is not an allowed filter.`, on `GetAllWafers`
  and `GetAllWaferTypes` as well.
- `CreateAsic` checks `asicFamilyType`, `asicQuality` and the wafer's existence before inserting. The reply carries
  `chipId: null`.

### 6.4 Chips and chip blocks

- `GetAllChips` items are the contract's `{ id, serialNumber, generalLocation, familyType }`, and the `familyTypes`
  filter works (D-5, Q-H3).
  - The C++ also sent `asicId`, which the contract's `ChipDto` does not list (R-10), so the clone does not. The ASIC
    of a chip is `GetAllAsics { filter: { chipId } }`.
  - An empty `ids` or `familyTypes` list means "all", as the contract says (on ASICs too).
- **One chip per ASIC.** `CreateChip` and `CreateManyChips` reject an ASIC that already has a chip (`BadRequest`:
  `Asic 1 already has a chip (1)`), and an ASIC listed twice in one request.
  - The database has no unique constraint on `Chip.asicId` and the C++ did not check. But `Asic.chipId` on the wire
    is a single value, so a second chip would be invisible.
  - Author (Q8): one chip per ASIC in principle; whether the schema enforces it is for the UI and database owners.
    *To be confirmed.*
- `CreateManyChips` is one transaction (chips, location rows, blocks): a duplicate serial number leaves nothing
  behind.
  - The reply lists the chips created, with `totalCount` (R-2, Q-H6).
  - The extra top-level `data.items` key the C++ demanded is tolerated (D-8).
  - An empty `items` list succeeds with an empty reply; a missing one is a `BadRequest`.
- **Chip blocks** (X-7 in §3). When `SVT_DB_AGENT_FEATURE_CHIP_BLOCKS` is on, a new chip gets one `ChipBlock` row
  per `AsicFamilyTypeBlockList` entry of its ASIC's family type, named `<blockType>_<chipSerialNumber>`.
- `GetAllBlocks`, the contract's `GetAllChipBlocks`, was never implemented in the C++. The clone lists the rows with
  the filters `ids`, `chipId`, `chipBlockTypes` and `serialNumber` (substring), and the pager.

### 6.5 Wafer probing (machines, probe cards, projects)

- **The machine reply carries the orientations.** The Kafka yaml's `WaferProbeMachineDto` requires
  `loadedWaferOrientation` and `installedProbeCardOrientation`, and WPAgent reads them. The TypeScript
  `EpicWpMachine` of `svt-ts-types` does not list them, and should gain the two fields.
- **Probe cards carry `asicFamilyTypes`** from `ProbeCardFamilyType` (R-3, Q-H15), in the enum's order. The yaml's
  `ProbeCardDto` requires the field; the TypeScript `EpicWpProbeCard` lacks it. No message creates a probe card or
  its family types (§3, Author Q16: entered with psql).
- **Loading a wafer** (`UpdateWpMachineLoadedWafer`):
  - A swap writes one `Loaded` row (X-8 in §3). `Unloaded`, with orientation `null`, is written only on an explicit
    unload (`loadedWaferId: null`).
  - A load needs an existing wafer and an orientation. Unloading with nothing loaded is a `BadRequest`, as in the
    C++. The C++ accepted a load without an orientation, which is still an open question
    ([03 §5.1](03-parity-testing.md#51-first-run-against-the-c-agent-2026-11-14), row 5).
  - The payload is validated with an app-local DTO, because the old `epic/entities` DTO lacked `wpMachineId` and the
    TypeScript type lacks `loadedWaferOrientation`, which WPAgent sends.
- **Uninstalling a probe card** (`installedProbeCardId: null`) clears the machine's two columns and succeeds, but
  leaves no history row (D-13 in §3). The install orientation is optional (dev data has `NULL`s).
- `UpdateWaferProbeMachine` validates `data.update` with the contract DTO, whose six fields are all required (the
  C++ accepted any subset). `generalLocation` is updatable there; machines have no location history.
- `CreateWaferProbeProject`:
  - `local2GlobalMap` must be a string holding valid JSON (R-7: an object is a `BadRequest`; the C++ silently stored
    `NULL`). It is returned byte for byte (since 2026-11-14).
  - Machine, wafer type and both enum values are checked before the insert.

### 6.6 Equipment

- `CreateEquipment` accepts `specification: null`: the yaml's `EquipmentCreateDto` marks it nullable and the C++
  accepted it. `null` is stored as `NULL` and comes back as `null`.
  - A string must hold valid JSON (R-7) and is returned byte for byte (since 2026-11-14).
  - The equipment type must exist and the location must be an enum value; both are checked before the insert.
- `UpdateEquipment` is not implemented (§3, Author Q37). `GetEquipmentListForTestSetup` is deferred (R-1 in §3).

### 6.7 SVT test setups, test types, templates

- **Config bodies round-trip byte for byte** (`configBody` is `text`, §3). Handlers `JSON.parse` the text first, so
  an invalid document is a `BadRequest` and an object a validation error (R-7).
- **Names.** A setup config's name is unique globally, a type config's name per test type, and a template's
  DUT type + configuration pair is unique. A duplicate is a `BadRequest`.
- **Setups.**
  - `GetAllSvtTestSetups` lists a setup without a default-config row with `defaultConfigId: null` (Q-R2, Q-H13: the
    C++ failed the whole list).
  - `UpdateSvtTestSetup` creates that row when it is missing (Q-U1), and rejects a config of another setup (Q20).
  - `CreateSvtTestSetup` is one transaction (setup, config, default row): a duplicate config name leaves nothing
    behind.
  - A missing nested `defaultConfig` or `testTypeConfig` is a `BadRequest`. The contract DTOs declare them
    `@ValidateNested()` without `@IsDefined()`, so the handler checks presence itself.
- **Test types.**
  - `GetAllSvtTestTypes`: the `dutTypes` filter matches a type that has any of them (D-4, Q22).
  - A type without DUT types lists `dutTypes: []` (R-4). DUT types come back in the enum's order; duplicates in a
    request are collapsed.
  - **`UpdateSvtTestType` takes the contract shape and replaces the list** (D-1): `data.id` + `data.update.dutTypes`,
    and the DUT types become exactly that list (an empty list clears them). The C++ read `data.testTypeId` and
    `data.dutTypes` and only appended, which no client sends (the BFF uses the contract shape, so the operation
    never worked end to end). Replace is what a PATCH with the full list means for the UI. *To be confirmed* by the
    author.
- **Config bodies and configs.**
  - `Get*ConfigBody` with an unknown id is `NotFound` (Q-H20).
  - `Create*Config` requires the `note` key (it may be `null`), as the contract DTO's `@ValidateIf` does. The nested
    config of `CreateSvtTestSetup` and `CreateSvtTestType` may omit it.
- **Templates.** `CreateSvtTestTemplate` honours `isEnabled` (D-12, Q-H17). `testTypeId` on the wire comes from the
  template's configuration. A NULL `isEnabled` (never written by the agent) reads as the database default `true`.

### 6.8 SVT tests

- **Every contract filter works** (D-3, Q-H12; the C++ had `ids` only):
  - `ids`, `testResultStatuses`, `testTypeConfigIds` and `testSetupConfigIds`;
  - `dutEntityNames` and `dutId`, meant to be combined;
  - the six timestamp bounds: `From` inclusive, `To` exclusive, ISO 8601. A NULL timestamp never matches.

  A test missing a link row lists with `null`s (Q-R2).
- **Lists come newest first** (`id desc`): the UI grid keeps the order it receives and documents it as newest
  first. The C++ listed by ascending id.
- **Timestamps are ISO 8601 UTC on the wire** (R-6: the contract says so; the C++ sent PostgreSQL text). The columns
  are `timestamp without time zone`, read and written as UTC: a client's `2026-03-01T10:15:30Z` is stored as
  `2026-03-01 10:15:30` and comes back as `2026-03-01T10:15:30.000Z`. Sub-millisecond precision is lost.
- **`UpdateSvtTestStart` and `UpdateSvtTestFinish`** have message classes and DTOs, but nothing in this repository
  sends them yet (TestAgent and SVTSupervisor have no reference). The agent validates `testResultStatus` with the
  contract enum and, as a drift check, against the live database enum. It only logs out-of-order transitions;
  TestAgent drives the state machine.
- **Result status: one vocabulary, decided 2026-11-08.**
  - The values are the PostgreSQL enum `testResultStatus`: `SUCCESS`, `PARTIAL_SUCCESS`, `FAILURE`, `ERROR` (created
    by migration 1 as on dev; the test agents' run logs use the same words), plus `CANCELLED`, which migration 2 adds
    for the UI's Cancelled status. `EpicSvtTestResultStatus` mirrors them; its earlier values (`None`, `Completed`,
    `Failed`, `Cancelled`) never existed in any database.
  - A test without a result has `testResultStatus: null`, as do `startedAt`, `finishedAt` and `pathToResult` until
    reached. `null` in the `testResultStatuses` filter selects those tests.
  - The BFF derives the UI status: `SUCCESS` and `PARTIAL_SUCCESS` → Completed; `FAILURE` and `ERROR` → Failed;
    `CANCELLED` → Cancelled; `null` → Pending. Nothing stored resolves to Running yet.
  - The yaml declares the `SvtTestResultStatus` enum component and references it from the test DTO, the
    finish-update DTO and the list filter. Author (Q25): the vocabulary and who enforces the order are still open.
- `CreateSvtTest` checks that the device exists in the table its `dutEntityName` names (ASIC, chip or chip block; no
  foreign key can) and that both configs exist. It then writes the test and its two link rows in one transaction;
  `createdAt` comes from the database default. Author (Q24): whether a test can have several DUTs, or none with a
  setup config, is still open.
