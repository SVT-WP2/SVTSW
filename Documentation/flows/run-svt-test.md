# Run an SVT test

**Goal.** A test of one device is in the database, from its creation to its result.

**Touches.** The [UI and its BFF](../../UI/docs/ARCHITECTURE.md), the
[DB agent](../../DbAgentNext/docs/README.md), and [TestAgent](../../TestAgent/README.md).

**State of this flow: only the first half works.** The UI can prepare and create a test (steps 1 to 6). No service
of this repository records the start and the finish of a test (steps 7 and 8), so every test stays "Pending" in
the UI. The section [What is missing](#what-is-missing) says what must be built.

What the entities mean: [domain model §5](../domain-model.md#5-testing).

## Before you start

- **The device exists**: an ASIC, a chip or a chip block.
- **The DUT type exists.** The enum `dutType` has a value that is equal to the family type of the device (for a
  chip block: to its block type). See [Add an ASIC family type](add-asic-family-type.md), step 6.
- The test setup and the test type can exist already; steps 1 to 5 are done one time for each of them, not for
  each test.

## Steps

| # | Service | What to do | Where (files, tables, messages) | Docs |
|---|---|---|---|---|
| 1 | UI → BFF → DB agent | Create the test setup with its first configuration, which becomes the default | page `/admin/svt-test/test-setups/list`; `POST /api/svt-test-setups`; `CreateSvtTestSetup`; tables `SvtTestSetup`, `SvtTestSetupConfig`, `SvtTestSetupDefaultConfig` | [DbAgentNext/docs/01 §6.7](../../DbAgentNext/docs/01-behaviour-decisions.md#67-svt-test-setups-test-types-templates) |
| 2 | UI → BFF → DB agent | Optional: add more configurations to the setup | `POST /api/svt-test-setup-configs`; `CreateSvtTestSetupConfig`; table `SvtTestSetupConfig` | same |
| 3 | UI → BFF → DB agent | Create the test type with its DUT types and its first configuration | page `/admin/svt-test/test-types/list`; `POST /api/svt-test-types`; `CreateSvtTestType`; tables `SvtTestType`, `SvtTestTypeDUTTypeList`, `SvtTestTypeConfig` | same |
| 4 | UI → BFF → DB agent | Optional: add more configurations to the test type | `POST /api/svt-test-type-configs`; `CreateSvtTestTypeConfig`; table `SvtTestTypeConfig` | same |
| 5 | UI → BFF → DB agent | Create a template: one DUT type with one test type configuration, enabled | page `/admin/svt-test/test-templates/list`; `POST /api/svt-test-templates`; `CreateSvtTestTemplate`; table `SvtTestTemplate` | same |
| 6 | UI → BFF → DB agent | Create the test. The dialog offers the enabled templates of the DUT type of the device, and sends the test type configuration of the chosen template with the setup configuration | page `/svt-tests`; `POST /api/svt-tests`; `CreateSvtTest` with `dutEntityName`, `dutId`, `testTypeConfigId`, `testSetupConfigId`; tables `SvtTestList`, `SvtTestListToEntityName`, `SvtTestListToEntityId` | [DbAgentNext/docs/01 §6.8](../../DbAgentNext/docs/01-behaviour-decisions.md#68-svt-tests) |
| 7 | not built → DB agent | Record the start | `UpdateSvtTestStart` with `id` and `update.startedAt`; column `SvtTestList.startedAt` | same |
| 8 | not built → DB agent | Record the finish: the time, the path to the result, the result status | `UpdateSvtTestFinish` with `id` and `update.finishedAt`, `update.pathToResult`, `update.testResultStatus`; columns of `SvtTestList` | same |

The code of steps 1 to 6: the BFF controllers are in `UI/apps/epic-measure-api/src/modules/svt-test/controllers/`,
the handlers of the DB agent are in `DbAgentNext/src/modules/handlers/svt-test-*/` and `svt-tests/`, and the UI
libraries are in `UI/libs/epic-ui/shared/svt-tests/`.

The status that the UI shows comes from the result status alone. The BFF derives it
(`resolveEpicSvtTestStatus` in `UI/libs/epic/entities/src/svt-tests/models/epic-svt-test-status.models.ts`): no
result is "Pending"; `SUCCESS` and `PARTIAL_SUCCESS` are "Completed"; `FAILURE` and `ERROR` are "Failed";
`CANCELLED` is "Cancelled". The start time and the finish time have no effect on it, and nothing gives "Running".

## Check

- After step 6: the page `/svt-tests` lists the test with the status "Pending", and the details page of the device
  shows it.
- After step 8 (with a message sent by hand or by a test): the list shows "Completed", "Failed" or "Cancelled".
  The e2e spec `DbAgentNext/test-e2e/svt-tests/` sends both messages.

## What is missing

- **A sender of steps 7 and 8.** The DB agent serves `UpdateSvtTestStart` and `UpdateSvtTestFinish`, and the
  TypeScript contract has the message classes. The BFF has no route for them, and TestAgent does not send them.
- **A link from a created test to TestAgent.** TestAgent runs a test on a command from `svt.test-agent.request`
  ([its contract](../../TestAgent/docs/svt.test-agent.kafka)). No service sends that command for a test that the
  UI created.
- **TestAgent speaks another dialect to the DB agent** (`TestAgent/svt_test_agent/db_client.py`):
  - it sends `GetAllChip`, `ResolveChipName` and `Create<chip name>Test` (for example `CreateSLDOTest`). The
    contract has `GetAllChips` and `CreateSvtTest`, and no `ResolveChipName`;
  - it sends the headers `correlationId` and `replyTopic`. The DB agent needs `kafka_correlationId` and
    `kafka_replyTopic` ([conventions](../Kafka/SvtKafkaConventions.md)); without them it sends no reply;
  - it ignores a failed save.
- **Decisions that are open** ([domain model §5.2](../domain-model.md#52-test)): the vocabulary of the result
  status, who enforces the order created, started, finished, what the path to the result points to, and whether
  one test can have several devices.

## Pitfalls

- **The DB agent does not enforce the order.** A finish before a start is recorded and logged. A second start or
  finish replaces the first.
- **`CANCELLED` exists only in a database that has migration 2** of the DB agent.
- **A template has no id in the test.** The test keeps the test type configuration; a template that is disabled
  later does not change the test.
