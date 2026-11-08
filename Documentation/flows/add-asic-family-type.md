# Add an ASIC family type

**Goal.** A new ASIC family type (a new chip type) is a value of the database, and each service that must know it
accepts it.

**Touches.** The database, the [DB agent](../../DbAgentNext/docs/README.md), `Configurations/`, and, only for some
uses of the new family, [WPAgent](../../WPAgent/README.md) and [TestAgent](../../TestAgent/README.md). The
[UI](../../UI/docs/ARCHITECTURE.md) needs no change.

An ASIC family type is a value of the PostgreSQL enum `asicFamilyType` ([glossary](../glossary.md#silicon)). No
service has its own list of the values: the DB agent reads them from the database for each request, and the UI
gets them from the DB agent.

## Before you start

- **Agree the exact name.** The values are case-sensitive (`MosaixLeft` is not `MOSAIX`), and a value of a
  PostgreSQL enum cannot be removed.
- **Decide what the new family is used for.** Steps 1 to 3 are always necessary. Steps 4 to 8 depend on the use:
  a wafer map, tests, blocks, probing.
- The DB owner adds the value. The other steps are for the owner of each service.

## Steps

| # | Service | What to change | Where (files, tables, messages) | Docs |
|---|---|---|---|---|
| 1 | Database | Add the value to the enum `asicFamilyType`, in each database (dev, prod). The DB owner runs `ALTER TYPE main."asicFamilyType" ADD VALUE '<name>'`. A migration of the DB agent can do the same for all databases | The database; or `DbAgentNext/src/migrations/` (the pattern is `Migration20261108000002_test_result_status_cancelled.ts`) | [DbAgentNext/docs/02 §4](../../DbAgentNext/docs/02-database-migration.md#4-enums-keep-postgres-enums) |
| 2 | DB agent | Regenerate the snapshot of the enum values. Do not edit it by hand. The agent does not need it to serve the new value; it keeps the schema comparison empty | `DbAgentNext/src/db/data/enums/svt-db-enum-values.ts` | same |
| 3 | DB agent docs | Add the value to the list of the enum type in the schema page | `DbAgentNext/docs/database-schema.md`, §6 | [database-schema.md §6](../../DbAgentNext/docs/database-schema.md#6-enum-types) |
| 4 | Wafer map | If wafers have dies of the new family: use the value as `FamilyType` in the map of the wafer type. The DB agent validates the map against the enum when the wafer type is created | `Configurations/WaferTypeMappings/*.json`; format [`WaferMap/GlobalWaferMapFormat.txt`](../WaferMap/GlobalWaferMapFormat.txt) | [Register a wafer](register-wafer.md) |
| 5 | Database | If devices of the new family are tested: add the same value to the enum `dutType` (steps 1 to 3 again, for `dutType`). Then create the test types and the templates for it | enum `dutType`; `CreateSvtTestType`, `CreateSvtTestTemplate` | [Run an SVT test](run-svt-test.md) |
| 6 | Database | If the family has blocks: add the block types to the enum `blockType`, and the rows that connect the family to its block types. By hand: no message writes them | enum `blockType`, table `AsicFamilyTypeBlockList` | [domain model §2.5](../domain-model.md#25-chip-block), [database-schema.md](../../DbAgentNext/docs/database-schema.md#3-silicon) |
| 7 | Database | If a probe card probes the family: add the rows that connect the card to the family. By hand | table `ProbeCardFamilyType` | [domain model §4](../domain-model.md#4-wafer-probing), [database-schema.md](../../DbAgentNext/docs/database-schema.md#4-wafer-probing) |
| 8 | WPAgent | If WPAgent probes the family: add the family to its configuration | `WPAgent/configs/WPInitProbingConfig.json` (family to SENTIO project), `WPAgent/configs/WPMapConversion_*.json` (die maps) | [WPAgent/README.md](../../WPAgent/README.md) |
| 9 | TestAgent | If TestAgent tests the family: add the family to its map from family to chip name | `TestAgent/svt_test_agent/db_client.py` (`_map_family_to_chipname`) | [TestAgent/README.md](../../TestAgent/README.md) |
| 10 | UI mocks | Optional: add the value to the two hand-copied lists that the UI uses without a database | `UI/apps/epic-db-agent/src/modules/db-agent/services/epic-db-agent-enums.service.ts`, `UI/libs/epic-ui/api/__mock__/src/enums/models/epic-enums.mock.models.ts` | [UI/docs/ARCHITECTURE.md](../../UI/docs/ARCHITECTURE.md) |

## Check

1. Open the page `/admin/enums/by-name/asicFamilyType` of the UI, or call `GET /api/enums`. The new value is in
   the list.
2. Create a wafer type with a map that uses the value. The DB agent accepts it.
3. If step 5 was done: in the dialog that creates a test, a device of the new family shows the templates of its
   DUT type.

## Pitfalls

- **A family type is not automatically a DUT type.** They are two enums. The UI offers a template for a device only
  when the DUT type of the template is equal to the family type of the device (for a chip block: to its block
  type).
- **The UI keeps the enum values that it loaded.** Load the page again to see a new value.
- **The rename of the enum `blockType` to `chipBlockType` is pending**
  ([DbAgentNext/docs/02 §2](../../DbAgentNext/docs/02-database-migration.md#2-what-migration-1-adds)). Step 6 uses
  the name that the database has.
