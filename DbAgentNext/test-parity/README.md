# svt-db-agent-next — parity suite

The black-box check of [docs/03-parity-testing.md](../docs/03-parity-testing.md):
the same Kafka requests are played against the C++ `DbAgent` and against `svt-db-agent-next`, each running on
its own copy of the same database, and the replies are compared case by case. A difference is either a bug
or one of the decisions of [01-behaviour-decisions.md](../docs/01-behaviour-decisions.md),
listed in [`utils/parity-known-differences.ts`](utils/parity-known-differences.ts). Nothing here boots the
application: the suite is a kafkajs client, and the agent under test is whichever one holds the consumer group
`svt.db-agent.request` on the broker of `.env.test` (`Dev/docker-compose.kafka-local.yml`, `localhost:9085`).

| Spec | Does | Run |
|---|---|---|
| `record.parity-spec.ts` | sends every case of [`utils/parity-cases.ts`](utils/parity-cases.ts) in order and stores the replies in `snapshots/<agent>.json` | `SVT_DB_AGENT_PARITY_AGENT=<agent> npm run parity:record` |
| `compare.parity-spec.ts` | compares `snapshots/cpp.json` with `snapshots/next.json` (or `SVT_DB_AGENT_PARITY_LEFT` / `_RIGHT`) and writes `snapshots/report.md` | `npm run parity:compare` |

The recorder asserts nothing about the replies: a case that gets no reply is stored as a timeout, and the
recorder waits for the agent to answer a probe again before the next case (the C++ exits on some inputs and
Docker restarts it). The comparer fails on every difference that is not a listed decision.

## The cases

`utils/parity-cases.ts` follows §4 of the parity plan, in four groups that run in this order:

1. **Reads** over the dev dump: for every `GetAll*`, no filter, `ids` for one and several ids, a missing id,
   every declared filter with a matching and a non-matching value, an undeclared key, `null`/`true`/`[]`/mixed
   arrays as filter values, and the pager at the start, on the second page, beyond the end and with a `null`
   limit; `GetAllEnums` with every spelling of the names key; the location histories, the wafer-type map and
   the config bodies of existing and missing ids.
2. **Write flows**, in an order that keeps both databases on the same ids (both start from the same dump):
   a wafer type and its map; one wafer per stored map with the full generated ASIC set; generic updates;
   two moves on one day; ASIC, chips, `CreateManyChips`; equipment; the wafer-probe machine (load, swap,
   unload, unload when empty, load without orientation, install, replace); a project; the whole test flow
   (type, type config, setup, setup config, template, test, start, finish, the filters over the new rows).
   Bodies use the shape both agents accept: every optional key present, `null` where allowed, and the extra
   top-level keys the C++ demands (`data.waferMap`, `data.items`).
3. **Contract-shape requests** the two agents are expected to answer differently (optional keys left out, a
   quote in a value, an uninstall, JSON fields sent as objects, the contract's `GetAllChipBlocks` name).
4. **Envelope**: a missing header each, an empty and an unknown type, a payload without `data`, without
   `type`, with a non-string `type`, and a value that is not JSON.

Finally the heartbeat topic is read once and its shape stored.

## Comparing

Per §3 of the plan the comparer looks at `status`, `type`, `error.code`, `error.message` without the C++
`[file:line]\n` prefix, and `data` with keys sorted; `items` are compared in order where the C++ orders them
(`ORDER BY id`) and as a set where it does not (histories). Keys listed as `volatileKeys` on a case
(`createdAt` from `now()`) are blanked. Lists longer than 200 items are stored as a digest (count, sha256 over
the canonical items, first and last item) with the full reply under `snapshots/full/` (git-ignored), so the
generated ASIC sets of a whole wafer compare exactly without a megabyte per agent in the repository.

## Running a parity round

Both agents need the same data. Restore the dev dump of 2026-11-08 into one database per agent, migrate only
the clone's (the C++ runs on the dump's own schema; the clone needs migrations 0–4). The `docker` commands run
from the repository root, the `npm` and `node` commands from `DbAgentNext/`. In Git Bash on Windows, set
`MSYS_NO_PATHCONV=1` first, or `/tmp/dev.dump` reaches `pg_restore` as a Windows path:

```bash
docker cp Dev/db-example/2026-11-08-backup.dump postgres-db--local:/tmp/dev.dump
```

```bash
for db in svt_sw_db_parity_cpp svt_sw_db_parity_next; do docker exec postgres-db--local psql -U postgres -c "DROP DATABASE IF EXISTS $db" -c "CREATE DATABASE $db" && docker exec postgres-db--local pg_restore --no-owner --no-privileges -U postgres -d $db /tmp/dev.dump; done
```

```bash
SVT_DB_AGENT_DB_NAME=svt_sw_db_parity_next npm run db:migration:up
```

One agent at a time holds the consumer group, so the two recordings run one after the other. The C++ agent,
built from `DbAgent/` (`docker build -t svt-db-agent:parity --build-arg VERSION=parity DbAgent`), on the compose
network of the local broker and Postgres, restarted by Docker when a malformed payload ends it:

```bash
docker run -d --name svt-db-agent-parity --network svt-network--local --restart unless-stopped -e SVT_DB_AGENT_DB_HOST=postgres-db--local -e SVT_DB_AGENT_DB_PORT=5432 -e SVT_DB_AGENT_DB_USER=postgres -e SVT_DB_AGENT_DB_PASS=postgres -e SVT_DB_AGENT_DB_NAME=svt_sw_db_parity_cpp -e SVT_DB_AGENT_KAFKA_SERVER=kafka -e SVT_DB_AGENT_KAFKA_PORT=9084 svt-db-agent:parity
```

```bash
SVT_DB_AGENT_PARITY_AGENT=cpp npm run parity:record
```

Stop that container (`docker rm -f svt-db-agent-parity`). The clone's consumer group
(`svt.db-agent.request-server`, see `docs/03-parity-testing.md` §5.2) keeps its committed offset, so the clone
would first replay every request of the C++ recording into its database. Move the offset to the end before you
start it; the group must have no member (wait about 30 s after a clone stopped):

```bash
docker exec svt.kafka-broker--local kafka-consumer-groups --bootstrap-server localhost:9084 --group svt.db-agent.request-server --topic svt.db-agent.request --reset-offsets --to-latest --execute
```

Then the clone on its database (from
`DbAgentNext/`, so that `.env.development` is found; the variable set in the shell wins over it):

```bash
SVT_DB_AGENT_DB_NAME=svt_sw_db_parity_next node dist/main.js
```

```bash
SVT_DB_AGENT_PARITY_AGENT=next npm run parity:record
```

```bash
npm run parity:compare
```

`snapshots/cpp.json`, `snapshots/next.json` and `snapshots/report.md` are committed: the C++ recording is the
evidence behind the "by code reading" claims of `DbAgent/docs`, and the report is the parity result of
[dev-plan/04-kafka-layer.md §4d](../docs/dev-plan/04-kafka-layer.md).
