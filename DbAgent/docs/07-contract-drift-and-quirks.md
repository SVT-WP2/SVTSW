# 07. Contract drift and observed quirks

Consolidated list of everything where the contract, the C++ code, the database and the consumers
disagree, and of behaviours observed in the code that are worth confirming with its author. The
**Effect** column is from the point of view of a consumer today: **breaks** (a documented call
fails), **wrong** (succeeds with a wrong result or side effect), **cosmetic**.

## 1. Message types: contract vs code

| Message type | Contract | Code | Consumers calling it | Effect |
|---|---|---|---|---|
| `GetAllChipBlocks` | yes | **no handler** → `Error: Request GetAllChipBlocks not Found` | epic-measure-api (chip-blocks module) | breaks |
| `GetAllModules`, `CreateModule`, `UpdateModuleLocation`, `GetModuleLocationHistory` | yes | no (DTO unfinished, unregistered) | none yet | breaks (future) |
| `UpdateChip`, `UpdateEquipment`, `CreateProbeCard` | **no** | yes, generic | none known | cosmetic; decide whether to adopt into the contract or drop |
| Everything else (48 types) | yes | yes | | |

Also outside this contract: the TestAgent's `db_client.py` sends `GetAllTests`,
`GetAll<Chip>Tests`, `GetAll<Chip>TestConfigurations`, `Create<Chip>Test` to the same topics. None
of these exist in the agent, so those calls can only be answered by its own local fallback. The
`svt.db-agent.kafka(ancASIC).yaml` file describes yet another set (`GetAllTestSetups`,
`CreateSLDOTest`, …) that nothing implements. Three contract documents therefore exist
for one topic pair.

Author (Q36, Q37): `svt.db-agent.kafka.yaml` is the only contract; the ancASIC file is obsolete and
the TestAgent is expected to move to the main contract. The three code-only types are added to the
contract only if a consumer needs them.

## 2. Request shape drift

| Id | Message | Contract says | Code does | Effect |
|---|---|---|---|---|
| D-1 | `UpdateSvtTestType` | `{ id, update: { dutTypes } }` | reads `data.testTypeId`, `data.dutTypes` | breaks with contract shape |
| D-2 | `GetAllEnums` | `data.enumsNames` (typo) | reads `data.enumNames`; UI sends `data.filter.enumNames` | wrong: filter ignored, all enums returned (harmless today) |
| D-3 | `GetAllSvtTests` filters | `ids, dutEntityNames, dutId, testResultStatuses, testTypeConfigIds, testSetupConfigIds, createdAtFrom/To, startedAtFrom/To, finishedAtFrom/To` | only `ids` | breaks for any other filter |
| D-4 | `GetAllSvtTestTypes` filter `dutTypes` | filters by DUT type | no-op (Q-H9) | wrong |
| D-5 | `GetAllChips` filter `familyTypes` | filters by family type | error (Q-H3, by code reading) | breaks |
| D-6 | `GetAllAsics` filter `chipId` | filters by chip | SQL error (Q-H4, by code reading) | breaks |
| D-7 | `CreateWaferType` | `data.create.waferMap` | additionally requires `data.waferMap` to exist (Q-H1) | breaks unless the client sends both |
| D-8 | `CreateManyChips` | `data.create.items` | additionally requires `data.items` to exist (Q-H6) | breaks unless both sent |
| D-9 | `CreateWafer` optional dates | optional | keys must be present, `null` allowed (Q-C3) | breaks if omitted |
| D-10 | `CreateEquipment.specification`, `Create*Config.note`, nested `defaultConfig.note`, `testTypeConfig.note` | nullable/optional | key must be present (Q-C3, Q-H19) | breaks if omitted |
| D-11 | `Update*Location.date` | nullable | key must be present (Q-H7) | breaks if omitted |
| D-12 | `CreateSvtTestTemplate.isEnabled` | honoured | dropped; DB default `true` (Q-H17) | wrong |
| D-13 | `UpdateWpMachineInstalledProbeCard` with `installedProbeCardId: null` | uninstall | fails on NOT NULL (Q-H8b) | breaks |

Author's answers: D-4 — the filter should return the test types associated with the given DUT
type(s) (Q22); D-1 — the intended update shape and replace-vs-add semantics are still open (Q22);
D-13 — a status such as "PC not installed" is the suggested representation (Q14).

## 3. Reply shape drift

| Id | Message | Contract says | Code returns | Effect |
|---|---|---|---|---|
| R-1 | `GetEquipmentListForTestSetup` | `items: EquipmentDto[]` | `items: { equipId, setupId }[]` (Q-H11) | wrong |
| R-2 | `CreateManyChips` | the created chips | **all** chips (≤ 5000) (Q-H6) | wrong |
| R-3 | `GetAllProbeCards` | `asicFamilyTypes: string[]` per card | field absent (Q-H15) | wrong |
| R-4 | `GetAllSvtTestTypes` for a type with no DUT types | `dutTypes: []` | `dutType: []` (Q-R1) | wrong key |
| R-5 | `WaferTypeDto.foundry`, `technology` | `number` | enum label strings | contract typo |
| R-6 | timestamps (`createdAt`, `startedAt`, `finishedAt`) | ISO `2025-06-03T23:59:12.Z` | `2025-06-03 23:59:12.123456` | cosmetic, but clients parse it |
| R-7 | JSON fields (`waferMap`, `configBody`, `specification`, `local2GlobalMap`) | string | string (agrees), but contract wording implies clients may send objects; objects are dropped on insert except for `configBody` | wrong on write |
| R-8 | `status` | may be `NotFound`, `UnexpectedError` | only `Success` / `BadRequest` ever | cosmetic |
| R-9 | `error.message` | message | `[<cpp file>:<line>]\n<message>`, often with the SQL statement | cosmetic / information leak |
| R-10 | `ChipDto` | no `asicId` | includes `asicId` | harmless extra |
| R-11 | `GetAllEnums` names | `chipBlockType`, `moduleType`, `dutEntityName`, `testResultStatus` | DB has `blockType`; the other three are not in the June DB (`testResultStatus` is a varchar) | wrong / schema |
| R-12 | `totalCount` | only on paged lists | on every list except location histories | harmless extra |
| R-13 | list without `pager` and more than 5000 rows | all rows | `items: [], totalCount: 0` (Q-P1) | wrong, silent |
| R-14 | entity key order | n/a | alphabetical | cosmetic |

Author's answers: R-1 — the equipment list is future development and the table is unused (Q19);
R-6 — the timestamps are believed to be UTC, unconfirmed (Q39); R-11 — `chipBlockType` is the name
to keep (Q30).

## 4. Observed behaviours independent of the contract

| Id | Where | What | Effect |
|---|---|---|---|
| X-1 | engine | No transactions; every multi-statement handler can leave partial writes ([04 §7](04-request-engine.md#7-transaction-semantics)). | wrong |
| X-2 | engine | SQL built by string concatenation without escaping (Q-S1): `'` in any value breaks the statement; filter values from clients are injectable. | breaks / security |
| X-3 | engine | New id via `SELECT MAX(id)` after insert (Q-C2): wrong under concurrent writers. | wrong (latent) |
| X-4 | engine | Pagination in memory after fetching all rows and N+1 relation queries ([04 §4.5](04-request-engine.md#45-page)). | performance |
| X-5 | engine | Scalar relations throw on zero rows (Q-R2): one bad row hides a whole list (`GetAllSvtTestSetups`, `GetAllSvtTests`). | breaks |
| X-6 | engine | Booleans dropped on create (Q-C1); `null`/`true`/objects ignored as filters (Q-F1). | wrong |
| X-7 | `CreateChip` | Block generation never runs (Q-H5); wrong table name `Block`. | wrong (feature missing) |
| X-8 | `UpdateWpMachineLoadedWafer` | Swap loses the `Unloaded` history row (Q-H8a). | wrong |
| X-9 | `Update*Location` | "Latest" location chosen by `ORDER BY date DESC` at day resolution; two moves on one day may set the wrong current location (Q-H7). | wrong |
| X-10 | envelope | Non-JSON payload, missing `type`/`data`, or non-string `type` crash the process ([01 §7](01-architecture.md#7-failure-and-recovery-behaviour)). | breaks (availability) |
| X-11 | `GetAllEnums` | Cache never refreshed; naive `enum_range` parsing (Q-H14). | wrong (operational) |
| X-12 | `Get*ConfigBody` | Unknown id → `Success` with `entity: {}` (Q-H20). | wrong |
| X-13 | `UpdateSvtTestSetup` | Relation update without upsert: silently updates 0 rows (Q-U1). | wrong |
| X-14 | reads | `int8` columns decoded through 32-bit `int` ([04 §3](04-request-engine.md#3-reading-rows-from-postgresql)). | latent |
| X-15 | three list queries | Schema `main` hardcoded (Q-H21). | cosmetic |
| X-16 | health | Healthcheck proves Kafka liveness only, not DB connectivity ([01 §8](01-architecture.md#8-heartbeat-and-health-check)). | operational |
| X-17 | `DbModuleDto` | Dead code with copy-pasted request names; would shadow `SvtTestList` handlers if ever registered (Q-H16). | latent |

Author's answers: X-8 — a `Loaded` row implies the unload, so the single row is by design (Q13);
X-9 — several relocations on one day are not expected (Q10).

## 5. Schema drift

See [03 §5](03-database-schema.md#5-where-dump-doc-and-code-disagree) (S1–S16), resolved against
the 2026-11-08 dev and prod dumps. The finding that matters operationally: **prod has not received
the `SvtTestList` changes the code adopted on 2026-09-27** (`createdAt`, `SvtTestListToEntityName`
and `…Id`, the `dutEntityName` and `testResultStatus` enums, the FK on `testSetupConfigId`), while
dev has. The code on `master` cannot serve `GetAllSvtTests` or `CreateSvtTest` against prod's
schema. Prod has no test rows, so nothing is lost yet, but the agent build and the schema deployed
in prod have to move together. Two further dev/prod differences: `configBody` is `json` in prod
and `text` in dev (S10); nothing else differs. Author (Q31, Q27): prod is outdated and
`SVT_DB_Tables_SourceOfTruth.txt` is the schema to deploy, which settles S10 on `text`.

## 6. Who depends on what

| Consumer | Message types | Quirks it is exposed to |
|---|---|---|
| epic-measure-api (UI BFF) | all 55 of the contract | D-2 (sends `filter.enumNames`, works by accident), GetAllChipBlocks (breaks), D-3/D-4/D-5/D-6 if the UI exposes those filters, R-1, R-3, R-6, R-13 |
| WPAgent (`WPDbKafkaClient.py`) | `GetAllWaferProbeProjects`, `GetAllWaferProbeMachines`, `GetAllAsics` (`ids` + pager), `UpdateWpMachineLoadedWafer`, `UpdateWpMachineInstalledProbeCard` | X-8 (history), D-13 (cannot uninstall a probe card) |
| TestAgent (`db_client.py`) | its own names (§1) | nothing it sends is served; it is to move to the contract (Q36) |
| Docker healthcheck | heartbeat topic | X-16 |

The NestJS mock (`UI/apps/epic-db-agent`) implements the **contract**, not the C++ behaviour; it
already differs from production on every row of §2 and §3. Code written against the mock may break
against the real agent, and vice versa.

## 7. What happens with these findings

Decisions on which of these behaviours a re-implementation should preserve or change are kept
outside this folder, in [UI/docs/db-agent-clone](../../UI/docs/db-agent-clone/README.md), and what
the re-implementation actually does is its own contract,
[Documentation/Kafka/svt.db-agent-next.kafka.yaml](../../Documentation/Kafka/svt.db-agent-next.kafka.yaml),
which quotes the ids of this document. This document only records what runs today.
