# e2e testing and the slice-by-slice delivery of phases 3 and 4

**Decision (2026-11-08).** Phases 3 (data layer) and 4 (Kafka handlers) are delivered together, **one
vertical slice at a time**: the entities and repository of a domain, its message handlers, and an e2e
spec that drives every message of the slice against a real PostgreSQL database and asserts the rows.
The first slice (wafer types + enums) and the harness exist; this page is the contract for the rest.

Why: the C++ agent's behaviour is defined per message, and the only proof that a slice behaves is a
test that sends the message and looks at the database, as rentaly's `test-e2e` suite does for its HTTP
API. Building all 34 entities first and all 55 handlers afterwards would postpone that proof to the end.

## 1. The harness

`UI/apps/svt-db-agent-next/test-e2e/` (README there), run with `npm run e2e::db-agent-next`
(`nx test-e2e svt-db-agent-next`, config `apps/svt-db-agent-next/vitest.e2e.config.ts`).

| Piece | What it does |
|---|---|
| `utils/test-setup.ts` `TestSetup` | `init()` boots the real `AppModule` with `@nestjs/testing` against the database of `.env.test` and applies `src/migrations` to it; `clearDatabase()` truncates every table of `main` (identities restarted); `send(message)` hands a request envelope to `SvtDbAgentNextRequestDispatcher` and returns the reply envelope, both after a JSON round trip; `em()` / `query()` for seeding and assertions. |
| `utils/e2e-env.ts` | `setupFiles`: `NODE_ENV=test`, loads the app's `.env.test.local` (git-ignored, personal credentials) then `.env.test`, refuses any database whose name does not end with `_e2e_test`. |
| `vitest.e2e.config.ts` | Node environment, **swc** transform (NestJS needs `design:paramtypes` metadata; esbuild emits none), aliases from `tsconfig.base.json`, sequential files, 30 s timeouts. Specs are `test-e2e/**/*.e2e-spec.ts`, which the unit config's `*.spec.ts` glob never matches. |

Kafka is **not** in the loop: `send()` calls the dispatcher the Kafka controller (phase 4) delegates to,
so a spec covers everything the agent does with a message except the transport. That is deliberate:
the transport is NestJS's `ServerKafka`, the protocol is its own request/reply convention, and a broker
in the test loop would make the suite slow and flaky for no coverage of our code. A broker-backed smoke
test (one message end to end, env-gated like rentaly's live R2 specs) is a later, separate addition.

Database: `localhost:5500`, `postgres`/`postgres`, **`svt_sw_db_e2e_test`** (the compose Postgres of
`Dev/docker-compose.postgres.yml`; create the database once). A developer whose instance differs (e.g. a
native PostgreSQL on 5432) overrides the keys in the git-ignored `.env.test.local`. CI provides the same
through a `postgres:17` service container in `db-agent-next.yml`.

Seeding: no shared fixtures. Each test creates what it needs, through the agent's own messages when a
`Create*` message exists (that also tests the message), otherwise through `setup.em()` or SQL.

## 2. The dispatcher and the handler contract

`apps/svt-db-agent-next/src/modules/dispatch/`:

- `SvtDbAgentNextRequestDispatcher.dispatch(message)` → always a reply `{ type, status, data, error }`
  (`error: { code: 0, message: '' }` on success, `data: null` and `code: -1` on failure). Unknown or
  malformed requests get `BadRequest`; `SvtDbAgentNextRequestError` carries the status a handler chose
  (`badRequest`, `notFound`); a MikroORM unique violation becomes `BadRequest`; anything else becomes
  `UnexpectedError` with a generic message (the real error is logged, never sent).
- Every handler runs inside `RequestContext.create(orm.em, …)`, so repositories inject the global
  `EntityManager` from `@mikro-orm/postgresql` and need no decorators of their own.
- A handlers class is `@Injectable() @SvtDbAgentNextHandlers()` and implements
  `getHandlerDefinitions(): { type, replyType, handle }[]`; the dispatcher discovers every marked
  provider (`DiscoveryService`), so a new domain only adds its class to
  `SvtDbAgentNextHandlersModule`.
- Request `data` is validated by name: `validateRequestData(Dto, data.create, 'data.create')` with the
  contract DTOs of `epic/entities` (`whitelist` + `forbidNonWhitelisted`, so unknown keys are rejected),
  `requireRecord` / `requireInteger` / `optionalIntegerList` for the rest. Enum values are checked
  against the live catalog (`SvtDbEnumsService`), not the generated snapshot.

The Kafka controller of phase 4 becomes one method:
`@MessagePattern(Request) handle(@Payload() message) { return JSON.stringify(await this.dispatcher.dispatch(message)) }`.

## 3. A slice, step by step

1. **Entities** for the domain's tables in `libs/svt-db/data/src/<domain>/`, following
   [03-data-layer.md](03-data-layer.md) (explicit `type`, `generated` identity, `SvtDbNamingStrategy`
   names, FK rules), appended to `SVT_DB_ENTITIES`. `npm run db-next:schema:update:dump` must stay
   "Schema is up-to-date".
2. **Repository** in the same folder (`EntityManager` injected, `em.transactional` for writes, DB-side
   paging and filters), registered in `SvtDbDataModule`.
3. **Handlers** in `apps/svt-db-agent-next/src/modules/handlers/<domain>/`, one class per domain,
   behaviour from `DbAgent/docs/05-request-handlers.md` and the decisions of
   [../01-behaviour-decisions.md](../01-behaviour-decisions.md); reply shapes from the message classes.
4. **e2e spec** `test-e2e/<domain>/<domain>.e2e-spec.ts`: one `describe` per message type; the success
   path, every reply status the handler can produce, and the database rows after each write. Add the
   message types to `dispatch/dispatch.e2e-spec.ts`.
5. Pure domain logic (wafer-map validation, ASIC generation) also gets a unit spec next to it.

Order of slices (dependencies first): wafer types + enums (done) → wafers with location history and ASIC
generation (done) → ASICs (done; a minimal `Chip` entity exists for `chipId`) → chips + chip blocks →
wafer-probe machines, probe cards, projects → equipment types + equipment → SVT test setups/configs,
test types/configs, templates → SVT tests → modules (read only).

## 4. Findings from the first slice

- MikroORM 7 + Vitest: unit specs that load decorated classes need explicit `type`s (no metadata);
  the e2e runner needs swc for NestJS injection. Both are in place.
- `json` columns come back parsed (`pg` parses `json`), so `GetWaferTypeMap` returns
  `JSON.stringify(stored)`: same JSON, not byte-identical to the uploaded text (the C++ returned the
  stored text verbatim). No client compares the text.
- `CreateWaferType` validates enum values before inserting (clear `BadRequest` instead of a driver
  error) and tolerates the extra top-level `data.waferMap` key the C++ demanded (D-7).

## 5. Findings from the wafers slice

- `generateAsics` (`libs/svt-db/data/src/wafer-maps`) reproduces the production rows exactly: the unit spec
  regenerates a prod ER2 wafer and compares a digest of all 3421 dies with the fixture in `__fixtures__`
  (generated from the dump), and the e2e spec does the same against the rows `CreateWafer` writes.
- `CreateWafer` is one transaction: wafer, `Location at creation` row and all ASICs (`em.insertMany`); a
  duplicate wafer or ASIC serial number leaves nothing behind (the C++ left partial writes).
- `CreateWafer` requires `generalLocation` (`BadRequest` when `null`): the C++ failed too, on the location
  row's `NOT NULL`, but after inserting the wafer. It also rejects an unknown wafer type or a type without
  a map before writing.
- The location pattern (`appendLocation`, `findLocationHistory` ordered by `id`, the written row becomes the
  current location) is in `SvtDbWafersRepository`; chips, equipment and modules reuse it.
- `UpdateWaferLocation` is validated with an app-local DTO (`SvtDbAgentNextWaferLocationRecordDto`): the
  contract's record DTO has no validators on `note` and `username`, which the whitelist would reject.
- Lists take `data.pager` (`optionalPager`, defaults `limit 20`, `offset 0` when present) and answer
  `{ items, totalCount }` counted database-side; location histories carry `totalCount` too.

## 6. Findings from the ASICs slice

- `GetAllAsics` implements every contract filter: `ids`, `waferId`, `chipId` (Q-H4 fixed: the chip is
  looked up and its ASIC id intersected with `ids`), `familyTypes`, `quality`, and `serialNumber` as a
  **case-insensitive substring** (`ILIKE`, wildcards escaped), the way the contract describes it; the C++
  only did equality.
- `chipId` on every item comes from one extra query per page (`Chip` rows for the page's ASIC ids), not
  from a join; `SvtDbChipEntity` exists for that and is extended by the chips slice.
- Unknown `filter` keys are rejected with the C++ text `Error: <key> is not an allowed filter.`
  (`requireAllowedFilterKeys`), now also on `GetAllWafers` and `GetAllWaferTypes`.
- `CreateAsic` checks `asicFamilyType` and `asicQuality` against the live catalog and the wafer's
  existence before inserting; the reply carries `chipId: null`.
