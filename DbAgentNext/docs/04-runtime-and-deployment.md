# 04. Runtime, Kafka transport and deployment

How the agent runs: configuration, the Kafka transport, heartbeat and health, logging, shutdown, build and
versioning, and the swap of the C++ agent for this one. The agent takes the place of the C++ agent in the compose
stacks of `Environment/*`, so each section also says where it differs from the C++ agent.

## 1. Configuration

The agent reads its configuration from the environment (NestJS `ConfigModule`). The variable names are those of the
C++ container, so the `.env` files on the servers serve both agents. The C++ reads a JSON file that its entrypoint
patches from the same variables; this agent has no such file.

| Variable | Meaning |
|---|---|
| `SVT_DB_AGENT_DB_HOST`, `_DB_PORT`, `_DB_USER`, `_DB_PASS`, `_DB_NAME`, `_DB_SCHEMA` | PostgreSQL connection; the schema is `main`. |
| `SVT_DB_AGENT_KAFKA_SERVER`, `_KAFKA_PORT` | The broker, joined into `bootstrap.servers`. |
| `SVT_DB_AGENT_LOGGER_TERM_VERBOSITY` | The log level, mapped onto Nest's levels: `PRODUCTION` → error and warn, `STANDARD` (the default) → + log, `VERBOSE` → + verbose, `DEBUG` → + debug. |
| `SVT_DB_AGENT_LOGGER_FILE_PATH`, `_LOGGER_FILE_VERBOSITY` | Accepted and ignored: the agent logs to stdout only (Docker keeps the logs). |
| `SVT_DB_AGENT_HTTP_PORT` | Not in the C++: the port of `GET /health` (7676). |
| `SVT_DB_AGENT_FEATURE_CHIP_BLOCKS` | Not in the C++, optional: `true` or `1` makes `CreateChip` and `CreateManyChips` write the chip's `ChipBlock` rows ([01 §6.4](01-behaviour-decisions.md#64-chips-and-chip-blocks)). Off when absent, until a naming of the blocks is defined (Q6). |
| `NODE_ENV` | Selects `.env.<NODE_ENV>` from the working directory for a local run. A container gets the variables from its environment only. |

All are validated at boot (`src/config`, `class-validator` on an env class). The database and Kafka variables are
required, as for the C++ container; a missing or invalid one ends the start with its name in the message.

## 2. Kafka transport

The protocol of the C++ agent is NestJS's Kafka request-reply convention, which the C++ imitates. The agent uses
NestJS's own transport: `Transport.KAFKA` and one `@MessagePattern('svt.db-agent.request')` controller that hands
every message to the dispatcher ([05 §3](05-implementation-notes.md#3-the-dispatcher-and-the-handler-contract)).

| Subject | C++ agent | This agent |
|---|---|---|
| Consumer group | `svt.db-agent.request` | The same, so a swap of the agents is a consumer handover and only one agent serves an environment. NestJS appends a `postfixId` (`-server`) to the group unless it is set to `''`; the agent sets it to `''`. |
| Start offset | `auto.offset.reset=latest` and a seek to the end at start: requests produced while the agent was down are skipped | The same. Before its consumer starts, the agent moves the group's offsets on the request topic to the end (`SvtDbAgentNextKafkaBacklogService`) and logs how many requests it skipped: their clients gave up long ago, and a write among them would land now. The broker refuses the move while another member holds the group (a handover from a running agent); the agent then joins at the committed offset. `fromBeginning: false` alone does not do it: kafkajs resumes from a committed offset. |
| Commit | manual, async after each batch | The NestJS default (auto-commit). |
| Reply topic | fixed `svt.db-agent.request.reply`; `kafka_replyTopic` is ignored | NestJS replies to the topic of the `kafka_replyTopic` header. Every client in the repository (the BFF, WPAgent's `WPDbKafkaClient`) sends the header with the fixed name, so nothing changes for them. A request without the header is an event for NestJS and gets no reply. |
| Reply partition | from `kafka_replyPartition`, required | NestJS copies the header when it is present. A request without it is answered (the C++ answers `BadRequest`); this is open question 6 of [03 §5.1](03-parity-testing.md#51-first-run-against-the-c-agent-2026-11-14). |
| Reply headers | `kafka_correlationId`, `kafka_replyPartition`, `kafka_nest-is-disposed=00` | Set by NestJS. |
| The user of a request | none | The optional header `svt_userId` (the id of a user, a decimal string). The controller takes its text as NestJS's parser has decoded it (any other value, such as a null value or JSON that the parser turned into an array, is refused) and hands it to the dispatcher, which checks it ([messages.md §1.5](messages.md#15-the-user-of-a-request)). The log line of each request names the user (`user=42`, `user=-`). A reply does not repeat the header. |
| Error replies | always the JSON envelope `{ type, status, data: null, error }` | The same. NestJS's own error path would send a `kafka_nest-err` header with a serialised exception, which WPAgent does not understand (it reads `status` from the body). The dispatcher therefore catches everything and returns the envelope; nothing is thrown out of the controller. |
| A value that is not JSON | the process exits | The value reaches the dispatcher as a string and gets the `BadRequest` envelope (`Malformed request: missing string "type"`); the agent keeps serving. |
| Compression and sizes | none; broker limit 50 MiB | gzip on the producer; the consumer fetches up to 10 MiB per partition and 50 MiB per request. |

An unreachable broker at start ends the boot, as for the C++ agent, and the container restarts.

A brand-new broker (an empty volume) has neither the request topic nor `__consumer_offsets`, and kafkajs does not
retry the errors it then gets. Before the backlog skip, `SvtDbAgentNextKafkaBacklogService` therefore prepares the
broker:

- It creates `svt.db-agent.request` (1 partition, replication 1) when the broker has not got it. Without this step,
  a KRaft broker answers the consumer's first metadata request with "This server does not host this
  topic-partition" while it auto-creates the topic, and the boot ends.
- It waits up to 30 s for the group coordinator. The first group request makes the broker create
  `__consumer_offsets`, and until that is ready the broker answers "This is not the correct coordinator for this
  group". The agent asks again every 500 ms.

Start order (`main.ts`): the application is initialised first, so that the handlers are registered; then the
pending migrations are applied ([02 §1](02-database-migration.md#1-baseline-from-the-live-database-not-from-the-files));
then the request topic and the group coordinator are made ready and the backlog is skipped; then the consumer
starts; then the heartbeat; then the HTTP port. A migration that fails, or a database that is unreachable or does
not exist at start, ends the boot, and the container restarts.

## 3. Heartbeat and health

- **Heartbeat.** Every 2 s the agent produces `{ "timestamp": "<epoch seconds>.<6 decimals>" }`, with the timestamp
  as a string, to `svt.db-agent.heartbeat`, as the C++ agent does. When the broker lacks the topic, the agent
  creates it with `retention.ms=60000` and `segment.ms=120000`, the settings of the C++ agent.
- **Health.** `GET /health` on `SVT_DB_AGENT_HTTP_PORT` (7676) reports two indicators in the NestJS Terminus format:
  `database` (`orm.checkConnection()`, 3 s timeout) and `kafka` (`admin.listTopics()`, 3 s timeout). The compose
  `HEALTHCHECK` calls this endpoint. The C++ image has a binary that consumes one heartbeat record instead; that
  check proves that the process and Kafka are alive, and says nothing about the database.

Code: `src/modules/kafka` (heartbeat), `src/modules/health`.

## 4. Logging

To stdout, at the level of `SVT_DB_AGENT_LOGGER_TERM_VERBOSITY` (§1). For each request the controller logs the type,
the reply status, the duration and the correlation id. The agent does not log SQL with literal values, and it does
not return SQL to clients (R-9).

## 5. Shutdown

On `SIGTERM` (a compose stop) the handler in flight finishes, the offset is committed and the connection pool is
closed: `enableShutdownHooks()` and the microservice's `close()`.

## 6. Build, versioning and where it runs

The agent is a standalone app at the top level of the repository, and the contract types are in
`Shared/svt-ts-types`. The decision and its reasons are in
[`Documentation/decisions/2026-11-repository-layout.md`](../../Documentation/decisions/2026-11-repository-layout.md).

| | Value |
|---|---|
| Code | `DbAgentNext/`: own `package.json` and lockfile, tsconfig, `eslint.config.mjs` and Vitest configs; no Nx |
| Contract types | `Shared/svt-ts-types`, aliases `svt-ts-types` and `svt-ts-types/kafka` in `DbAgentNext/tsconfig.json` and `UI/tsconfig.base.json`. Dependency-free TypeScript; the agent validates requests with its own DTO classes |
| Build | `nest build` with the webpack builder: `dist/main.js`, `Shared/` bundled, npm packages external |
| Image | `ghcr.io/svt-wp2/svt-db-agent-next`, built from `DbAgentNext/Dockerfile` with the repository root as context, limited by `DbAgentNext/Dockerfile.dockerignore` to the app and `Shared/` (Node 22 alpine, multi-stage, `npm ci` + `npm run build`, runtime `npm ci --omit=dev` from the app's lockfile, runs as `node`) |
| Health | `HEALTHCHECK` calls `GET /health` on `SVT_DB_AGENT_HTTP_PORT` (7676) with busybox `wget` |
| Version | `DbAgentNext/package.json` (and its lockfile), independent of the UI's `svt-ui@` version; bumped by `DbAgent Next :: Release` (`svt-db-agent-next@<v>` commit, `svt-db-agent-next-<v>` tag, `release/svt-db-agent-next/<v>` branch for major/minor) |
| Workflows | `.github/workflows/db-agent-next.yml` (CI: `npm run lint`, `typecheck`, `test`, `build`, `e2e` against a PostgreSQL service; PR image build without push; master → `:dev` + `:<sha>` and deploy to dev; tag → `:<version>` [+ `:latest`] and deploy to dev), `db-agent-next-manual.yml`, `db-agent-next-release.yml`. Path filter: `DbAgentNext/**` and `Shared/**`; `ui.yml` watches `UI/**` and `Shared/**`, so a change of the contract types builds both |
| Compose | service `svt-db-agent-next`, container `svt.db-agent-next--<env>`, `SVT_DB_AGENT_NEXT_VERSION` in `versions.env`, the same `SVT_DB_*` values from `.env`, optional `SVT_DB_AGENT_NEXT_LOG_VERBOSITY`; no log volume |
| Where it runs | This agent is the DB agent of every environment (decided 2026-11-18). **dev** and **prod** run it (`Environment/Dev/`, `Environment/Prod/`): dev is deployed by the master jobs, prod by hand. `db-agent.yml` only compiles the C++ code: no workflow builds, releases or deploys the C++ image |

Details for operators: [`Environment/README.md`](../../Environment/README.md#the-two-db-agent-services).

## 7. Swap procedure

This agent is the DB agent of every environment. The C++ agent is frozen and gets no support
([decision](../../Documentation/decisions/2026-11-db-agent-next-only.md)). The compose files of dev and prod define
`svt-db-agent-next` instead of `svt-db-agent`.

The C++ agent and this agent hold the same consumer group, so an environment runs one of them.

**Dev**: every master push that touches the agent deploys it. The old C++ container is removed once, by hand
([`Environment/Dev/README.md`](../../Environment/Dev/README.md#db-agent-switching-from-svt-db-agent-to-svt-db-agent-next)).

**Production** is deployed by hand. The first deploy of this agent to the production server has three steps:

1. Make a release of this agent with `DbAgent Next :: Release`, if the wanted version has none. The tag builds the
   image `svt-db-agent-next:<version>`.
2. Deploy that release with `DbAgent Next :: Manual → deploy-prod--manual`, before a deploy of another service.
   The deploy copies the compose file to the server and adds `SVT_DB_AGENT_NEXT_VERSION` to `versions.env`. At its
   first start the agent applies its migrations to the prod database
   ([02 §1](02-database-migration.md#1-baseline-from-the-live-database-not-from-the-files)).
3. Remove the container `svt.db-agent--prod` once
   ([`Environment/Prod/README.md`](../../Environment/Prod/README.md#db-agent-switching-from-svt-db-agent-to-svt-db-agent-next)).

The C++ agent works on a database that has migrations 1 to 4, so it can run until step 3. No later migration is
checked against the C++ agent: if the release has one, do step 3 immediately after step 2.

No workflow builds or deploys the C++ agent. A return to the C++ container needs its service block from the git
history of the prod compose file, then `bash Environment/deploy-service.sh prod svt-db-agent <tag>` on the server,
with the previous C++ tag.

Open:

- **Parity against dev.** The parity suite ran on a local restore of the dev dump
  ([03 §5](03-parity-testing.md#5-intentional-differences)), not against the dev environment.
