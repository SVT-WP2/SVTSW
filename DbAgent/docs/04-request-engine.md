# 04. The generic request engine

Almost every message type is served by one of three generic algorithms (list, create, update)
parameterised by a per-entity **DTO declaration**. This doc specifies those algorithms exactly.
[05-request-handlers.md](05-request-handlers.md) then only has to state each entity's declaration
and the places where it deviates.

Source: `app/src/DbAgentDto/DbBaseDto.cpp`, `DbBaseListDto.h`, `DbBaseLocationDto.cpp`,
`app/src/Database/DbAPI.cpp`, `DbInterface.cpp`, `app/src/DbAgentService/DbAgentRequest.cpp`.

## 1. Dispatch

`DbAgentRequest` owns a map of 16 DTO singletons. For an incoming `type` it asks each DTO in turn
(map iteration order = alphabetical by DTO key) whether it registered a handler under that name;
the first match runs. Names are therefore global, and a duplicate registration in a later DTO is
shadowed silently.

| DTO key | Class | Table | Registered handlers |
|---|---|---|---|
| `SvtDbAsicDto` | `DbAsicDto` | `Asic` | GetAllAsics, CreateAsic |
| `SvtDbChipDto` | `DbChipDto` | `Chip` | GetAllChips, CreateChip, CreateManyChips, UpdateChip, UpdateChipLocation, GetChipLocationHistory |
| `SvtDbEnumDto` | `DbEnumDto` | (pg_enum) | GetAllEnums |
| `SvtDbEquipDto` | `DbEquipDto` | `Equipment` | GetAllEquipment, CreateEquipment, UpdateEquipment, UpdateEquipmentLocation, GetEquipmentLocationHistory |
| `SvtDbEquipTypeDto` | `DbEquipTypeDto` | `EquipmentType` | GetAllEquipmentTypes, CreateEquipmentType |
| `SvtDbProbeCardDto` | `DbProbeCardDto` | `ProbeCard` | GetAllProbeCards, CreateProbeCard |
| `SvtDbTestDto` | `DbTestDto` | `SvtTestList` | GetAllSvtTests, CreateSvtTest, UpdateSvtTestStart, UpdateSvtTestFinish |
| `SvtDbTestSetupConfigDto` | `DbTestSetupConfigDto` | `SvtTestSetupConfig` | GetAllSvtTestSetupConfigs, CreateSvtTestSetupConfig, GetSvtTestSetupConfigBody |
| `SvtDbTestSetupDto` | `DbTestSetupDto` | `SvtTestSetup` | GetAllSvtTestSetups, CreateSvtTestSetup, UpdateSvtTestSetup, GetEquipmentListForTestSetup |
| `SvtDbTestTemplateDto` | `DbTestTemplateDto` | `SvtTestTemplate` | GetAllSvtTestTemplates, CreateSvtTestTemplate, UpdateSvtTestTemplate |
| `SvtDbTestTypeConfigDto` | `DbTestTypeConfigDto` | `SvtTestTypeConfig` | GetAllSvtTestTypeConfigs, CreateSvtTestTypeConfig, GetSvtTestTypeConfigBody |
| `SvtDbTestTypeDto` | `DbTestTypeDto` | `SvtTestType` | GetAllSvtTestTypes, CreateSvtTestType, UpdateSvtTestType |
| `SvtDbWPMachineDto` | `DbWPMachineDto` | `WaferProbeMachine` | GetAllWaferProbeMachines, CreateWaferProbeMachine, UpdateWaferProbeMachine, UpdateWpMachineLoadedWafer, UpdateWpMachineInstalledProbeCard |
| `SvtDbWPProjectDto` | `DbWPProjectDto` | `WaferProbeProject` | GetAllWaferProbeProjects, CreateWaferProbeProject |
| `SvtDbWaferDto` | `DbWaferDto` | `Wafer` | GetAllWafers, CreateWafer, UpdateWafer, UpdateWaferLocation, GetWaferLocationHistory |
| `SvtDbWaferTypeDto` | `DbWaferTypeDto` | `WaferType` | GetAllWaferTypes, CreateWaferType, GetWaferTypeMap |

Not in the registry (exist in code, unreachable from Kafka): `DbModuleDto` (unfinished, see
[07](07-contract-drift-and-quirks.md)), `DbBlockDto`, `DbAsicFamilyTypeBlockList`, the per-entity
`DbLocationDto`s, and every `DbBaseListDto` (relation tables). They are used internally.

## 2. The DTO declaration

Everything the engine needs about an entity:

```ts
type DtoDeclaration = {
    table: string                               // e.g. "Wafer"; SQL uses `<schema>."Wafer"`
    columns: Map<string, boolean>               // column name → required (see §5 for what "required" means)
    validFilters: Map<string, string>           // filter name in request → column name. "ids" → "id" is auto-added when column "id" exists
    jsonColumns: Set<string>                    // values that are JSON objects are stringified before insert
    excludeFromReply: Set<string>               // keys stripped from every reply (used for configBody)
    relations: RelationDeclaration[]            // merged into every entity on read; inserted on create
    customListQuery?: string                    // replaces the generated SELECT … FROM (Asic, Chip, SvtTestTemplate)
}

type RelationDeclaration = {                    // a DbBaseListDto
    table: string                               // e.g. "SvtTestTypeDUTTypeList"
    pkName: string                              // FK column pointing at the parent: "testTypeId"
    colName: string                             // value column: "dutType"
    inDtoName: string                           // key used in the parent entity when isArray: "dutTypes" (defaults to colName)
    isArray: boolean                            // true → array of values; false → single value
}
```

A relation table is itself a DTO with two required columns, `pkName` and `colName`, and one
valid filter (the `pkName`), so it can be listed with the generic list algorithm.

## 3. Reading rows from PostgreSQL

Column values are converted from libpq text by the OID of the column, nothing else:

| Postgres OID / type | JSON produced | Notes |
|---|---|---|
| 16 `bool` | `true` / `false` | |
| 20 `int8`, 21 `int2`, 23 `int4` | number (via C `int`) | `int8` beyond 32 bit throws a conversion error. |
| 700 `float4`, 701 `float8` | number (double) | |
| **anything else** | **string** | `date` → `"2025-06-03"`, `timestamp` → `"2025-06-03 12:34:56.789"` (space, no zone), `json` → the stored text, enums → their label, `varchar`/`text` as-is. |
| SQL `NULL` | `null` | regardless of type |

Consequences: dates are strings in the agent's own format (the contract describes
ISO `T…Z` for timestamps, which the C++ never produces); JSON columns come back as **strings**, not
objects; `numeric`/`decimal` would come back as strings (none exist today).

The entity key for each value is the **result-set column name**, so aliases in custom queries
(`T1."id" AS "chipId"`) become entity keys. A row's column count must equal the DTO's registered
column count or the whole list fails with "return row size unmatches query list size".

## 4. List

Serves every `GetAll*`. Input is `data` of the request.

```ts
function list(dto, data): ListReply {
    // 4.1 filters
    const filters: Record<string, Json> = {}
    for (const [name, value] of Object.entries(data.filter ?? {})) {
        if (name !== 'ids' && !dto.validFilters.has(name)) throw `Error: ${name} is not an allowed filter.`
        filters[name] = value
    }
    // 4.2 query
    const orderBy = dto.columns.has('id') ? 'id' : undefined       // ascending
    const entries = selectEntries(dto, filters, orderBy)           // §4.3
    // 4.4 relations
    for (const e of entries) mergeRelations(dto, e)
    // 4.5 paging
    return page(entries, data.pager)
}
```

### 4.3 `selectEntries` — WHERE generation

```ts
function selectEntries(dto, filters, orderBy, baseQuery = dto.customListQuery): Entry[] {
    const where: string[] = []
    for (const [name, value] of Object.entries(filters)) {
        if (!dto.validFilters.has(name)) { log(`Invalid filter: ${name}`); return FAILURE }   // → "Error: getting entries"
        const col = dto.validFilters.get(name)
        if (!dto.columns.has(col)) throw `Invalid filter ${name}, col ${col} non found in Table ${dto.table}`
        const ident = baseQuery ? `T0."${col}"` : `"${col}"`
        if (Array.isArray(value)) {
            if (value.length === 0) continue                                  // empty array: filter ignored
            if (value.every(Number.isInteger)) where.push(`${ident} IN (${value.join(',')})`)
            else if (value.every(isString))     where.push(`${ident} IN (${value.map(v => `'${v}'`).join(',')})`)
            else throw 'Invalid filter type, only array of integer or string is allowed'
        }
        else if (Number.isInteger(value)) where.push(`${ident} = ${value}`)
        else if (isString(value))         where.push(`${ident} = '${value}'`)
        else if (isFloat(value))          where.push(`${ident} = ${value.toFixed(6)}`)
        // null, boolean, object: silently ignored → no clause at all          (Quirk Q-F1)
    }
    let sql = baseQuery ?? `SELECT ${[...dto.columns.keys()].map(c => `"${c}"`).join(', ')} FROM ${schema}."${dto.table}"`
    if (where.length) sql += ' WHERE ' + where.join(' AND ')
    if (orderBy) sql += ` ORDER BY ${orderBy}`                                  // + ' DESC' when descending
    return rowsToEntries(execute(sql))                                          // §3
}
```

Filter semantics summary:

| Filter value | SQL | Note |
|---|---|---|
| `[1,2]` | `"col" IN (1,2)` | |
| `["a","b"]` | `"col" IN ('a','b')` | no escaping of `'` |
| `[]` | none | filter ignored, all rows |
| `[1,"a"]` | error | "Invalid filter type…" |
| `5` | `"col" = 5` | |
| `"x"` | `"col" = 'x'` | |
| `1.5` | `"col" = 1.500000` | |
| `null`, `true`, `{}` | none | **Quirk Q-F1**: silently ignored |

Only equality and `IN` exist. There is no range, `LIKE`, `IS NULL`, or ordering control. The
contract's `GetAllSvtTests` date-range filters cannot be expressed with this engine.

A `WHERE` column for a custom-query DTO is always prefixed `T0.`; a filter that maps to a column
that only exists on the joined table (Asic's `chipId`) produces invalid SQL (see 05 / 07).

### 4.4 `mergeRelations`

```ts
function mergeRelations(dto, e) {
    for (const rel of dto.relations) {
        const rows = selectEntries(relDto(rel), { [rel.pkName]: e.id })        // one query per entity per relation (N+1)
        if (rel.isArray) {
            if (rows.length) e[rel.inDtoName] = rows.map(r => r[rel.colName])
            else             e[rel.colName]   = []                             // Quirk Q-R1: key is colName, not inDtoName
        } else {
            e[rel.colName] = rows[0][rel.colName]                              // Quirk Q-R2: zero rows → exception → whole request fails
        }
    }
}
```

### 4.5 `page`

```ts
function page(entries, pager): ListReply {
    if (pager === undefined) {
        const items = entries.length <= 5000 ? entries : []                    // Quirk Q-P1: >5000 rows → empty list, totalCount 0
        return { items, totalCount: items.length }
    }
    const limit  = pager.limit  ?? 20                                          // null → exception (BadRequest)
    const offset = pager.offset ?? 0
    if (offset > entries.length) throw `Pager offset out of range, filtered asic size: ${entries.length}`   // sic, for every entity
    return { items: entries.slice(offset, offset + limit), totalCount: entries.length }
}
```

Pagination is done **in memory after fetching every matching row and merging every relation**. The
DB is never asked for `LIMIT`/`OFFSET` or `COUNT`.

## 5. Create

Serves every generic `Create*` (the overrides in 05 call the same core).

```ts
function create(dto, data): EntityReply {
    requireKey(data, 'create')                                         // throws "Object create id was found" (sic)
    const entity = createAndReturn(dto, data.create)
    return { entity }
}

function createAndReturn(dto, body): Entry {
    // 5.1 drop relation value columns from the row body (recursively, any depth)
    const row = deepClone(body)
    for (const rel of dto.relations) deleteKeyRecursively(row, rel.colName)

    // 5.2 the "required" check — a COUNT, not a name check
    const required = [...dto.columns].filter(([c, req]) => req && c !== 'id').length
    if (Object.keys(row).length < required)
        throw `Incorrect number of paramenters. Required: ${required} and entry size is: ${Object.keys(row).length}`

    // 5.3 JSON columns
    for (const [k, v] of Object.entries(row))
        if (isObject(v) && dto.jsonColumns.has(k)) row[k] = JSON.stringify(v, null, 1)

    // 5.4 INSERT, with value filtering (see table below); unknown keys go to SQL as-is
    insert(dto.table, row)                                              // failure → "Entry was not created in <table>"

    // 5.5 id of the new row
    const id = scalar(`SELECT MAX(id) FROM ${schema}."${dto.table}"`)   // Quirk Q-C2: not RETURNING id

    // 5.6 relation rows
    for (const rel of dto.relations)
        if (body[rel.colName] !== undefined) addRelationValues(rel, id, body[rel.colName])

    // 5.7 re-read through the list path (custom query + relations apply)
    return getById(dto, id)
}

function addRelationValues(rel, id, values) {
    for (const v of asIterable(values)) {                               // a scalar iterates as one value
        const existing = selectEntries(relDto(rel), { [rel.pkName]: id })
        if (!existing.some(r => r[rel.colName] === v)) insert(rel.table, { [rel.pkName]: id, [rel.colName]: v })
    }
}
```

Literal formatting on **insert** (`SimpleInsert::addColumnAndValue`):

| JSON value | Emitted | Effect |
|---|---|---|
| integer | `42` | |
| string | `'text'` | **no escaping**; a `'` in the value breaks the statement (Q-S1) |
| float | `1.500000` | |
| `null` | column omitted | DB default applies, or `NOT NULL` violation |
| `true`/`false` | **column omitted** | **Quirk Q-C1**: booleans are silently dropped on create (`SvtTestTemplate.isEnabled` always gets the DB default) |
| array / object | column omitted | unless stringified by §5.3 |

What "required" means in practice: only the **number** of keys in `create` is checked against the
number of required non-id columns. Names are not checked; a body with the right count but wrong
keys passes this check and fails in SQL ("column … does not exist"). Optional keys count toward
the total, and `null` values count as present. Hence the contract's "optional" fields on wafers
(`thinningDate`, …) must be **sent, possibly as `null`**, or the create is rejected (Q-C3).

## 6. Update

Serves `Update*` messages that are plain field updates.

```ts
function update(dto, data, allowNull = false): EntityReply {
    requireKey(data, 'id'); requireKey(data, 'update')
    const id = data.id
    if (!exists(dto.table, id)) throw `Object with id ${id} does not found.`
    const set: string[] = []
    for (const [k, v] of Object.entries(data.update)) {
        if (v === null && !allowNull) continue                       // nulls ignored unless the handler opted in
        set.push(formatAssignment(k, v))                             // table below
    }
    if (set.length === 0) return { entity: getById(dto, id) }        // no-op success
    execute(`UPDATE ${schema}."${dto.table}" SET ${set.join(', ')} WHERE "id" = ${id}`)   // failure → "Entry was not updated"
    return { entity: getById(dto, id) }
}
```

Literal formatting on **update** (`SimpleUpdate::addColumnAndValue`), which differs from insert:

| JSON value | Emitted |
|---|---|
| integer / float | `"k" = 42` / `"k" = 1.500000` |
| string | `"k" = 'text'`; the literal string `"NULL"` becomes `"k" = NULL` |
| `true`/`false` | `"k" = 'true'` / `"k" = 'false'` (string literal; Postgres casts it for boolean columns) |
| `null` with `allowNull` | `"k" = NULL` |
| `null` without `allowNull` | skipped |
| array / object | skipped |

Unknown keys are not rejected before SQL. `generalLocation` on location-tracked entities is
rejected explicitly ("Failed to update entry. update location is not allowed using generic update
request").

Relation-table update (`UpdateSvtTestSetup` only):
`UPDATE <relTable> SET "<colName>" = v WHERE "<pkName>" = id`. If no row exists nothing is inserted
and the reply is still `Success` (Q-U1).

## 7. Transaction semantics

**There are none.** The connection runs a `pqxx::nontransaction`: every statement autocommits the
moment it executes. The code's `commitUpdate()` sends a bare `commit;` (Postgres answers with a
warning) and `rollbackUpdate()` calls `abort()` on the nontransaction, which cannot undo anything
already executed.

So every multi-statement handler is **non-atomic**: `CreateWafer` (wafer + location row + N ASIC
inserts), `CreateChip` (chip + location + blocks), `CreateSvtTestType` (type + DUT rows + config),
`CreateSvtTestSetup` (setup + config + default-config row), `Update*Location` (history row +
parent update), `UpdateWpMachine*` (history row + machine update). A failure in step k leaves
steps 1..k-1 committed, and the client receives `BadRequest`.

## 8. Errors

Every failure surfaces as `status: "BadRequest"`, `error.code: -1`, `error.message` = exception
text ([01 §5](01-architecture.md#5-request--reply-envelope)). Most messages are raised through the
`THROW_RUNTIME_ERROR` macro, which **prefixes the text with the C++ source location and a newline**,
so what a client actually receives looks like:

```
[/app/app/src/DbAgentDto/DbBaseDto.cpp:482]
Error: waferTypeId is not an allowed filter.
```

Messages the engine produces, without that prefix (clients may match on them):

| Message | Raised when |
|---|---|
| `Error: <name> is not an allowed filter.` | filter key not declared |
| `Invalid filter <name>, col <col> non found in Table <T>` | filter maps to an unregistered column |
| `Invalid filter type, only array of integer or string is allowed` | mixed-type array filter |
| `Error: getting entries` | SELECT failed or row width mismatch (details only in the log) |
| `Pager offset out of range, filtered asic size: <n>` | `pager.offset` > result size |
| `Object <key> id was found` | a required key is missing from `data` (message text is inverted) |
| `Incorrect number of paramenters. Required: <n> and entry size is: <m>` | create body too short |
| `Entry was not created in <T>` | INSERT failed |
| `Object with id <id> does not found.` | update of a missing id |
| `Entry was not updated` | UPDATE failed |
| `Failed to update entry. update location is not allowed using generic update request` | `generalLocation` in a generic update |
| libpqxx text, e.g. `ERROR:  duplicate key value violates unique constraint "Wafer_serialNumber_key" …` | any SQL error reached through `doGenericQuery` |

SQL errors are **logged with the complete statement**, literal values included, and the libpqxx
message (which may echo the statement) is returned to the client.

## 9. SQL generation rules

- Identifiers are double-quoted: `"waferId"`, `T0."id"`. Table references are `<schema>."Table"`
  for generated queries; the three hand-written list queries hardcode `main."…"`.
- Values are inlined as literals (§5, §6). There is no parameter binding and no escaping. A
  `serialNumber` containing `'` cannot be stored or searched (Q-S1).
- Each query is wrapped in `PREPARE query_name AS <sql>` / `EXECUTE` / `DEALLOCATE PREPARE`,
  which brings none of the benefits of prepared statements because the literals are already inlined.
- Generated SELECTs name every registered column explicitly, so a column renamed in the DB breaks
  every read of that entity until the DTO is changed and the agent redeployed.

## 10. Reply builders

```ts
type ListReply   = { items: Entry[]; totalCount?: number }   // totalCount present when ≥ 0; absent for location histories
type EntityReply = { entity: Entry }
```

Before serialisation, keys in `dto.excludeFromReply` are removed from each entry (today only
`configBody` on the two config DTOs). Entry keys serialise in **alphabetical order**.

## 11. Internal helpers used by the custom handlers in 05

| Helper | Behaviour |
|---|---|
| `getById(dto, id)` | `list` with `filter.ids = [id]`, no paging, relations merged; returns the first entry or an empty entry (not an error) if none. |
| `getMaxId(table)` | `SELECT MAX(ID)`; `0` when the table is empty. |
| `exists(table, id)` | `SELECT … WHERE "id" = id` has at least one row. |
| `insertRow(dto, row)` | `createEntryInDB`: INSERT with the §5 literal rules, no required-count check, no re-read. Used for history rows, ASICs, blocks. |
| `selectEntries(dto, filters)` without `orderBy` | no `ORDER BY`; rows come back in heap order. Used for relation lookups and location histories. |
