# Messages: what the agent does for each request

This page states what the DB agent `svt-db-agent-next` does for each request on the topic `svt.db-agent.request`.
The message shapes (fields and types) are in the contract
[`svt.db-agent-next.kafka.yaml`](../../Documentation/Kafka/svt.db-agent-next.kafka.yaml). This page is the authority
for the behaviour: the checks, the statuses, the rows that are written and the order of the results. Transport,
headers and heartbeat are in [04-runtime-and-deployment.md](04-runtime-and-deployment.md). The tables are in
[database-schema.md](database-schema.md) and the entities are in [domain-model.md](domain-model.md).

## 1. Request and reply

### 1.1 Envelope

A request is a JSON object with the keys `type` and `data`:

```json
{ "type": "GetWaferTypeMap", "data": { "waferTypeId": 999 } }
```

- `type` is a string. It selects the handler.
- `data` is the payload of that message type. When `data` is absent or `null`, the handler receives `{}`.

The agent builds one reply for every request, also when the request fails. The reply has four keys, in this order:

```json
{
    "type": "GetWaferTypeMapReply",
    "status": "NotFound",
    "data": null,
    "error": { "code": -1, "message": "No wafer map for wafer type 999" }
}
```

- `type` is the request type followed by `Reply` (`<Type>Reply`).
- `status` is one of the four values of §1.2.
- `data` is the payload on `Success`. It is `null` on every other status.
- `error` is `{ "code": 0, "message": "" }` on `Success`. On every other status it is
  `{ "code": -1, "message": "<reason>" }`. The agent uses no other error code.

### 1.2 Statuses

| `status` (wire value) | When the agent uses it |
|---|---|
| `Success` | The handler finished. |
| `BadRequest` | The request is not valid. The causes are listed below. |
| `NotFound` | The row that the message reads or changes by its id does not exist. |
| `UnexpectedError` | Any other failure. |

The causes of `BadRequest`:

- The envelope is malformed, or no handler serves the type (§1.3).
- The header `svt_userId` is not valid, or names no user (§1.5).
- `data` fails validation (§2.1), or a filter is not valid (§2.2).
- A value is not a value of its enum (§2.7).
- A row that the payload refers to does not exist. Example: the wafer type of a new wafer.
- A rule of the message is broken. Example: an ASIC that already has a chip.
- A unique constraint is violated (§1.4).

A missing row answers `NotFound` only when it is the target of the message. Examples: `data.id` of an update,
`waferId` of `UpdateWaferLocation`, `data.id` of `GetSvtTestSetupConfigBody`. A missing row that new data points
to answers `BadRequest`.

### 1.3 Requests that reach no handler

| Request | Reply `type` | `status` | `error.message` |
|---|---|---|---|
| The message is not a JSON object, or `type` is absent, empty or not a string. | `UnknownRequestReply` | `BadRequest` | `Malformed request: missing string "type"` |
| No handler serves the `type`. | `<type>Reply` | `BadRequest` | `Unknown request type: <type>` |

### 1.4 Failures inside a handler

| Cause | `status` | `error.message` |
|---|---|---|
| The handler rejects the request (validation, a check of §3). | `BadRequest` or `NotFound` | The text of the check. The fixed texts are in §2 and §3. |
| An insert violates a unique constraint. | `BadRequest` | `Failed entry creation: an entry with the same unique value already exists` |
| The database rejects a value because it is not a value of an enum type. | `BadRequest` | `Error: "<value>" is not a value of the <enum> enum` |
| The database rejects a value that does not fit the type of its column, in another way. | `BadRequest` | `Error: a value does not fit the type of its column` |
| Any other error. | `UnexpectedError` | `Unexpected error while processing <Type>` |

- The unique-constraint text does not name the column. §3 names the unique columns of each create message.
- The two `Error: …` rows cover the PostgreSQL error code `22P02`. The usual case is an invalid enum value in a
  filter (§2.2).
- For `UnexpectedError` the reply carries only the generic text. The agent writes the real error and its stack
  trace to the log. The reply never contains SQL or a stack trace.
- The agent logs a unique-constraint violation and a `22P02` error as warnings.

### 1.5 The user of a request

A request record can carry the header `svt_userId`: the user that the request is for, as the `id` of a row of
`SvtUser` in a decimal string (`42`). The header is optional. The conventions are in
[SvtKafkaConventions.md](../../Documentation/Kafka/SvtKafkaConventions.md#the-user-of-a-request).

The agent checks a request in this order:

1. The envelope and the type (§1.3). A malformed request or an unknown type is answered as in §1.3, whatever the
   header holds.
2. The header, when the record has it:

   | Case | `status` | `error.message` |
   |---|---|---|
   | The value is not a decimal string of a positive integer: a sign, a space, a leading zero, a point, more than 10 digits, a number above 2147483647, an empty value, a null value, a value that the header has twice (`1,1`). | `BadRequest` | `Header svt_userId must be a positive integer` |
   | No row of `SvtUser` has this id. | `BadRequest` | `Unknown user: <id>` |

3. The handler. It gets the user id, or no user when the record has no header. No handler uses it yet.

- **A header that is there must hold a valid value.** Only a record without the header is a request without a
  user. A null value is refused like an empty one: a client library that sends a null value for "no user" (as
  `confluent-kafka` does for `None`) must leave the header out instead.
- NestJS decodes the headers before the agent sees them, and turns text that starts with `[` or `{` and is valid
  JSON into an array or an object. Such a value is refused: `[1]` is not the user 1.
- The reply type of a header failure is `<Type>Reply`, as for every failure of a known type. The handler does not
  run, and nothing is written.
- **A user who is switched off is accepted.** A user who was switched off after starting a long measurement is still
  the right owner of the rows that the measurement writes. Switching a user off stops the log-in and the UI, not the
  work that is already running.
- The agent checks no role: the services on Kafka trust each other.
- The header is read from the Kafka record only. A key `svt_userId` in the body has no meaning.
- A reply does not repeat the header.
- The log line of each request names the user: `user=42`, `user=-` without the header, `user=invalid` for a value
  that is no positive integer. An id of no user is logged as it is (`user=999`).

## 2. Rules for all messages

### 2.1 Validation of `data`

The agent reads `data` by key name. It validates in two ways.

**Objects validated as a whole.** The agent validates `data.create`, `data.update` and `data.pager` against a class
with one rule per field. The classes are in the `*.dtos.ts` file beside each handlers class. The function is
`validateRequestData`. In five messages the agent validates `data` itself this way: `UpdateWaferLocation`,
`UpdateChipLocation`, `UpdateEquipmentLocation`, `UpdateWpMachineLoadedWafer` and
`UpdateWpMachineInstalledProbeCard`.

- A required field must be present and must have the declared type.
- For an optional field, `null` means the same as an absent key.
- The agent rejects a key that the class does not declare.
- The reply lists every violation of the object: `<path>: <violation>; <violation>`. The path is for example
  `data.create`. Each violation names its field. The violation texts come from the validation library, except the
  length checks of the user messages (§3.18).
- When the value is not a JSON object, the text is `<path> must be an object`. A missing `data.create` gives
  `data.create must be an object`.

**Single keys.** The other keys go through the helper functions of
`src/modules/dispatch/svt-db-agent-next-request-validation.ts`. Each helper has one fixed text.

| Helper | Used for | `error.message` |
|---|---|---|
| `requireRecord` | `data` of every message other than `GetAll…`, `data.update` of `UpdateWafer` | `<path> must be an object` |
| `optionalRecord` | `data` and `data.filter` of the `GetAll…` messages; absent and `null` mean `{}` | `<path> must be an object` |
| `requireInteger` | `data.id`, `data.waferTypeId`, `data.waferId`, `data.chipId`, `data.equipmentId` | `<path> must be an integer` |
| `optionalInteger` | filters with one id (`waferId`, `chipId`, `setupId`, `testTypeId`, `dutId`) | `<path> must be an integer` |
| `requireString` | `data.login` of `GetUserCredentials`, `data.passwordHash` of `UpdateUserPassword` | `<path> must be a string` |
| `optionalString` | filters with one string (`quality`, `generalLocation`, `serialNumber`) | `<path> must be a string` |
| `optionalBoolean` | the filter `isActive` of `GetAllUsers` | `<path> must be a boolean` |
| `optionalIntegerList` | filters with a list of ids | `<path> must be a list of integers` |
| `optionalStringList` | filters with a list of enum values, `enumNames` | `<path> must be a list of strings` |
| `optionalStringOrNullList` | the filter `testResultStatuses` | `<path> must be a list of strings or nulls` |
| `optionalDateTime` | the timestamp bounds of `GetAllSvtTests` | `<path> must be an ISO 8601 date-time` |
| `requireAllowedFilterKeys` | the keys of `data.filter` | `Error: <key> is not an allowed filter.` |
| `parseJsonOrBadRequest`, `jsonTextOrBadRequest` | JSON documents that travel as strings (§2.6) | `<path> must be a string holding valid JSON` |
| `parseJson5OrBadRequest` | `configBody`, which may be JSON or JSON5 (§2.6) | `<path> must be a string holding valid JSON or JSON5` |
| `optionalPager` | `data.pager` (§2.3), validated as a whole | `data.pager: <violation>` |

A handler ignores the keys of `data` that it does not read. Example: a key beside `data.create`. The exception is
the five messages above, where the agent validates `data` as a whole.

### 2.2 Filters

A list message takes its filter in `data.filter`. The filter is optional.

| Case | Result |
|---|---|
| `data.filter` is absent or `null` | No filter. The list holds all rows. |
| A key that the list does not allow | `BadRequest`, `Error: <key> is not an allowed filter.` The reply names the first such key. |
| A key with `null` | The filter is not set. |
| An empty list `[]` | The filter is not set. The list holds all rows. |
| An empty string in a substring filter | The filter is not set. |
| A value of the wrong type | `BadRequest`, with the helper text of §2.1. Example: `data.filter.waferId must be an integer`. |
| A string that is not a value of the enum of its column | `BadRequest`, `Error: "<value>" is not a value of the <enum> enum`. The database reports it. |

- The allowed keys of each list are in §3. `GetAllEnums` is the exception: it does not check the keys of its filter.
- A row must match every filter that is set.
- A list filter matches a row when the value of the row is one of the values of the list.
- A filter with one value matches a row when the values are equal.
- The substring filters are `serialNumber` of `GetAllAsics`, `GetAllChips` and `GetAllBlocks`. The comparison
  ignores case. The text can be at any position of the serial number. The characters `%`, `_` and `\` have no
  special meaning: the agent escapes them.

### 2.3 Paging

The 17 list messages `GetAll…` (all but `GetAllEnums`) take an optional `data.pager = { limit, offset }`.

- `limit` and `offset` are optional integers of 0 or more. The agent has no upper limit. It rejects another key
  in the pager.
- With a pager, `limit` is 20 and `offset` is 0 when the key is absent. `"pager": {}` returns the first 20 rows.
- Without a pager (absent or `null`), the reply holds every row that matches the filter.
- The database applies the pager. The agent does not load the rows that it does not return.
- `totalCount` is the number of rows that match the filter. The pager does not change it.
- An `offset` after the last row returns `items: []` with the real `totalCount`.
- The location history messages and `CreateManyChips` take no pager.

### 2.4 Reply shapes and order

| Reply | `data` |
|---|---|
| A list (`GetAll…`, `Get<Entity>LocationHistory`, `CreateManyChips`) | `{ "items": [ … ], "totalCount": <number> }` |
| One entity (create, update, `GetWaferTypeMap`, `Get…ConfigBody`) | `{ "entity": { … } }` |
| `GetAllEnums` | The map of §3.17, with no wrapper. |

A create or update message replies with the entity as it is after the write. The items of a list are in ascending
order of `id`. The exceptions:

| Reply | Order |
|---|---|
| `GetAllSvtTests` | Descending `id`: the newest test is first. |
| `Get<Entity>LocationHistory` | Ascending `id` of the history rows: the oldest row is first. |
| `CreateManyChips` | The order of `data.create.items`. |
| `asicFamilyTypes` of a probe card, `dutTypes` of a test type | The order in which the database enum declares its values. |
| The values of each enum in `GetAllEnums` | The order in which the database enum declares its values. |

### 2.5 Transactions

- A write message writes all its rows in one database transaction.
- When one insert of the message fails, the database keeps no row of that message. Example: `CreateManyChips` with
  two items and a duplicate serial number in the second item writes no chip, no location row and no chip block.
  `CreateWafer` with a duplicate ASIC serial number writes no wafer.
- The checks that read the enum values and the referred rows run before this transaction, as separate queries.
- A read message opens no transaction.

### 2.6 Values on the wire

| Kind | Fields | On the wire |
|---|---|---|
| Calendar date (`date` column) | `thinningDate`, `dicingDate`, `productionDate`, `date` of a history row, `createdAt` of a configuration, `arriveDate` | A string `YYYY-MM-DD`. |
| Timestamp | `createdAt`, `startedAt`, `finishedAt` of a test; `createdAt` of a user | An ISO 8601 string in UTC with milliseconds: `2026-03-01T10:15:30.000Z`. |
| JSON document | `waferMap`, `local2GlobalMap`, `specification` | A string that holds the JSON text. |
| Configuration body | `configBody` | A string that holds JSON or JSON5 text (comments, trailing commas, unquoted keys, single-quoted strings). |
| Enum value | all enum-typed fields | A string. |

- A date in a request must be an ISO 8601 date string. The agent rejects a date that does not exist.
- A timestamp in a request must be an ISO 8601 string, for example `2026-03-01T10:15:30Z`. The columns have no time
  zone. The agent stores and reads them as UTC: it stores `2026-03-01T10:15:30Z` as `2026-03-01 10:15:30`.
- For a JSON document the agent checks that the string parses as JSON. It stores the string as it is and returns
  it byte for byte: the spaces, the line breaks and the key order stay. An object or an array in place of the
  string is a `BadRequest`.
- A nullable field is always present in a reply. Its value is `null` when the database has no value.
- One field is different: `note` of a location history item is `""` when the database has no value.

### 2.7 Enum values

- Before a write, the agent checks every enum-typed field of the request against the values of the database enum.
- The agent reads these values from the database catalogue for each request. It does not keep them in memory.
- A failure answers `BadRequest` with `<value> is not a value of the <enum> enum`. `<enum>` is the name of the
  database enum type. This text has no `Error:` prefix and no quotes, unlike the filter text of §2.2.

| Field | Enum type |
|---|---|
| `generalLocation` (wafers, chips, equipment, wafer probe machines, test setups) | `wpGeneralLocation` |
| `engineeringRun`, `foundry`, `technology` (wafer types) | `engineeringRun`, `foundryName`, `waferTech` |
| `familyType` (ASICs), `asicFamilyType` (wafer probe projects) | `asicFamilyType` |
| `quality` (ASICs) | `asicQuality` |
| `connectionType`, `software`, `vendor` (wafer probe machines) | `wpConnectionType`, `wpSwType`, `wpVendor` |
| `loadedWaferOrientation`, `installedProbeCardOrientation`, `orientation` (wafer probe projects) | `waferMapOrientation` |
| `dutType`, `dutTypes` | `dutType` |
| `dutEntityName` | `dutEntityName` |
| `testResultStatus` | `testResultStatus` |
| `role` (users) | `userRole` |

### 2.8 The location pattern (wafers, chips, equipment)

A wafer, a chip and a piece of equipment each have a current location and a history. The current location is the
column `generalLocation` of the entity. The history is one table per entity: `WaferLocation`, `ChipLocation`,
`EquipmentLocation`. The key of the entity is `waferId`, `chipId` or `equipmentId`.

**Create.** The create message inserts the entity with its `generalLocation` and the first history row. This row
has the location of the request and the note `Location at creation`. Its `date` is the current date of the
database. Its `username` has no value.

**`Update<Entity>Location`.** `data` is the history record: `{ <entity>Id, generalLocation, date, username, note }`.

1. Validation of `data` (§2.1). `<entity>Id` (integer) and `generalLocation` (string) are required. `date`,
   `username` and `note` are optional.
2. Enum check of `generalLocation` (`wpGeneralLocation`).
3. The entity exists. If not: `NotFound`, `<Entity> <id> not found` (`Wafer 5 not found`, `Chip 5 not found`,
   `Equipment 5 not found`).

- The agent inserts one history row and sets `generalLocation` of the entity to the location of that row.
- When `date` is absent or `null`, the database sets the current date.
- When `username` or `note` is absent or `null`, the row has no value in that column.
- The reply is `{ entity }` with the new `generalLocation`.

**Which row is the current location.** The current location is the row that the agent wrote last. It is not the
row with the latest `date`. A record with an old `date` still becomes the current location.

**`Get<Entity>LocationHistory`.** `data` is `{ <entity>Id }`.

1. `data.<entity>Id` is an integer. If not: `BadRequest`, `data.<entity>Id must be an integer`.
2. The entity exists. If not: `NotFound`, `<Entity> <id> not found`.

- The reply is `{ items, totalCount }` with every history row of the entity. The message has no filter and no
  pager.
- The oldest row is first: the order is the ascending `id` of the history rows, which is the order of the inserts.
- An item is `{ <entity>Id, generalLocation, date, note, username }`.

Wafer probe machines and test setups also have a `generalLocation`, but no history.

## 3. Messages by domain

Each sub-section names the tables of the domain and lists its message types by their wire names. The checks of a
message run in the order given. The first failure ends the request. Every write message writes its rows in one
transaction (§2.5). No domain has a delete message. These terms keep the tables short:

- **Standard list**: the rules of §2.2 (filters), §2.3 (paging) and §2.4 (shape and order) apply.
- **Validation**: the validation of §2.1. A failure answers `BadRequest`.
- **Enum check**: the check of §2.7. A failure answers `BadRequest`.
- **Unique**: the columns with a unique constraint. A duplicate value answers `BadRequest` with the text of §1.4.
- **Id check**: `data.id` is an integer. If not: `BadRequest`, `data.id must be an integer`.
- **Item**: the fields of one element of the list of the domain. A create or update message replies `{ entity }`
  with the same fields.

### 3.1 Wafer types

Tables: `WaferType`, `WaferTypeMap`. The domain has no update message.

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllWaferTypes` | Lists the wafer types. | Standard list. Filter key: `ids`. | Nothing. |
| `CreateWaferType` | Creates a wafer type and its wafer map. | 1. Validation of `data.create`: `name`, `engineeringRun`, `foundry`, `technology` and `waferMap` are required strings.<br>2. Enum checks: `engineeringRun`, `foundry`, `technology`.<br>3. The wafer map check (below). If it fails: `BadRequest`. The message holds the violations, one per line.<br>4. The insert. Unique: `name`, `engineeringRun`. | One `WaferType` row, one `WaferTypeMap` row. |
| `GetWaferTypeMap` | Returns the wafer map of one wafer type. | 1. `data.waferTypeId` is an integer. If not: `BadRequest`, `data.waferTypeId must be an integer`.<br>2. The wafer type has a map. If not: `NotFound`, `No wafer map for wafer type <id>`. | Nothing. |

- Item: `{ id, name, engineeringRun, foundry, technology }`. It does not carry the wafer map.
- `GetWaferTypeMap` replies `{ entity: { waferMap } }`. `waferMap` is the stored text (§2.6).

The wafer map check. `waferMap` is JSON text with the objects `Groups` and `MapGroups`. The full format, with an
example, is in [wafer-map.md](wafer-map.md).

| # | Rule | Message of a violation |
|---|---|---|
| 1 | The text is JSON. | `WaferTypeMap don't follow json format.` |
| 2 | `Groups` and `MapGroups` are objects. | `Wrong json format. Missing Groups or MapGroups objects.` |
| 3 | The enum `asicFamilyType` has values. | `No ASIC FamilyType found.` |
| 4a | Each group of `Groups` is a list. | `Group <group> is not a list of elements` |
| 4b | `PosInGroup` of each element equals its index in the list. | `Unmatching PosInGroup index: <value> from expected <index> in group <group>` |
| 4c | `FamilyType` of each element is a value of `asicFamilyType`. | `Asic Family type: <value> is not part of enum value in the DB` |
| 5a | Each row of `MapGroups` has a list `MapGroupsColumns`. | `Map Group: <row> has no MapGroupsColumns list` |
| 5b | `GroupName` of each column is a group of `Groups`. | `Map Group: <row> Col: <n> group name <name> was not found` |
| 5c | The four index lists of the column are valid. | `Map Group: <row> Col: <n> Wrong array found` |
| 5d | `ExistingAsics` is not longer than the group. Its length equals the sum of the lengths of the three property lists. | `Map Group: <row> Col: <n>, unmaching number of asics and properties size` |
| 5e | Each index of `ExistingAsics` is in exactly one property list. | `Map Group: <row> Col: <n>, asic index <i> has more than one property` |

- Rules 1 to 3 end the check at the first violation. The agent collects every violation of rules 4a to 4c.
- Rules 5a to 5e end the check at the first violation. The message then also holds the violations of rule 4.
- The index lists of a column are `ExistingAsics` and the three property lists `MechanicallyDamagedASICs`,
  `ASICsCoveredByGreenLayer` and `MechanicallyIntegerASICs`.
- An index list that is `null`, absent or `[]` holds no index. A list whose first element is `"All"` holds every
  index of the group. A list of integers holds those indexes.

### 3.2 Wafers

Tables: `Wafer`, `WaferLocation`, `Asic`. Wafers follow the location pattern (§2.8).

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllWafers` | Lists the wafers. | Standard list. Filter key: `ids`. | Nothing. |
| `CreateWafer` | Creates a wafer, its first location row and every ASIC of the wafer map of its wafer type. | 1. Validation of `data.create`: `serialNumber` (string), `batchNumber` and `waferTypeId` (numbers) are required. `thinningDate`, `dicingDate` and `productionDate` are optional dates.<br>2. `generalLocation` has a value. If not: `BadRequest`, `data.create.generalLocation is required to create a wafer`.<br>3. Enum check of `generalLocation`.<br>4. The wafer type exists. If not: `BadRequest`, `Wafer type <id> does not exist`.<br>5. The wafer type has a wafer map. If not: `BadRequest`, `Wafer type <id> has no wafer map`.<br>6. The agent can generate the ASICs (below). If not: `BadRequest`, `Cannot generate the ASICs of the wafer: <reason>`.<br>7. The insert. Unique: `serialNumber` of the wafer, `serialNumber` of each ASIC. | One `Wafer` row, one `WaferLocation` row (§2.8), one `Asic` row for each existing ASIC of the map. |
| `UpdateWafer` | Changes the three dates of a wafer. | 1. Id check.<br>2. `data.update` is an object. If not: `BadRequest`, `data.update must be an object`.<br>3. `data.update` has no key `generalLocation`. If it has: `BadRequest`, `Failed to update entry. update location is not allowed using generic update request`.<br>4. Validation of `data.update`: `thinningDate`, `dicingDate` and `productionDate` are optional dates. No other key is allowed.<br>5. The wafer exists. If not: `NotFound`, `Wafer <id> not found`. | The `Wafer` row. |
| `UpdateWaferLocation` | Moves a wafer to a location. | §2.8, with the key `waferId`. | One `WaferLocation` row, the `Wafer` row. |
| `GetWaferLocationHistory` | Lists the location history of a wafer. | §2.8, with the key `waferId`. | Nothing. |

- Item: `{ id, serialNumber, batchNumber, thinningDate, dicingDate, productionDate, waferTypeId, generalLocation }`.
- `UpdateWafer` writes the keys that are present. An absent key keeps its value. A key with `null` removes the date.
- No message changes `serialNumber`, `batchNumber` or `waferTypeId` of a wafer.

How `CreateWafer` generates the ASICs (the details and a worked example are in [wafer-map.md](wafer-map.md)):

- It reads the rows of `MapGroups` in the numeric order of their key suffix (`MapGroupsRow<n>`).
- In a row, it reads the columns in their order. In a column, it reads the indexes of `ExistingAsics`.
- `waferMapPosition` is `<row>_<col>`. `col` starts at 0 in each row. It counts the existing ASICs of the row over
  all columns.
- `familyType` is the `FamilyType` of the group element at the index.
- `quality` is `MechanicallyDamaged`, `CoveredByGreenLayer` or `MechanicallyInteger`: the property list that holds
  the index. The agent looks in the lists in this order.
- `serialNumber` is `<waferSerialNumber>_<row>_<col>`.
- A `MechanicallyInteger` ASIC in a row with an `SN_prefix` has another serial number:
  `<SN_prefix>_<waferSerialNumber>`. When the prefix contains `babyMOSAIX-`, it is
  `<SN_prefix>_<k>_<waferSerialNumber>`. `k` counts these ASICs in the row and starts at 1.

### 3.3 ASICs

Table: `Asic`. The domain has no update message. `CreateWafer` creates the ASICs of a wafer (§3.2).

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllAsics` | Lists the ASICs. | Standard list. Filter keys: the table below. | Nothing. |
| `CreateAsic` | Creates one ASIC by hand. | 1. Validation of `data.create`: `serialNumber`, `familyType`, `waferMapPosition` and `quality` are required strings. `waferId` is a required number.<br>2. Enum checks: `familyType`, `quality`.<br>3. The wafer exists. If not: `BadRequest`, `Wafer <id> does not exist`.<br>4. The insert. Unique: `serialNumber`. | One `Asic` row. |

| Filter key | Type | Matches |
|---|---|---|
| `ids` | list of integers | The ASICs with these ids. |
| `waferId` | integer | The ASICs of this wafer. |
| `chipId` | integer | The ASIC of this chip. A chip that does not exist gives an empty list. |
| `familyTypes` | list of strings | The ASICs with one of these family types. |
| `quality` | string | The ASICs with this quality. |
| `serialNumber` | string | Substring filter (§2.2). |

- Item: `{ id, serialNumber, waferId, chipId, familyType, waferMapPosition, quality }`.
- `chipId` is not a column of `Asic`. It is the id of the chip whose `asicId` is this ASIC. It is `null` when the
  ASIC has no chip. `CreateAsic` replies with `chipId: null`.

### 3.4 Chips

Tables: `Chip`, `ChipLocation`, `ChipBlock`. Chips follow the location pattern (§2.8). An ASIC has at most one chip:
the handlers check it. No message changes `serialNumber` or `asicId` of a chip.

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllChips` | Lists the chips. | Standard list. Filter keys: the table below. | Nothing. |
| `CreateChip` | Creates one chip and its first location row. | 1. Validation of `data.create`: `serialNumber` (string), `asicId` (number) and `generalLocation` (string) are required.<br>2. Enum check of `generalLocation`.<br>3. The ASIC has no chip. If it has: `BadRequest`, `Asic <asicId> already has a chip (<chipId>)`.<br>4. The ASIC exists. If not: `BadRequest`, `Asic <asicId> does not exist`.<br>5. The insert. Unique: `serialNumber` of the chip, `serialNumber` of each chip block. | One `Chip` row, one `ChipLocation` row (§2.8), the `ChipBlock` rows (below). |
| `CreateManyChips` | Creates several chips at one location. `data.create` is `{ generalLocation, items: [ { serialNumber, asicId } ] }`. | 1. Validation of `data.create` and of each item: `generalLocation` and `serialNumber` are strings, `asicId` is a number.<br>2. `items` is present. If not: `BadRequest`, `data.create.items must be an array`.<br>3. Enum check of `generalLocation`.<br>4. No ASIC is in two items. If one is: `BadRequest`, `Asic <asicId> appears more than once in data.create.items`.<br>5. No ASIC of the items has a chip. If one has: `BadRequest`, `Asic <asicId> already has a chip (<chipId>)`.<br>6. Every ASIC of the items exists. If not: `BadRequest`, `Asic <asicId> does not exist`.<br>7. The insert. Unique: as for `CreateChip`. | For each item, the rows that `CreateChip` writes. |
| `UpdateChipLocation` | Moves a chip to a location. | §2.8, with the key `chipId`. | One `ChipLocation` row, the `Chip` row. |
| `GetChipLocationHistory` | Lists the location history of a chip. | §2.8, with the key `chipId`. | Nothing. |

| Filter key | Type | Matches |
|---|---|---|
| `ids` | list of integers | The chips with these ids. |
| `generalLocation` | string | The chips at this location. |
| `serialNumber` | string | Substring filter (§2.2). |
| `familyTypes` | list of strings | The chips whose ASIC has one of these family types. |

- Item: `{ id, serialNumber, generalLocation, familyType }`.
- `familyType` is not a column of `Chip`. It is the `familyType` of the ASIC of the chip.
- The item does not carry `asicId`. `GetAllAsics` with the filter `chipId` returns the ASIC of a chip.
- `CreateManyChips` writes all items or none (§2.5). It replies `{ items, totalCount }` with only the chips of the
  request, in the order of the request.
- An empty `items` list answers `Success` with `{ items: [], totalCount: 0 }`. The agent writes nothing.

**Chip blocks and `SVT_DB_AGENT_FEATURE_CHIP_BLOCKS`.** The environment variable is off by default. The values
`true` and `1` switch it on.

- Off: `CreateChip` and `CreateManyChips` write no `ChipBlock` row.
- On: the agent reads the rows of `AsicFamilyTypeBlockList` for the family type of the ASIC of the chip. It writes
  one `ChipBlock` row for each of them, in the same transaction as the chip.
- `blockType` of the row is the block type of the list. `serialNumber` is `<blockType>_<chipSerialNumber>`.
- A family type with no row in `AsicFamilyTypeBlockList` gives a chip with no chip block.

### 3.5 Chip blocks

Table: `ChipBlock`. The domain is read-only: it has no create and no update message. Only `CreateChip` and
`CreateManyChips` write chip blocks (§3.4). The TypeScript contract names the type `GetAllChipBlocks`. The wire
value is `GetAllBlocks`.

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllBlocks` | Lists the chip blocks. | Standard list. Filter keys: the table below. | Nothing. |

| Filter key | Type | Matches |
|---|---|---|
| `ids` | list of integers | The chip blocks with these ids. |
| `chipId` | integer | The chip blocks of this chip. |
| `chipBlockTypes` | list of strings | The chip blocks with one of these block types. |
| `serialNumber` | string | Substring filter (§2.2). |

Item: `{ id, chipId, chipBlockType, serialNumber }`. `chipBlockType` is the column `blockType`.

### 3.6 Wafer probe machines

Tables: `WaferProbeMachine`, `WaferLoadedInMachine`, `ProbeCardInstalledInMachine`. A wafer probe machine has no
location history. The TypeScript contract names three types with `WpMachine` (`GetAllWpMachines`,
`CreateWpMachine`, `UpdateWpMachine`). The wire values are in the table.

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllWaferProbeMachines` | Lists the wafer probe machines. | Standard list. Filter key: `ids`. | Nothing. |
| `CreateWaferProbeMachine` | Creates a wafer probe machine. | 1. Validation of `data.create`: `name`, `serialNumber`, `hostName`, `connectionType`, `generalLocation`, `software`, `swVersion` and `vendor` are required strings. `connectionPort` is a required number.<br>2. Enum checks: `connectionType`, `generalLocation`, `software`, `vendor`.<br>3. The insert. Unique: `name`, `serialNumber`. | One `WaferProbeMachine` row, with no wafer loaded and no probe card installed. |
| `UpdateWaferProbeMachine` | Changes six fields of a wafer probe machine. | 1. Id check.<br>2. Validation of `data.update`: `hostName`, `connectionType`, `generalLocation`, `software` and `swVersion` (strings) and `connectionPort` (number) are all required. No other key is allowed.<br>3. Enum checks: `connectionType`, `generalLocation`, `software`.<br>4. The wafer probe machine exists. If not: `NotFound`, `Wafer probe machine <id> not found`. | The six columns of the `WaferProbeMachine` row. |
| `UpdateWpMachineLoadedWafer` | Loads a wafer into a wafer probe machine, or unloads it. `data` is `{ wpMachineId, loadedWaferId, loadedWaferOrientation }`. | 1. Validation of `data`: `wpMachineId` is a required integer. `loadedWaferId` is an optional integer. `loadedWaferOrientation` is an optional string.<br>2. The wafer probe machine exists. If not: `NotFound`, `Wafer probe machine <id> not found`.<br>3. Unload only: a wafer is loaded. If not: `BadRequest`, `No wafer is loaded in wafer probe machine <id>`.<br>4. Load only: `loadedWaferOrientation` has a value. If not: `BadRequest`, `data.loadedWaferOrientation is required to load a wafer`.<br>5. Load only: enum check of `loadedWaferOrientation`.<br>6. Load only: the wafer exists. If not: `BadRequest`, `Wafer <id> does not exist`. | One `WaferLoadedInMachine` row, the `WaferProbeMachine` row (below). |
| `UpdateWpMachineInstalledProbeCard` | Installs a probe card in a wafer probe machine, or uninstalls it. `data` is `{ wpMachineId, installedProbeCardId, installedProbeCardOrientation }`. | 1. Validation of `data`: `wpMachineId` is a required integer. `installedProbeCardId` is an optional integer. `installedProbeCardOrientation` is an optional string.<br>2. The wafer probe machine exists. If not: `NotFound`, `Wafer probe machine <id> not found`.<br>3. Install only: enum check of `installedProbeCardOrientation`, when it has a value.<br>4. Install only: the probe card exists. If not: `BadRequest`, `Probe card <id> does not exist`. | Install: one `ProbeCardInstalledInMachine` row, the `WaferProbeMachine` row. Uninstall: the `WaferProbeMachine` row. |

- Item: the fields `id`, `name`, `serialNumber`, `hostName`, `connectionType`, `connectionPort`, `generalLocation`,
  `software`, `swVersion`, `vendor`, `loadedWaferId`, `loadedWaferOrientation`, `installedProbeCardId` and
  `installedProbeCardOrientation`. The last four are `null` when no wafer is loaded or no probe card is installed.
- No message changes `name`, `serialNumber` or `vendor` of a wafer probe machine.

**Load and unload.** A `loadedWaferId` loads that wafer. `null` or an absent key unloads the current wafer.

| Case | Row written to `WaferLoadedInMachine` | Columns of `WaferProbeMachine` |
|---|---|---|
| Load | The wafer, the orientation, `status` `Loaded`. | `loadedWaferId` and `loadedWaferOrientation` are set. |
| Load while another wafer is loaded | One `Loaded` row for the new wafer. No `Unloaded` row for the wafer before. | Both columns get the new values. |
| Unload | The wafer that was loaded, no orientation, `status` `Unloaded`. | Both columns lose their value. |

- `date` of the history row is the current date of the database. `username` has no value.
- The agent does not compare the new wafer with the loaded wafer. A load of the wafer that is already loaded
  writes one more `Loaded` row.
- On an unload the agent ignores `loadedWaferOrientation`.

**Install and uninstall.** An `installedProbeCardId` installs that probe card. `null` or an absent key uninstalls
the current probe card.

- Install: the history row has the probe card, the orientation, the current date and no `username`. The agent
  sets `installedProbeCardId` and `installedProbeCardOrientation` of the machine. The orientation is optional.
- Uninstall: the agent removes the value of the two machine columns. It writes no history row.
- An uninstall with no probe card installed answers `Success`.

### 3.7 Probe cards

Tables: `ProbeCard`, `ProbeCardFamilyType`. The domain is read-only: it has no create and no update message. The
TypeScript contract names the type `GetAllWpProbeCards`.

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllProbeCards` | Lists the probe cards. | Standard list. Filter key: `ids`. | Nothing. |

- Item: the fields `id`, `serialNumber`, `name`, `vendor`, `model`, `arriveDate`, `location`, `type`,
  `vendorCleaningInterval` and `asicFamilyTypes`.
- `asicFamilyTypes` is not a column of `ProbeCard`. It holds the `asicFamilyType` of each `ProbeCardFamilyType` row
  of the probe card. It is `[]` when the probe card has no such row.
- The item does not carry the column `version`.

### 3.8 Wafer probe projects

Table: `WaferProbeProject`. The domain has no update message. The TypeScript contract names the types
`GetAllWpProjects` and `CreateWpProject`.

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllWaferProbeProjects` | Lists the wafer probe projects. | Standard list. Filter key: `ids`. | Nothing. |
| `CreateWaferProbeProject` | Creates a wafer probe project. | 1. Validation of `data.create`: `wpMachineId` and `waferTypeId` are required numbers. `name`, `asicFamilyType`, `orientation`, `alignmentDie`, `homeDie` and `local2GlobalMap` are required strings.<br>2. Enum checks: `asicFamilyType`, `orientation`.<br>3. The wafer probe machine exists. If not: `BadRequest`, `Wafer probe machine <id> does not exist`.<br>4. The wafer type exists. If not: `BadRequest`, `Wafer type <id> does not exist`.<br>5. `local2GlobalMap` holds JSON. If not: `BadRequest`, `data.create.local2GlobalMap must be a string holding valid JSON`.<br>6. The insert. Unique: `name`. | One `WaferProbeProject` row. |

Item: `{ id, wpMachineId, waferTypeId, name, asicFamilyType, orientation, alignmentDie, homeDie, local2GlobalMap }`.

### 3.9 Equipment types

Table: `EquipmentType`. The domain has no update message.

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllEquipmentTypes` | Lists the equipment types. | Standard list. Filter key: `ids`. | Nothing. |
| `CreateEquipmentType` | Creates an equipment type. | 1. Validation of `data.create`: `name` is a required string.<br>2. The insert. Unique: `name`. | One `EquipmentType` row. |

Item: `{ id, name }`.

### 3.10 Equipment

Tables: `Equipment`, `EquipmentLocation`. Equipment follows the location pattern (§2.8). No message changes `name`,
`equipmentTypeId` or `specification`.

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllEquipment` | Lists the equipment. | Standard list. Filter key: `ids`. | Nothing. |
| `CreateEquipment` | Creates a piece of equipment and its first location row. | 1. Validation of `data.create`: `name` (string), `equipmentTypeId` (integer) and `generalLocation` (string) are required. `specification` is an optional string.<br>2. Enum check of `generalLocation`.<br>3. The equipment type exists. If not: `BadRequest`, `Equipment type <id> does not exist`.<br>4. `specification` holds JSON, when it has a value. If not: `BadRequest`, `data.create.specification must be a string holding valid JSON`.<br>5. The insert. Unique: `name`. | One `Equipment` row, one `EquipmentLocation` row (§2.8). |
| `UpdateEquipmentLocation` | Moves a piece of equipment to a location. | §2.8, with the key `equipmentId`. | One `EquipmentLocation` row, the `Equipment` row. |
| `GetEquipmentLocationHistory` | Lists the location history of a piece of equipment. | §2.8, with the key `equipmentId`. | Nothing. |

- Item: `{ id, name, equipmentTypeId, generalLocation, specification }`. `specification` is JSON text or `null`.
- The agent stores an absent or `null` `specification` as no value and returns it as `null`.

### 3.11 SVT test setups

Tables: `SvtTestSetup`, `SvtTestSetupConfig`, `SvtTestSetupDefaultConfig`. A test setup has test setup
configurations (§3.12). One of them can be its default.

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllSvtTestSetups` | Lists the test setups. | Standard list. Filter key: `ids`. | Nothing. |
| `CreateSvtTestSetup` | Creates a test setup with its first test setup configuration, and makes it the default. | 1. Validation of `data.create`: `name` and `generalLocation` are required strings. In `defaultConfig`, `name` and `configBody` are required strings and `note` is an optional string.<br>2. `defaultConfig` is present. If not: `BadRequest`, `data.create.defaultConfig is required`.<br>3. Enum check of `generalLocation`.<br>4. `defaultConfig.configBody` holds JSON or JSON5. If not: `BadRequest`, `data.create.defaultConfig.configBody must be a string holding valid JSON or JSON5`.<br>5. The insert. Unique: `name` of the test setup configuration. | One `SvtTestSetup` row, one `SvtTestSetupConfig` row, one `SvtTestSetupDefaultConfig` row. |
| `UpdateSvtTestSetup` | Changes the default test setup configuration of a test setup. | 1. Id check.<br>2. Validation of `data.update`: `defaultConfigId` is a required number. No other key is allowed.<br>3. The test setup exists. If not: `NotFound`, `Test setup <id> not found`.<br>4. The test setup configuration exists. If not: `BadRequest`, `Test setup config <configId> does not exist`.<br>5. The test setup configuration belongs to the test setup. If not: `BadRequest`, `Test setup config <configId> does not belong to test setup <id>`. | The `SvtTestSetupDefaultConfig` row of the test setup. |

- Item: `{ id, name, defaultConfigId, generalLocation }`.
- `defaultConfigId` is not a column of `SvtTestSetup`. It comes from the `SvtTestSetupDefaultConfig` row of the
  test setup. It is `null` when the test setup has no such row.
- `CreateSvtTestSetup` replies with the id of the new test setup configuration in `defaultConfigId`.
- `UpdateSvtTestSetup` updates the `SvtTestSetupDefaultConfig` row. When the test setup has no such row, the agent
  inserts it.
- No message changes `name` or `generalLocation` of a test setup.

### 3.12 SVT test setup configurations

Table: `SvtTestSetupConfig`. The domain has no update message. The `name` of a test setup configuration is unique
over all test setups.

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllSvtTestSetupConfigs` | Lists the test setup configurations. | Standard list. Filter keys: `ids`, and `setupId` (integer) for the test setup configurations of one test setup. | Nothing. |
| `CreateSvtTestSetupConfig` | Adds a test setup configuration to a test setup. | 1. Validation of `data.create`: `setupId` (number), `name` (string) and `configBody` (string) are required. The key `note` is required too. Its value is a string or `null`.<br>2. The test setup exists. If not: `BadRequest`, `Test setup <setupId> does not exist`.<br>3. `configBody` holds JSON or JSON5. If not: `BadRequest`, `data.create.configBody must be a string holding valid JSON or JSON5`.<br>4. The insert. Unique: `name`. | One `SvtTestSetupConfig` row. |
| `GetSvtTestSetupConfigBody` | Returns the body of one test setup configuration. | 1. Id check.<br>2. The test setup configuration exists. If not: `NotFound`, `Test setup config <id> not found`. | Nothing. |

- Item: `{ id, setupId, name, note, createdAt }`. It does not carry `configBody`.
- The database sets `createdAt` to the current date.
- `CreateSvtTestSetupConfig` does not change the default test setup configuration of the test setup.
- `GetSvtTestSetupConfigBody` replies `{ entity: { id, configBody } }`. `configBody` is the stored text (§2.6).

### 3.13 SVT test types

Tables: `SvtTestType`, `SvtTestTypeDUTTypeList`, `SvtTestTypeConfig`. A test type has a list of DUT types (the types
of device under test that it applies to) and test type configurations (§3.14).

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllSvtTestTypes` | Lists the test types. | Standard list. Filter keys: `ids`, and `dutTypes` (list of strings). A test type matches `dutTypes` when it has at least one of the DUT types of the list. | Nothing. |
| `CreateSvtTestType` | Creates a test type with its DUT types and its first test type configuration. | 1. Validation of `data.create`: `name` is a required string. `dutTypes` is a required list of strings. In `testTypeConfig`, `name` and `configBody` are required strings and `note` is an optional string.<br>2. `testTypeConfig` is present. If not: `BadRequest`, `data.create.testTypeConfig is required`.<br>3. Enum check of each value of `dutTypes`. The reply names the first value that fails.<br>4. `testTypeConfig.configBody` holds JSON or JSON5. If not: `BadRequest`, `data.create.testTypeConfig.configBody must be a string holding valid JSON or JSON5`.<br>5. The insert. Unique: `name` of the test type. | One `SvtTestType` row, one `SvtTestTypeDUTTypeList` row for each different DUT type, one `SvtTestTypeConfig` row. |
| `UpdateSvtTestType` | Replaces the DUT types of a test type. | 1. Id check.<br>2. Validation of `data.update`: `dutTypes` is a required list of strings. No other key is allowed.<br>3. Enum check of each value of `dutTypes`.<br>4. The test type exists. If not: `NotFound`, `Test type <id> not found`. | The `SvtTestTypeDUTTypeList` rows of the test type. |

- Item: `{ id, name, dutTypes }`.
- `dutTypes` is not a column of `SvtTestType`. It holds the `dutType` of each `SvtTestTypeDUTTypeList` row of the
  test type. It is `[]` when the test type has no such row.
- The reply of `CreateSvtTestType` does not carry the id of the new test type configuration.
- `UpdateSvtTestType` deletes every `SvtTestTypeDUTTypeList` row of the test type. Then it inserts one row for
  each different value of `dutTypes`. An empty list leaves the test type with no DUT type.
- No message changes `name` of a test type.

### 3.14 SVT test type configurations

Table: `SvtTestTypeConfig`. The domain has no update message. The `name` of a test type configuration is unique
within its test type. Two test types can have a test type configuration with the same name.

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllSvtTestTypeConfigs` | Lists the test type configurations. | Standard list. Filter keys: `ids`, and `testTypeId` (integer) for the test type configurations of one test type. | Nothing. |
| `CreateSvtTestTypeConfig` | Adds a test type configuration to a test type. | 1. Validation of `data.create`: `testTypeId` (number), `name` (string) and `configBody` (string) are required. The key `note` is required too. Its value is a string or `null`.<br>2. The test type exists. If not: `BadRequest`, `Test type <testTypeId> does not exist`.<br>3. `configBody` holds JSON or JSON5. If not: `BadRequest`, `data.create.configBody must be a string holding valid JSON or JSON5`.<br>4. The insert. Unique: the pair `testTypeId` and `name`. | One `SvtTestTypeConfig` row. |
| `GetSvtTestTypeConfigBody` | Returns the body of one test type configuration. | 1. Id check.<br>2. The test type configuration exists. If not: `NotFound`, `Test type config <id> not found`. | Nothing. |

- Item: `{ id, testTypeId, name, note, createdAt }`. It does not carry `configBody`.
- The database sets `createdAt` to the current date.
- `GetSvtTestTypeConfigBody` replies `{ entity: { id, configBody } }`. `configBody` is the stored text (§2.6).

### 3.15 SVT test templates

Table: `SvtTestTemplate`. A test template links one DUT type to one test type configuration, with the flag
`isEnabled`.

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllSvtTestTemplates` | Lists the test templates. | Standard list. Filter keys: `ids`, and `dutTypes` (list of strings) for the test templates with one of these DUT types. | Nothing. |
| `CreateSvtTestTemplate` | Creates a test template. | 1. Validation of `data.create`: `isEnabled` (boolean), `dutType` (string) and `testTypeConfigId` (number) are required.<br>2. Enum check of `dutType`.<br>3. The test type configuration exists. If not: `BadRequest`, `Test type config <id> does not exist`.<br>4. The insert. Unique: the pair `dutType` and `testTypeConfigId`. | One `SvtTestTemplate` row, with the `isEnabled` of the request. |
| `UpdateSvtTestTemplate` | Switches a test template on or off. | 1. Id check.<br>2. Validation of `data.update`: `isEnabled` is a required boolean. No other key is allowed.<br>3. The test template exists. If not: `NotFound`, `Test template <id> not found`. | `isEnabled` of the `SvtTestTemplate` row. |

- Item: `{ id, dutType, isEnabled, testTypeId, testTypeConfigId }`.
- `testTypeId` is not a column of `SvtTestTemplate`. It is the test type of the test type configuration of the
  test template.
- `isEnabled` is `true` in the reply when the column has no value.
- No message changes `dutType` or `testTypeConfigId` of a test template.

### 3.16 SVT tests

Tables: `SvtTestList`, `SvtTestListToEntityName`, `SvtTestListToEntityId`. A test is one run of a test type
configuration on a test setup configuration, for one DUT. `dutEntityName` says in which table the DUT is: `Asic`,
`Chip` or `ChipBlock`. `dutId` is the id of the DUT in that table.

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllSvtTests` | Lists the tests. The newest test is first. | Standard list, in descending order of `id`. Filter keys: the table below. | Nothing. |
| `CreateSvtTest` | Creates a test. | 1. Validation of `data.create`: `dutEntityName` (string), `dutId`, `testTypeConfigId` and `testSetupConfigId` (numbers) are required.<br>2. Enum check of `dutEntityName`.<br>3. The DUT exists: a row with the id `dutId` in `Asic`, `Chip` or `ChipBlock`. If not: `BadRequest`, `<dutEntityName> <dutId> does not exist` (`Chip 7 does not exist`).<br>4. The test type configuration exists. If not: `BadRequest`, `Test type config <id> does not exist`.<br>5. The test setup configuration exists. If not: `BadRequest`, `Test setup config <id> does not exist`. | One `SvtTestList` row, one `SvtTestListToEntityName` row, one `SvtTestListToEntityId` row. |
| `UpdateSvtTestStart` | Records the start of a test. | 1. Id check.<br>2. Validation of `data.update`: `startedAt` is a required ISO 8601 string. No other key is allowed.<br>3. The test exists. If not: `NotFound`, `Test <id> not found`. | `startedAt` of the `SvtTestList` row. |
| `UpdateSvtTestFinish` | Records the end of a test and its result. | 1. Id check.<br>2. Validation of `data.update`: `finishedAt` (ISO 8601 string), `pathToResult` (string) and `testResultStatus` are required. `testResultStatus` is `SUCCESS`, `PARTIAL_SUCCESS`, `FAILURE`, `ERROR` or `CANCELLED`. No other key is allowed.<br>3. Enum check of `testResultStatus` against the database enum.<br>4. The test exists. If not: `NotFound`, `Test <id> not found`. | `finishedAt`, `pathToResult` and `testResultStatus` of the `SvtTestList` row. |

| Filter key | Type | Matches |
|---|---|---|
| `ids` | list of integers | The tests with these ids. |
| `dutEntityNames` | list of strings | The tests whose DUT is in one of these tables. |
| `dutId` | integer | The tests whose DUT has this id. An id is unique only within one table, so use it with `dutEntityNames`. |
| `testResultStatuses` | list of strings or `null` | The tests with one of these result statuses. `null` in the list selects the tests with no result. |
| `testTypeConfigIds` | list of integers | The tests of these test type configurations. |
| `testSetupConfigIds` | list of integers | The tests of these test setup configurations. |
| `createdAtFrom`, `startedAtFrom`, `finishedAtFrom` | ISO 8601 date-time | The tests whose timestamp is at this time or later. |
| `createdAtTo`, `startedAtTo`, `finishedAtTo` | ISO 8601 date-time | The tests whose timestamp is before this time. |

- A test with no value in a timestamp never matches a bound on that timestamp.
- Item: the fields `id`, `dutEntityName`, `dutId`, `testTypeConfigId`, `testSetupConfigId`, `createdAt`,
  `startedAt`, `finishedAt`, `pathToResult` and `testResultStatus`.
- `dutEntityName` and `dutId` are not columns of `SvtTestList`. They come from the rows of
  `SvtTestListToEntityName` and `SvtTestListToEntityId`. Each is `null` when its row is missing.
- The database sets `createdAt` to the current time. `startedAt`, `finishedAt`, `pathToResult` and
  `testResultStatus` are `null` until a message sets them.
- The agent does not check the order of the two update messages. `UpdateSvtTestStart` on a test with a start time
  replaces it. `UpdateSvtTestFinish` on a test with no start time, or with an end time, still writes the values.
  In these cases the agent logs a warning.
- No message changes the DUT or the configurations of a test.

### 3.17 Enums

The domain has no table of its own and no write message.

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllEnums` | Returns the values of the enum types of the database schema. | 1. The list of names is a list of strings. If not: `BadRequest`, `<path> must be a list of strings`. | Nothing. |

- The names of the wanted enum types are a list of strings in `data.filter.enumNames`. The agent also reads the
  list from `data.enumNames` and from `data.enumsNames`. It uses the first of the three keys that has a value, in
  this order.
- No list, or an empty list, returns every enum type.
- The agent leaves a name that is not an enum type of the schema out of the reply. It is not an error.
- The message takes no pager. The agent does not check the other keys of `data.filter`.
- The reply `data` is a map with no wrapper: `{ "<enumType>": [ "<value>", … ] }`.
- The keys are the names of the enum types in the database. Example: the type of the chip block types is
  `blockType`.
- The values of a type are in the order in which the database declares them.
- The agent reads the catalogue of the database for each request. A value that was added to an enum type is in
  the next reply.

### 3.18 Users

Table: `SvtUser`. A user has a login, a name, a role of the enum `userRole`, a password hash and the flag
`isActive`. No message deletes a user: an Admin switches it off. The agent does not check who sends these messages;
the BFF allows the user management to an Admin only.

| Message | What it does | Checks, in order | Writes |
|---|---|---|---|
| `GetAllUsers` | Lists the users. | Standard list. Filter keys: `ids` (list of integers), `roles` (list of strings), `isActive` (boolean). | Nothing. |
| `GetUserCredentials` | Returns one user with its password hash. The BFF sends it at log-in. | 1. `data` is an object. If not: `BadRequest`, `data must be an object`.<br>2. `data.login` is a string. If not: `BadRequest`, `data.login must be a string`.<br>3. A user has the login. The agent trims `data.login` and compares it in lower case. If not: `NotFound`, `No user with this login`. | Nothing. |
| `CreateUser` | Creates an active user. | 1. Validation of `data.create` (below).<br>2. Enum check of `role`.<br>3. The insert. A login that exists already: `BadRequest`, the unique-constraint text of §1.4. | One `SvtUser` row, with `isActive` true. |
| `UpdateUser` | Changes the name, the role or the state of a user. | 1. Id check.<br>2. Validation of `data.update`: `name` (as in `CreateUser`), `role` (a value of `userRole`) and `isActive` (boolean) are optional. No other key is allowed, so `login` is rejected.<br>3. Enum check of `role`, when it has a value.<br>4. The user exists. If not: `NotFound`, `No user with id <id>`.<br>5. The last-Admin rule (below). If it is broken: `BadRequest`, `The installation must keep one active Admin`. | The changed columns of the `SvtUser` row. |
| `UpdateUserPassword` | Sets the password hash of a user. | 1. Id check.<br>2. `data.passwordHash` is a string. If not: `BadRequest`, `data.passwordHash must be a string`.<br>3. It has 1 to 255 characters. If not: `BadRequest`, `data.passwordHash must be 1 to 255 characters long`.<br>4. The user exists. If not: `NotFound`, `No user with id <id>`. | `passwordHash` of the `SvtUser` row. |

The validation of `data.create` of `CreateUser`. A key that the table does not name is rejected.

| Key | Rule | Stored as |
|---|---|---|
| `login` | A string. After trimming: 3 to 50 characters. After lower-casing: only `a-z`, `0-9`, `.`, `_` and `-`. | Trimmed, in lower case. |
| `name` | A string of 1 to 100 characters after trimming. | Trimmed. |
| `role` | `User`, `Expert`, `Developer` or `Admin`. | As sent. |
| `passwordHash` | A string of 1 to 255 characters. | As sent. |

- Item: `{ id, login, name, role, isActive, createdAt }`. No reply but that of `GetUserCredentials` holds
  `passwordHash`; `GetUserCredentials` replies `{ entity: { id, login, name, role, isActive, createdAt, passwordHash } }`.
- A length is a number of characters as the `varchar` column counts them (Unicode code points). A text that is too
  short or too long answers `<key> must be <min> to <max> characters long`, in `data.create: …` or
  `data.update: …`. This text is the agent's own, not one of the validation library.
- A login that exists already, in any case, answers the unique-constraint text of §1.4, because the stored login is
  in lower case. The insert does not fail: the agent inserts with `ON CONFLICT DO NOTHING` and reads "no row
  written" as the duplicate. Of two creates of one login at the same time, one writes the user. An `id` that a row
  entered by hand has taken answers the same text ([database-schema.md §5a.1](database-schema.md#5a1-svtuser)).
- `GetUserCredentials` returns a user with `isActive` false like any other. The caller decides.
- The database sets `createdAt` to the current time.
- `UpdateUser` writes the keys that have a value. An absent key or `null` keeps the value. An empty `data.update`
  answers `Success` and changes nothing.
- No message changes `login`.
- **The last-Admin rule.** `UpdateUser` refuses a change when the user is an active Admin, the change switches it off
  or gives it another role, and no other active Admin exists. The check and the write are in one transaction, which
  first takes one lock for all updates of users: the updates of users run one at a time. Of two changes at the same
  time that each remove one of the last two Admins, one is refused.
- The agent never writes a `passwordHash` to its log. The transactions of `CreateUser` and `UpdateUserPassword` log
  no query, also when the debug log is on.
- The hash is in the text of the SQL statement that the agent sends. A database server that logs statements logs
  it ([05 §7](05-implementation-notes.md#7-notes-per-domain), Users).

## 4. Index

The agent registers 55 message types. Every other type answers `Unknown request type` (§1.3). There is no message
for modules, and no `UpdateChip`, `UpdateEquipment`, `CreateProbeCard` or `GetEquipmentListForTestSetup`.

| Message type (wire name) | Reply type | Handlers file | Section |
|---|---|---|---|
| `GetAllWaferTypes` | `GetAllWaferTypesReply` | `src/modules/handlers/wafer-types/svt-db-agent-next-wafer-types.handlers.ts` | [3.1](#31-wafer-types) |
| `CreateWaferType` | `CreateWaferTypeReply` | `src/modules/handlers/wafer-types/svt-db-agent-next-wafer-types.handlers.ts` | [3.1](#31-wafer-types) |
| `GetWaferTypeMap` | `GetWaferTypeMapReply` | `src/modules/handlers/wafer-types/svt-db-agent-next-wafer-types.handlers.ts` | [3.1](#31-wafer-types) |
| `GetAllWafers` | `GetAllWafersReply` | `src/modules/handlers/wafers/svt-db-agent-next-wafers.handlers.ts` | [3.2](#32-wafers) |
| `CreateWafer` | `CreateWaferReply` | `src/modules/handlers/wafers/svt-db-agent-next-wafers.handlers.ts` | [3.2](#32-wafers) |
| `UpdateWafer` | `UpdateWaferReply` | `src/modules/handlers/wafers/svt-db-agent-next-wafers.handlers.ts` | [3.2](#32-wafers) |
| `UpdateWaferLocation` | `UpdateWaferLocationReply` | `src/modules/handlers/wafers/svt-db-agent-next-wafers.handlers.ts` | [3.2](#32-wafers), [2.8](#28-the-location-pattern-wafers-chips-equipment) |
| `GetWaferLocationHistory` | `GetWaferLocationHistoryReply` | `src/modules/handlers/wafers/svt-db-agent-next-wafers.handlers.ts` | [3.2](#32-wafers), [2.8](#28-the-location-pattern-wafers-chips-equipment) |
| `GetAllAsics` | `GetAllAsicsReply` | `src/modules/handlers/asics/svt-db-agent-next-asics.handlers.ts` | [3.3](#33-asics) |
| `CreateAsic` | `CreateAsicReply` | `src/modules/handlers/asics/svt-db-agent-next-asics.handlers.ts` | [3.3](#33-asics) |
| `GetAllChips` | `GetAllChipsReply` | `src/modules/handlers/chips/svt-db-agent-next-chips.handlers.ts` | [3.4](#34-chips) |
| `CreateChip` | `CreateChipReply` | `src/modules/handlers/chips/svt-db-agent-next-chips.handlers.ts` | [3.4](#34-chips) |
| `CreateManyChips` | `CreateManyChipsReply` | `src/modules/handlers/chips/svt-db-agent-next-chips.handlers.ts` | [3.4](#34-chips) |
| `UpdateChipLocation` | `UpdateChipLocationReply` | `src/modules/handlers/chips/svt-db-agent-next-chips.handlers.ts` | [3.4](#34-chips), [2.8](#28-the-location-pattern-wafers-chips-equipment) |
| `GetChipLocationHistory` | `GetChipLocationHistoryReply` | `src/modules/handlers/chips/svt-db-agent-next-chips.handlers.ts` | [3.4](#34-chips), [2.8](#28-the-location-pattern-wafers-chips-equipment) |
| `GetAllBlocks` | `GetAllBlocksReply` | `src/modules/handlers/chip-blocks/svt-db-agent-next-chip-blocks.handlers.ts` | [3.5](#35-chip-blocks) |
| `GetAllWaferProbeMachines` | `GetAllWaferProbeMachinesReply` | `src/modules/handlers/wp-machines/svt-db-agent-next-wp-machines.handlers.ts` | [3.6](#36-wafer-probe-machines) |
| `CreateWaferProbeMachine` | `CreateWaferProbeMachineReply` | `src/modules/handlers/wp-machines/svt-db-agent-next-wp-machines.handlers.ts` | [3.6](#36-wafer-probe-machines) |
| `UpdateWaferProbeMachine` | `UpdateWaferProbeMachineReply` | `src/modules/handlers/wp-machines/svt-db-agent-next-wp-machines.handlers.ts` | [3.6](#36-wafer-probe-machines) |
| `UpdateWpMachineLoadedWafer` | `UpdateWpMachineLoadedWaferReply` | `src/modules/handlers/wp-machines/svt-db-agent-next-wp-machines.handlers.ts` | [3.6](#36-wafer-probe-machines) |
| `UpdateWpMachineInstalledProbeCard` | `UpdateWpMachineInstalledProbeCardReply` | `src/modules/handlers/wp-machines/svt-db-agent-next-wp-machines.handlers.ts` | [3.6](#36-wafer-probe-machines) |
| `GetAllProbeCards` | `GetAllProbeCardsReply` | `src/modules/handlers/wp-probe-cards/svt-db-agent-next-wp-probe-cards.handlers.ts` | [3.7](#37-probe-cards) |
| `GetAllWaferProbeProjects` | `GetAllWaferProbeProjectsReply` | `src/modules/handlers/wp-projects/svt-db-agent-next-wp-projects.handlers.ts` | [3.8](#38-wafer-probe-projects) |
| `CreateWaferProbeProject` | `CreateWaferProbeProjectReply` | `src/modules/handlers/wp-projects/svt-db-agent-next-wp-projects.handlers.ts` | [3.8](#38-wafer-probe-projects) |
| `GetAllEquipmentTypes` | `GetAllEquipmentTypesReply` | `src/modules/handlers/equipment-types/svt-db-agent-next-equipment-types.handlers.ts` | [3.9](#39-equipment-types) |
| `CreateEquipmentType` | `CreateEquipmentTypeReply` | `src/modules/handlers/equipment-types/svt-db-agent-next-equipment-types.handlers.ts` | [3.9](#39-equipment-types) |
| `GetAllEquipment` | `GetAllEquipmentReply` | `src/modules/handlers/equipment/svt-db-agent-next-equipment.handlers.ts` | [3.10](#310-equipment) |
| `CreateEquipment` | `CreateEquipmentReply` | `src/modules/handlers/equipment/svt-db-agent-next-equipment.handlers.ts` | [3.10](#310-equipment) |
| `UpdateEquipmentLocation` | `UpdateEquipmentLocationReply` | `src/modules/handlers/equipment/svt-db-agent-next-equipment.handlers.ts` | [3.10](#310-equipment), [2.8](#28-the-location-pattern-wafers-chips-equipment) |
| `GetEquipmentLocationHistory` | `GetEquipmentLocationHistoryReply` | `src/modules/handlers/equipment/svt-db-agent-next-equipment.handlers.ts` | [3.10](#310-equipment), [2.8](#28-the-location-pattern-wafers-chips-equipment) |
| `GetAllSvtTestSetups` | `GetAllSvtTestSetupsReply` | `src/modules/handlers/svt-test-setups/svt-db-agent-next-svt-test-setups.handlers.ts` | [3.11](#311-svt-test-setups) |
| `CreateSvtTestSetup` | `CreateSvtTestSetupReply` | `src/modules/handlers/svt-test-setups/svt-db-agent-next-svt-test-setups.handlers.ts` | [3.11](#311-svt-test-setups) |
| `UpdateSvtTestSetup` | `UpdateSvtTestSetupReply` | `src/modules/handlers/svt-test-setups/svt-db-agent-next-svt-test-setups.handlers.ts` | [3.11](#311-svt-test-setups) |
| `GetAllSvtTestSetupConfigs` | `GetAllSvtTestSetupConfigsReply` | `src/modules/handlers/svt-test-setup-configs/svt-db-agent-next-svt-test-setup-configs.handlers.ts` | [3.12](#312-svt-test-setup-configurations) |
| `CreateSvtTestSetupConfig` | `CreateSvtTestSetupConfigReply` | `src/modules/handlers/svt-test-setup-configs/svt-db-agent-next-svt-test-setup-configs.handlers.ts` | [3.12](#312-svt-test-setup-configurations) |
| `GetSvtTestSetupConfigBody` | `GetSvtTestSetupConfigBodyReply` | `src/modules/handlers/svt-test-setup-configs/svt-db-agent-next-svt-test-setup-configs.handlers.ts` | [3.12](#312-svt-test-setup-configurations) |
| `GetAllSvtTestTypes` | `GetAllSvtTestTypesReply` | `src/modules/handlers/svt-test-types/svt-db-agent-next-svt-test-types.handlers.ts` | [3.13](#313-svt-test-types) |
| `CreateSvtTestType` | `CreateSvtTestTypeReply` | `src/modules/handlers/svt-test-types/svt-db-agent-next-svt-test-types.handlers.ts` | [3.13](#313-svt-test-types) |
| `UpdateSvtTestType` | `UpdateSvtTestTypeReply` | `src/modules/handlers/svt-test-types/svt-db-agent-next-svt-test-types.handlers.ts` | [3.13](#313-svt-test-types) |
| `GetAllSvtTestTypeConfigs` | `GetAllSvtTestTypeConfigsReply` | `src/modules/handlers/svt-test-type-configs/svt-db-agent-next-svt-test-type-configs.handlers.ts` | [3.14](#314-svt-test-type-configurations) |
| `CreateSvtTestTypeConfig` | `CreateSvtTestTypeConfigReply` | `src/modules/handlers/svt-test-type-configs/svt-db-agent-next-svt-test-type-configs.handlers.ts` | [3.14](#314-svt-test-type-configurations) |
| `GetSvtTestTypeConfigBody` | `GetSvtTestTypeConfigBodyReply` | `src/modules/handlers/svt-test-type-configs/svt-db-agent-next-svt-test-type-configs.handlers.ts` | [3.14](#314-svt-test-type-configurations) |
| `GetAllSvtTestTemplates` | `GetAllSvtTestTemplatesReply` | `src/modules/handlers/svt-test-templates/svt-db-agent-next-svt-test-templates.handlers.ts` | [3.15](#315-svt-test-templates) |
| `CreateSvtTestTemplate` | `CreateSvtTestTemplateReply` | `src/modules/handlers/svt-test-templates/svt-db-agent-next-svt-test-templates.handlers.ts` | [3.15](#315-svt-test-templates) |
| `UpdateSvtTestTemplate` | `UpdateSvtTestTemplateReply` | `src/modules/handlers/svt-test-templates/svt-db-agent-next-svt-test-templates.handlers.ts` | [3.15](#315-svt-test-templates) |
| `GetAllSvtTests` | `GetAllSvtTestsReply` | `src/modules/handlers/svt-tests/svt-db-agent-next-svt-tests.handlers.ts` | [3.16](#316-svt-tests) |
| `CreateSvtTest` | `CreateSvtTestReply` | `src/modules/handlers/svt-tests/svt-db-agent-next-svt-tests.handlers.ts` | [3.16](#316-svt-tests) |
| `UpdateSvtTestStart` | `UpdateSvtTestStartReply` | `src/modules/handlers/svt-tests/svt-db-agent-next-svt-tests.handlers.ts` | [3.16](#316-svt-tests) |
| `UpdateSvtTestFinish` | `UpdateSvtTestFinishReply` | `src/modules/handlers/svt-tests/svt-db-agent-next-svt-tests.handlers.ts` | [3.16](#316-svt-tests) |
| `GetAllEnums` | `GetAllEnumsReply` | `src/modules/handlers/enums/svt-db-agent-next-enums.handlers.ts` | [3.17](#317-enums) |
| `GetAllUsers` | `GetAllUsersReply` | `src/modules/handlers/users/svt-db-agent-next-users.handlers.ts` | [3.18](#318-users) |
| `GetUserCredentials` | `GetUserCredentialsReply` | `src/modules/handlers/users/svt-db-agent-next-users.handlers.ts` | [3.18](#318-users) |
| `CreateUser` | `CreateUserReply` | `src/modules/handlers/users/svt-db-agent-next-users.handlers.ts` | [3.18](#318-users) |
| `UpdateUser` | `UpdateUserReply` | `src/modules/handlers/users/svt-db-agent-next-users.handlers.ts` | [3.18](#318-users) |
| `UpdateUserPassword` | `UpdateUserPasswordReply` | `src/modules/handlers/users/svt-db-agent-next-users.handlers.ts` | [3.18](#318-users) |
