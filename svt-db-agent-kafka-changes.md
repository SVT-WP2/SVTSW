# SVT DB Agent: changes to the Kafka layer

What has to change in the DB agent's Kafka contract so that the test agents and the test plan service can work. The changes are written into `Documentation/Kafka/svt.db-agent.kafka.yaml`.

So far only the contract file is changed. The DB tables and the DB agent code still have to follow.

Related contracts:

- `Documentation/Kafka/svt.test.kafka.yaml`: the test agent, which runs one test.
- `Documentation/Kafka/svt.test-plan.kafka.yaml`: the test plan service, which runs many tests as a plan.

## 1. New entity: SvtTestPlan

A plan is an ordered list of existing SvtTests of one setup.

| Field | Meaning |
| --- | --- |
| `id`, `name`, `createdAt` | Identity |
| `setupId` | The setup the plan runs on |
| `failureRule` | `Continue`, `SkipDut` or `Pause` |
| `status` | `NotStarted`, `Running`, `Paused` or `Finished` |
| `svtTestIds` | The tests; the order of the list is the execution order |

## 2. New messages (5)

| Message | Sent by | What it does |
| --- | --- | --- |
| `GetAllSvtTestPlans` | UI, test plan service | Lists plans. Filters: `ids`, `setupIds`, `statuses`, plus pager. |
| `CreateSvtTestPlan` | UI | Creates a plan with status `NotStarted`. |
| `UpdateSvtTestPlan` | UI | Changes name, failure rule or the test list. |
| `UpdateSvtTestPlanStatus` | Test plan service | Stores the plan status. |
| `UpdateSvtTestReset` | Test plan service | Puts an aborted test back to "not started". |

## 3. Changes to existing entities

| Entity | Change | Filled by |
| --- | --- | --- |
| `SvtTestType` | New required field `testProcessingAgentType` | The user, when creating the test type |
| `SvtTest` | New field `setupId` | The DB agent on `CreateSvtTest`, from the setup config |
| `SvtTest` | New field `testProcessingAgentType` | The DB agent on `CreateSvtTest`, from the test type |
| `SvtTest` | New field `testPlanId`, empty outside a plan | The DB agent on create or update of a plan |

Why the two address fields are on the test: a test agent is addressed by the pair `setupId` and agent type. With both values on the SvtTest, the caller reads the address from the test and needs no other lookup.

## 4. Changes to existing messages

| Message | Change |
| --- | --- |
| `CreateSvtTestType` | Takes the new required `testProcessingAgentType`. |
| `CreateSvtTest` | Request is unchanged. The DB agent fills `setupId` and `testProcessingAgentType` itself. |
| `GetAllSvtTests` | New filter `testPlanIds`. The reply carries the three new test fields. |
| `GetAllSvtTestTypes` | The reply carries `testProcessingAgentType`. |
| `GetAllEnums` | Returns three more enums (section 5). |

## 5. Enums

| Enum | Values | Status |
| --- | --- | --- |
| `testProcessingAgentType` | `TestAgent`, `ITS3TestAgent` | New |
| `svtTestPlanFailureRule` | `Continue`, `SkipDut`, `Pause` | New |
| `svtTestPlanStatus` | `NotStarted`, `Running`, `Paused`, `Finished` | New |
| `testResultStatus` | Adds `ABORTED` | Existing, one new value |

## 6. Rules the DB agent has to enforce

- **One setup per plan:** every test of a plan must belong to the plan's setup.
- **One plan per test:** a test that already has a `testPlanId` cannot be added to another plan.
- **No edits while running:** `UpdateSvtTestPlan` is rejected while the plan status is `Running`.
- **Reset only after abort:** `UpdateSvtTestReset` works only on a test with result `ABORTED`. It clears `startedAt`, `finishedAt`, `pathToResult` and `testResultStatus`.
- **Existing rows need values:** existing test types need a `testProcessingAgentType`, and existing tests need `setupId` and `testProcessingAgentType`.

## 7. Already in the contract but not implemented

These four messages are documented today, and both new services depend on them. On `master` the DB agent does not implement them. They exist only as empty stubs on the unmerged branch `origin/289-db-test-list` (checked on 2026-09-30).

- `GetAllSvtTests`
- `CreateSvtTest`
- `UpdateSvtTestStart`
- `UpdateSvtTestFinish`
