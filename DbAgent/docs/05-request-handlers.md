# 05. Request handlers, entity by entity

For each entity: the DTO **declaration** (what the generic engine of [04](04-request-engine.md) is
parameterised with), the **messages** it serves, and the exact algorithm of every handler that is
not the plain generic one. `data` means the `data` object of the request payload.

Quirk ids (`Q-…`) are consolidated in [07](07-contract-drift-and-quirks.md). "Required" has the
meaning of [04 §5](04-request-engine.md#5-create): it only feeds the key-count check.

Message types the code registers that are **not** in the contract are marked ⚠ *code only*.
Contract types with no handler are listed in [07 §1](07-contract-drift-and-quirks.md#1-message-types-contract-vs-code).

---

## 1. Shared pattern: location-tracked entities

`Wafer`, `Chip`, `Equipment` (and the unfinished `Module`) extend a common base that pairs the
entity with a history table `<Entity>Location(<idName>, generalLocation, date, username, note)`.
The history DTO registers all five columns as required and one filter, `<idName>`.

### Create with location

Replaces the generic create for these entities (the entity-specific `Create*` handlers call it).

```ts
function createWithLocation(dto, loc, data): Entry {
    requireKey(data, 'create')
    const body = data.create
    checkRequiredCount(dto, body)                                  // 04 §5.2, relation keys are NOT removed here
    const before = getMaxId(dto.table)
    insertRow(dto, body)                                           // failure → "Failed entry creation <table>"
    const id = getMaxId(dto.table)
    if (id !== before + 1) log.warn(`unexpected new entry id: ${id}, previous id: ${before}`)
    const entity = getById(dto, id)
    insertRow(loc, { [loc.idName]: id, generalLocation: entity.generalLocation, note: 'Location at creation' })
    // username → NULL, date → CURRENT_DATE
    return entity
}
```

### Generic update guard

`Update<Entity>`: if `data.update.generalLocation` is present → throw
`Failed to update entry. update location is not allowed using generic update request`. Otherwise
[04 §6](04-request-engine.md#6-update).

### `Update<Entity>Location`

`data` is the location record itself: `{ <idName>, generalLocation, date, username, note }`.

```ts
function updateLocation(dto, loc, data): EntityReply {
    checkRequiredCount(loc, data)                                  // 5 required → all five keys must be present (Q-H7)
    insertRow(loc, data)                                           // null values are dropped → DB default for date
    const id = data[loc.idName]
    const history = selectEntries(loc, { [loc.idName]: id }, 'date', DESC)   // ORDER BY date DESC, day resolution (Q-H7)
    if (history.length === 0) throw 'Failed to access Wafer location records'  // message says Wafer for every entity
    updateRow(dto, id, { generalLocation: history[0].generalLocation })        // the most recent by DATE, not the row just inserted
    return { entity: getById(dto, id) }
}
```

### `Get<Entity>LocationHistory`

`data.<idName>` → `{ items: selectEntries(loc, { [idName]: id }) }`. No `ORDER BY`, no `totalCount`.
Items have the five history columns; `date` is a `"YYYY-MM-DD"` string.

---

## 2. WaferType

| | |
|---|---|
| Table | `WaferType` |
| Columns | `id`, `name`, `engineeringRun`, `foundry`, `technology` (all required) |
| Filters | `ids` |
| Helper DTO | `WaferTypeMap(waferTypeId, waferMap)`, JSON column `waferMap`, filter `waferTypeId`. **Not** a merged relation. |

| Message | Algorithm |
|---|---|
| `GetAllWaferTypes` | generic list |
| `CreateWaferType` | custom, below |
| `GetWaferTypeMap` | custom, below |

### `CreateWaferType`

```ts
requireKey(data, 'create')
requireKey(data, 'waferMap')                       // Q-H1: data.waferMap must exist (any value); the real map is read from data.create.waferMap
const mapText: string = data.create.waferMap        // must be non-null, must be a JSON *string*
const err = validateWaferMap(mapText)              // 06 §3; throws with the accumulated message
const reply = genericCreate(dto, { create: omitDeep(data.create, 'waferMap') })   // reply { entity } is built here
const waferTypeId = getMaxId('WaferType')
insertRow(waferTypeMapDto, { waferTypeId, waferMap: mapText })                    // failure → "Failed creating the wafer map in the DB" (type row stays)
return reply
```

The reply entity has no `waferMap`. The validation requires the `asicFamilyType` enum cache
(loaded at startup) to contain every family type used in the map.

### `GetWaferTypeMap`

```ts
const waferTypeId = data.waferTypeId ?? -1
if (waferTypeId < 0) throw 'Error. waferTypeId item was not found in request message'
const rows = selectEntries(waferTypeMapDto, { waferTypeId })
if (rows.length === 0) throw 'Failed to access Wafer location records'    // copy-pasted message
if (rows.length > 1) log.warn('More than one wafer type map found …')
return { entity: rows[0] }                                                  // { waferMap: "<json text>", waferTypeId }
```

---

## 3. Wafer

| | |
|---|---|
| Table | `Wafer`, location table `WaferLocation(waferId, …)` |
| Columns | `id`, `batchNumber`, `waferTypeId`, `serialNumber`, `generalLocation`, `thinningDate`, `dicingDate`, `productionDate` (**all required**, so `CreateWafer` needs all seven non-id keys; dates may be `null`, Q-C3) |
| Filters | `ids` |

| Message | Algorithm |
|---|---|
| `GetAllWafers` | generic list (`pager` honoured if sent) |
| `CreateWafer` | create with location, then **generate ASICs**, below |
| `UpdateWafer` | generic update with the location guard |
| `UpdateWaferLocation` | §1 |
| `GetWaferLocationHistory` | §1 |

### `CreateWafer`

```ts
const wafer = createWithLocation(waferDto, waferLocationDto, data)     // §1; every failure throws → BadRequest
const mapText = getWaferTypeMapText(wafer.waferTypeId)                 // §2 GetWaferTypeMap, throws if none
const map = JSON.parse(mapText)
for (const asic of generateAsics(wafer.id, wafer.serialNumber, map))   // 06 §4
    insertRow(asicDto, asic)                                            // one INSERT each, no transaction, first failure → BadRequest
return { entity: wafer }
```

The C++ has a branch for `createWithLocation` returning `false` that would reply `Success` with
`data: null`; it is unreachable because the only non-throwing failure it guards against (missing
`data.create`) throws earlier. Noted for completeness.

---

## 4. Asic

| | |
|---|---|
| Table | `Asic` |
| Columns | `id`, `waferId`, `chipId`⁺, `serialNumber`, `familyType`, `waferMapPosition`, `quality` (required count 5) |
| Filters | `ids`, `waferId`, `chipId`, `serialNumber`, `familyTypes`→`familyType`, `quality` |
| List query | `SELECT T0.*, T1."id" AS "chipId" FROM main."Asic" AS T0 LEFT JOIN main."Chip" AS T1 ON T0."id" = T1."asicId"` (schema hardcoded, Q-H21) |

| Message | Algorithm |
|---|---|
| `GetAllAsics` | generic list over the custom query. Items: `{ chipId (null if not diced), familyType, id, quality, serialNumber, waferId, waferMapPosition }`. |
| `CreateAsic` | generic create (manual ASIC; the UI does not use it) |

**Q-H4** (by code reading): filter `chipId` becomes `T0."chipId" = n`, and `Asic` has no such column
→ SQL error → `Error: getting entries`.

Typical WPAgent call: `{ filter: { ids: [asicId] }, pager: { limit: 1, offset: 0 } }`.

---

## 5. Chip

| | |
|---|---|
| Table | `Chip`, location table `ChipLocation(chipId, …)` |
| Columns | `id`, `asicId`, `asicFamilyType`⁺, `serialNumber`, `generalLocation` (required count 3) |
| Filters | `ids`, `generalLocation`, `serialNumber`, `familyTypes`→`familyType` |
| List query | `SELECT T0.*, T1."familyType" AS "familyType" FROM main."Chip" AS T0 LEFT JOIN main."Asic" AS T1 ON T0."asicId" = T1."id"` |
| Helper DTOs | `AsicFamilyTypeBlockList(asicFamilyType, blockType)` with **no filters declared**; `Block` (sic) `(id, chipId, blockType, serialNumber)` |

| Message | Algorithm |
|---|---|
| `GetAllChips` | generic list over the custom query. Items: `{ asicId, familyType, generalLocation, id, serialNumber }`. |
| `CreateChip` | custom, below |
| `CreateManyChips` | custom, below |
| `UpdateChip` ⚠ *code only* | generic update with the location guard |
| `UpdateChipLocation` | §1 |
| `GetChipLocationHistory` | §1 |

**Q-H3** (by code reading): the `familyTypes` filter maps to column `familyType`, which is not a
registered column (the DTO registered `asicFamilyType`) → `Invalid filter familyTypes, col familyType non found in Table Chip`.

### `CreateChip`

```ts
function createChip(body): Entry {
    const chip = createWithLocation(chipDto, chipLocationDto, { create: body })      // asicId, serialNumber, generalLocation
    const asic = getById(asicDto, body.asicId)
    const blocks = selectEntries(asicFamilyTypeBlockListDto, { asicFamilyType: asic.familyType })
    // Q-H5: the filter is rejected ("Invalid filter: asicFamilyType" is only LOGGED), the call returns
    // failure, `blocks` is empty → no ChipBlock rows are ever created. Intended behaviour below.
    for (const b of blocks)
        insertRow(blockDto, { chipId: chip.id, blockType: b.blockType, serialNumber: `${b.blockType}_${chip.serialNumber}` })
    return chip
}
// handler: requireKey(data,'create'); return { entity: createChip(data.create) }
```

Apparent intended rule, from the code's structure (to be confirmed by the author): for every
`(familyType, blockType)` row in `AsicFamilyTypeBlockList` matching the chip's ASIC family type,
create a `ChipBlock` with serial number `<blockType>_<chipSerialNumber>`.

**Data (dev dump, 2026-11-08):** `AsicFamilyTypeBlockList` has three rows for `AncMPW2`
(`AncMPW2_SLDO`, `AncMPW2_NVBG`, `AncMPW2_CML_TRANSCEIVER`), and the single chip
`AncMPW2-W1_0_0` has three `ChipBlock` rows named `SLDO_AncMPW2-W1_0_0`, `NVBG_AncMPW2-W1_0_0`,
`CML_TRANSCEIVER_AncMPW2-W1_0_0`: the family prefix of the block type is **stripped**. The code has
always built `<blockType>_<chipSN>` (git history of `blockSN`), so these rows were not produced by
this handler. Which naming is intended is a question for the author. Prod has no chips and an
empty block list.

### `CreateManyChips`

```ts
requireKey(data, 'create'); requireKey(data.create, 'generalLocation')
requireKey(data, 'items')                        // Q-H6: data.items must exist; the items are then read from data.create.items
const created: number[] = []
for (const item of data.create.items) created.push(createChip({ ...item, generalLocation: data.create.generalLocation }).id)
return list(chipDto, createdIdsAsArray)          // Q-H6: passes an ARRAY where an object is expected → no filter → ALL chips (≤ 5000)
```

Apparent intent (the unused local `data.filters` variable): reply with the chips just created.

---

## 6. Module (unfinished, not reachable)

Declared: table `Module`, location `ModuleLocation(modId, …)`, columns `id`, `modType`,
`serialNumber`⁺, `generalLocation`; filters `generalLocation`, `serialNumber`, `modTypes`→`modType`;
relation `ModuleChipList(modId, chipId)` as array `chips` with filter `testId` (copy-paste).
Handlers are registered under `GetAllSvtTests`, `CreateSvtTest`, `UpdateSvtTestStart`,
`UpdateSvtTestFinish` (copy-paste) and the DTO is **not added to the dispatcher**, so nothing of
this is live (Q-H16). The contract defines `GetAllModules`, `CreateModule`, `UpdateModuleLocation`,
`GetModuleLocationHistory` with `chips: integer[]`; even if wired, `chips` would not be linked
because the relation inserts look for key `chipId`. The contract also implies a generated
`serialNumber` that no code produces.

---

## 7. WaferProbeMachine

| | |
|---|---|
| Table | `WaferProbeMachine` |
| Columns | `id`, `connectionPort`, `serialNumber`, `name`, `hostName`, `connectionType`, `generalLocation`, `software`, `swVersion`, `vendor` (required, count 9); `loadedWaferId`⁺, `loadedWaferOrientation`⁺, `installedProbeCardId`⁺, `installedProbeCardOrientation`⁺ |
| Filters | `ids` |
| Helper DTOs | `WaferLoadedInMachine(machineId, waferId, waferOrientation*, date, username, status)`, `ProbeCardInstalledInMachine(machineId, probeCardId, probeCardOrientation*, date, username)` — \* registered name; the code inserts `orientation` |

| Message | Algorithm |
|---|---|
| `GetAllWaferProbeMachines` | generic list |
| `CreateWaferProbeMachine` | generic create |
| `UpdateWaferProbeMachine` | generic update (no location guard: `generalLocation` is updatable here) |
| `UpdateWpMachineLoadedWafer` | custom, below |
| `UpdateWpMachineInstalledProbeCard` | custom, below |

### `UpdateWpMachineLoadedWafer`

`data = { wpMachineId, loadedWaferId | null, loadedWaferOrientation | null }`

```ts
if (data.wpMachineId == null) throw 'Mising data, machineId is not a nullable field.'
const machine = getById(machineDto, data.wpMachineId)
const hist = { machineId: data.wpMachineId }
if (data.loadedWaferId == null) {                                        // UNLOAD
    if (machine.loadedWaferId == null) throw 'WARN! No Wafer was loaded in the machine. Ignoring action.'
    insertRow(waferLoadedDto, { ...hist, status: 'Unloaded', waferId: machine.loadedWaferId })
} else {                                                                 // LOAD (or swap)
    if (data.loadedWaferOrientation == null) throw 'ERROR: Mising orientation for the loaded wafer'
    if (machine.loadedWaferId != null) log.warn('Create entry for unloaded action …')
    // Q-H8a: the intended Unloaded row for the previous wafer is overwritten before insert; only ONE row is written:
    insertRow(waferLoadedDto, { ...hist, status: 'Loaded', waferId: data.loadedWaferId, orientation: data.loadedWaferOrientation })
}
return update(machineDto, { id: data.wpMachineId, update: { loadedWaferId: data.loadedWaferId, loadedWaferOrientation: data.loadedWaferOrientation } }, allowNull = true)
```

Apparent intent on swap (from the overwritten assignments): one `Unloaded` row for the old wafer,
then one `Loaded` row for the new.

**Data (2026-11-08):** prod's `WaferLoadedInMachine` has two rows, both `Loaded` (wafer 1 on
2026-05-11, wafer 4 on 2026-10-13) and no `Unloaded` row although the machine's wafer changed;
dev has 14 `Loaded` and one `Unloaded`. Consistent with Q-H8a. `username` is NULL in every row.
`username` is never written (NULL). WPAgent is the caller.

### `UpdateWpMachineInstalledProbeCard`

`data = { wpMachineId, installedProbeCardId | null, installedProbeCardOrientation | null }`

```ts
if (data.wpMachineId == null) throw 'Mising data, machineId is not a nullable field.'
insertRow(pcInstalledDto, { machineId: data.wpMachineId, probeCardId: data.installedProbeCardId, orientation: data.installedProbeCardOrientation })
// Q-H8b: with installedProbeCardId = null the insert omits the NOT NULL column → SQL error → BadRequest. "Uninstall" is impossible today.
return update(machineDto, { id: data.wpMachineId, update: { installedProbeCardId: …, installedProbeCardOrientation: … } }, allowNull = true)
```

No `status` column exists on this history table; it only records installs.

---

## 8. ProbeCard

| | |
|---|---|
| Table | `ProbeCard` |
| Columns | `id`, `version`, `vendorCleaningInterval`, `serialNumber`, `name`, `vendor`, `model`, `arriveDate`, `location`, `type` (required count 9) |
| Filters | `ids` |

| Message | Algorithm |
|---|---|
| `GetAllProbeCards` | generic list. Items lack the contract's `asicFamilyTypes` (Q-H15). |
| `CreateProbeCard` ⚠ *code only* | generic create |

---

## 9. WaferProbeProject

| | |
|---|---|
| Table | `WaferProbeProject` |
| Columns | `id`, `wpMachineId`, `waferTypeId`, `asicFamilyType`, `orientation`, `name`, `alignmentDie`, `homeDie`, `local2GlobalMap` (required count 8) |
| Filters | `ids` |

| Message | Algorithm |
|---|---|
| `GetAllWaferProbeProjects` | generic list; `local2GlobalMap` returned as JSON text |
| `CreateWaferProbeProject` | generic create; `local2GlobalMap` must be sent as a **string**. An object is silently dropped from the INSERT and the (nullable) column is stored as `NULL`. |

---

## 10. Equipment and EquipmentType

| | |
|---|---|
| Tables | `Equipment` (location table `EquipmentLocation(equipmentId, …)`), `EquipmentType` |
| Equipment columns | `id`, `name`, `equipmentTypeId`, `generalLocation`, `specification` (required count 4; `specification` may be `null` but must be present) |
| EquipmentType columns | `id`, `name` |
| Filters | `ids` on both |

| Message | Algorithm |
|---|---|
| `GetAllEquipmentTypes`, `CreateEquipmentType` | generic |
| `GetAllEquipment` | generic list; `specification` as JSON text |
| `CreateEquipment` | create with location (§1). `specification` must be a string. |
| `UpdateEquipment` ⚠ *code only* | generic update with location guard |
| `UpdateEquipmentLocation`, `GetEquipmentLocationHistory` | §1 |

---

## 11. SvtTestSetup

| | |
|---|---|
| Table | `SvtTestSetup` |
| Columns | `id`, `name`, `generalLocation` (required count 2) |
| Filters | `ids` |
| Relations | `SvtTestSetupDefaultConfig(setupId → defaultConfigId)`, **scalar**, merged into every entity as `defaultConfigId` (Q-R2: a setup without this row breaks `GetAllSvtTestSetups`, Q-H13) |
| Helper DTO | `SvtTestSetupEquipList(setupId, equipId)`, filter `setupId`, not merged |

| Message | Algorithm |
|---|---|
| `GetAllSvtTestSetups` | generic list with relation. Items: `{ defaultConfigId, generalLocation, id, name }` |
| `CreateSvtTestSetup` | custom, below |
| `UpdateSvtTestSetup` | relation-table update: `data.id`, `data.update.defaultConfigId` → `UPDATE SvtTestSetupDefaultConfig SET defaultConfigId WHERE setupId = id` (no upsert, Q-U1); reply entity |
| `GetEquipmentListForTestSetup` | `data.setupId` required (`Missing field setupId`) → `{ items: [{ equipId, setupId }, …], totalCount }`. **Q-H11**: the contract promises `EquipmentDto` items. |

No message adds equipment to a setup; `SvtTestSetupEquipList` is populated by hand.

### `CreateSvtTestSetup`

`data.create = { name, generalLocation, defaultConfig: { name, configBody, note } }`

```ts
const body = data.create; if (body == null) throw 'Wrong request message format'
const cfg = body.defaultConfig; delete body.defaultConfig          // recursive delete
const setup = createAndReturn(setupDto, body)                       // required count 2
cfg.setupId = setup.id
const config = createAndReturn(setupConfigDto, cfg)                 // required count 4: setupId, name, note, configBody (note must be present, Q-H19)
addRelationValues(defaultConfigRel, setup.id, config.id)            // inserts the SvtTestSetupDefaultConfig row
return { entity: getById(setupDto, setup.id) }                       // { defaultConfigId, generalLocation, id, name }
```

---

## 12. SvtTestSetupConfig and SvtTestTypeConfig

Identical structure, two tables.

| | SvtTestSetupConfig | SvtTestTypeConfig |
|---|---|---|
| Columns | `id`, `setupId`, `name`, `note`, `configBody` (required, count 4), `createdAt`⁺ | `id`, `testTypeId`, `name`, `note`, `configBody` (required, count 4), `createdAt`⁺ |
| JSON column | `configBody` (objects are stringified with 1-space indentation before insert) | same |
| Excluded from reply | `configBody` | same |
| Filters | `ids`, `setupId` | `ids`, `testTypeId` |
| Body DTO | `(id, configBody)` on the same table, nothing excluded | same |

| Message | Algorithm |
|---|---|
| `GetAllSvtTestSetupConfigs` / `GetAllSvtTestTypeConfigs` | generic list. Items: `{ createdAt: "YYYY-MM-DD", id, name, note, setupId | testTypeId }` |
| `CreateSvtTestSetupConfig` / `CreateSvtTestTypeConfig` | generic create. `note` key must be present (may be `null`). `configBody` string or object. Reply entity without `configBody`. |
| `GetSvtTestSetupConfigBody` / `GetSvtTestTypeConfigBody` | `data.id` (int, required) → `{ entity: { configBody: "<json text>", id } }`; an unknown id yields `{ entity: {} }` with `Success` (Q-H20) |

---

## 13. SvtTestType

| | |
|---|---|
| Table | `SvtTestType` |
| Columns | `id`, `name` (required count 1) |
| Filters | `ids` |
| Relation | `SvtTestTypeDUTTypeList(testTypeId → dutType)` as **array** `dutTypes` (Q-R1: `dutType: []` when empty) |

| Message | Algorithm |
|---|---|
| `GetAllSvtTestTypes` | generic list unless `filter.dutTypes` is present; then **Q-H9**: the code reads `filter.dutType` (singular, absent → null → no WHERE), collects every `testTypeId` in the DUT-type table, and recurses with a malformed payload that ends up applying **no filter**. Net effect: with any DUT-type rows present the reply is all test types; with none, an empty list. The contract's `dutTypes` filter is a no-op. |
| `CreateSvtTestType` | custom, below |
| `UpdateSvtTestType` | **Q-H10**: reads `data.testTypeId` and `data.dutTypes` (the contract says `data.id` and `data.update.dutTypes`); appends missing DUT types (never removes); reply entity. With the contract's shape `data.testTypeId` is null → type error → `BadRequest`. |

### `CreateSvtTestType`

`data.create = { name, dutTypes: string[], testTypeConfig: { name, configBody, note } }`

```ts
const body = data.create; if (body == null) throw 'Wrong request message format'
const cfg = body.testTypeConfig; delete body.testTypeConfig
const type = createAndReturn(typeDto, body)          // body still has dutTypes (array → dropped from INSERT); count 2 ≥ 1
addRelationValues(dutTypesRel, type.id, body.dutTypes)
cfg.testTypeId = type.id
createAndReturn(typeConfigDto, cfg)                  // required count 4 (note must be present)
return { entity: getById(typeDto, type.id) }         // { dutTypes: [...], id, name }
```

---

## 14. SvtTestTemplate

| | |
|---|---|
| Table | `SvtTestTemplate` |
| Columns | `id`, `dutType`, `testTypeConfigId` (required, count 2); `testTypeId`⁺ (virtual, from JOIN), `isEnabled`⁺ |
| Filters | `ids`, `dutTypes`→`dutType` |
| List query | `SELECT T0.id, T0."dutType", T0."testTypeConfigId", T1."testTypeId", T0."isEnabled" FROM main."SvtTestTemplate" AS T0 JOIN main."SvtTestTypeConfig" AS T1 ON T0."testTypeConfigId" = T1.id` |

| Message | Algorithm |
|---|---|
| `GetAllSvtTestTemplates` | generic list over the custom query. Items: `{ dutType, id, isEnabled (bool), testTypeConfigId, testTypeId }` |
| `CreateSvtTestTemplate` | generic create. **Q-H17**: `isEnabled` is a boolean and is dropped from the INSERT (Q-C1), so every new template is enabled regardless of the request. |
| `UpdateSvtTestTemplate` | generic update; `isEnabled` works here (`'true'`/`'false'` literals) |

---

## 15. SvtTest (table `SvtTestList`)

| | |
|---|---|
| Table | `SvtTestList` |
| Columns | `id`, `testTypeConfigId`, `testSetupConfigId` (required, count 2); `createdAt`⁺, `startedAt`⁺, `finishedAt`⁺, `pathToResult`⁺, `testResultStatus`⁺ |
| Filters | **`ids` only** (Q-H12; the contract lists nine more) |
| Relations | `SvtTestListToEntityName(testId → dutEntityName)` and `SvtTestListToEntityId(testId → dutId)`, both **scalar** (Q-R2: a test missing either row breaks `GetAllSvtTests`) |

| Message | Algorithm |
|---|---|
| `GetAllSvtTests` | generic list with pager and both relations (3 queries per test). Items: `{ createdAt: "YYYY-MM-DD HH:MM:SS.ffffff", dutEntityName, dutId, finishedAt, id, pathToResult, startedAt, testResultStatus, testSetupConfigId, testTypeConfigId }` |
| `CreateSvtTest` | generic create: `dutEntityName` and `dutId` are relation value columns → removed from the row, inserted as relation rows after; `createdAt` from DB default. Reply entity as above. |
| `UpdateSvtTestStart` | generic update, `{ id, update: { startedAt } }` |
| `UpdateSvtTestFinish` | generic update, `{ id, update: { finishedAt, pathToResult, testResultStatus } }` |

Timestamps are sent by the client as strings and inserted as literals; Postgres parses ISO
`2025-06-03T23:59:12Z` fine. They come back in Postgres text form (space separator, no zone).

---

## 16. Enums

No table. Values cached at startup from `pg_type ⋈ pg_enum` (types in the configured schema) and
`SELECT enum_range(null::<schema>."<type>")` (values, parsed from `{a,b,c}`).

| Message | Algorithm |
|---|---|
| `GetAllEnums` | `names = data.enumNames ?? allCachedTypeNames`; reply `data = { [name]: values[] }` for each requested name (unknown name → `[]`). No `items`/`entity` wrapper. |

**Q-H14**: the contract spells the key `enumsNames`, the UI sends `data.filter.enumNames`, the code
reads `data.enumNames`; in practice the filter is ignored and all enums are returned. The cache is
never refreshed: a value added with `ALTER TYPE … ADD VALUE` is invisible until restart, and
`CreateWaferType` validation rejects maps using it until then. Values containing commas or needing
Postgres double-quoting would be mis-parsed (none exist today).

---

## 17. Handler ⇄ message index

| Message type | Section | Generic? |
|---|---|---|
| GetAllWaferTypes, CreateWaferType, GetWaferTypeMap | 2 | list / custom / custom |
| GetAllWafers, CreateWafer, UpdateWafer, UpdateWaferLocation, GetWaferLocationHistory | 3, 1 | list / custom / update+guard / location / location |
| GetAllAsics, CreateAsic | 4 | list (custom query) / create |
| GetAllChips, CreateChip, CreateManyChips, UpdateChip⚠, UpdateChipLocation, GetChipLocationHistory | 5, 1 | list (custom query) / custom / custom / update+guard / location / location |
| GetAllWaferProbeMachines, CreateWaferProbeMachine, UpdateWaferProbeMachine, UpdateWpMachineLoadedWafer, UpdateWpMachineInstalledProbeCard | 7 | list / create / update / custom / custom |
| GetAllProbeCards, CreateProbeCard⚠ | 8 | list / create |
| GetAllWaferProbeProjects, CreateWaferProbeProject | 9 | list / create |
| GetAllEquipmentTypes, CreateEquipmentType, GetAllEquipment, CreateEquipment, UpdateEquipment⚠, UpdateEquipmentLocation, GetEquipmentLocationHistory | 10, 1 | list / create / list / location-create / update+guard / location / location |
| GetAllSvtTestSetups, CreateSvtTestSetup, UpdateSvtTestSetup, GetEquipmentListForTestSetup | 11 | list+relation / custom / relation update / custom |
| GetAllSvtTestSetupConfigs, CreateSvtTestSetupConfig, GetSvtTestSetupConfigBody | 12 | list / create / custom |
| GetAllSvtTestTypes, CreateSvtTestType, UpdateSvtTestType | 13 | custom / custom / custom |
| GetAllSvtTestTypeConfigs, CreateSvtTestTypeConfig, GetSvtTestTypeConfigBody | 12 | list / create / custom |
| GetAllSvtTestTemplates, CreateSvtTestTemplate, UpdateSvtTestTemplate | 14 | list (custom query) / create / update |
| GetAllSvtTests, CreateSvtTest, UpdateSvtTestStart, UpdateSvtTestFinish | 15 | list+relations / create / update / update |
| GetAllEnums | 16 | custom |
