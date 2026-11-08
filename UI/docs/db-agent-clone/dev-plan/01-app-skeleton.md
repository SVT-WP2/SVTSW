# Phase 1: application skeleton

**Goal.** `apps/svt-db-agent-next` exists as a NestJS application in this workspace: it builds with
Nx, starts, validates its configuration from the `SVT_DB_AGENT_*` environment variables, exposes
`GET /health`, logs through Nest's logger, lints and has a test. No Kafka, no database yet; those
are phases 4 and 2.

**Read first.** [00-context.md](00-context.md) §2, §4, §5, §7. Then the mock app's project files:
`UI/apps/epic-db-agent/{project.json,webpack.config.js,tsconfig.json,tsconfig.app.json,tsconfig.spec.json,eslint.config.mjs,package.json,.env.development}`
and `UI/apps/epic-db-agent/src/{main.ts,app/app.module.ts}`. For the config pattern, rentaly's
`apps/rentaly-api/src/config/` (env class validated with class-validator, `ConfigFactory` producing a
typed config) if that repository is available; otherwise follow the description below.

## Paths this phase may touch

- `UI/apps/svt-db-agent-next/**` (new)
- `UI/package.json` (scripts; move `@nestjs/microservices` to `dependencies`), `UI/package-lock.json`
- `UI/CLAUDE.md` (apps table and commands), `UI/docs/ARCHITECTURE.md` §2 (workspace layout), `UI/README.md` (one line under the DB agent section)

## Files to create

```
apps/svt-db-agent-next/
├── .env.development            SVT_DB_AGENT_* local defaults (00-context §7), SVT_DB_AGENT_HTTP_PORT=7676
├── .env.test                   same keys, test values
├── .env.production             only the keys that must exist; no values (they come from the container)
├── eslint.config.mjs           as the mock's
├── package.json                as the mock's (name svt-db-agent-next)
├── project.json                as the mock's, names changed; serve port for the inspector distinct from 9696 (use 9697)
├── tsconfig.json / tsconfig.app.json / tsconfig.spec.json   as the mock's
├── webpack.config.js           output dist/apps/svt-db-agent-next
└── src/
    ├── main.ts
    ├── app/
    │   ├── app.module.ts
    │   └── index.ts
    ├── config/
    │   ├── svt-db-agent-next-env.models.ts          class SvtDbAgentNextEnvVars with class-validator decorators, one property per variable
    │   ├── svt-db-agent-next-config.models.ts       type SvtDbAgentNextConfig { httpPort, logLevels, database: { host, port, user, password, dbName, schema }, kafka: { server, port, brokers: string[] } }
    │   ├── svt-db-agent-next-config.factory.ts      getSvtDbAgentNextConfigFactory(): ConfigFactory<SvtDbAgentNextConfig>; validate(env) that throws listing every invalid variable
    │   ├── svt-db-agent-next-config.factory.spec.ts
    │   └── index.ts
    └── modules/
        └── health/
            ├── svt-db-agent-next-health.controller.ts   GET /health via @nestjs/terminus HealthCheckService; no indicators yet (phase 2 adds DB, phase 4 adds Kafka)
            ├── svt-db-agent-next-health.module.ts
            └── index.ts
```

## Steps

1. Copy the mock app's configuration files to the new folder, rename every `epic-db-agent` to
   `svt-db-agent-next`, output path `dist/apps/svt-db-agent-next`. Keep `generatePackageJson: true`.
2. `main.ts`: `NestFactory.create(AppModule)` (HTTP app; the Kafka microservice is connected in
   phase 4 with `connectMicroservice` + `startAllMicroservices`), `app.enableShutdownHooks()`,
   listen on `config.httpPort`, log the URL. Set Nest logger levels from
   `SVT_DB_AGENT_LOGGER_TERM_VERBOSITY`: `PRODUCTION` → `['error','warn']`, `STANDARD` →
   `+ 'log'`, `VERBOSE` → `+ 'verbose'`, `DEBUG` → `+ 'debug'`; default `STANDARD`.
3. `AppModule`: `ConfigModule.forRoot({ isGlobal: true, envFilePath: `.env.${process.env.NODE_ENV ?? 'development'}`, load: [getSvtDbAgentNextConfigFactory()], validate })`,
   `TerminusModule`, `HealthModule`.
4. Config: the env class declares every variable of [00-context.md §7](00-context.md#7-configuration-the-agent-must-honour)
   with `@IsString()`, `@IsInt()` (`@Type(() => Number)`), `@IsOptional()` where allowed. The
   database and Kafka variables are **required** (the C++ container fails without them too). The
   logger variables are optional and accepted. `validate()` uses `plainToInstance` +
   `validateSync` and throws an `Error` whose message lists each failing variable.
5. Health: `GET /health` returns Terminus's standard body with status `ok` and an empty details
   object for now. This is the endpoint the Docker `HEALTHCHECK` will call in the runtime phase.
6. Scripts in `UI/package.json`: `"start::db-agent-next": "nx serve svt-db-agent-next"`,
   `"build::db-agent-next": "nx build svt-db-agent-next"`. Move `@nestjs/microservices` from
   `devDependencies` to `dependencies` (same version). Run `npm i` (no `--force`).
7. Docs: add the app to the apps table in `UI/CLAUDE.md` ("Real DB Agent, in development; see
   docs/db-agent-clone") and the command to the Commands section; add it to the layout tree in
   `UI/docs/ARCHITECTURE.md` §2; one line in `UI/README.md`'s DB agent section pointing at
   `docs/db-agent-clone/README.md`.
8. Test: `svt-db-agent-next-config.factory.spec.ts` (`// @vitest-environment node`): a complete
   environment produces the expected config object (brokers joined as `host:port`); a missing
   `SVT_DB_AGENT_DB_HOST` throws with the variable name in the message; an invalid
   `SVT_DB_AGENT_DB_PORT` throws.

## Acceptance criteria

```bash
cd UI && npm i && npm run lint && npx nx build svt-db-agent-next && npx nx test svt-db-agent-next
```

all pass, and:

```bash
cd UI && npm run start::db-agent-next
```

starts with `.env.development`, logs the listen URL, and `curl http://localhost:7676/health` returns
`{"status":"ok",…}`. Starting with `SVT_DB_AGENT_DB_HOST` removed from the environment fails fast
with a message naming the variable. `git status` shows changes only under the paths listed above.

## Ask before…

- choosing a different HTTP port or environment variable names (they are referenced by the later
  phases and by `../04-runtime-and-deployment.md`).

## Hand-off to phase 2

State in the PR description: the final env variable list, the HTTP port, and anything in the mock's
build configuration that had to change to build the new app.
