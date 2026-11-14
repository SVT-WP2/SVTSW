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

The real DB Agent's NestJS re-implementation (`svt-db-agent-next`, deployed to dev in place of the C++ agent) is
**not** in this workspace: it is the standalone app [`../DbAgentNext`](../DbAgentNext/CLAUDE.md), with its own
`package.json`, lockfile, image and pipelines. What it shares with this workspace is the contract types of
`../Shared/svt-ts-types` and nothing else.

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
docker compose up -d zookeeper kafka kafka-ui   # Kafka broker on 9095 + UI on 8088
```

```bash
npm run pre-pull-request   # lint + test — run this before opening a PR
```

Lint/test individually: `npm run lint`, `npm run lint:fix`, `npm test`. `npm run lint:shared` lints and
strictly type-checks `../Shared/svt-ts-types` (part of `npm run lint`).

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
  `epic-ui/shared/svt-tests`, `epic/entities`, `svt-ts-types`, `svt-ts-types/kafka`, `@env/environment`, …).
- `svt-ts-types` (`../Shared/svt-ts-types/main`) is the **HTTP contract**: the request bodies, query strings and responses of the
  DB-agent-backed `/api/...` endpoints as plain TypeScript types, and the only lib compiled into both the Angular
  SPA and the NestJS apps. No decorators, no npm imports (`npm run lint:shared` rejects them). The UI
  uses these types as its models; a BE DTO class `implements` them, so a member drifting between FE and BE is a
  compile error. `implements` misses a renamed or missing member of a type with optional members (every
  `ListQuery`), so those DTOs are also paired in `libs/epic/entities/src/contract/epic-api-contract-checks.models.ts`.
  Request bodies end in `Request`, list filters in `ListQuery`. A type exists only for an operation the Kafka contract
  (`../Documentation/Kafka/svt.db-agent.kafka.yaml`) defines: no contract operation → no type, no endpoint, no UI flow.
- `svt-ts-types/kafka` (`../Shared/svt-ts-types/kafka`) is the **Kafka contract** of the Node apps: the message
  envelope, the `SvtDbAgentKafka<X>` namespaces and the wire types. Same rule as `svt-ts-types` — no decorators,
  no framework imports — but it is its own entry point, not exported by the `svt-ts-types` barrel, and Angular code
  must not import it (the root `eslint.config.mjs` rejects it). The messages carry the `svt-ts-types` types
  directly; a separate wire type (`EpicSvtTestEntity`, the `*LocationUpdate` types) exists only where the Kafka
  shape differs from the HTTP one.
- `libs/epic/*` is Node-only, shared between `epic-measure-api` and `epic-db-agent`: the decorated DTO classes and
  the RxJS / NestJS helpers around the Kafka contract (`mapEpicKafkaMessageData()`, `processKafkaReplyError()`).
- Angular components are **standalone** (`imports: [...]`), except a few legacy `NgModule` feature modules.
- Angular UI code must never import from `libs/epic/*`. For the DB-agent-backed domains `epic-ui/api` holds the
  HTTP clients only — the types come from `svt-ts-types`. `iv-mnt` and `tcp` (BFF endpoints that are not DB-agent
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
- `.env.development` / `.env.production` / `.env.test` **are committed** for `epic-measure-api` and
  `epic-db-agent`. Don't put secrets there. `nx serve` loads the project's
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
- The contract types (`svt-ts-types`, `svt-ts-types/kafka`) are in `../Shared/svt-ts-types`, **outside the
  workspace**. Two rules follow from it. A tsconfig that compiles to CommonJS sets `"importHelpers": false` (else
  the barrels' `export *` imports `tslib`, which does not resolve from `../Shared`: TS2354). And **no comments in a
  tsconfig** that an Nx webpack build reads, nor in its `extends` chain: Nx 22.7 reads that chain with
  `JSON.parse`, and on a comment it resolves the aliases from the app folder ("Module not found" for every alias
  with a `/`). Docker builds use the repository root as context (`docker build -f UI/Dockerfile .`). The rest
  (Nx cache input, lint-staged, CI filters) is in `../Shared/svt-ts-types/README.md`.
- Release/CI details live in [README.md](README.md); don't duplicate them here.

## External sources of truth (outside this workspace)

- `../Documentation/Kafka/SvtKafkaConventions.md` + `svt.db-agent.kafka.yaml` — **the** Kafka contract (the C++ agent's;
  `svt.db-agent-next.kafka.yaml` next to it documents what `svt-db-agent-next` does where it differs).
  Check it before inventing a message type.
- `../Documentation/DB/DBTables/SVT_DB_Tables_SourceOfTruth.txt` — DB schema.
- `../Dev/` — auxiliary compose files (Kafka, Postgres).
- `../DbAgent/docs/` — behavioural documentation of the **real** DB Agent (current state, pending its
  author's review). The authority on what the C++ actually does, quirks included.
- `../DbAgentNext/` — the NestJS re-implementation of the DB Agent, a standalone app with its own `CLAUDE.md`;
  its decisions and plans are in `../DbAgentNext/docs/`.
- `../Shared/svt-ts-types/` — the contract types this workspace and the agent compile (aliases `svt-ts-types`,
  `svt-ts-types/kafka`).
