# epic-measure-api — e2e tests

The suite calls the BFF's HTTP API and follows every request the whole way: **HTTP → epic-measure-api → Kafka →
svt-db-agent-next (`../DbAgentNext`) → PostgreSQL → back**. Every endpoint that goes through the DB agent has a
spec here; each one checks the response shape, every query parameter, the error statuses, and what landed in the
database.

```bash
docker compose -f ../Dev/docker-compose.e2e.yml up -d      # from UI/: the e2e Kafka broker (localhost:9185)
```

```bash
npm run e2e::api                                            # from UI/ = nx e2e epic-measure-api: tsc, then vitest
```

One spec file: `npx vitest run --config apps/epic-measure-api/vitest.e2e.config.ts test-e2e/wafers`.

## What runs where

| Piece | How the suite runs it |
|---|---|
| **BFF** (`epic-measure-api`) | In-process, per spec file: `TestSetup.init()` boots the real `AppModule` with `configureEpicMeasureApiApp()` (the bootstrap `main.ts` uses), connects its Kafka clients as `main.ts` does (`connectEpicMeasureApiKafkaClients`) and listens on a free port. Requests are plain `fetch` calls. |
| **The user** | The suite runs as a logged-in Admin, through the real `EpicAuthGuard`: `init()` empties the database, enters `E2E_ADMIN` (user 1, a random password per run) and logs it in with `POST /api/auth/login`; `get` / `post` / `patch` / `request` send its session cookie. `clearDatabase()` puts the user back as user 1, so the session stays valid. `setup.as(null)` sends no cookie, `setup.loginAs(role)` logs in as a new user of that role, `setup.createUser()` enters a user, `setup.fetch()` returns the raw response (cookies). |
| **DB agent** (`DbAgentNext`) | A child process, once per run (`utils/global-setup.ts`): built with `npm run build` when `dist/main.js` is older than its sources, migrated with its own CLI when a migration is missing, started as `node dist/main.js` (NODE_ENV=test) and stopped gracefully over IPC (`agent/run-agent.cjs`). Its log: `UI/tmp/epic-measure-api-e2e/svt-db-agent-next.log`. |
| **Kafka** | The dedicated broker of `../Dev/docker-compose.e2e.yml` on **9185**, never the dev broker (9085): see below. |
| **PostgreSQL** | The Postgres of `../Dev/docker-compose.postgres.yml` on 5500, database **`svt_sw_db_api_e2e_test`** (created on first run). Every table is truncated before each test, so ids are `1, 2, …`. |

Not booted: Swagger and the `epic-ui` Kafka microservice of `main.ts` (it only logs the two topics). Out of scope: the
`tcp` routes (they talk TCP to an instrument) and the `iv-mnt` WebSocket gateway.

### Why a broker of its own

The agent consumes as the fixed group `svt.db-agent.request` (the C++ agent's, `../DbAgentNext/CLAUDE.md`), and its
backlog skip *joins* a group that already has a member instead of refusing to start. The BFF's reply consumers use
fixed groups too (`epic-ui.<module>-client`). On the dev broker, a running dev agent could therefore take the
suite's requests, and write them to the dev database. On its own broker the suite meets no one; the global setup still
refuses to start while one of those groups has a member (it first waits up to 45 s for the leftovers of a crashed run).

## Settings

`apps/epic-measure-api/.env.test` (committed, no secrets): `KAFKA_BROKER`, `EPIC_API_E2E_DB_*`,
`EPIC_API_E2E_AGENT_HTTP_PORT` (the agent's `GET /health`, the readiness probe; 7678) and `SVT_UI_AUTH_SECRET` (a
value marked `DEVELOPMENT-ONLY-`). Personal overrides go into
`apps/epic-measure-api/.env.test.local` (git-ignored), and variables set in the shell win over both. The harness
refuses a database whose name does not end with `_e2e_test`. The agent gets the database and broker as `SVT_DB_AGENT_*`
variables on top of its own `DbAgentNext/.env.test`, with its feature flags at their defaults (chip blocks off).

Needs `DbAgentNext/node_modules` (`npm ci` there) and Node ≥ 22.17, like the agent.

CI: `.github/workflows/ui-e2e.yml`, with Postgres and the same broker as service containers, on every change of
`UI/`, `DbAgentNext/` or `Shared/`.

## Layout

```
test-e2e/
├── agent/run-agent.cjs        # runs the agent's dist/main.js, turns IPC 'shutdown' into SIGTERM
├── utils/
│   ├── global-setup.ts        # once per run: broker, database, agent build + migrations + process
│   ├── test-setup.ts          # TestSetup: BFF lifecycle, the e2e Admin, get/post/patch, as, loginAs, clearDatabase, query, routes
│   ├── e2e-kafka.ts           # the broker checks of the global setup; E2eRequestTopicReader (records + headers)
│   ├── e2e-expectations.ts    # expectError, expectStatus, expectPageQueryParams, repeatedQuery
│   └── *-fixtures.ts          # payloads and seeds (wafer maps, WP machine, probe cards via SQL, SVT configs)
├── routes/                    # every route of the BFF and the spec that covers it
├── auth/                      # log-in, log-out, me, the guard on every route, the header svt_userId, the user cache
└── <domain>/<domain>.e2e-spec.ts
```

## Writing a spec for a new endpoint

```ts
describe('Wafers (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())
    beforeEach(() => setup.clearDatabase())

    it('creates the wafer, its first location row and the ASICs of its map', async () => {
        await createWaferType(setup)

        const response = await setup.post('/api/wafers', waferCreate())

        expect(response).toEqual({ status: 201, body: WAFER_1 })
        expect(await setup.count('Asic')).toBe(2)
    })

})
```

- Add the route to `routes/routes.e2e-spec.ts`; it fails for a route nobody covers.
- Seed through the API where an endpoint exists; with `setup.query()` (`$1` placeholders) where none does (probe cards,
  chip blocks, the start and finish of an SVT test).
- Expected values are typed with `svt-ts-types` (`const WAFER_1: EpicWafer = …`), so a drift of the HTTP contract is a
  compile error (`npm run e2e::api` type-checks the folder first). Compare whole bodies with `toEqual`, and the key
  order once per entity with `Object.keys`.
- Per endpoint: the success path, every query parameter on its own and combined, array parameters in the three forms
  (`k=a&k=b`, `k=a,b`, `k[]=a`), paging (`expectPageQueryParams`), the BFF's validation (400), the agent's rejections
  mapped to 400 / 404, and the database after a write.
- A behaviour that is wrong but needs a decision: `it.fails`, with a comment naming its finding below. Flip it to `it`
  with the fix.

## Findings

What the suite found on 2026-11-15 (updated 2026-11-16). **Fixed** items have tests that guard them; the others are pinned (`it.fails`, or
a test of today's behaviour) until someone decides.

| Id | Finding | State |
|---|---|---|
| E2E-1 | A query array with more than 20 values (`ids=1&…&ids=21`, or `ids[]=`) reached the DTO as an object (qs `arrayLimit` 20) and became `[NaN]` (400) or `['[object Object]']` (a wrong filter). | **Fixed**: `toQueryStringArray` takes the object's values in index order (unit spec next to it). |
| E2E-2 | The global `ValidationPipe`'s `enableImplicitConversion` converts JSON bodies too: `{ "name": 5 }` creates `"5"`, and any string is `true` for a boolean (`"false"` included). | Decision needed (`it.fails` in `equipment`, `svt-test-catalog`): convert only query strings, e.g. explicit `@Type()` on the query DTOs. Changes what bodies the API accepts. |
| E2E-3 | A path id that is no number answered 404 "does not exist: NaN" (asics, chips, chip blocks) or a 400 from the agent (others), after a Kafka round trip. | **Fixed**: `ParseIntPipe` on every numeric `@Param` (400 "numeric string is expected"). |
| E2E-4 | `GET /api/svt-tests?statuses=Done` answered 200 with an empty page: the values were only checked to be strings. | **Fixed**: `@IsEnum(EpicSvtTestStatus, { each: true })`. |
| E2E-5 | `POST /api/wp-machines/:id/loaded-wafer` could not load a wafer: the HTTP body had no orientation, and DbAgentNext requires `loadedWaferOrientation` (the C++ stored `null`; parity question 5). | **Fixed** 2026-11-16: the body takes `loadedWaferOrientation` (and the probe-card install an optional `installedProbeCardOrientation`); the agent keeps requiring it to load, decided in `../../../../DbAgentNext/docs/01-behaviour-decisions.md` §6.5. The UI's machine card has an orientation select. |
| E2E-6 | Responses carried agent keys the HTTP types did not have: `loadedWaferOrientation` / `installedProbeCardOrientation` on WP machines, `asicFamilyTypes` on probe cards (the serializer passes unknown keys through). | Machines **fixed** 2026-11-16 (`EpicWpMachine` has both orientations). Probe cards' `asicFamilyTypes`: decision needed, add it to `EpicWpProbeCard` or strip it. Pinned in `wp`. |
| E2E-7 | `GET /api/enums` also returns `dutEntityName`, `moduleType`, `testResultStatus` and `userRole`, which `EpicEnumName` does not list. | Decision needed: extend `EpicEnumName` or filter. Pinned in `enums`. |
| E2E-8 | Undeclared query params are dropped silently (`whitelist` without `forbidNonWhitelisted`): a misspelt filter lists everything, e.g. `/api/asics?familyTypes=…`. | Decision needed (400 would be a contract change). Pinned in `asics`. |
| E2E-9 | Copy-paste slips: the setup-config 404 said "SvtTestSetup does not exist", the WP machine 404s said "Wafer does not exist", `GET /wafer-types/:id/wafer-map` serialized as `EpicWaferDto`, and `POST /wafers` documented the update body in Swagger. | **Fixed**. |
| E2E-10 | DbAgentNext exits at start on a brand-new broker: its backlog skip gets "not the correct coordinator" (no `__consumer_offsets` yet) and does not retry. Harmless on dev (long-lived broker, the container restarts). | **Fixed** 2026-11-22: the backlog skip creates the request topic and waits up to 30 s for the coordinator (`../../../../DbAgentNext/docs/04-runtime-and-deployment.md` §2). The global setup still waits for the coordinator first, for its own group checks. |
