# SvtDbAgentNext: development plan

`SvtDbAgentNext` is the NestJS re-implementation of the SVT DB Agent. It lives in this Nx workspace
as the application `apps/svt-db-agent-next`, with its data layer in two libraries under
`libs/svt-db/`. These documents are **instructions for the agents (and people) who build it**,
one phase at a time, in separate sessions. Nothing here assumes knowledge of the conversation that
produced it: [00-context.md](00-context.md) carries the context.

## How to work from these documents

1. Read [00-context.md](00-context.md) completely. It is the shared context for every phase:
   repository map, conventions, local infrastructure, the Kafka protocol, the database facts, the
   decisions already taken and the known pitfalls.
2. Read the phase document you were assigned. Each one states its goal, what to read first, the
   files to create, the steps, and the **acceptance criteria**. A phase is done when every criterion
   passes, not before.
3. One phase is one branch and one pull request. Do not start the next phase in the same PR. Do not
   touch files outside the paths the phase lists, except where the phase says so (for example the
   root `package.json`).
4. Where a phase document and reality disagree (an API changed, a file moved), follow reality,
   and record the deviation in the PR description **and** in the phase document, so the next phase
   starts from the truth.
5. Questions that need a human are listed per phase under "Ask before…". Do not guess on those;
   stop and ask.

## Phases

| Phase | Document | Delivers | Depends on |
|---|---|---|---|
| 1 | [01-app-skeleton.md](01-app-skeleton.md) | `apps/svt-db-agent-next`: a NestJS app that boots, reads its configuration from the `SVT_DB_AGENT_*` environment variables, serves `/health`, builds with Nx, lints and tests. No Kafka, no database yet. | nothing |
| 2 | [02-mikro-orm.md](02-mikro-orm.md) | `libs/svt-db/orm`: MikroORM module, configuration and CLI setup; migration 0 (production baseline) and migration 1 (bring production to the dev layout); one pilot entity proving the chain; the DB health indicator. | 1 |
| 3 | [03-data-layer.md](03-data-layer.md) | `libs/svt-db/data`: every entity of the schema, repositories, the enum-values service, and the pure domain logic (wafer-map validation and ASIC generation) with tests. | 2 |
| 4 | [04-kafka-layer.md](04-kafka-layer.md) | The agent: Kafka transport, the request/reply envelope, all 55 message handlers, heartbeat, health, error mapping; parity against the C++ agent. | 3 |
| later | [../03-parity-testing.md](../03-parity-testing.md), [../04-runtime-and-deployment.md](../04-runtime-and-deployment.md) | Parity harness and the prod swap. The Docker image, CI, versioning and the **dev** deployment already exist since phase 1 (`apps/svt-db-agent-next/Dockerfile`, `.github/workflows/db-agent-next*.yml`, `Environment/Dev/`; see 04 §6): every phase merged to `master` is deployed to dev automatically, so keep `main.ts` bootable at every step. | 4 |

## Scope interpretation (correct here if wrong)

- **Entities.** The data layer models **every table** of the schema in its dev (September 2026)
  layout, including the tables the current UI and BFF never touch (`WaferTypeImage`,
  `ProbeCardFamilyType`, `SvtTestSetupEquipList`, the `Module*` tables, history tables). Nothing
  of that exists in TypeScript yet, so nothing is duplicated.
- **Wire types.** The HTTP and Kafka shapes that already exist are **reused, not re-declared**:
  `libs/epic-api-types` (shared request/response types), `libs/epic/entities` (Kafka message
  classes, envelope, DTOs). The data layer may alias them but never redefines them.
- **Behaviour.** The agent reproduces the C++ agent as documented in `DbAgent/docs`, except where
  [../01-behaviour-decisions.md](../01-behaviour-decisions.md) says **fix**. Rows marked **ask**
  are implemented the way the C++ does it today unless the answer has arrived in
  `DbAgent/docs/08-questions-for-the-author.md`.

## Decisions taken by this plan

Change them **here**, then in the phase documents; the phases only apply them.

| Topic | Decision | Why |
|---|---|---|
| App name and path | `svt-db-agent-next`, `apps/svt-db-agent-next` | as requested |
| Libraries | `libs/svt-db/orm` (alias `svt-db/orm`, project `svt-db-orm`): MikroORM module, config, naming strategy, CLI config. `libs/svt-db/data` (alias `svt-db/data`, project `svt-db-data`): entities, repositories, enum values, pure domain logic. | mirrors rentaly's `api/db` + domain libs; keeps ORM plumbing separate from the model |
| Class and file prefix | classes `SvtDb…` (`SvtDbWaferEntity`, `SvtDbOrmModule`), files `svt-db-<thing>.<role>.ts`, app files `svt-db-agent-next-<thing>.<role>.ts` | a distinct bounded context from the `Epic…` UI/BFF code; the workspace lint does not enforce class prefixes outside Angular |
| Lib dependencies | `svt-db/data` → `svt-db/orm`, `epic-api-types`. The app → both libs, `epic/entities`. Neither lib imports `epic/entities`, `epic-ui/*`, `@angular/*`. | the data layer must not know the Kafka contract |
| MikroORM version | **7.2.x** (ESM-first, Node ≥ 22.17, `@mikro-orm/nestjs` 7.1.x). Decorators are imported from `@mikro-orm/decorators/legacy` (the workspace uses `experimentalDecorators`); `OptionalProps`, `DeferMode`, `MikroORM` and the naming strategies from `@mikro-orm/core` / `@mikro-orm/postgresql`. The app and the `svt-db/*` libs compile with `module`/`moduleResolution: nodenext` and `skipLibCheck` (webpack still emits a CommonJS bundle). | decided 2026-11-08 before phase 3 multiplies the entities; v7's types are only resolvable with a modern `moduleResolution`, and the upgrade guide drops the legacy `node` setting |
| Metadata provider | runtime: `ReflectMetadataProvider` from `@mikro-orm/decorators/legacy`, set explicitly (no longer the default) with `emitDecoratorMetadata`, explicit entity lists; every scalar property also declares `type` explicitly. CLI (migrations): `TsMorphMetadataProvider` with `entitiesTs` globs, TypeScript loaded through the `swc` loader (`@swc-node/register`, already a workspace dependency) selected by `preferTs: true`. | the app is bundled with webpack; globs and ts-morph do not work in a bundle; the CLI runs from source; Vitest (esbuild) emits no decorator metadata, so explicit types keep the specs working |
| Naming strategy | `SvtDbNamingStrategy` (`svt-db/orm`): `EntityCaseNamingStrategy` plus PostgreSQL's default constraint names (`_pkey`, `_key`, `_fkey`); explicit `tableName` on every entity, `schema: 'main'` | the database uses quoted camelCase identifiers and was created with PostgreSQL's default constraint names; this keeps `schema:update --dump` empty without naming constraints by hand |
| Enum columns | typed as `string` in TypeScript; declared with `@Enum({ nativeEnumName, items })` where `items` comes from one generated file of the prod values. Behaviour-relevant values (`asicQuality`, `waferInMachineStatus`, `dutEntityName`) also get string-literal unions. No TypeScript enum of 86 ASIC family types is used as a type. | values are data maintained in the DB; the agent serves them from `pg_enum` |
| Migrations | `apps/svt-db-agent-next/src/migrations`, CLI config `apps/svt-db-agent-next/mikro-orm.config.ts`, npm scripts `db-next:*`. Migration 0 = production schema (idempotent); migration 1 = dev layout + surrogate ids. | mirrors rentaly; the app owns its schema history |
| Transactions and context | every message handled inside one MikroORM request context (`@CreateRequestContext()`), writes in `em.transactional()` | fixes the C++ non-atomicity; required by MikroORM for a non-HTTP transport |
| Replies | handlers return the JSON envelope **string**; errors are caught and mapped to `BadRequest` / `NotFound` / `UnexpectedError` envelopes; NestJS's own error path is never used | WPAgent and the BFF read `status` from the body |
| Date formats on the wire | `date` columns as `YYYY-MM-DD` (as today); `timestamp` columns as ISO 8601 UTC (`2026-08-20T16:24:10.448Z`), produced by one serializer function | the contract says ISO; one function makes the format a one-line switch if the UI objects |
| Enum values served | read from `pg_type ⋈ pg_enum` per request (no startup cache) | the DB owner adds values live |
| Configuration | environment variables `SVT_DB_AGENT_*` exactly as the C++ container, plus `SVT_DB_AGENT_HTTP_PORT` for `/health`; validated at boot | drop-in replacement in the compose stacks |
| Tests | Vitest from the workspace root config; unit tests always; database tests gated by `SVT_DB_AGENT_TEST_DB_URL` and skipped when unset | CI has no Postgres |

## Definition of done, every phase

- `npm run lint` passes (`npm run lint:fix` first if needed); `nx build <project>` passes for the
  app; `npm test` passes; `npm i` (no `--force`) still resolves after dependency changes.
- Only the paths the phase lists changed, plus `package.json` / `package-lock.json` /
  `tsconfig.base.json` / `UI/CLAUDE.md` where the phase says so.
- Documentation updated where the phase says so, and the phase document itself corrected if
  reality differed.
- The PR description lists deviations and anything left for the next phase.
