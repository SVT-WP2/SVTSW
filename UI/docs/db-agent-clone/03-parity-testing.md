# 03. Parity testing

The clone is accepted when a black-box suite over Kafka produces the same replies as the C++ agent
for every message type, except where [01-behaviour-decisions.md](01-behaviour-decisions.md) says
the difference is intentional. The suite is written once, in TypeScript (Vitest, `kafkajs`), and
run against both implementations.

## 1. Why snapshot the C++ first

The current agent has no tests. Its exact replies, including the quirks, are only knowable by
running it. Snapshotting them gives the clone a target and gives the author's review of
[DbAgent/docs](../../../DbAgent/docs/README.md) hard evidence for every "by code reading" claim.

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
  [Dev/db-example/README.md](../../../Dev/db-example/README.md).
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
   with the algorithm in [DbAgent/docs/06 §4](../../../DbAgent/docs/06-wafer-map.md#4-asic-generation-algorithm)
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

## 6. Beyond parity

Load: replay a day of production requests (from the `request` topic, if retention allows, or
synthetic) at 10× rate; the C++ serialises everything, so the clone only has to be no slower.
Message size: a `GetAllAsics` without pager on the largest wafer type (ER1, hundreds of dies per
wafer × all wafers) must stay under the 50 MiB broker limit after gzip.
