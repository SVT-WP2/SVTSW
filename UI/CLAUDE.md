# CLAUDE.md — svt-ui (EpicMeasure)

Nx monorepo. Read this first, then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the map and
[docs/RECIPES.md](docs/RECIPES.md) for step-by-step "how do I add X" checklists.

> This directory (`UI/`) is the Nx workspace. It lives inside the larger `SVTSW` repo, whose siblings
> (`SVTSupervisor`, `TestAgent`, `DbAgent`, `WPAgent`, …) are the real services this UI talks to in production.

## The apps

| App | Stack | Role |
|---|---|---|
| `apps/epic-measure-ui` | Angular 21 | Front-end. Serves on **7755**, baseHref `/app/`. |
| `apps/epic-measure-api` | NestJS 11 | BFF. HTTP REST at `/api` + Kafka **client**. Serves on **7373** in dev. |
| `apps/epic-db-agent` | NestJS 11 | **Mock only.** Kafka-consumer microservice standing in for the real DB Agent so we can develop offline. Never ships to prod. |
| `apps/svt-db-agent-next` | NestJS 11 | **Real DB Agent, in development.** Re-implementation of `../DbAgent` (C++); `GET /health` on **7676**. Config via `SVT_DB_AGENT_*`. Own image (`ghcr.io/svt-wp2/svt-db-agent-next`, Dockerfile in the app folder, context `UI/`), own version and release, deployed to **dev** in place of the C++ agent. Plan and context: [docs/db-agent-clone](docs/db-agent-clone/README.md). |

The browser never talks to Kafka. Flow is always:

```
Angular → HTTP /api → epic-measure-api → Kafka (svt.db-agent.request) → DB Agent → reply topic → back up
```

## Commands

```bash
npm run start          # UI + API together
```

```bash
npm run start::ui      # Angular only, http://localhost:7755/app
```

```bash
npm run start::api     # NestJS only, http://localhost:7373/api (Swagger: /api/swagger)
```

```bash
npm run start::db-agent   # fake DB agent — needs Kafka running
```

```bash
npm run start::db-agent-next   # real DB agent (in development), http://localhost:7676/health
```

```bash
npm run e2e::db-agent-next     # DB agent e2e suite — needs Postgres on 5500 with database svt_sw_db_e2e_test
```

```bash
docker compose up -d zookeeper kafka kafka-ui   # Kafka broker on 9095 + UI on 8088
```

```bash
npm run pre-pull-request   # lint + test — run this before opening a PR
```

Lint/test individually: `npm run lint`, `npm run lint:fix`, `npm test`.

Tests run on **Vitest** from a single root `vitest.config.ts` + `test-setup.ts` — libs have no
test config of their own. `npm test` runs the whole workspace in one process; `nx test <project>`
or `npm run test::affected` scope it.

**Kafka must be running before the API starts.** Broker is `localhost:9095` per
`apps/epic-measure-api/.env.development`.

## Code style — non-negotiable, enforced by ESLint

- **4-space indent**, **single quotes**, **no semicolons**, trailing commas on multiline.
- Stroustrup braces, `max-len` **140**.
- `padded-blocks: { classes: always }` — a blank line right after `{` of a class and right before `}`.
- Type/interface members use **no delimiter** (neither `;` nor `,` between members).
- `import/order`: alphabetized, **newlines between groups**, and **two blank lines** before the first
  declaration after the import block.
- `id-denylist: ['e']` — never name anything `e` (use `error`, `event`).
- Member ordering is enforced (static → decorated → instance → abstract, fields before ctor before methods).

## Naming

- Files: `epic-<domain>-<thing>.<role>.ts` where role ∈ `component | models | dto | service | api-client |
  data-source | facade | store | actions | effects | selectors | factory | module | routing | providers`.
- Classes: `Epic` prefix (`EpicSvtTestsApiClient`). Component selectors: `epic-`, `app-`, or `ag-`.
- **`index.ts` barrel in every folder.** Import from the barrel, never deep-import a sibling file.
- TypeScript `namespace` is used deliberately for grouping (`EpicSvtTestsGrid`, `SvtDbAgentKafkaSvtTests`,
  `EpicSvtTestSetupsStore`). Inside a file, alias it: `import Grid = EpicSvtTestsGrid`.

## Cross-cutting rules

- **Never import across libs by relative path.** Use the `tsconfig.base.json` aliases (`epic-ui/api`,
  `epic-ui/shared/svt-tests`, `epic/entities`, `epic-api-types`, `@env/environment`, …).
- `libs/epic-api-types` is the **HTTP contract**: the request bodies, query strings and responses of the
  DB-agent-backed `/api/...` endpoints as plain TypeScript types, and the only lib compiled into both the Angular
  SPA and the NestJS apps. No decorators, no framework imports (the root `eslint.config.mjs` rejects them). The UI
  uses these types as its models; a BE DTO class `implements` them, so a member drifting between FE and BE is a
  compile error. `implements` misses a renamed or missing member of a type with optional members (every
  `ListQuery`), so those DTOs are also paired in `libs/epic/entities/src/contract/epic-api-contract-checks.models.ts`.
  Request bodies end in `Request`, list filters in `ListQuery`. A type exists only for an operation the Kafka contract
  (`../Documentation/Kafka/svt.db-agent.kafka.yaml`) defines: no contract operation → no type, no endpoint, no UI flow.
- `libs/epic/*` is Node-only, shared between `epic-measure-api` and `epic-db-agent`. Kafka message contracts,
  the decorated DTO classes and the `Epic<X>Entity` Kafka wire types live there — the latter are one-line
  aliases of the `epic-api-types` types for as long as the two shapes are identical.
- Angular components are **standalone** (`imports: [...]`), except a few legacy `NgModule` feature modules.
- Angular UI code must never import from `libs/epic/*`. For the DB-agent-backed domains `epic-ui/api` holds the
  HTTP clients only — the types come from `epic-api-types`. `iv-mnt` and `tcp` (BFF endpoints that are not DB-agent
  operations) and the instruments / measurement / wafer-tests models still keep their types next to their clients.

## Two data-loading patterns — pick the right one

1. **`SimpleDataSource` subclass** (`*-grid.data-source.ts`) — page-local list/grid data, no global cache.
   Default choice for a new list page.
2. **NgRx feature store** (`store/{actions,effects,selectors}` + `provideEpicXxxStore()` registered in
   `app.module.ts`) — for entities read by many pages and worth caching (test setups, test types, wafer types, WP).

Don't add a NgRx store for a single grid.

## Mocking — two independent levels

- **UI-level:** `epic-ui/api/__mock__` clients swapped in by `provideMockData()` when `environment.useMockData`
  is true *or* `localStorage['epic.mockSettings'] = {"useMockData":true}`. No backend needed at all.
- **System-level:** run `epic-db-agent` over real Kafka. Exercises the whole API + Kafka path.

## Gotchas

- Dev API port is **7373** (`.env.development`), not the `9393` fallback in `main.ts`. `proxy.conf.json`
  targets 7373 — keep them in sync.
- `.env.development` / `.env.production` / `.env.test` **are committed** for `epic-measure-api`,
  `epic-db-agent` and `svt-db-agent-next`. Don't put secrets there. `nx serve` loads the project's
  `.env.<configuration>` itself; the `envFilePath` in `app.module.ts` is for containers.
- New SCSS in a lib needs its `styles/` dir added to `stylePreprocessorOptions.includePaths` in
  `apps/epic-measure-ui/project.json`; new lib `assets/` needs an entry in the same file's `assets` array.
- Kafka payloads are `JSON.stringify`'d by hand before `.send()` — the reply comes back needing
  `mapEpicKafkaMessageData()` to unwrap.
- **After pulling a branch that bumps Angular or Nx, wipe the build caches before you build:**
  `npx nx reset && rm -rf .angular/cache`. A cache written by the previous major makes `@angular/build`'s
  lmdb store blow up with `Error: Not enough space` (lmdb code 12) — that's the cache, not your disk.
  CI sidesteps this by running `rm -rf .nx` before `build::all`.
- Every dependency must satisfy the Angular 21 peer ranges so plain `npm i` / `npm ci` resolve. If you add
  or bump a package, check its peers — a single stale one (e.g. a lib still pinned to `@angular/*@^19`)
  forces the whole workspace onto `npm i --force` and hides every other conflict behind it.
- `svt-db-agent-next` uses **MikroORM 7**, which is ESM-first and needs **Node ≥ 22.17** (`engines` in
  `package.json`). Import its decorators from `@mikro-orm/decorators/legacy`; `apps/svt-db-agent-next` and
  `libs/svt-db/*` compile with `moduleResolution: nodenext` because v7's types are invisible to the legacy
  `node` resolution the rest of the workspace uses. Conventions for entities: `docs/db-agent-clone/dev-plan/03-data-layer.md`.
- Release/CI details live in [README.md](README.md); don't duplicate them here.

## External sources of truth (outside this workspace)

- `../Documentation/Kafka/SvtKafkaConventions.md` + `svt.db-agent.kafka.yaml` — **the** Kafka contract.
  Check it before inventing a message type.
- `../Documentation/DB/DBTables/SVT_DB_Tables_SourceOfTruth.txt` — DB schema.
- `../Dev/` — auxiliary compose files (Kafka, Postgres).
- `../DbAgent/docs/` — behavioural documentation of the **real** DB Agent (current state, pending its
  author's review). The authority on what the C++ actually does, quirks included.
- `docs/db-agent-clone/` — working notes for re-implementing the DB Agent in this workspace (proposal).
