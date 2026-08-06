# CLAUDE.md — svt-ui (EpicMeasure)

Nx monorepo. Read this first, then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the map and
[docs/RECIPES.md](docs/RECIPES.md) for step-by-step "how do I add X" checklists.

> This directory (`UI/`) is the Nx workspace. It lives inside the larger `SVTSW` repo, whose siblings
> (`SVTSupervisor`, `TestAgent`, `DbAgent`, `WPAgent`, …) are the real services this UI talks to in production.

## The three apps

| App | Stack | Role |
|---|---|---|
| `apps/epic-measure-ui` | Angular 19 | Front-end. Serves on **7755**, baseHref `/app/`. |
| `apps/epic-measure-api` | NestJS 11 | BFF. HTTP REST at `/api` + Kafka **client**. Serves on **7373** in dev. |
| `apps/epic-db-agent` | NestJS 11 | **Mock only.** Kafka-consumer microservice standing in for the real DB Agent so we can develop offline. Never ships to prod. |

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

Lint/test individually: `npm run lint`, `npm run lint:fix`, `npm test`.

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
  `epic-ui/shared/svt-tests`, `epic/entities`, `@env/environment`, …).
- `libs/epic/*` is the **only** code shared between `epic-measure-api` and `epic-db-agent`. Kafka message
  contracts and DTOs live there — change them in one place and both sides stay in sync.
- Angular components are **standalone** (`imports: [...]`), except a few legacy `NgModule` feature modules.
- Angular UI code must never import from `libs/epic/*` — the UI has its own view models in `epic-ui/api`.

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
- `.env.development` / `.env.production` / `.env.test` **are committed** for both `epic-measure-api` and
  `epic-db-agent`. Don't put secrets there.
- New SCSS in a lib needs its `styles/` dir added to `stylePreprocessorOptions.includePaths` in
  `apps/epic-measure-ui/project.json`; new lib `assets/` needs an entry in the same file's `assets` array.
- Kafka payloads are `JSON.stringify`'d by hand before `.send()` — the reply comes back needing
  `mapEpicKafkaMessageData()` to unwrap.
- Release/CI details live in [README.md](README.md); don't duplicate them here.

## External sources of truth (outside this workspace)

- `../Documentation/Kafka/SvtKafkaConventions.md` + `svt.db-agent.kafka.yaml` — **the** Kafka contract.
  Check it before inventing a message type.
- `../Documentation/DB/DBTables/SVT_DB_Tables_SourceOfTruth.txt` — DB schema.
- `../Dev/` — auxiliary compose files (Kafka, Postgres).
