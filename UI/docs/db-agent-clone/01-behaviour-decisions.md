# 01. Behaviour decisions: preserve, fix, or ask

Every behaviour of the current agent that a re-implementation has to take a position on. The
behaviour itself is described in [DbAgent/docs](../../../DbAgent/docs/README.md); ids (`Q-…`,
`D-…`, `R-…`, `X-…`, `S…`) refer to the markers there, chiefly
[07-contract-drift-and-quirks.md](../../../DbAgent/docs/07-contract-drift-and-quirks.md).

- **preserve**: reproduce exactly, for compatibility.
- **fix**: implement the contract or the apparent intent instead.
- **ask**: changes a consumer-visible result; the consumer owners decide.

Recommendations are in the last column and are proposals.

## 1. Engine-level

| Topic | Today | Options | Recommendation |
|---|---|---|---|
| Transactions ([X-1](../../../DbAgent/docs/04-request-engine.md#7-transaction-semantics)) | autocommit per statement; multi-step handlers leave partial writes | preserve / one transaction per handler | **fix**: one transaction per handler. No consumer depends on partial writes. |
| SQL literals ([X-2](../../../DbAgent/docs/04-request-engine.md#9-sql-generation-rules)) | string concatenation, no escaping | n/a | **fix**: ORM / bound parameters. Also stops `'` in serial numbers from breaking requests. |
| New ids ([X-3](../../../DbAgent/docs/04-request-engine.md#5-create)) | `SELECT MAX(id)` after INSERT | n/a | **fix**: `RETURNING id` (MikroORM does this). |
| Pagination and relations ([X-4](../../../DbAgent/docs/04-request-engine.md#45-page), R-13) | all rows fetched, N+1 relation queries, in-memory slice, empty list above 5000 rows | preserve the 5000 cap / real `LIMIT OFFSET` + `COUNT` | **fix**; drop the 5000 cap. Unpaged requests still return all rows. |
| Scalar relation with zero rows ([X-5](../../../DbAgent/docs/04-request-engine.md#44-mergerelations)) | exception, whole list fails | throw / `null` | **fix**: `null` for the field. |
| Required-count check ([Q-C3](../../../DbAgent/docs/04-request-engine.md#5-create), D-9, D-10, D-11) | only the number of keys is checked; optional fields must be present | preserve / validate by name | **fix**: DTO validation by name (`class-validator`); optional means optional. Loosening only, no client breaks. |
| Booleans on create ([Q-C1](../../../DbAgent/docs/04-request-engine.md#5-create), D-12) | dropped from INSERT | n/a | **fix**. |
| Null, boolean, object filter values ([Q-F1](../../../DbAgent/docs/04-request-engine.md#43-selectentries--where-generation)) | silently ignored | preserve / reject | **fix**: reject with `BadRequest` (a `null` filter that matches everything is a trap). |
| Empty-array filter | ignored (all rows) | preserve / match nothing | **ask**: the UI may rely on "empty selection = no filter". |
| Relation-table update without row ([Q-U1](../../../DbAgent/docs/04-request-engine.md#6-update), X-13) | updates 0 rows, replies `Success` | preserve / upsert | **fix**: upsert. *Status:* `UpdateSvtTestSetup` creates the default-config row (dev-plan/05 §10). |
| `int8` decoding ([X-14](../../../DbAgent/docs/04-request-engine.md#3-reading-rows-from-postgresql)) | 32-bit | n/a | irrelevant with an ORM; note that JS numbers are safe to 2^53. |
| Entity key order (R-14) | alphabetical | n/a | irrelevant. |

## 2. Envelope and errors

| Topic | Today | Options | Recommendation |
|---|---|---|---|
| Malformed payload ([X-10](../../../DbAgent/docs/01-architecture.md#7-failure-and-recovery-behaviour)) | process exits on non-JSON; missing `type`/`data` undefined; non-string `type` exits | n/a | **fix**: reply `BadRequest` in all cases; never crash on input. |
| Statuses (R-8) | only `Success` / `BadRequest` | preserve / use the contract's four | **fix**: `NotFound` for a missing id, `UnexpectedError` for DB and infrastructure errors, `BadRequest` for validation. Check `processKafkaReplyError()` in `epic-measure-api` maps all four. |
| `error.message` (R-9) | `[file:line]\n` prefix, SQL statements echoed | n/a | **fix**: message only; no source locations, no SQL. Keep the verbatim validation texts from [04 §8](../../../DbAgent/docs/04-request-engine.md#8-errors) where a client may match on them (none known). |
| `error.code` | always `-1` on failure, `0` on success | preserve / define codes | **ask**: define codes in the contract; keep `-1` until then. |
| Reply topic | fixed `svt.db-agent.request.reply`; `kafka_replyTopic` header ignored | preserve / honour header | **preserve** the fixed topic (every client sends the same value anyway); honouring the header is harmless if NestJS does it by default. |
| Required headers | `kafka_correlationId`, `kafka_replyPartition` | n/a | **preserve** (NestJS does the same). |
| Compression | none | none / gzip | **fix**: gzip, as the mock already does. Broker limits are on the compressed batch. |

## 3. Handlers

| Topic | Today | Options | Recommendation |
|---|---|---|---|
| `GetAllChipBlocks`, Module messages (07 §1) | not implemented | n/a | **fix**: implement `GetAllChipBlocks` (the UI calls it). Module: see README open question 3. |
| `UpdateChip`, `UpdateEquipment`, `CreateProbeCard` (07 §1) | code only, not in contract | drop / add to contract | **ask**: add them to the contract; harmless generic operations. |
| `GetAllSvtTests` filters (D-3) | `ids` only | preserve / implement | **fix**: implement all contract filters including the date ranges. |
| `GetAllSvtTestTypes.dutTypes` (D-4, Q-H9) | no-op | n/a | **fix**. *Status:* done, any-match (dev-plan/05 §10). |
| `GetAllChips.familyTypes` (D-5, Q-H3), `GetAllAsics.chipId` (D-6, Q-H4) | error | n/a | **fix**. |
| `CreateWaferType` extra key `data.waferMap` (D-7), `CreateManyChips` extra key `data.items` (D-8) | required | preserve / drop | **fix**: accept the contract shape; tolerate the extra keys. |
| `UpdateSvtTestType` shape (D-1, Q-H10) | `data.testTypeId`, `data.dutTypes` | code shape / contract shape | **ask**: contract shape, after checking no client sends the code shape. Also decide add-only vs replace semantics. *Status:* contract shape (the BFF is the only client and uses it) with **replace** semantics, to be confirmed (dev-plan/05 §10). |
| `GetEquipmentListForTestSetup` reply (R-1, Q-H11) | `(setupId, equipId)` pairs | pairs / `EquipmentDto[]` | **ask**: contract shape; confirm with the UI. Add a message to set a setup's equipment list, which does not exist today. |
| `CreateManyChips` reply (R-2, Q-H6) | all chips | all / created | **fix**: created chips. |
| `asicFamilyTypes` on probe cards (R-3, Q-H15) | absent | omit / read `ProbeCardFamilyType` | **fix**: read it; add a way to write it. *Status:* read (dev-plan/05 §8); no write message in the contract yet. |
| `dutType: []` key on empty relation (R-4, Q-R1) | wrong key | n/a | **fix**: `dutTypes: []`. *Status:* done. |
| Chip block generation ([X-7](../../../DbAgent/docs/05-request-handlers.md#5-chip), Q-H5) | never runs | leave inert / implement the apparent rule | **ask**: the code's rule is `<blockType>_<chipSN>`, but the three existing dev `ChipBlock` rows use `<blockType without family prefix>_<chipSN>` (`SLDO_AncMPW2-W1_0_0`). Confirm the naming and that `AsicFamilyTypeBlockList` is maintained (3 rows in dev, 0 in prod) before enabling it. *Status:* implemented with the code's rule behind `SVT_DB_AGENT_FEATURE_CHIP_BLOCKS` (default off); see dev-plan/05 §7. |
| Machine wafer swap history ([X-8](../../../DbAgent/docs/05-request-handlers.md#7-waferprobemachine), Q-H8a) | one `Loaded` row, no `Unloaded` | preserve / fix | **fix**: `Unloaded` for the old wafer, then `Loaded`. Agree with the WPAgent team. *Status:* implemented (dev-plan/05 §8). |
| Uninstall probe card (D-13, Q-H8b) | fails on `NOT NULL` | preserve / allow | **fix**: needs a schema change (nullable `probeCardId` or a status column, see [02](02-database-migration.md)). Agree with the WPAgent team. *Status:* the uninstall clears the machine's columns and succeeds; no history row until the schema change (dev-plan/05 §8). |
| Current location after `Update*Location` ([X-9](../../../DbAgent/docs/05-request-handlers.md#1-shared-pattern-location-tracked-entities), Q-H7) | newest by `date` (day resolution) | preserve / use the row just inserted | **fix**: the row just written is the current location. Consider `timestamptz` for history dates ([02](02-database-migration.md)). |
| `isEnabled` on `CreateSvtTestTemplate` (D-12, Q-H17) | dropped | n/a | **fix**. *Status:* done. |
| `Get*ConfigBody` unknown id ([X-12](../../../DbAgent/docs/05-request-handlers.md#12-svttestsetupconfig-and-svttesttypeconfig), Q-H20) | `Success` with `entity: {}` | preserve / `NotFound` | **fix**: `NotFound`. *Status:* done. |
| Enum cache ([X-11](../../../DbAgent/docs/05-request-handlers.md#16-enums), Q-H14) | loaded at startup, never refreshed; naive `enum_range` parsing | per-request query / short TTL / startup | **fix**: query `pg_enum` per request (cheap) or cache with a short TTL. Use `enumlabel` rows, not `enum_range` text. |
| `GetAllEnums` request key (D-2) | reads `data.enumNames`; contract `enumsNames`; UI sends `filter.enumNames` | pick one | **ask**: fix the contract typo and accept `filter.enumNames`; keep returning everything when no names are given. |
| Enum names `chipBlockType` vs `blockType` (R-11, S15) | DB says `blockType` | rename DB type / rename in contract | **ask**: one name end to end. Renaming in the contract and UI is cheaper than renaming a DB type. |
| Date and timestamp formats (R-6) | Postgres text (`YYYY-MM-DD`, `YYYY-MM-DD HH:MM:SS.ffffff`) | preserve / ISO 8601 UTC | **ask**: the contract says ISO 8601; the UI parses today's format. Coordinate the switch, or emit ISO and verify the UI's parsing accepts both. *Status:* dates stay `YYYY-MM-DD`; `SvtTestList` timestamps are ISO 8601 UTC (the UI mocks already produce ISO; dev-plan/05 §11). |
| JSON fields on the wire (R-7) | strings; objects silently dropped on write (except `configBody`) | strings / objects | **preserve** strings on the wire for now (WPAgent and the UI expect strings); **fix** by rejecting objects with `BadRequest` instead of dropping them. |
| Location `username` | never written by `Create*` (NULL); written by `Update*Location` | n/a | **preserve**; consider taking the creator's name from the create request later. |
| Test state machine | not enforced | preserve / enforce | **preserve** (TestAgent drives it); log out-of-order transitions. *Status:* done; the `testResultStatus` vocabularies of the database enum and the TypeScript contract disagree (dev-plan/05 §11). |

## 4. Schema-affecting items

Decisions that change the database are listed with their migration consequences in
[02-database-migration.md](02-database-migration.md): surrogate ids on history tables, the
probe-card uninstall, `testResultStatus` as enum or varchar, history `date` resolution, and the
S1–S16 discrepancies.

## 5. Behaviour notes collected while documenting the C++

Observations that are not decisions but matter for the implementation.

- The 16-entity dispatch and the three generic algorithms in
  [04](../../../DbAgent/docs/04-request-engine.md) map one to one onto the mock's structure in
  `apps/epic-db-agent` (one controller `switch`, one service per domain). Replacing the in-memory
  arrays with repositories keeps that structure.
- The verbatim error texts in [04 §8](../../../DbAgent/docs/04-request-engine.md#8-errors) are not
  matched by any known client; they do not need to be reproduced.
- The ASIC generation algorithm in [06 §4](../../../DbAgent/docs/06-wafer-map.md#4-asic-generation-algorithm)
  is the only place where exact reproduction matters down to the string: serial numbers are
  business keys that already exist in the database for every registered wafer.
- Wafer map validation ([06 §3](../../../DbAgent/docs/06-wafer-map.md#3-validation-checkwafertypemap))
  leaves gaps (indices outside `ExistingAsics`, duplicates, out-of-range indices, serial-number
  collisions). Adding those checks is a strict tightening and safe.
- `SvtTestSetupEquipList` and `ProbeCardFamilyType` have no write path today. The clone will need
  messages for them or they stay hand-maintained.
- The contract's `svt.db-agent.kafka(ancASIC).yaml` and the TestAgent's own message names
  (`GetAllTests`, …) are not served by anything. One contract should survive.
