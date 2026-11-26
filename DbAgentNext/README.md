# DbAgentNext — svt-db-agent-next

The DB agent of SVTSW: the NestJS service that reads and writes the database for all other services. It consumes
`svt.db-agent.request` (consumer group `svt.db-agent.request`), replies on
`svt.db-agent.request.reply`, produces the heartbeat and serves `GET /health` (database + Kafka) on **7676**.
PostgreSQL through MikroORM 7. Configuration through the `SVT_DB_AGENT_*` variables only.

A standalone app: its own `package.json`, lockfile, tsconfig, ESLint config, Dockerfile and workflows. The only
code it shares is the contract types of [`../Shared/svt-ts-types`](../Shared/svt-ts-types/README.md) (aliases
`svt-ts-types` and `svt-ts-types/kafka` in `tsconfig.json`), which the UI workspace compiles as well.

Why it is here and not in `UI/`:
[the layout decision](../Documentation/decisions/2026-11-repository-layout.md). The documentation of the agent:
[docs/README.md](docs/README.md). Its Kafka contract:
[`svt.db-agent-next.kafka.yaml`](../Documentation/Kafka/svt.db-agent-next.kafka.yaml).

Since 2026-11-15 this is where the DB agent is developed, and the C++ agent is frozen
([the fork note](../Documentation/decisions/2026-11-db-agent-clone.md)). This agent is the DB agent of every
environment; the C++ agent gets no support
([decision](../Documentation/decisions/2026-11-db-agent-next-only.md)). A change of the schema, of the business
logic or of the contract changes the page of [docs/](docs/README.md) that describes it, in the same pull request.

## Requirements

- Node.js **^22.17** or **>= 24** (MikroORM 7, `engines` in `package.json`).
- PostgreSQL on `localhost:5500` and Kafka on `localhost:9085` for a local run (`../Dev/docker-compose.postgres.yml`,
  `../Dev/docker-compose.kafka-local.yml`); the values are in `.env.development`.

## Commands

All from this folder, after `npm ci`.

| Command | Does |
|---|---|
| `npm start` | Nest CLI watch build and run (`.env.development`), <http://localhost:7676/health> |
| `npm run build` | Production bundle `dist/main.js` (Nest CLI, webpack; `../Shared` bundled, npm packages external) |
| `npm run start:prod` | `node dist/main.js` |
| `npm run lint` | ESLint with `eslint.config.mjs` (the UI workspace's TypeScript rules without Angular, plus the `src/db` import rules) |
| `npm run typecheck` | `tsc` on `tsconfig.app.json` and on `src/db/tsconfig.json` (`strict`) |
| `npm test` | Unit tests (`vitest.config.ts`, `src/**/*.spec.ts`) |
| `npm run e2e` | e2e suite against a real PostgreSQL ([test-e2e/README.md](test-e2e/README.md)) |
| `npm run parity:record`, `npm run parity:compare` | Parity suite against the C++ agent ([test-parity/README.md](test-parity/README.md)) |
| `npm run db:migration:up` (`:create`, `:down`, `:pending`), `npm run db:schema:update:dump` | MikroORM CLI (`mikro-orm.config.ts`) |
| `npm run db:restore` | Drops the database of `.env.development` and restores into it the `pg_dump -Fc` file that the script names in `package.json`, with the tools of the Postgres container ([`../Dev/db-example/`](../Dev/db-example/README.md)) |
| `npm run pre-pull-request` | lint, typecheck, unit tests |

## Layout

```
DbAgentNext/
├── src/
│   ├── app/  config/  modules/     NestJS application: Kafka controller, dispatcher, handlers, health
│   ├── db/                         database layer: orm (MikroORM setup), data (entities, repositories); strict
│   └── migrations/                 MikroORM migrations 0–5 and their list; the agent applies them at start
├── scripts/                        db-restore.mjs (npm run db:restore)
├── test-e2e/  test-parity/
├── docs/                           domain model, database schema, messages, wafer map, runtime, implementation, decisions
├── tsconfig.json                   compiler options and the two aliases into ../Shared
├── tsconfig.app.json  tsconfig.spec.json  tsconfig.mikro-orm.json  src/db/tsconfig.json
├── nest-cli.json  eslint.config.mjs  vitest.config.ts  vitest.e2e.config.ts  vitest.parity.config.ts
└── Dockerfile  Dockerfile.dockerignore
```

## Docker

The build context is the **repository root**, because the app compiles `../Shared/svt-ts-types`;
`Dockerfile.dockerignore` limits it to this folder (without tests, docs and `.env` files) and `Shared/`.

```bash
docker build -f DbAgentNext/Dockerfile -t svt-db-agent-next .
```

Node 22 alpine, multi-stage: `npm ci` and `npm run build`, then a runtime stage with `npm ci --omit=dev` from this
folder's lockfile and `dist/main.js`; runs as `node`; `HEALTHCHECK` on `GET /health`.

## CI/CD

Its own service (image `ghcr.io/svt-wp2/svt-db-agent-next`, container `svt.db-agent-next--<env>`), versioned in
this folder's `package.json`, with the three-workflow layout of the UI:

| Workflow file | Trigger | Purpose |
|---|---|---|
| `db-agent-next.yml` (`DbAgent Next`) | PR, push to `master`, `svt-db-agent-next-*` tag | CI (`npm run lint`, `typecheck`, `test`, `build`, `e2e` against a PostgreSQL service; image build without push on PRs); build & push + deploy to dev on master pushes and on tags |
| `db-agent-next-release.yml` (`DbAgent Next :: Release`) | Manual | Bump `package.json` and `package-lock.json` → commit `svt-db-agent-next@<v>` + tag `svt-db-agent-next-<v>` + push (needs `RELEASE_PAT`) |
| `db-agent-next-manual.yml` (`DbAgent Next :: Manual`) | Manual | Build a short-SHA image, deploy an image to dev, deploy a release to prod |

> Path filter: `DbAgentNext/**` and `Shared/**`. `ui.yml` also watches `Shared/**`: a change of the contract types
> builds both. `svt-db-agent-next@` release commits are skipped by the master jobs; the release image is built
> from the tag.
>
> Where it runs: **dev** (`Environment/Dev/`), deployed by the master jobs, and **prod** (`Environment/Prod/`),
> deployed by hand. The first deploy to a server that ran the C++ agent is described in
> [docs/04-runtime-and-deployment.md](docs/04-runtime-and-deployment.md#7-swap-procedure). Operator notes:
> [`../Environment/README.md`](../Environment/README.md#the-two-db-agent-services).
