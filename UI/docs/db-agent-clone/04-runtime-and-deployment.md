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

The dispatch itself stays a `switch` on `message.type` over the typed unions in `epic-api-types/kafka`
(one controller) or one `@MessagePattern` per type if a second topic is ever introduced; both are
compatible with the single request topic.

## 3. Heartbeat and health

*Status 2026-11-08:* implemented as decided below — the heartbeat record every 2 s with the C++ topic
retention, `GET /health` with `database` (a `select 1`) and `kafka` (an admin call), the compose
`HEALTHCHECK` on that endpoint ([dev-plan/04-kafka-layer.md](dev-plan/04-kafka-layer.md), Outcome).

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

**Decision (2026-11-08): the first column, with its own name.** The agent lives in the UI workspace
as `apps/svt-db-agent-next` (the contract types stay in one workspace), but it is a **separate
service** rather than a drop-in image under the C++ name:

| | Value |
|---|---|
| Image | `ghcr.io/svt-wp2/svt-db-agent-next`, built from `UI/apps/svt-db-agent-next/Dockerfile` with context `UI/` (Node 22 alpine, multi-stage, `npm ci` + `nx build`, runtime `npm install --omit=dev` on the generated `package.json` because the generated lock is incomplete, runs as `node`) |
| Health | `HEALTHCHECK` calls `GET /health` on `SVT_DB_AGENT_HTTP_PORT` (7676) with busybox `wget`; replaces the `svt-db-agent-healthcheck` binary |
| Version | `UI/apps/svt-db-agent-next/package.json`, independent of the workspace's `svt-ui@` version; bumped by `DbAgent Next :: Release` (`svt-db-agent-next@<v>` commit, `svt-db-agent-next-<v>` tag, `release/svt-db-agent-next/<v>` branch for major/minor) |
| Workflows | `.github/workflows/db-agent-next.yml` (CI: scoped eslint, vitest, nx build; PR image build without push; master → `:dev` + `:<sha>` and deploy to dev; tag → `:<version>` [+ `:latest`] and deploy to dev), `db-agent-next-manual.yml`, `db-agent-next-release.yml`. Path filter: the app, `libs/epic/**`, `libs/epic-api-types/**`, `libs/svt-db/**` and the workspace build files; `ui.yml` ignores `UI/apps/svt-db-agent-next/**` |
| Compose | service `svt-db-agent-next`, container `svt.db-agent-next--<env>`, `SVT_DB_AGENT_NEXT_VERSION` in `versions.env`, same `SVT_DB_*` values from `.env`, optional `SVT_DB_AGENT_NEXT_LOG_VERBOSITY`; no log volume |
| Where it runs | **dev only** for now, in place of the C++ service (`Environment/Dev/`); prod keeps `svt-db-agent`. `db-agent.yml` still builds the C++ image but no longer deploys to dev |

Details for operators: [`Environment/README.md`](../../../Environment/README.md#the-two-db-agent-services).

## 7. Swap procedure

1. **Dev (done 2026-11-08 at the compose level):** `Environment/Dev/docker-compose-svtsw-dev.yml`
   defines `svt-db-agent-next` instead of `svt-db-agent`; every master push touching the agent
   deploys it. The old C++ container has to be removed once by hand
   ([`Environment/Dev/README.md`](../../../Environment/Dev/README.md#db-agent-switching-from-svt-db-agent-to-svt-db-agent-next)).
   Until phase 4 lands, dev has no Kafka consumer for `svt.db-agent.request`.
2. Run the parity harness against dev once phase 4 is deployed.
3. **Production:** add the `svt-db-agent-next` service to `Environment/Prod/docker-compose-svtsw-prod.yml`
   and `SVT_DB_AGENT_NEXT_VERSION` to `Prod/versions.env.example`, deploy a release via
   `DbAgent Next :: Manual → deploy-prod--manual`, remove `svt.db-agent--prod` once, then drop the
   `svt-db-agent` service from the prod compose file. Rollback before that last step is
   `DbAgent :: Manual → deploy-prod--manual` with the previous C++ tag; nothing else needs to change
   as long as migration 1 only added columns the C++ ignores.
4. After a quiet period, archive `DbAgent/` and its workflows (keep `DbAgent/docs` as the historical
   specification or move it next to the clone).
