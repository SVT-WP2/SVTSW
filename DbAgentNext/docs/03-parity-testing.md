# 03. Parity testing

The clone is accepted when a black-box suite over Kafka produces the same replies as the C++ agent
for every message type, except where [01-behaviour-decisions.md](01-behaviour-decisions.md) says
the difference is intentional. The suite is written once, in TypeScript (Vitest, `kafkajs`), and
run against both implementations.

## 1. Why snapshot the C++ first

The current agent has no tests. Its exact replies, including the quirks, are only knowable by
running it. Snapshotting them gives the clone a target and gives the author's review of
[DbAgent/docs](../../DbAgent/docs/README.md) hard evidence for every "by code reading" claim.

## 2. Environment

- Kafka: `Dev/docker-compose.kafka-local.yml` (50 MiB message limit already configured).
- Database: `Dev/docker-compose.postgres.yml`, then restore the **dev** dump of 2026-11-08, whose
  schema matches `master` and which carries fixtures for every entity:

  ```bash
  pg_restore --no-owner --no-privileges -d svt_sw_db Dev/db-example/2026-11-08-backup.dump
  ```

  The **prod** dump (`2026-11-08-backup_prod.dump`) is the realistic load case (41 052 ASICs) but
  lacks the September `SvtTestList` schema, so `master`'s test handlers fail against it; record
  that, then run the test cases on the dev dump. See
  [Dev/db-example/README.md](../../Dev/db-example/README.md).
- C++ agent: `Dev/docker-compose.swtsw.yml` service `svt-db-agent`.
- Clone: the same compose service with the Node image, or `nx serve` against the same broker.

## 3. Harness shape

One client per run: produce to `svt.db-agent.request` with the three headers, consume
`svt.db-agent.request.reply`, match on `kafka_correlationId`, record headers and the parsed value.
Snapshots are stored per message type and case. Compare:

- `status`, `type`, `error.code`;
- `error.message` after stripping the C++ `[file:line]\n` prefix (intentional difference R-9);
- `data` as a JSON value with keys sorted (key order is an intentional non-difference, R-14);
- for lists, `items` as a set keyed by `id` where order is not specified by the C++ (no `ORDER BY`
  on relation and history lists), and as an ordered list where it is (`ORDER BY id`).

Write cases reset the database between runs (restore the dump, or wrap each case in a transaction
rolled back via a test-only DB connection; the C++ cannot participate in that, so a restore is
simpler).

## 4. Cases

1. Every `GetAll*` with: no `data.filter`; `filter.ids` for one and for several ids; each declared
   filter with a matching and a non-matching value; an undeclared filter key; `filter` values of
   `null`, `true`, `[]`, mixed-type arrays; with and without `pager`; `pager.offset` beyond the
   result size.
2. Every `Create*` with the contract's full body; with each optional field absent; with each
   optional field `null`; with a boolean field; with a JSON field sent as string and as object;
   with a `'` in a string field; with a duplicate business key.
3. Every `Update*` on an existing id; on a missing id; with `generalLocation` in a generic update;
   with an empty `update`.
4. `CreateWafer` once per map in `Configurations/WaferTypeMappings`, comparing the full generated
   ASIC set (serial numbers, positions, qualities, family types) exactly. These three files are the
   unit-test fixtures for the validation and generation functions as well. The expected output
   already exists: the `Asic` rows of the 2026-11-08 dumps regenerate exactly from the stored maps
   with the algorithm in [DbAgent/docs/06 §4](../../DbAgent/docs/06-wafer-map.md#4-asic-generation-algorithm)
   (12 of 12 prod wafers, 15 of 15 dev wafers), so a unit test can assert the clone's generator
   against those rows directly.
5. `UpdateWpMachineLoadedWafer`: load into an empty machine; swap; unload; unload when empty; load
   without orientation. `UpdateWpMachineInstalledProbeCard`: install; replace; uninstall (null).
6. Location flows: `Create*` then `Get*LocationHistory` (the "Location at creation" row);
   `Update*Location` twice on one day, then read the entity's `generalLocation`.
7. Test flows: `CreateSvtTestType` with config, `CreateSvtTestSetup` with default config,
   `CreateSvtTestTemplate` with `isEnabled: false`, `CreateSvtTest`, `UpdateSvtTestStart`,
   `UpdateSvtTestFinish`, `GetAllSvtTests` with each contract filter.
8. Envelope: missing `kafka_correlationId`; missing `kafka_replyPartition`; `type: ""`; unknown
   `type`; payload without `data`; payload without `type`; non-string `type`; non-JSON value. For
   the C++ the last four are recorded as "process restarted" rather than as a reply.
9. `GetAllEnums` with no names, with `data.enumNames`, with `data.filter.enumNames`, with an
   unknown name.
10. Heartbeat: one record every 2 s on `svt.db-agent.heartbeat` with a string `timestamp`.

## 5. Intentional differences

Every row marked **fix** in [01-behaviour-decisions.md](01-behaviour-decisions.md) corresponds to
cases above whose expected value for the clone is the contract's, not the snapshot. The harness
keeps that list explicitly (a map from case id to "expected: contract") so a parity failure is
either a bug or a listed decision, never a surprise.

The list is `test-parity/utils/parity-known-differences.ts`. An entry covers whole cases, so it lists a case
only when its decision explains **every** difference of that case; a case that also shows a bug or an open
question stays out and keeps failing.

### 5.1 First run against the C++ agent (2026-11-14)

Both agents on their own restore of `Dev/db-example/2026-11-08-backup.dump` (the clone's with migrations 0–4),
recorded the same day: `test-parity/snapshots/cpp.json` (the C++ image built from `DbAgent/`, 6 restarts, no
reply to three malformed records) and `next.json`; the comparison is `snapshots/report.md`.

| Verdict | Cases |
|---|---|
| same | 161 |
| intentional (a listed decision) | 182 |
| different | 53 |

The 182 intentional cases, by decision: the chip-block handler the C++ lacks (07 §1, 21 cases), `Q-F1` (a wrong
filter value is a `BadRequest`, 16), `R-9` (other message texts, 19), `X-4` (paging in the database, 19),
`D-3` (every `GetAllSvtTests` filter, 20), `R-6` and newest-first svt-tests (9), `R-10` (no `asicId` on
chips, 12), the test flow after the C++ failed `CreateSvtTestSetup` (`X-5`, `X-1`, 10), `X-9` (8), `R-12` (7),
and `R-13`, `R-8`, `R-2`, `R-7`, `X-2`, `X-10`, `X-12`, `D-1`, `D-2`, `D-4` to `D-13`, the `CANCELLED` test status
(01 §3) and the envelope headers for the rest. The registry has a note per entry.

The 53 different cases are not decisions:

| # | Cases | What differs | Kind |
|---|---|---|---|
| 1 | 34: `pager-first`, `pager-second`, `pager-beyond` of `wafer-types`, `equipment-types`, `equipment`, `wp-machines`, `wp-probe-cards`, `wp-projects`, `svt-test-setups`, `svt-test-setup-configs`, `svt-test-types`, `svt-test-type-configs`, `svt-test-templates`; `svt-test-type-configs/pager-offset-only` | These 11 list handlers ignore `data.pager` and return every row. Only `wafers`, `asics`, `chips`, `chip-blocks` and `svt-tests` call `optionalPager`. | **Bug** of the clone: the agent's contract (`svt.db-agent-next.kafka.yaml`, "Lists, filters and paging") and the C++ page every list. **Fixed** (§5.2). |
| 2 | 8: `wp-projects` lists (7), `wafer-types/map` | `local2GlobalMap` and `waferMap` come back re-serialised (compact); the C++ returns the stored text. | **Bug** of the clone: the columns are `json` (which keeps the text) but the entities map them as MikroORM `type: 'json'` (parse, then `JSON.stringify`); the contract says "returned byte for byte" (R-7). `Equipment.specification` is mapped the same way. **Fixed** (§5.2). |
| 3 | 7: `wp-probe-cards` lists | The C++ returns the column `version`; the clone does not (it adds `asicFamilyTypes`, R-3). | **Open:** `version` is in neither contract (like `asicId` on chips, R-10). Drop it (as now) or add it to the contract. |
| 4 | 1: `flow/wafer-type-map` (and `wafer-types/map`) | The C++ adds `waferTypeId` to the `GetWaferTypeMap` entity. | **Open:** not in `WaferTypeMapDto`; same question as row 3. |
| 5 | 2: `flow/wp-machine-load-no-orientation`, `flow/wp-machine-unload-again` | Loading a wafer without `loadedWaferOrientation` is a `BadRequest` in the clone; the C++ accepted it (the second case follows from the first). | **Open:** the clone's contract requires the orientation, but no decision row backs it. WPAgent sends the key, with `None` as the default value; confirm with the WPAgent team. |
| 6 | 1: `envelope/missing-reply-partition` | The C++ answers `BadRequest` without `kafka_replyPartition`; the clone replies `Success`. | **Open:** 01 §2 says the header is required "(NestJS does the same)", but NestJS only copies it when present ([04 §2](04-runtime-and-deployment.md#2-kafka-transport)). Correct the decision row, or require the header. |

Found in the harness: the location row written by a `Create*` carries the day of the run (`date` from `now()`),
and the case does not blank it, so recordings of different days differ in `flow/*-location-at-creation` and in the
order of `flow/wafer-history-after-moves`. Record both agents on the same day.

### 5.2 After the two fixes (2026-11-14)

The two bugs of §5.1 are fixed: the 11 list handlers page in the database (`findPage` with `findAndCount`, as the
others), and the three `json` columns are mapped by `SvtDbJsonTextType` (`src/db/data/common`), which reads them
with `::text` and writes the string as sent, so the stored text comes back byte for byte. The e2e suite checks
both (`expectListPaging` in every list spec; the equipment, WP-project and wafer-map specs compare the text).
The clone was recorded again the same day on a fresh restore; `cpp.json` is unchanged.

| Verdict | Cases |
|---|---|
| same | 189 |
| intentional (a listed decision) | 193 |
| different | 14 |

The 28 cases of the two bugs now match the C++ or a decision: the `pager-beyond` cases of the 11 lists answer
`items: []` with the real `totalCount` (`X-4`, 11 more intentional cases), the others are the same. The 14 different
cases are the open questions 3 to 6 of §5.1 (9 probe-card cases, 2 wafer-map cases, 2 wafer loads, 1 envelope).

Found while re-recording, in the clone's Kafka set-up; **both fixed the same day** (`postfixId: ''`, and
`SvtDbAgentNextKafkaBacklogService` skips the backlog at start, [04 §2](04-runtime-and-deployment.md#2-kafka-transport)):

- **The consumer group is `svt.db-agent.request-server`, not `svt.db-agent.request`.** NestJS appends its
  `postfixId` (`-server` by default) to the configured `groupId`, and `buildSvtDbAgentNextKafkaOptions` does not
  override it. The C++ agent and the clone are therefore in two groups: run side by side, both would answer every
  request, and the planned swap ([04 §7](04-runtime-and-deployment.md#7-swap-procedure)) is not the consumer
  handover that [04 §2](04-runtime-and-deployment.md#2-kafka-transport) describes.
- **The clone replays the requests sent while it was down.** `fromBeginning: false` applies only to a group without
  a committed offset; the clone's group keeps one, so at start it consumes everything after it, writes included
  (the C++ agent seeks to the end). The comment in `svt-db-agent-next-kafka.models.ts` says the opposite. Here it
  replayed the 399 requests of the C++ recording into the fresh database of the clone before the reads ran. The
  Kafka e2e spec now produces such a backlog before the agent starts and checks that it gets no reply.

## 6. Beyond parity

Load: replay a day of production requests (from the `request` topic, if retention allows, or
synthetic) at 10× rate; the C++ serialises everything, so the clone only has to be no slower.
Message size: a `GetAllAsics` without pager on the largest wafer type (ER1, hundreds of dies per
wafer × all wafers) must stay under the 50 MiB broker limit after gzip.
