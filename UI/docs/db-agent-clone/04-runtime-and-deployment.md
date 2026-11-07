# 04. Runtime, transport and deployment parity

What the clone must honour so that the compose service definition in `Environment/*` and the
operational habits around it do not change. Current behaviour is in
[DbAgent/docs/01-architecture.md](../../../DbAgent/docs/01-architecture.md).

## 1. Configuration

The C++ reads a JSON file that the entrypoint patches from environment variables. The clone reads
the environment directly (NestJS `ConfigModule`) and drops the JSON file and the `jq` entrypoint.
Names stay the same so `.env` on the servers and the compose files need no change:

| Variable | Meaning |
|---|---|
| `SVT_DB_AGENT_DB_HOST`, `_DB_PORT`, `_DB_USER`, `_DB_PASS`, `_DB_NAME`, `_DB_SCHEMA` | PostgreSQL connection; schema is `main`. |
| `SVT_DB_AGENT_KAFKA_SERVER`, `_KAFKA_PORT` | broker, joined into `bootstrap.servers`. |
| `SVT_DB_AGENT_LOGGER_FILE_PATH`, `_LOGGER_TERM_VERBOSITY`, `_LOGGER_FILE_VERBOSITY` | logging. The clone may log to stdout only (Docker json-file logging is already configured); keep the file path variable accepted and ignored, or honour it, but do not fail on it. |

The compose service also bind-mounts `/var/log/svt-db-agent`; harmless if unused.

## 2. Kafka transport

NestJS's Kafka microservice transport is the protocol the C++ imitates, so `Transport.KAFKA` with
`@MessagePattern('svt.db-agent.request')` is the right shape; the mock already does this. Points to
settle:

| Topic | Today (C++) | Clone |
|---|---|---|
| Consumer group | `svt.db-agent.request` | **same**, so a deployment swap is a plain consumer handover with no offset surprises. Not `epic-ui.fake-db-agent` (the mock's). |
| Start offset | `auto.offset.reset=latest` + seek to end on start: messages produced while the agent was down are skipped | process the backlog instead (no seek). This is safe only once poison messages reply `BadRequest` rather than crash ([01 §2](01-behaviour-decisions.md#2-envelope-and-errors)). |
| Commit | manual, async after each batch | NestJS default (auto-commit) is acceptable; replies are idempotent reads or single-row writes. Revisit if exactly-once matters. |
| Reply topic | fixed `svt.db-agent.request.reply`, `kafka_replyTopic` ignored | NestJS replies to the `kafka_replyTopic` header; every client sends the fixed name, so behaviour is identical. Reject or log a request whose header names a different topic. |
| Reply partition | from `kafka_replyPartition` | NestJS does the same. |
| Reply headers | `kafka_correlationId`, `kafka_replyPartition`, `kafka_nest-is-disposed=00` | NestJS sets these itself. |
| Error replies | always a JSON envelope `{type, status, data: null, error}` | **important**: NestJS's default error path sends a `kafka_nest-err` header with a serialised exception, not the envelope. WPAgent checks `status == "Success"` in the JSON body. Handlers (or an interceptor / exception filter) must catch everything and return the envelope. The mock's `throw new Error('Unknown request')` must go. |
| Message size | broker 50 MiB; no compression | gzip (`CompressionTypes.GZIP`) on the producer; consumer `maxBytes` raised, as in the mock's `main.ts`. |
| Fetch sizes | n/a | `maxBytesPerPartition` 10 MiB, `maxBytes` 50 MiB as in the mock. |

The dispatch itself stays a `switch` on `message.type` over the typed unions in `libs/epic/entities`
(one controller) or one `@MessagePattern` per type if a second topic is ever introduced; both are
compatible with the single request topic.

## 3. Heartbeat and health

- Keep producing `{ "timestamp": "<epoch seconds>.<6 decimals>" }` as a **string** to
  `svt.db-agent.heartbeat` every 2 s. The compose `HEALTHCHECK` consumes it and nothing else does,
  so the payload is free to gain fields but must keep `timestamp` a string until the healthcheck
  is replaced.
- Add a DB round-trip (`SELECT 1`) to the health decision; the C++ heartbeat proves only that the
  process and Kafka are alive.
- The `svt-db-agent-healthcheck` binary disappears with the image. Options: an HTTP
  `/health` endpoint (`@nestjs/terminus`, already a dependency) with `curl` in the `HEALTHCHECK`,
  or a tiny Node script that consumes one heartbeat. The HTTP endpoint is simpler and also gives
  Kafka and DB status.
- Topic creation at startup (`ensureTopicsExist`, heartbeat topic with `retention.ms=60000`):
  reproduce with `kafkajs` admin or rely on broker auto-create. The local and server brokers
  auto-create; reproducing it keeps the heartbeat topic's short retention.

## 4. Logging

Four C++ levels map onto NestJS's `log` / `warn` / `error` / `debug`. Log the request type and
correlation id per message; never log full SQL with literal values; never return SQL to clients.

## 5. Shutdown

Handle `SIGTERM` (compose stop) by letting the in-flight handler finish, committing the offset,
and closing the pool; NestJS `enableShutdownHooks()` plus the microservice `close()` do this.

## 6. Where the code lives, build and versioning

Two options, both viable; this is an open decision:

| | Promote `apps/epic-db-agent` in the UI Nx workspace | New top-level `DbAgentNode/` (or replace `DbAgent/`) |
|---|---|---|
| Contract types | imported from `libs/epic/entities` directly | published or path-mapped from the UI workspace, or copied |
| Build | new Dockerfile target in `UI/`, built by a `db-agent.yml` whose context becomes `UI/` | own Dockerfile and workflow, like today |
| Version | the workspace has **one** `package.json` version shared with the UI image; the DB agent would need its own `VERSION` file or a per-app version | own `VERSION`, today's release workflow unchanged |
| CLAUDE.md note "epic-db-agent never ships to prod" | must change | n/a |
| Blast radius | a UI refactor of `libs/epic/*` can break the agent build (and vice versa); CI must build both | isolated |

Recommendation: promote the mock, because the contract types are the one thing that must never
drift between BFF and agent, and keeping them in one workspace is how that is enforced. Give the
agent its own `VERSION` file and image (`ghcr.io/svt-wp2/svt-db-agent`, same name as today) so
`Environment/*` and `deploy-service.sh` are untouched, and keep the `db-agent*.yml` workflows with a
changed build context.

## 7. Swap procedure

1. Deploy the Node image to **dev** via `DbAgent :: Manual → deploy-dev--manual` with the new tag;
   the C++ container is replaced in place (same compose service name).
2. Run the parity harness against dev.
3. Production: `deploy-prod--manual` with the release tag. Rollback is the same action with the
   previous C++ tag; nothing else needs to change as long as migration 1 only added columns the
   C++ ignores.
4. After a quiet period, archive `DbAgent/` (keep `DbAgent/docs` as the historical specification
   or move it next to the clone).
