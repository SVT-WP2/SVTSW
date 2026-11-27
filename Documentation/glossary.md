# Glossary

The terms of SVTSW, one entry for each term: what it means, the other words that people use for it, and the names
it has in the database, on the wire and in the TypeScript contract. The [domain model](domain-model.md) and every
[flow](flows/README.md) use these terms. The domain model says how the entities relate and change.

Columns: **Database** is the table or the enum type of schema `main`. **Wire** is the noun in the message types of
the DB agent (`GetAll<…>`, `Create<…>`) and, after the slash, the type of
[`Shared/svt-ts-types`](../Shared/svt-ts-types/README.md).

## Silicon

| Term | Meaning | Also called | Database | Wire / TypeScript |
|---|---|---|---|---|
| **Engineering run** | A fabrication run of a chip design (`ER1`, `ER2`, `AncMPW2`, …). | run, ER | enum `engineeringRun` | field `engineeringRun` |
| **Foundry** | The company that makes the wafers. | | enum `foundryName` | field `foundry` |
| **Technology** | The process of the foundry. | wafer tech | enum `waferTech` | field `technology` |
| **Wafer type** | The design of a wafer: one engineering run, one foundry, one technology. | | `WaferType` | `WaferType` / `EpicWaferType` |
| **Wafer type map** | The JSON document of a wafer type that describes every die: groups, positions, family types, qualities. | wafer map, map | `WaferTypeMap` | `WaferTypeMap` / `EpicWaferTypeMap` |
| **Wafer** | One physical silicon wafer, with the serial number of the foundry. | | `Wafer` | `Wafer` / `EpicWafer` |
| **Batch number** | The lot number of the foundry for a wafer. | lot | `Wafer.batchNumber` | field `batchNumber` |
| **Die** | One position on a wafer, as the wafer type map describes it. The system stores a die as an ASIC. | | (in the map) | (in the map) |
| **ASIC** | One die of a registered wafer, with a serial number, a family type, a position and a quality. | die | `Asic` | `Asic` / `EpicAsic` |
| **ASIC family type** | The chip design that an ASIC implements (`MOSAIX`, `BABYMOSS`, `AncMPW2`, …). | chip type, family type, family | enum `asicFamilyType` | fields `familyType`, `asicFamilyType`, filter `familyTypes` |
| **ASIC quality** | The mechanical state of a die: mechanically integer, mechanically damaged, covered by the green layer. | quality | enum `asicQuality` | field `quality` |
| **Wafer map position** | Where the die is on the wafer map: `<row>_<column>`. | position | `Asic.waferMapPosition` | field `waferMapPosition` |
| **Chip** | An ASIC after dicing: a single die that is handled as its own object. | diced ASIC | `Chip` | `Chip` / `EpicChip` |
| **Chip block** | A functional block of an ancillary ASIC, tested as its own device. | block | `ChipBlock`; enum `blockType` | `Block` (`GetAllBlocks`), field `chipBlockType` / `EpicChipBlock` |
| **Block type** | The kind of a chip block, with the family prefix (`AncMPW2_SLDO`). | chip block type | enum `blockType` (to be renamed `chipBlockType`) | field `chipBlockType` |
| **Module** | An assembly of several chips. Not built. | | `Module`, `ModuleChipList` | none |

## Location

| Term | Meaning | Also called | Database | Wire / TypeScript |
|---|---|---|---|---|
| **General location** | Where an object is: an institute or a room. | location | enum `wpGeneralLocation` | field `generalLocation` |
| **Location history** | The list of the moves of a wafer, a chip or an equipment. | location records | `WaferLocation`, `ChipLocation`, `EquipmentLocation` | `Get<…>LocationHistory` / `EpicWaferLocationHistoryRecord`, `EpicChipLocationHistoryRecord`, `EpicEquipmentLocationHistoryRecord` |
| **Move** | A change of the general location, with a date, the user who made it and a note. | relocation, location update | one history row | `Update<…>Location` |

## Wafer probing

| Term | Meaning | Also called | Database | Wire / TypeScript |
|---|---|---|---|---|
| **Wafer probing** | The electrical test of the dies on a wafer, before dicing, with needles. | WP, probing | | prefix `Wp`, `WaferProbe` |
| **Wafer probe machine** | A station that probes wafers. | prober, WP machine, machine | `WaferProbeMachine` | `WaferProbeMachine`, `WpMachine` / `EpicWpMachine` |
| **Probe card** | The needle card that is mounted on a prober. | PC, card | `ProbeCard`, `ProbeCardFamilyType` | `ProbeCard` / `EpicWpProbeCard` |
| **Wafer probe project** | The definition of one probing job: one family type, on one wafer type, on one machine. | project, WP project | `WaferProbeProject` | `WaferProbeProject` / `EpicWpProject` |
| **Orientation** | How a wafer or a probe card is turned in the machine: north, south, east, west. | | enum `waferMapOrientation` | fields `loadedWaferOrientation`, `installedProbeCardOrientation`, `orientation` |
| **Load, unload** | To put a wafer on a machine, to take it off. | | `WaferLoadedInMachine`; enum `waferInMachineStatus` | `UpdateWpMachineLoadedWafer` |
| **Install** | To mount a probe card on a machine. | | `ProbeCardInstalledInMachine` | `UpdateWpMachineInstalledProbeCard` |
| **Alignment die**, **home die** | The two reference dies of a project. | | `WaferProbeProject.alignmentDie`, `.homeDie` | fields `alignmentDie`, `homeDie` |
| **Local-to-global map** | The JSON map from the coordinates of the prober to the coordinates of the wafer map. | | `WaferProbeProject.local2GlobalMap` | field `local2GlobalMap` |
| **WPAgent** | The control software of the prober. A service of this repository. | WP agent | | |

## Testing

| Term | Meaning | Also called | Database | Wire / TypeScript |
|---|---|---|---|---|
| **SVT test** | A test of a device on a test setup. "SVT" separates it from wafer probing. | test | `SvtTestList` | `SvtTest` / `EpicSvtTest` |
| **Equipment** | A laboratory instrument. | instrument | `Equipment` | `Equipment` / `EpicEquipment` |
| **Equipment type** | The kind of an instrument. | | `EquipmentType` | `EquipmentType` / `EpicEquipmentType` |
| **Test setup** | A test bench at a location. | setup | `SvtTestSetup` | `SvtTestSetup` / `EpicSvtTestSetup` |
| **Test setup configuration** | A named JSON document for a setup. | setup config | `SvtTestSetupConfig` | `SvtTestSetupConfig` / `EpicSvtTestSetupConfig` |
| **Default configuration** | The setup configuration that the TestAgent loads when the setup is selected. | default config | `SvtTestSetupDefaultConfig` | field `defaultConfigId` |
| **Test type** | A kind of test. | | `SvtTestType` | `SvtTestType` / `EpicSvtTestType` |
| **Test type configuration** | A named JSON document for a test type. | type config | `SvtTestTypeConfig` | `SvtTestTypeConfig` / `EpicSvtTestTypeConfig` |
| **Configuration body** | The JSON or JSON5 text of a configuration. Lists leave it out; a separate message returns it. | config body | `configBody` | `Get<…>ConfigBody` / `EpicSvtTestSetupConfigBody`, `EpicSvtTestTypeConfigBody` |
| **Device under test** | The device that a test runs on: an ASIC, a chip or a chip block. | DUT | `SvtTestListToEntityName`, `SvtTestListToEntityId` | fields `dutEntityName`, `dutId` |
| **DUT entity name** | The kind of the device under test: `Asic`, `Chip`, `ChipBlock`. | | enum `dutEntityName` | field `dutEntityName` / `EpicSvtDutEntityName` |
| **DUT type** | The category of device that a test type applies to: a family type or a block type. | | enum `dutType`; `SvtTestTypeDUTTypeList` | fields `dutType`, `dutTypes` |
| **Test template** | "Test type configuration X is enabled for DUT type Y": one entry of the menu of tests for a DUT type. | template | `SvtTestTemplate` | `SvtTestTemplate` / `EpicSvtTestTemplate` |
| **Result status** | The result of a finished test, as stored: `SUCCESS`, `PARTIAL_SUCCESS`, `FAILURE`, `ERROR`, `CANCELLED`. | test result status | enum `testResultStatus` | field `testResultStatus` / `EpicSvtTestResultStatus` |
| **Test status** | The status that the UI shows: Pending, Completed, Failed, Cancelled. The BFF derives it from the result status alone; the database does not store it. Nothing gives "Running" yet. | status | none | HTTP only / `EpicSvtTestStatus` |
| **Path to the result** | Where the result data of a test is. | | `SvtTestList.pathToResult` | field `pathToResult` |
| **TestAgent** | The software that runs the tests on a setup. A service of this repository. | test agent | | |

## Users

| Term | Meaning | Also called | Database | Wire / TypeScript |
|---|---|---|---|---|
| **User** | A person who works with the system, with a login, a name, a role and a password hash. Never deleted: switched off. | account | `SvtUser` | `User` / `EpicUser` |
| **Login** | The name a user types at log-in. Unique, in lower case. | user name | `SvtUser.login` | field `login` |
| **Role** | The level of a user: `User` < `Expert` < `Developer` < `Admin`. A role has every right of the roles below it. | level | enum `userRole` | field `role` / `EpicUserRole` |
| **Admin** | The highest role. An Admin manages the users. The installation always keeps one active Admin. | | value `Admin` of `userRole` | `EpicUserRole.Admin` |
| **Password hash** | What the system keeps of a password: an opaque string that the BFF makes. Only the reply of `GetUserCredentials` carries it. | hash | `SvtUser.passwordHash` | field `passwordHash` / `EpicUserCredentials` (Kafka only) |
| **Switched off** | A user that cannot log in. Its row stays. | inactive | `SvtUser.isActive` = `false` | field `isActive` |

## System

| Term | Meaning | Also called |
|---|---|---|
| **SVTSW** | This repository: the software of the SVT. | |
| **EpicMeasure** | The product name of the UI and its backend. It gives the `epic-` prefix of the apps and the `Epic` prefix of the TypeScript types. | Epic |
| **UI** | The Angular application `epic-measure-ui`. | front end |
| **BFF** | The backend of the UI, `epic-measure-api`: it turns the HTTP requests of the UI into Kafka requests. | API, back end for front end |
| **DB agent** | The service that reads and writes the database for all other services, over Kafka: `svt-db-agent-next` (`DbAgentNext/`). It is the DB agent of every environment. | DbAgent, the agent |
| **C++ DB agent** | The first DB agent, `svt-db-agent` (`DbAgent/`). Frozen, without support. | the C++ |
| **The clone** | An old name for `svt-db-agent-next` in the record of its decisions: it started as a re-implementation of the C++ DB agent. | DbAgentNext, the re-implementation |
| **Mock DB agent** | `epic-db-agent`, a DB agent with data in memory, for UI work without a database. | the mock |
| **Contract** | The description of the messages of a service, a file of [Kafka/](Kafka/SvtKafkaConventions.md). For the DB agent: `svt.db-agent-next.kafka.yaml`. | Kafka contract |
| **Message type** | The `type` of a Kafka request, for example `GetAllWafers`. The reply has the type with `Reply` at the end. | request type |
| **Envelope** | The fixed outer shape of a request (`type`, `data`) and of a reply (`type`, `status`, `data`, `error`). | |
| **Enum** | A list of allowed values that is a type of the database. The DB agent returns the values with `GetAllEnums`. | enumeration |
| **Parity** | The comparison of the replies of the C++ DB agent and of `svt-db-agent-next` to the same requests, made in November 2026. A record: a new feature gets no parity case. | parity run, parity suite |
| **Fork** | The decision of 2026-11-15: the DB agent is developed in `DbAgentNext/`, and the C++ DB agent is frozen ([record](decisions/2026-11-db-agent-clone.md)). Since 2026-11-18 `svt-db-agent-next` is the DB agent of every environment ([record](decisions/2026-11-db-agent-next-only.md)). | freeze |
| **Schema page** | `DbAgentNext/docs/database-schema.md`: the current schema of the database, and the place where a schema change is proposed. | |
