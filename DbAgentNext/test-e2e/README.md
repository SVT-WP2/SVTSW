# svt-db-agent-next — e2e tests

The suite boots the **real NestJS application** against a **real PostgreSQL database** and drives it
with the same request envelopes the Kafka clients send. Every message type the agent reacts to has a
spec here, and every spec that writes asserts what landed in the database.

```bash
npm run e2e                       # from DbAgentNext/ = vitest run --config vitest.e2e.config.ts
```

## What is under test

| Layer | Covered |
|---|---|
| Request envelope → handler lookup → reply envelope (`type`, `status`, `data`, `error`) | yes, through `SvtDbAgentNextRequestDispatcher` |
| Validation, enum checks, business rules (e.g. wafer-map validation) | yes |
| Repositories, transactions, the real schema (migrations applied by the harness) | yes |
| JSON wire format (dates as strings, `null` data on failure, key order) | yes: every request and reply takes a `JSON.parse(JSON.stringify(…))` round trip |
| NestJS's Kafka transport itself (topics, headers, compression) | **no**: `send()` calls the dispatcher the Kafka controller delegates to (phase 4). A broker-backed smoke test can be added later behind an env flag. |

So `setup.send(message)` is to this agent what `request().post(url)` is to an HTTP API.

## Database

`.env.test` points at `localhost:5500` (the compose Postgres of `Dev/docker-compose.postgres.yml`), user
`postgres` / `postgres`, database **`svt_sw_db_e2e_test`**; create the database once with
`CREATE DATABASE svt_sw_db_e2e_test OWNER postgres`. The harness refuses to run unless the database name
ends with `_e2e_test`, because it **truncates every table** of schema `main` before each test.

Credentials or a port that differ on your machine go into **`DbAgentNext/.env.test.local`**
(git-ignored, same keys), which wins over `.env.test`; variables already set in the shell win over both.
For example, to use a native PostgreSQL on its default port instead:

```
SVT_DB_AGENT_DB_PORT=5432
SVT_DB_AGENT_DB_PASS=<your password>
```

Never put a real password into `.env.test`: it is committed and CI reads it.

- `TestSetup.init()` applies the application's migrations (`src/migrations`) to that database, so the
  schema is always the one the code expects; nothing is generated from entities.
- `beforeEach(() => setup.clearDatabase())` truncates all tables and restarts the identities, so ids
  are predictable (`1, 2, …`) within a test.
- There is no shared fixture set: **each test seeds what it needs**, preferably through the agent's own
  messages (`createWaferType()` in the wafer-types spec), or with `setup.em()` / `setup.query()` for
  rows no message creates.

CI runs the same suite against a `postgres:17` service container (see `.github/workflows/db-agent-next.yml`).

## Kafka

The domain specs never touch a broker. The one spec that does, `kafka/kafka.e2e-spec.ts`, is skipped
unless `SVT_DB_AGENT_E2E_KAFKA=1` is set; it then boots the application with the Kafka microservice
connected (`new TestSetup({ kafka: true })`) and plays a kafkajs client against it, using the broker of
`.env.test` (`localhost:9085`, the one `Dev/docker-compose.kafka-local.yml` starts):

```bash
docker compose -f ../Dev/docker-compose.kafka-local.yml up -d
```

```bash
SVT_DB_AGENT_E2E_KAFKA=1 npx vitest run --config vitest.e2e.config.ts test-e2e/kafka
```

It checks the reply envelope and its correlation id, an unknown type and a non-JSON value (both
`BadRequest`, the agent keeps serving), a write through Kafka, and the heartbeat record. CI has no
broker, so the flag stays off there.

## Writing a spec for a new slice

```ts
describe('Wafers (e2e)', () => {
    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())
    beforeEach(() => setup.clearDatabase())

    it('creates a wafer with its ASICs', async () => {
        const reply = await setup.send(new SvtDbAgentKafkaWafers.CreateWaferMessage({ create }))

        expect(reply).toMatchObject({ type: 'CreateWaferReply', status: 'Success' })
        expect(await setup.query('select count(*)::int as n from main."Asic"')).toEqual([{ n: 41052 }])
    })
})
```

- One file per domain (`test-e2e/<domain>/<domain>.e2e-spec.ts`), one `describe` per message type.
- Cover the success path **and** every reply status the handler can produce (`BadRequest` for
  validation, `NotFound` for a missing id), and assert the database for writes.
- Add the new message types to the list in `dispatch/dispatch.e2e-spec.ts`.
- Use the typed message classes of `svt-ts-types/kafka` where they fit; a plain `{ type, data }` object is
  fine where a class is awkward.
- A spec that needs a feature flag boots its own application with it:
  `new TestSetup({ env: { SVT_DB_AGENT_FEATURE_CHIP_BLOCKS: 'true' } })` sets the variable before `init()`
  and restores it in `close()` (`chip-blocks/chip-blocks.e2e-spec.ts`); the default stays covered by the
  domain's own spec.

## How the runner differs from the unit config

`vitest.e2e.config.ts` uses the **swc** plugin instead of Vitest's esbuild transform: NestJS resolves
constructor injection from decorator metadata (`design:paramtypes`), which esbuild never emits.
`utils/e2e-env.ts` (a `setupFiles` entry) sets `NODE_ENV=test` and loads `.env.test.local` then `.env.test`;
variables already in the environment win, so CI or a developer can point the suite at another database.
Spec files run sequentially (`fileParallelism: false`) because they share one database.
