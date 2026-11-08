# Wafer map: format, validation and ASIC generation

A wafer map is a JSON document of a wafer type. It describes every die of a wafer of that type.
When a client registers a wafer, `svt-db-agent-next` creates one ASIC row for each die of the wafer map.
The serial number and the position of an ASIC are business keys, and the agent derives both from the wafer map.
The algorithm is therefore part of the data model, and this page describes it in full. Related pages:
[domain-model.md](domain-model.md) (entities), [database-schema.md](database-schema.md) (tables `WaferTypeMap`,
`Asic`), [messages.md](messages.md) (the messages).

## 1. Where the map travels

| Step | Message | Place of the wafer map | Form |
|---|---|---|---|
| In | `CreateWaferType` | `data.create.waferMap` | A string that holds the JSON text. |
| Stored | — | Table `WaferTypeMap`, column `waferMap`, type `json` | The text as the client sent it. |
| Out | `GetWaferTypeMap` | `data.entity.waferMap` of `GetWaferTypeMapReply` | A string: the stored text, byte for byte. |
| Used | `CreateWafer` | The `WaferTypeMap` row of `data.create.waferTypeId` | The stored text, parsed with `JSON.parse`. |

- `CreateWaferType` reads only `data.create`. It ignores other keys of `data`, for example a top-level
  `data.waferMap`.
- `waferMap` must be a string. An object or an array gives `BadRequest`: `data.create: waferMap must be a string`.
- After the validation (section 3) the agent inserts the `WaferType` row and the `WaferTypeMap` row in one
  transaction.
- `WaferTypeMap.waferTypeId` is the primary key and references `WaferType.id`. A wafer type has at most one wafer map.
- The column type is `json`, not `jsonb`. The agent writes the string unchanged and reads the column as text
  (`SvtDbJsonTextType`). The white space and the key order of the client's text stay.
- `GetWaferTypeMap` takes `data.waferTypeId`, an integer. Without a `WaferTypeMap` row for that id it answers
  `NotFound` with `No wafer map for wafer type <id>`.
- `GetAllWaferTypes` does not return the wafer map. No message changes or deletes a stored wafer map.
- `CreateWafer` is the only message that generates ASICs from the wafer map (section 4). `CreateAsic` inserts one
  ASIC row from the request and does not read the wafer map.

## 2. Format

The owner of the format describes it in
[GlobalWaferMapFormat.txt](../../Documentation/WaferMap/GlobalWaferMapFormat.txt). The real wafer maps are in
[Configurations/WaferTypeMappings/](../../Configurations/WaferTypeMappings/). This section describes the
structure as the agent reads it. Terms on this page:

- A **group** is a named list of group elements. Each element has an index and a family type.
- A **row** is one entry of `MapGroups`. A **column** is one entry of `MapGroupsColumns` and places one group.
- A **die** is one index of a group that a column lists in `ExistingAsics`. Each die becomes one ASIC row.

### 2.1 Keys that the agent reads

| Key | Where | Type | Required | Meaning |
|---|---|---|---|---|
| `Groups` | top level | object | yes | The groups. The key is the group name, the value is the list of group elements. |
| `PosInGroup` | group element | integer | yes | The index of the element. It must equal the array index of the element, from 0. |
| `FamilyType` | group element | string | yes | The family type of the die. A value of the enum `asicFamilyType`. |
| `MapGroups` | top level | object | yes | The rows. The key is the row key, the value is the row. |
| `MapGroupsRow<n>` | key of `MapGroups` | object | no | One row. `<n>` is the row number, from 0 in the real wafer maps. |
| `SN_prefix` | row | string | no | A prefix for the serial numbers of the dies of quality `MechanicallyInteger` in the row. |
| `MapGroupsColumns` | row | array | yes | The columns of the row, in order. |
| `GroupName` | column | string | yes | The name of a group in `Groups`. Many columns can name the same group. |
| `ExistingAsics` | column | index list | no | The indexes of the group that exist as dies in this column. |
| `MechanicallyDamagedASICs` | column | index list | no | The dies of quality `MechanicallyDamaged`. |
| `ASICsCoveredByGreenLayer` | column | index list | no | The dies of quality `CoveredByGreenLayer`. |
| `MechanicallyIntegerASICs` | column | index list | no | The dies of quality `MechanicallyInteger`. |

An index list has one of these forms:

| Value | Meaning |
|---|---|
| absent, `null` or `[]` | No index. |
| an array with `"All"` as its first item | Every index of the group, from `0` to the group size minus 1. The agent ignores the other items. |
| an array of integers | Exactly those indexes, in the given order. |
| anything else | Not an index list. The validation rejects it. |

### 2.2 Keys that the agent ignores

- Every other top-level key. The real wafer maps have `FileName`, `MotherFilename`, `DateOfCreation`,
  `DateOfLastUpdate`, `Revision` and `Orientation`.
- `Property` of a column. It is a hint for a human reader.
- `Dies` and `MapDies`, which the format text describes. The real wafer maps do not have them.
- Any unknown key. The validation does not reject unknown keys.

The agent stores the whole text, so `GetWaferTypeMap` returns the ignored keys too. The agent does not read a
mother file ([ER1MotherFormat.txt](../../Documentation/WaferMap/ER1MotherFormat.txt)). A mother file has no
`Groups` and no `MapGroups`, so the validation rejects it.

The format text differs from what the agent reads in three places. It shows `MapGroupsRow` as an array with a key
`MapGroupsColumn`. It spells the last list `MechanicallyIntergerASICs`. It gives `ExistingAsics` as a range.
The agent reads only the keys and the forms of section 2.1. The format text also does not describe `SN_prefix`.

### 2.3 Example

[ER2WaferMap_v0.json](../../Configurations/WaferTypeMappings/ER2WaferMap_v0.json), trimmed and reformatted.
The comments name the parts that are left out.

```jsonc
{
  "FileName": "ER2WaferMap_v0.json",
  // MotherFilename, DateOfCreation, DateOfLastUpdate, Revision
  "Orientation": "West",
  "Groups": {
    "Group_0": [{ "PosInGroup": 0, "FamilyType": "MOSAIX" }],
    "Group_1": [{ "PosInGroup": 0, "FamilyType": "BABYMOSAIX" }]
    // Group_2 to Group_5, with 4 or 13 elements each
  },
  "MapGroups": {
    // MapGroupsRow0 to MapGroupsRow15
    "MapGroupsRow16": {
      "SN_prefix": "MOSAIX-1",
      "MapGroupsColumns": [
        { "GroupName": "Group_0", "Property": "WithMechanicallyIntegerASICs", "ExistingAsics": [0],
          "MechanicallyDamagedASICs": [], "ASICsCoveredByGreenLayer": [], "MechanicallyIntegerASICs": [0] }
      ]
    }
    // MapGroupsRow17 to MapGroupsRow36
  }
}
```

The whole file has 6 groups, 37 rows, 405 columns and 3421 dies. Nine rows have an `SN_prefix`: `babyMOSAIX-1` to
`babyMOSAIX-4` and `MOSAIX-1` to `MOSAIX-5`. Other columns use `["All"]`, for example in `MapGroupsRow1`.

## 3. Validation

Validation runs once for a wafer map: in `CreateWaferType`, before the agent writes anything. The handler first
checks the fields of `data.create` and the enum values of `engineeringRun`, `foundry` and `technology`. Then it
calls `validateWaferMap` with the text of `waferMap` and the values of the enum `asicFamilyType`. The agent reads
these values from the database for each request. `CreateWafer` and `GetWaferTypeMap` do not validate the stored
wafer map again.

The table lists the rules in code order. Each violation gives `BadRequest`. `<column>` is the column index, from 0.

| # | Rule | Error text | After a violation |
|---|---|---|---|
| 1 | The text is valid JSON. | `WaferTypeMap don't follow json format.` | stop |
| 2 | The document is an object. `Groups` and `MapGroups` are objects, not arrays and not `null`. | `Wrong json format. Missing Groups or MapGroups objects.` | stop |
| 3 | The enum `asicFamilyType` has at least one value. | `No ASIC FamilyType found.` | stop |
| 4 | Each value of `Groups` is an array. | `Group <group name> is not a list of elements` | go to the next group |
| 5 | `PosInGroup` of each group element equals its array index. | `Unmatching PosInGroup index: <PosInGroup> from expected <array index> in group <group name>` | continue |
| 6 | `FamilyType` of each group element is a string and a value of `asicFamilyType`. | `Asic Family type: <FamilyType> is not part of enum value in the DB` | continue |
| 7 | Each row has an array `MapGroupsColumns`. | `Map Group: <row key> has no MapGroupsColumns list` | stop |
| 8 | `GroupName` of each column is a string and names a group that is an array. | `Map Group: <row key> Col: <column> group name <GroupName> was not found` | stop |
| 9 | The four index lists of the column have a form of section 2.1. | `Map Group: <row key> Col: <column> Wrong array found` | stop |
| 10 | `ExistingAsics` has no more indexes than the group has elements. It has as many indexes as the three quality lists together. | `Map Group: <row key> Col: <column>, unmaching number of asics and properties size` | stop |
| 11 | Each index of `ExistingAsics` is in exactly one of the three quality lists. | `Map Group: <row key> Col: <column>, asic index <index> has more than one property` | stop |

- Rules 4 to 6 run for all groups first. The validation collects every violation of these rules.
- Rules 7 to 11 then run row by row and column by column, in the order of the document. The first violation ends
  the validation.
- The reply has `data: null` and `error.code` `-1`. After rule 3, `error.message` holds the collected violations
  of rules 4 to 6, then the violation of rules 7 to 11 if there is one. A line feed separates them.
- A missing value appears as `undefined` in the error text. Rule 11 gives the same text for an index that is in
  no quality list.

### What the validation does not check

- **Index range.** An index outside the group, also a negative one, passes. `CreateWafer` then fails with
  `Cannot generate the ASICs of the wafer: invalid familyType for asic <index> in group <GroupName>`.
- **Duplicate indexes.** Rule 10 compares only the sizes of the lists. `ExistingAsics: [0, 0]` passes when the
  sizes match. The generator then creates two ASIC rows for index 0.
- **Row keys.** Any key of `MapGroups` passes. The generator takes the row number from the key (section 4). Two
  keys with the same number, for example `MapGroupsRow1` and `MapGroupsRow01`, give duplicate positions and
  duplicate serial numbers.
- **`SN_prefix`.** The validation does not read it. In a row with an `SN_prefix` without `babyMOSAIX-`, two dies
  of quality `MechanicallyInteger` get the same serial number.
- **Length.** `Asic.serialNumber` holds 50 characters. No code checks the length of a generated serial number.
- **Empty wafer maps.** `Groups: {}` with `MapGroups: {}` passes, and so does a column without `ExistingAsics`.
  Such a wafer map generates no ASIC.
- **A `null` entry in `MapGroupsColumns`.** The validation throws. The reply is `UnexpectedError` with
  `Unexpected error while processing CreateWaferType`.

## 4. ASIC generation

### 4.1 When it runs

Generation runs in `CreateWafer`. The handler checks the request in this order. Each failure is a `BadRequest`.

1. `data.create` has the declared fields and no unknown key.
2. `generalLocation` is present: `data.create.generalLocation is required to create a wafer`.
3. `generalLocation` is a value of the enum `wpGeneralLocation`.
4. The wafer type exists: `Wafer type <id> does not exist`.
5. The wafer type has a wafer map: `Wafer type <id> has no wafer map`.

Then the agent opens one transaction and inserts the `Wafer` row. It calls `generateAsics` with two inputs: the
serial number of the wafer (`data.create.serialNumber`, `<waferSN>` below) and the parsed wafer map.

### 4.2 Algorithm

1. Take the keys of `MapGroups`. The row number `<row>` is the integer after the first 12 characters of the key
   (the length of `MapGroupsRow`), read in base 10.
2. Sort the rows by ascending row number. The order of the keys in the document does not matter.
3. For each row, set the die counter `<col>` to 0 and the counter `<k>` to 0. Read `SN_prefix`. An absent, `null`
   or empty `SN_prefix` means no prefix.
4. Walk the columns of `MapGroupsColumns` in array order. For each column, find the group by `GroupName` and
   expand the four index lists against the size of the group.
5. Walk the indexes of `ExistingAsics` in list order. `"All"` gives ascending order. For each index, create one
   ASIC:
   - `waferMapPosition` is `<row>_<col>`.
   - `quality` is the first match: `MechanicallyDamaged` if the index is in `MechanicallyDamagedASICs`, else
     `CoveredByGreenLayer` if it is in `ASICsCoveredByGreenLayer`, else `MechanicallyInteger` if it is in
     `MechanicallyIntegerASICs`.
   - `familyType` is the `FamilyType` of the group element at that index.
   - `serialNumber` follows the table below. Then add 1 to `<col>`.

`<col>` counts the dies of the whole row, across all its columns. It is not the index of the column and not
`PosInGroup`. The generated ASICs are in the order of the walk: by row number, then by column, then by index.

| Case | Pattern of `serialNumber` | Example |
|---|---|---|
| The quality is not `MechanicallyInteger`, or the row has no prefix | `<waferSN>_<row>_<col>` | `HS02697-24A0_3_0` |
| The quality is `MechanicallyInteger` and `SN_prefix` does not contain `babyMOSAIX-` | `<SN_prefix>_<waferSN>` | `MOSAIX-1_HS02697-24A0` |
| The quality is `MechanicallyInteger` and `SN_prefix` contains `babyMOSAIX-` | `<SN_prefix>_<k>_<waferSN>` | `babyMOSAIX-1_2_HS02697-24A0` |

In the third case the generator adds 1 to `<k>` before it builds the serial number. So `<k>` numbers the dies of
quality `MechanicallyInteger` in the row, from 1. The search for `babyMOSAIX-` is case-sensitive.

### 4.3 Insert and failures

One transaction holds the `Wafer` row, the first `WaferLocation` row and all ASIC rows. After a failure the
transaction rolls back: no wafer, no location row and no ASIC stay in the database.

- The `WaferLocation` row has the `generalLocation` of the request and the note `Location at creation`.
- The agent inserts the ASIC rows with one `insertMany` call, or with none when the wafer map has no die. Each
  row gets the `waferId` of the new wafer. The database assigns the `id`.
- `CreateWaferReply` returns the wafer only, not its ASICs.

| Failure | Status | `error.message` |
|---|---|---|
| The generation fails | `BadRequest` | `Cannot generate the ASICs of the wafer: <reason>` |
| A unique constraint fails (`Wafer.serialNumber` or `Asic.serialNumber`) | `BadRequest` | `Failed entry creation: an entry with the same unique value already exists` |

The generator does not validate the wafer map. It throws one of four errors: `Map Group: <row key> group name
<GroupName> was not found`, `Wrong array found`, `Wrong Asic quality property for asic <index>` or `invalid
familyType for asic <index> in group <GroupName>`. After a successful validation only the last error can occur.
An `SN_prefix` that is not a string also makes the generation fail.

### 4.4 Worked example

The wafer map below has one row with the row number 7 and two columns. The serial number of the wafer is
`HS01769-12A4`. The example is a case of the generation spec (section 5).

```json
{
  "Groups": {
    "Group_1": [{ "PosInGroup": 0, "FamilyType": "BABYMOSAIX" }, { "PosInGroup": 1, "FamilyType": "BABYMOSAIX" }]
  },
  "MapGroups": {
    "MapGroupsRow7": {
      "SN_prefix": "babyMOSAIX-1",
      "MapGroupsColumns": [
        { "GroupName": "Group_1", "ExistingAsics": [0, 1], "MechanicallyDamagedASICs": [1],
          "ASICsCoveredByGreenLayer": [], "MechanicallyIntegerASICs": [0] },
        { "GroupName": "Group_1", "ExistingAsics": ["All"], "MechanicallyDamagedASICs": [],
          "ASICsCoveredByGreenLayer": [], "MechanicallyIntegerASICs": ["All"] }
      ]
    }
  }
}
```

| Column | Index | `serialNumber` | `waferMapPosition` | `familyType` | `quality` |
|---|---|---|---|---|---|
| 0 | 0 | `babyMOSAIX-1_1_HS01769-12A4` | `7_0` | `BABYMOSAIX` | `MechanicallyInteger` |
| 0 | 1 | `HS01769-12A4_7_1` | `7_1` | `BABYMOSAIX` | `MechanicallyDamaged` |
| 1 | 0 | `babyMOSAIX-1_2_HS01769-12A4` | `7_2` | `BABYMOSAIX` | `MechanicallyInteger` |
| 1 | 1 | `babyMOSAIX-1_3_HS01769-12A4` | `7_3` | `BABYMOSAIX` | `MechanicallyInteger` |

The damaged die has no prefix in its serial number, but it still takes position `7_1`. `<k>` counts only the dies
of quality `MechanicallyInteger`, so the third die gets `_2_`.

## 5. What guards it

Unit specs (`npx vitest run src/db/data/wafer-maps`, 14 tests, no database):

- The validation spec accepts `ER2WaferMap_v0.json` and a minimal wafer map. It checks rules 1 to 3 and 9 to 11.
  It checks that the violations of rules 5 and 6 are collected, and that a violation of rule 8 ends the
  validation. It also checks every form of an index list.
- The generation spec checks the three patterns of the serial number and the numeric order of the rows. It checks
  three of the four errors of the generator. `dummy_MPW1_WaferMap.json` with `W-001` gives one ASIC, `W-001_0_0`.

The fixture `er2-HS02697-24A0.asics.json` is a digest of the `Asic` rows of the production wafer `HS02697-24A0`
(wafer type `ER2`). Its `source` field names the production dump of 2026-11-08. The fixture holds the number of
dies (3421) and the number of dies of each quality: 3147 `MechanicallyInteger`, 184 `CoveredByGreenLayer`, 90
`MechanicallyDamaged`. It also holds 15 complete sample ASICs and a SHA-256 digest. The digest covers one line
`serialNumber|waferMapPosition|familyType|quality` for each ASIC, sorted and joined with a line feed.
The generation spec generates the ASICs of `HS02697-24A0` from `ER2WaferMap_v0.json`. It compares the count, the
digest, the samples and the quality counts with the fixture. An equal digest proves that all four generated
values of all 3421 dies equal the production rows.

E2e specs (`npm run e2e`, the real application on a real PostgreSQL database):

- The wafer-types spec: `CreateWaferType` stores the wafer type and the wafer map. An invalid wafer map gives
  `BadRequest` with both violations and writes nothing. `GetWaferTypeMap` returns a string that equals the text
  of `ER2WaferMap_v0.json`. It answers `NotFound` for an id without a wafer map.
- The wafers spec: `CreateWafer` with the wafer map of ER2 writes the wafer, one location row and 3421 ASIC rows.
  The rows in the database have the digest and the samples of the fixture. A wafer map with two dies gives
  `W-SMALL-1_0_0` and `W-SMALL-1_0_1` in `id` order. A duplicate serial number of a wafer gives `BadRequest` and
  leaves the three tables unchanged.

These specs do not cover a duplicate serial number of a generated ASIC, or the gaps of section 3.

## 6. Reference files

| File | Content |
|---|---|
| [svt-db-wafer-map.models.ts](../src/db/data/wafer-maps/svt-db-wafer-map.models.ts) | The TypeScript shape of the wafer map. |
| [svt-db-wafer-map-validation.ts](../src/db/data/wafer-maps/svt-db-wafer-map-validation.ts), [spec](../src/db/data/wafer-maps/svt-db-wafer-map-validation.spec.ts) | `validateWaferMap` and `resolveIndexList` (the forms of an index list). |
| [svt-db-asic-generation.ts](../src/db/data/wafer-maps/svt-db-asic-generation.ts), [spec](../src/db/data/wafer-maps/svt-db-asic-generation.spec.ts) | `generateAsics`. |
| [er2-HS02697-24A0.asics.json](../src/db/data/wafer-maps/__fixtures__/er2-HS02697-24A0.asics.json) | The digest of the ASICs of a production wafer. |
| [svt-db-agent-next-wafer-types.handlers.ts](../src/modules/handlers/wafer-types/svt-db-agent-next-wafer-types.handlers.ts) | `CreateWaferType` (validation, storage) and `GetWaferTypeMap`. |
| [svt-db-agent-next-wafers.handlers.ts](../src/modules/handlers/wafers/svt-db-agent-next-wafers.handlers.ts) | `CreateWafer`: the checks, and the error text of a failed generation. |
| [svt-db-wafer-types.repository.ts](../src/db/data/wafer-types/svt-db-wafer-types.repository.ts) | Inserts the wafer type with its wafer map. Reads the wafer map. |
| [svt-db-wafer-type-map.entity.ts](../src/db/data/wafer-types/svt-db-wafer-type-map.entity.ts) | The entity of `WaferTypeMap`. |
| [svt-db-json-text.type.ts](../src/db/data/common/svt-db-json-text.type.ts) | Reads and writes a `json` column as its text. |
| [svt-db-wafers.repository.ts](../src/db/data/wafers/svt-db-wafers.repository.ts) | `createWithLocationAndAsics`: the transaction of `CreateWafer`. |
| [svt-db-asic.entity.ts](../src/db/data/asics/svt-db-asic.entity.ts) | The entity of `Asic`. `serialNumber` is unique. |
| [svt-db-agent-next-request-dispatcher.service.ts](../src/modules/dispatch/svt-db-agent-next-request-dispatcher.service.ts) | Builds the reply for a failure, also for a unique constraint. |
| [wafer-types.e2e-spec.ts](../test-e2e/wafer-types/wafer-types.e2e-spec.ts) | The e2e spec of `CreateWaferType` and `GetWaferTypeMap`. |
| [wafers.e2e-spec.ts](../test-e2e/wafers/wafers.e2e-spec.ts) | The e2e spec of `CreateWafer`. |
| [svt.db-agent-next.kafka.yaml](../../Documentation/Kafka/svt.db-agent-next.kafka.yaml) | The contract of `CreateWaferType`, `GetWaferTypeMap` and `CreateWafer`. |
| [GlobalWaferMapFormat.txt](../../Documentation/WaferMap/GlobalWaferMapFormat.txt) | The format of the wafer map as its owner describes it. |
| [ER1MotherFormat.txt](../../Documentation/WaferMap/ER1MotherFormat.txt), [ER1_mother.json](../../Configurations/WaferTypeMappings/ER1_mother.json) | The format of the mother file, and a mother file. The agent does not read a mother file. |
| [ER2WaferMap_v0.json](../../Configurations/WaferTypeMappings/ER2WaferMap_v0.json) | The wafer map of ER2: 37 rows, 3421 dies, rows with `SN_prefix`. |
| [ER1WaferMap_v0.json](../../Configurations/WaferTypeMappings/ER1WaferMap_v0.json) | The wafer map of ER1: 61 rows, 4436 dies, no `SN_prefix`. |
| [dummy_MPW1_WaferMap.json](../../Configurations/WaferTypeMappings/dummy_MPW1_WaferMap.json) | The smallest wafer map: one group, one row, one die. |
