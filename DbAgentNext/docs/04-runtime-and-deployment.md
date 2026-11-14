# 04. Runtime, transport and deployment parity

What the clone must honour so that the compose service definition in `Environment/*` and the
operational habits around it do not change. Current behaviour is in
[DbAgent/docs/01-architecture.md](../../DbAgent/docs/01-architecture.md).

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
| Consumer group | `svt.db-agent.request` | **same**, so a deployment swap is a plain consumer handover with no offset surprises. NestJS appends a `postfixId` (`-server`) to the group unless it is set to `''`; until 2026-11-14 the clone ran as `svt.db-agent.request-server` ([03 §5.2](03-parity-testing.md#52-after-the-two-fixes-2026-11-14)). Not `epic-ui.fake-db-agent` (the mock's). |
| Start offset | `auto.offset.reset=latest` + seek to end on start: messages produced while the agent was down are skipped | **same** (decided 2026-11-14): before its consumer starts, the clone moves the group's offsets on the request topic to the end (`SvtDbAgentNextKafkaBacklogService`) and logs how many requests it skipped; their clients gave up long ago, and a write among them would land now. The broker refuses the move while another member holds the group (a handover from a running agent); the clone then joins at the committed offset. `fromBeginning: false` alone does not do it: kafkajs resumes from a committed offset. The proposal of 2026-11-08 here was the opposite, to process the backlog. |
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

**Decision (2026-11-14): a standalone app `DbAgentNext/` at the top level of the repository, next to
`DbAgent/`, and the contract types in `Shared/svt-ts-types`.** It replaces the decision of 2026-11-08 (the agent
as `apps/svt-db-agent-next` in the UI Nx workspace, below). The move, its steps and its checks are in
[05-repository-layout-plan.md](05-repository-layout-plan.md).

Why the decision of 2026-11-08 was revised:

- The top-level folders of SVTSW are the deployables, and the agent is one: its own image, version and release.
- In the UI workspace it shared one `package.json`, one lockfile and one Node version with the Angular app.
  MikroORM 7's Node ≥ 22.17 became a constraint of the whole workspace, the agent's unit tests ran under the
  Angular test setup (`jsdom`, the zone wrapper), and a change of the workspace's lint or tsconfig settings could
  break the agent.
- The reason for the workspace, "the contract types stay in one place", holds with `Shared/svt-ts-types` as well:
  one copy, compiled by both sides through a path alias, so a type that one side no longer matches still breaks
  that side's build.

| | Value |
|---|---|
| Code | `DbAgentNext/`: own `package.json` and lockfile, tsconfig, `eslint.config.mjs` and Vitest configs; no Nx |
| Contract types | `Shared/svt-ts-types`, aliases `svt-ts-types` and `svt-ts-types/kafka` in `DbAgentNext/tsconfig.json` and `UI/tsconfig.base.json`. Dependency-free TypeScript; the agent validates requests with its own DTO classes |
| Build | `nest build` with the webpack builder: `dist/main.js`, `Shared/` bundled, npm packages external |
| Image | `ghcr.io/svt-wp2/svt-db-agent-next`, built from `DbAgentNext/Dockerfile` with the repository root as context, limited by `DbAgentNext/Dockerfile.dockerignore` to the app and `Shared/` (Node 22 alpine, multi-stage, `npm ci` + `npm run build`, runtime `npm ci --omit=dev` from the app's lockfile, runs as `node`) |
| Health | `HEALTHCHECK` calls `GET /health` on `SVT_DB_AGENT_HTTP_PORT` (7676) with busybox `wget`; replaces the `svt-db-agent-healthcheck` binary |
| Version | `DbAgentNext/package.json` (and its lockfile), independent of the UI's `svt-ui@` version; bumped by `DbAgent Next :: Release` (`svt-db-agent-next@<v>` commit, `svt-db-agent-next-<v>` tag, `release/svt-db-agent-next/<v>` branch for major/minor) |
| Workflows | `.github/workflows/db-agent-next.yml` (CI: `npm run lint`, `typecheck`, `test`, `build`, `e2e` against a PostgreSQL service; PR image build without push; master → `:dev` + `:<sha>` and deploy to dev; tag → `:<version>` [+ `:latest`] and deploy to dev), `db-agent-next-manual.yml`, `db-agent-next-release.yml`. Path filter: `DbAgentNext/**` and `Shared/**`; `ui.yml` watches `UI/**` and `Shared/**`, so a change of the contract types builds both |
| Compose | service `svt-db-agent-next`, container `svt.db-agent-next--<env>`, `SVT_DB_AGENT_NEXT_VERSION` in `versions.env`, same `SVT_DB_*` values from `.env`, optional `SVT_DB_AGENT_NEXT_LOG_VERBOSITY`; no log volume |
| Where it runs | **dev only** for now, in place of the C++ service (`Environment/Dev/`); prod keeps `svt-db-agent`. `db-agent.yml` still builds the C++ image but no longer deploys to dev |

Details for operators: [`Environment/README.md`](../../Environment/README.md#the-two-db-agent-services).

### Superseded: the decision of 2026-11-08

The two options as they were compared then:

| | Promote `apps/epic-db-agent` in the UI Nx workspace | New top-level `DbAgentNode/` (or replace `DbAgent/`) |
|---|---|---|
| Contract types | imported from `libs/epic/entities` directly | published or path-mapped from the UI workspace, or copied |
| Build | new Dockerfile target in `UI/`, built by a `db-agent.yml` whose context becomes `UI/` | own Dockerfile and workflow, like today |
| Version | the workspace has **one** `package.json` version shared with the UI image; the DB agent would need its own `VERSION` file or a per-app version | own `VERSION`, today's release workflow unchanged |
| CLAUDE.md note "epic-db-agent never ships to prod" | must change | n/a |
| Blast radius | a UI refactor of `libs/epic/*` can break the agent build (and vice versa); CI must build both | isolated |

The decision then was the first column, with its own name: the agent in the UI workspace as
`apps/svt-db-agent-next` ("the contract types stay in one workspace"), built from
`UI/apps/svt-db-agent-next/Dockerfile` with context `UI/` and `nx build`, versioned in its own app
`package.json`, path-filtered on the app, `libs/epic/**`, `libs/epic-api-types/**` and the workspace build files.
Its image name, health check, release flow, compose service and environments are kept above; the build, the
Docker context, the version file and the path filter changed.

## 7. Swap procedure

1. **Dev (done 2026-11-08 at the compose level):** `Environment/Dev/docker-compose-svtsw-dev.yml`
   defines `svt-db-agent-next` instead of `svt-db-agent`; every master push touching the agent
   deploys it. The old C++ container has to be removed once by hand
   ([`Environment/Dev/README.md`](../../Environment/Dev/README.md#db-agent-switching-from-svt-db-agent-to-svt-db-agent-next)).
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
