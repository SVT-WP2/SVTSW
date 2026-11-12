# 08. Questions for the author

Everything in this folder that cannot be settled by reading the code or the database, collected
in one place. These are questions about **intent, domain rules, operations and history**. Plain
defects that the code review surfaced (in-memory pagination, error handling, transactions, SQL
building, crash cases) are deliberately **not** repeated here; they are recorded as observations
in [07](07-contract-drift-and-quirks.md) and need no explanation.

How to answer: write under **Answer** directly in this file, or reply in the review thread quoting
the question number. ★ marks the questions that block other work (schema migration, contract
clean-up, or the review of the docs themselves). Each question links to where the behaviour or the
data is described.

## Status (answers of 2026-11-08)

The author answered every question on 2026-11-08 (commit `1bf4153a`). Each question now carries a
**Status** line: **Resolved** when the answer settles it (the confirmation is carried into the other
docs, marked `Author (Q-n)`), **Open** when it is unanswered or answered only in part. 30 are
resolved; the 13 below still need an answer, and only what is listed here is still asked:

| Q | Still needed |
|---|---|
| Q1 | the serial-number rule for ER3 and later runs (ER2 is confirmed) |
| Q8 | whether to enforce one chip per ASIC in the schema (the author leaves it to the UI and DB owners) |
| Q15 | what the two orientations describe (notch position, card rotation); one enum for both is confirmed |
| Q22 | `UpdateSvtTestType`: replace the DUT-type set or only add to it, and which request shape; the filter semantics are confirmed |
| Q24 | whether one test can have several DUTs, and whether a test without a setup config is meaningful; the scheme itself is under validation |
| Q25 | the `testResultStatus` vocabulary, and who enforces the created → started → finished order |
| Q26 | what `pathToResult` points to |
| Q34 | whether `WaferTypeImage` is still planned |
| Q38 | other consumers of the agent, or readers of the database |
| Q39 | whether the stored timestamps are UTC (the author believes so), and the wire format |
| Q41 | operational knowledge that the repository does not capture |
| Q42 | serial-number formats, and who assigns chip and module serial numbers |
| Q43 | expected growth |

---

## A. Wafers, ASICs and wafer maps

### ★ Q1. ASIC serial-number rules

**Context.** [06 §4](06-wafer-map.md#4-asic-generation-algorithm): default `<waferSN>_<row>_<col>`;
in a map row with `SN_prefix`, intact dies get `<prefix>_<waferSN>`, and if the prefix contains
`babyMOSAIX-` a per-row counter is inserted, `<prefix>_<k>_<waferSN>`. Verified against all 41 052
prod ASICs.
**Question.** Is this the intended rule, or an encoding of the ER2 conventions only? A `MOSAIX-n` row
can hold exactly one intact die before serial numbers collide; is that a property of the map or of
the rule? What should happen for ER3 and later runs: more prefixes in the map, or a rule change?
**Answer.** Yes, ER2 MechanicalInteger MOSAIX and BabyMosaix use a different notation to follow ITS3 adopted naming. ER3
cases need TBD.
**Status.** Open — ER2 is confirmed (carried into 06 §4); the rule for ER3 and later runs is still to be defined.

### Q2. `waferMapPosition` numbering

**Context.** Position is `<row>_<col>` where `col` counts existing dies from the start of the row
across all group columns ([06 §4](06-wafer-map.md#4-asic-generation-algorithm)).
**Question.** Is this numbering used by anything downstream (WPAgent, probing projects,
`local2GlobalMap`)? Must the clone keep it exactly, or is it internal?
**Answer.** Yes, it's the convention.
**Status.** Resolved — the numbering is a convention consumers rely on and must be kept exactly (06 §4).

### Q3. Wafer-map validation leniency

**Context.** [06 §3](06-wafer-map.md#3-validation-checkwafertypemap) does not reject indices in a
quality list that are not in `ExistingAsics`, out-of-range or duplicate indices, or serial-number
collisions.
**Question.** Intentional tolerance for hand-written maps, or gaps that may be closed?
**Answer.** Maybe would be good to add some additional check.
**Status.** Resolved — tightening the validation is welcome (06 §3).

### Q4. Who produces the maps

**Context.** `Configurations/WaferTypeMappings` holds the maps and a "mother" file; the maps in
both databases are byte-identical to the repo files ([06 §6](06-wafer-map.md#6-reference-files)).
**Question.** Which tool generates them, and is the repo copy or the DB copy the master? Should the
agent ever accept a map that differs from the repo?
**Answer.** mapping is manually creted, Stefano was working on scripts to create automatically from the enginnerng
design, but not sure the current status.
**Status.** Resolved — maps are written by hand; a generator from the engineering design was being worked on by Stefano, status unknown (06 §6).

### Q5. Wafer dates and batch number

**Context.** `thinningDate`, `dicingDate`, `productionDate` are NULL on every prod wafer;
`batchNumber` is 2695 on eleven wafers and 1 on the first.
**Question.** Are the dates expected to be filled later through `UpdateWafer`? Is `batchNumber` the
foundry lot number, and is `1` on wafer `HS02697-24A0` a placeholder?
**Answer.** yes to all.
**Status.** Resolved — dates are filled in later through `UpdateWafer`; `batchNumber` is the foundry lot; `1` is a placeholder (05 §3).

## B. Chips, blocks and modules

### ★ Q6. Chip block serial numbers and generation

**Context.** The code builds `<blockType>_<chipSN>` but never runs (its lookup is rejected,
[05 §5](05-request-handlers.md#5-chip)); the three dev `ChipBlock` rows are named
`SLDO_AncMPW2-W1_0_0`, `NVBG_…`, `CML_TRANSCEIVER_…`, i.e. with the family prefix stripped
([03 §7](03-database-schema.md#7-data-in-the-2026-11-08-dumps)).
**Question.** Which naming is intended? Were the dev rows inserted by hand? Should blocks be created
automatically when a chip is created, and for every family type listed in `AsicFamilyTypeBlockList`?
**Answer.** Block were created as test and code was never tested, future user will define naming to use.
**Status.** Resolved — the dev rows were test data and the generation was never exercised; no naming is defined yet, so the feature stays inert until a user defines it (05 §5, 02 §1).

### Q7. `AsicFamilyTypeBlockList` ownership

**Context.** 3 rows in dev (`AncMPW2`), 0 in prod. No message type reads or writes it.
**Question.** Who maintains it, and is it expected to be complete for all ancillary family types
(`AncMPW1`, `AncMPW3`, `AncBrain`, `AncASIC` have no rows)?
**Answer.** Developer user manually create list of block types for each chip containing block.
**Status.** Resolved — maintained by hand by the developer user, per chip design that has blocks (03 §3, 05 §5).

### Q8. One chip per ASIC?

**Context.** `Chip.asicId` has no uniqueness constraint; the ASIC list query assumes at most one
chip per ASIC ([05 §4](05-request-handlers.md#4-asic)).
**Question.** Is a second chip for the same ASIC ever legitimate (re-dicing, re-registration)? If
not, may the schema enforce uniqueness?
**Answer.** In prinicple no, but let other to decide.
**Status.** Open — one chip per ASIC in principle, but the author leaves the schema decision to the UI and DB owners; not enforced for now (02 §1, 05 §4).

### ★ Q9. Module design

**Context.** Tables exist (empty) in dev and prod; the handler is unfinished and unregistered
([05 §6](05-request-handlers.md#6-module-unfinished-not-reachable)). The contract's `CreateModule`
takes `modType`, `chips[]`, `generalLocation` but the DB requires a `NOT NULL UNIQUE serialNumber`
that nothing generates.
**Question.** How is a module serial number formed? What do `IB0`, `IB1`, `IB2` denote, and does
the type constrain the number or family of chips? Can a chip belong to more than one module over
time? Is this feature needed in the near term?
**Answer.** Module entity is not complete and need development.
**Status.** Resolved — the module entity is incomplete and needs development; out of scope until then (05 §6, 02 §1).

## C. Locations and history

### ★ Q10. Current location vs history

**Context.** `Update*Location` appends a history row and then copies the **newest row by `date`**
(day resolution) onto the entity ([05 §1](05-request-handlers.md#1-shared-pattern-location-tracked-entities)).
Two moves on one day may leave the entity on the earlier one.
**Question.** Is the rule "current location = most recent history entry" the intended model? Should
history carry a timestamp rather than a date? Should the location be allowed to be corrected
without a history row (today forbidden for wafers, chips and equipment, allowed for prober
machines through `UpdateWaferProbeMachine`)?
**Answer.** Several relocation of the component in single day is not intended to happen.
**Status.** Resolved — several relocations of one component on one day are not expected; the day resolution stands (05 §1, 07 X-9).

### Q11. `username` and `note` on history rows

**Context.** `username` is NULL in every history row in both databases; creation rows get the note
`Location at creation`.
**Question.** Should the user be mandatory (and where would it come from: UI login, WPAgent)? Is the
creation note a convention consumers rely on?
**Answer.** Username feature is not implemented yet. need review after implementation in the GUI.
**Status.** Resolved — `username` is not implemented yet; to be reviewed once the GUI provides it (05 §1).

### Q12. Location vocabulary

**Context.** `wpGeneralLocation` has 11 values; only `CERN`, `CERN_186_R_E10` (and `Brunel` in dev)
are used. `ProbeCard` uses a separate `pcLocation` enum with 5 values.
**Question.** Is the room-level `CERN_186_R_E10` next to the institute-level `CERN` intentional
(two granularities in one enum)? Why a separate enum for probe cards?
**Answer.** Yes
**Status.** Resolved — both granularities in one enum and the separate probe-card enum are intentional (02 §1).

## D. Prober, probe cards and projects

### Q13. Wafer swap history

**Context.** On a swap the code writes one `Loaded` row and no `Unloaded` row for the previous
wafer ([05 §7](05-request-handlers.md#7-waferprobemachine)); prod's history has two `Loaded` rows
and no `Unloaded`.
**Question.** Should a swap record `Unloaded` then `Loaded`? Is the history meant to reconstruct
machine occupancy over time, or only to log loads?
**Answer.** In a swap a loaded wafer imply the previous wafer was unloaded.
**Status.** Resolved — a `Loaded` row implies that the previous wafer was unloaded; the single row on a swap is by design (05 §7, 07 X-8).

### Q14. Removing a probe card

**Context.** `UpdateWpMachineInstalledProbeCard` with a null card fails on the history table's
`NOT NULL probeCardId`; the table has no status column.
**Question.** Is "no card installed" a state that must be representable? If so, should the history
table get a status like the wafer one, or a nullable card id?
**Answer.** Maybe it would reflect a status "PC not installed".
**Status.** Resolved — the author suggests a status such as "PC not installed" (tentative; 05 §7, 07 D-13).

### Q15. Orientation semantics

**Context.** `loadedWaferOrientation` and `installedProbeCardOrientation` share the
`waferMapOrientation` enum (`North`…`West`); prod uses `West` for both.
**Question.** Orientation of what relative to what (notch position, card rotation)? Is the same enum
appropriate for both?
**Answer.** Yes,
**Status.** Open — one enum for both orientations is intended (05 §7); what each orientation describes is still unanswered.

### Q16. Probe cards: creation and family types

**Context.** `CreateProbeCard` exists in the code but not in the contract; `ProbeCardFamilyType` has
3 rows in prod and no message reads or writes it, although the contract's `ProbeCardDto` has an
`asicFamilyTypes` field ([07 §3](07-contract-drift-and-quirks.md#3-reply-shape-drift)).
**Question.** How are probe cards and their family types entered today (UI, psql)? Should the agent
return and maintain `asicFamilyTypes`?
**Answer.** They are created manually in the DB using psql.
**Status.** Resolved — probe cards and their family types are entered with psql; no write message is needed for now (05 §8).

### Q17. Probe project fields

**Context.** `alignmentDie` and `homeDie` are strings like `0,0` and `-2,1`; `local2GlobalMap` is
JSON stored from a client string ([05 §9](05-request-handlers.md#9-waferprobeproject)).
**Question.** Who defines the `local2GlobalMap` format (WPAgent?) and the die coordinate convention?
Should the agent validate either?
**Answer.** manually created by expert user.
**Status.** Resolved — written by hand by expert users; no validation expected (05 §9).

## E. Equipment and test setups

### Q18. Equipment specification

**Context.** `Equipment.specification` is free JSON; no schema.
**Question.** Is a structure intended (per equipment type), or is it free-form by design?
**Answer.** No for now.
**Status.** Resolved — free-form for now (05 §10).

### Q19. Setup equipment list

**Context.** `SvtTestSetupEquipList` has no message type that writes it; `GetEquipmentListForTestSetup`
returns `(setupId, equipId)` pairs where the contract promises equipment objects
([05 §11](05-request-handlers.md#11-svttestsetup)).
**Question.** How is the list populated today? Should the agent offer a message to set it? Which
reply shape did you intend?
**Answer.** Need future development, table is not curently populated.
**Status.** Resolved — future development; the table is not populated today (05 §11, 07 R-1).

### Q20. Default configuration

**Context.** One default config per setup (PK on `setupId`); `UpdateSvtTestSetup` only changes that
pointer and does not check that the config belongs to the setup.
**Question.** Is "default config" the configuration the TestAgent loads when a setup is selected?
Must it belong to the same setup?
**Answer.** Yes
**Status.** Resolved — the default config is the one the TestAgent loads and must belong to the same setup (05 §11).

## F. Test types, templates and tests

### ★ Q21. DUT type model

**Context.** `dutType` has `MOSAIX`, `BABYMOSAIX` (ASIC family types) and `AncMPW2_SLDO` (a block
type). `dutEntityName` (dev) is `Asic` / `Chip` / `ChipBlock`.
**Question.** Is a DUT type meant to be "a family type or a block type", i.e. a union that will grow
with every testable design? How does a DUT type map onto `dutEntityName` + `dutId` when a test is
created, and who decides that mapping (UI, TestAgent)?
**Answer.** yes, DUT is a subset of ASIC family type and block type union. dutEntityName and dutId define a unique
device, devices belong to unique DUT tht is defined at creation.
**Status.** Resolved — a DUT type is a family type or a block type; `dutEntityName` + `dutId` identify the device, whose DUT type is fixed at creation (02 §1).

### Q22. Filtering test types by DUT type, and updating them

**Context.** The `dutTypes` filter on `GetAllSvtTestTypes` is a no-op in the code; `UpdateSvtTestType`
only adds DUT types and reads a different request shape than the contract
([05 §13](05-request-handlers.md#13-svttesttype)).
**Question.** Intended filter semantics: test types applicable to **any** of the given DUT types, or
to **all**? Should the update replace the set or only add? Which request shape is the intended one?
**Answer.** Test types applicable to only dut type associated to.
**Status.** Open — the filter returns the test types associated with the given DUT type(s) (confirmed, 05 §13, 07 D-4); replace-vs-add and the request shape of the update are unanswered.

### Q23. Templates

**Context.** `SvtTestTemplate` = `(dutType, testTypeConfigId, isEnabled)`, unique per pair
([05 §14](05-request-handlers.md#14-svttesttemplate)).
**Question.** Is a template "this config is offered for this DUT type", consumed by the TestAgent
to build its menu? Does disabling a template affect tests already created from it?
**Answer.** Yes, test template define a list to perform from testAgent, test already created are not affected.
**Status.** Resolved — templates are the TestAgent's menu; disabling one does not affect existing tests (02 §1, 05 §14).

### ★ Q24. Test records: DUT reference and setup config

**Context.** Dev and the code reference the DUT polymorphically through `SvtTestListToEntityName`
and `SvtTestListToEntityId` (one row each per test in dev); prod still has the three typed link
tables `SvtAsicTestList`, `SvtChipTestList`, `SvtChipBlockTestList`
([03 §5](03-database-schema.md#5-where-dump-doc-and-code-disagree) S5). `testSetupConfigId` is
NOT NULL in dev, nullable in prod.
**Question.** Is the polymorphic pair the final design? Can one test have several DUTs (the link
tables allow it, the code treats it as one)? Is a test without a setup config meaningful?
**Answer.** This is a new scheme and need to be validated before move to production.
**Status.** Open — the polymorphic reference is a new scheme to be validated before production (05 §15); several DUTs per test and a test without setup config are unanswered.

### ★ Q25. Test result status

**Context.** `testResultStatus` is `varchar(50)` in prod and an enum (`SUCCESS`, `PARTIAL_SUCCESS`,
`FAILURE`, `ERROR`) in dev; the agent writes whatever string it receives; no value has been
written anywhere yet.
**Question.** Is the four-value enum the intended vocabulary, and does it align with the TestAgent's
own statuses? Should the agent enforce the created → started → finished order
([02 §3.2](02-domain-model.md#32-testing-from-test-type-to-test-result)), or is that the TestAgent's job?
**Answer.** TBD
**Status.** Open — no answer yet (TBD).

### Q26. `pathToResult`

**Question.** What does it point to (EOS path, URL, run directory)? Is there a convention the
agent could validate or at least document?
**Answer.** TBD
**Status.** Open — no answer yet (TBD).

## G. Configuration bodies

### ★ Q27. `configBody` type and ownership

**Context.** `json` in prod, `text` in dev, for both `SvtTestSetupConfig` and `SvtTestTypeConfig`
([03 §5](03-database-schema.md#5-where-dump-doc-and-code-disagree) S10). The agent treats the body
as opaque and excludes it from lists.
**Question.** Which column type is intended? Does anything require the body to be valid JSON? Who
owns the body format (TestAgent), and is there a schema per test type we should reference?
**Answer.** under test change need to be propagated to production when validated.
**Status.** Resolved — `text`, the type of the schema doc confirmed authoritative in Q31, is intended; dev is the version under test, to be propagated to production once validated (03 §5 S10). Who owns the body format stays undocumented.

### Q28. Config naming

**Context.** `SvtTestSetupConfig.name` is unique **globally**; `SvtTestTypeConfig.name` is unique
**per test type** ([03 §3.3](03-database-schema.md#33-equipment-and-testing)).
**Question.** Deliberate difference?
**Answer.** yes
**Status.** Resolved — deliberate (02 §4).

## H. Enumerations

### Q29. Enum value lifecycle

**Context.** Values are added with `ALTER TYPE … ADD VALUE` by the DB owner; the agent caches them
at startup ([05 §16](05-request-handlers.md#16-enums)). Prod, dev and the schema doc agree on every
value; 5 `asicFamilyType` values, 5 `pcModel`, 2 `pcName`, 8 locations and several prober values
have never been used ([03 §6.1](03-database-schema.md#61-values-actually-used-2026-11-08-data)).
**Question.** Is "DB owner adds values by hand, then restarts the agent" the intended workflow, or
should values be manageable through the UI? Are any of the never-used values obsolete and
removable? Will Postgres enums remain the mechanism, or is a lookup table acceptable?
**Answer.** lookup table would be fine.
**Status.** Resolved — a lookup table would be acceptable (03 §6). Whether unused values are obsolete was not answered.

### Q30. `blockType` vs `chipBlockType`

**Context.** The DB and the code say `blockType`; the contract says `chipBlockType` in `GetAllEnums`
and `GetAllChipBlocks` ([03 §5](03-database-schema.md#5-where-dump-doc-and-code-disagree) S15).
**Question.** Which name should survive?
**Answer.** chipBlockType
**Status.** Resolved — `chipBlockType` survives; the DB type and the schema doc are to be renamed (03 §5 S15, 07 R-11).

## I. Schema and deployment

### ★ Q31. Prod and dev schemas differ

**Context.** Prod lacks the September `SvtTestList` changes that the code on `master` requires
(`createdAt`, the `SvtTestListToEntity*` tables, the `dutEntityName` and `testResultStatus` enums,
the FK on `testSetupConfigId`), and differs on `configBody` ([03 §5](03-database-schema.md#5-where-dump-doc-and-code-disagree)).
**Question.** Which agent build is deployed in prod today, and does it match prod's schema? Is a
prod migration planned, and is there a DDL script or change log kept outside the repository that
we should bring into it?
**Answer.** Prod would be outdated, table scheme list in `Documentation/DB/DBTables/SVT_DB_Tables_SourceOfTruth.txt` is
the most correct scheme that must be deployed in dev.
**Status.** Resolved — prod is outdated; `SVT_DB_Tables_SourceOfTruth.txt` is the schema to deploy (03 §5, 07 §5, README).

### Q32. Schema conventions

**Context.** History and link tables have no primary key ([03 §4](03-database-schema.md#4-tables-without-a-primary-key));
every foreign key is `DEFERRABLE`; history tables use `date` rather than a timestamp
([03 §1](03-database-schema.md#1-conventions-in-the-real-database)).
**Question.** Are these deliberate (bulk loads, simplicity), and is there any objection to adding
surrogate ids and timestamps?
**Answer.** Ids for those table are not considered need and are omitted for simplicity, we alse decide to use date
instead timestamp.
**Status.** Resolved — no surrogate ids and `date` columns are deliberate choices for simplicity (03 §4, 02 §4).

### Q33. `SvtTestTemplate.testTypeConfigId` nullability

**Context.** Nullable in every database, `NOT NULL` in the schema doc (S11).
**Question.** Which is right?
**Answer.** Not sure, but probably not null.
**Status.** Resolved — probably NOT NULL, as the schema doc says (03 §5 S11).

### Q34. `WaferTypeImage`

**Context.** Table exists, empty, unused by the agent.
**Question.** Still planned (who writes it), or dead?
**Answer.** TBD
**Status.** Open — no answer yet (TBD).

### Q35. Deletion and correction

**Context.** The agent has no delete or archive operation ([02 §4](02-domain-model.md#4-identity-and-keys)).
**Question.** Is the database meant to be append-only? How are mistakes corrected today, and does
that happen in psql directly?
**Answer.**Yes, deletion is DB expert manually action only.
**Status.** Resolved — deletion is a manual action of a DB expert; the agent stays append-only (02 §4).

## J. Contract and consumers

### ★ Q36. Which contract is authoritative

**Context.** Three documents describe messages on the same topics: `svt.db-agent.kafka.yaml` (55
types, implemented), `svt.db-agent.kafka(ancASIC).yaml` (`GetAllTestSetups`, `CreateSLDOTest`, …,
implemented by nothing), and the TestAgent's own names (`GetAllTests`, `Create<Chip>Test`, …)
([07 §1](07-contract-drift-and-quirks.md#1-message-types-contract-vs-code)).
**Question.** Is the ancASIC document obsolete? Is the TestAgent expected to move to the main
contract, or the agent to serve its names?
**Answer.** `svt.db-agent.kafka.yaml`
**Status.** Resolved — `svt.db-agent.kafka.yaml` is the contract; the ancASIC file is obsolete and the TestAgent must move to it (07 §1, README).

### Q37. Code-only message types

**Context.** `UpdateChip`, `UpdateEquipment`, `CreateProbeCard` exist in the code and not in the
contract.
**Question.** Does anyone use them? Keep and document, or drop?
**Answer.** Need to beadded if used.
**Status.** Resolved — added to the contract only if someone uses them; nobody known does (07 §1).

### Q38. Other consumers

**Context.** Known: `epic-measure-api`, WPAgent, TestAgent ([README](README.md#who-talks-to-the-agent)).
**Question.** Does anything else talk to the agent or read the database directly (ITS3TestAgent,
SVTSupervisor, analysis scripts, Grafana)?
**Answer.** TBD
**Status.** Open — no answer yet (TBD).

### Q39. Date and time formats on the wire

**Context.** The agent returns dates as `YYYY-MM-DD` and timestamps as `YYYY-MM-DD HH:MM:SS.ffffff`
(Postgres text, no zone); the contract documents ISO 8601 with `Z`
([07 §3](07-contract-drift-and-quirks.md#3-reply-shape-drift) R-6).
**Question.** Are the stored timestamps UTC or local? Which format do you consider the contract?
**Answer.** UTC?
**Status.** Open — the author believes the timestamps are UTC but is not sure; the wire format was not addressed (05 §15, 07 R-6).

## K. History and operations

### Q40. FRED

**Context.** A comment in `svt_db_agent.cpp` says the DB connection may be removed "once integrated
with FRED"; nothing else mentions it.
**Question.** Was embedding the agent in FRED (or another C++ framework) a plan? Is it still?
**Answer.** FRES is old, we should update the comment removing FRED.
**Status.** Resolved — the comment in `svt_db_agent.cpp` was removed together with these answers.

### Q41. Operational knowledge not in the repository

**Question.** Restart procedures, known failure modes, manual SQL that is run regularly, how the
50 MiB Kafka limit was arrived at, how long a `CreateWafer` takes on ER1 (4 436 dies): anything
you do or know that the docs do not capture.
**Answer.**TBD
**Status.** Open — no answer yet (TBD).

### Q42. Serial-number formats

**Context.** Wafer serial numbers look like `HS02695-15C6` (foundry lot and slot); one dev wafer's
serial number ends in a tab character ([03 §7](03-database-schema.md#7-data-in-the-2026-11-08-dumps)).
Chip serial numbers are free text.
**Question.** Is there a format per foundry or per entity that should be validated? Who assigns chip
and module serial numbers?
**Answer.**TBD
**Status.** Open — no answer yet (TBD).

### Q43. Expected growth

**Question.** Roughly how many wafers per year and per engineering run, and how many chips and
tests? This decides whether unpaged list replies (today all rows, up to 50 MiB per message) stay
viable.
**Answer.** TBD
**Status.** Open — no answer yet (TBD).

---

Items confirmed by data rather than by asking, for completeness: the ASIC generation rule (Q1)
reproduces every ASIC in both databases; the stored wafer maps equal the repo files; the enum
values in prod, dev and the schema doc are identical for every type prod has.
