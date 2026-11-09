# Phase 4: the Kafka layer, the agent itself

**Goal.** `apps/svt-db-agent-next` consumes `svt.db-agent.request`, answers every one of the 55
contract message types with the documented envelope, emits the heartbeat, reports Kafka and database
health, and passes the parity suite against the C++ agent except for the listed intentional
differences. Delivered in four steps (4a–4d), each a PR.

**Read first.** [00-context.md](00-context.md) §8, §11, §12. `DbAgent/docs/01-architecture.md`
§4–§8, `04-request-engine.md` entirely, `05-request-handlers.md` entirely,
`../01-behaviour-decisions.md` entirely, `../03-parity-testing.md`. The mock's controller
`UI/apps/epic-db-agent/src/modules/db-agent/controllers/epic-db-agent-wafers.controller.ts` and
`main.ts`; the BFF's `UI/apps/epic-measure-api/src/main.ts` for the client side.

## Paths this phase may touch

- `UI/apps/svt-db-agent-next/**`
- `UI/libs/svt-db/data/**` (repository additions discovered while implementing handlers; list them in the PR)
- `UI/CLAUDE.md`, `UI/docs/ARCHITECTURE.md` (the agent replaces the mock in the diagrams once 4d passes)
- `UI/docs/db-agent-clone/03-parity-testing.md` (results), this file

Never: `UI/libs/epic/entities/**` contract types (a contract change is its own PR with the UI
owner), `DbAgent/**`.

## Layout

```
apps/svt-db-agent-next/src/
├── main.ts                                  + connectMicroservice(Transport.KAFKA …) + startAllMicroservices
└── modules/
    ├── kafka/
    │   ├── svt-db-agent-next-kafka.controller.ts         @MessagePattern(SvtDbAgentKafka.TopicName.Request); @CreateRequestContext(); delegates to the dispatcher; always returns a string
    │   ├── svt-db-agent-next-dispatcher.service.ts      type → handler map (Map<string, (data) => Promise<ReplyData>>), request validation, envelope building, error mapping
    │   ├── svt-db-agent-next-envelope.ts                buildReply(type, data) / buildErrorReply(type, status, message, code = -1) producing the exact key order of 00-context §8; parseRequest(value) → { type, data } or a BadRequest reason
    │   ├── svt-db-agent-next-heartbeat.service.ts       kafkajs producer, setInterval 2000 ms, payload { timestamp: '<seconds>.<6 decimals>' }, topic ensured at startup with retention.ms 60000
    │   ├── svt-db-agent-next-kafka-health.indicator.ts  admin.listTopics() with timeout → 'kafka'
    │   └── svt-db-agent-next-kafka.module.ts
    └── handlers/                                   one module per domain, mirroring the mock's services
        ├── wafer-types/  svt-db-agent-next-wafer-types.handlers.ts   GetAllWaferTypes, CreateWaferType, GetWaferTypeMap
        ├── wafers/       …                                           GetAllWafers, CreateWafer, UpdateWafer, UpdateWaferLocation, GetWaferLocationHistory
        ├── asics/        …                                           GetAllAsics, CreateAsic
        ├── chips/        …                                           GetAllChips, CreateChip, CreateManyChips, UpdateChip, UpdateChipLocation, GetChipLocationHistory, GetAllChipBlocks
        ├── modules/      …                                           GetAllModules, CreateModule (BadRequest "not implemented" until Q9), UpdateModuleLocation, GetModuleLocationHistory
        ├── probing/      …                                           GetAllWaferProbeMachines, CreateWaferProbeMachine, UpdateWaferProbeMachine, UpdateWpMachineLoadedWafer, UpdateWpMachineInstalledProbeCard, GetAllProbeCards, CreateProbeCard, GetAllWaferProbeProjects, CreateWaferProbeProject
        ├── equipment/    …                                           GetAllEquipmentTypes, CreateEquipmentType, GetAllEquipment, CreateEquipment, UpdateEquipment, UpdateEquipmentLocation, GetEquipmentLocationHistory
        ├── test-setups/  …                                           GetAllSvtTestSetups, CreateSvtTestSetup, UpdateSvtTestSetup, GetEquipmentListForTestSetup, GetAllSvtTestSetupConfigs, CreateSvtTestSetupConfig, GetSvtTestSetupConfigBody
        ├── test-types/   …                                           GetAllSvtTestTypes, CreateSvtTestType, UpdateSvtTestType, GetAllSvtTestTypeConfigs, CreateSvtTestTypeConfig, GetSvtTestTypeConfigBody, GetAllSvtTestTemplates, CreateSvtTestTemplate, UpdateSvtTestTemplate
        ├── tests/        …                                           GetAllSvtTests, CreateSvtTest, UpdateSvtTestStart, UpdateSvtTestFinish
        └── enums/        …                                           GetAllEnums
```

Each handler file exports a class with one method per message type, `register(dispatcher)` adding
them under the contract's type names (take the names from the `MessageType` enums in
`epic/entities`, never string literals), and request DTO classes (`class-validator`) for the `data`
of each type, implementing the matching `…MessageData` types from `epic/entities` so a contract
change is a compile error.

## 4a. Transport, envelope, enums, heartbeat, health

1. `main.ts`: after creating the HTTP app, `connectMicroservice<MicroserviceOptions>({ transport: Transport.KAFKA, options: { client: { clientId: 'svt-db-agent-next', brokers }, consumer: { groupId: 'svt.db-agent.request', maxBytesPerPartition: 10 * 1024 * 1024, maxBytes: 50 * 1024 * 1024 }, send: { compression: CompressionTypes.GZIP }, subscribe: { fromBeginning: false } } })`,
   then `startAllMicroservices()` before `listen`. Keep `enableShutdownHooks()`.
2. Controller: one `@MessagePattern(SvtDbAgentKafka.TopicName.Request)` method with
   `@Payload() value: unknown` and `@Ctx() context: KafkaContext`; decorated `@CreateRequestContext()`
   (inject `MikroORM`). It calls `dispatcher.handle(value)` and returns the resulting **string**.
   It never throws: the dispatcher catches everything.
3. Dispatcher: `parseRequest` (value must be an object with a string `type` and an object `data`,
   else `BadRequest`), look up the handler (unknown → `BadRequest` `Error: Request <type> not Found`,
   message kept for parity), validate `data` with the handler's DTO (failures → `BadRequest` with
   the class-validator messages joined), run it inside `em.transactional()` for write types,
   build `{ type: type + 'Reply', status: 'Success', data, error: { code: 0, message: '' } }`.
   Errors: `SvtDbNotFoundError` → `NotFound`; `SvtDbValidationError` and DTO failures →
   `BadRequest`; `UniqueConstraintViolationException` → `BadRequest` with a message naming the
   constraint; anything else → `UnexpectedError` with a generic message, full error logged.
   Serialise with `JSON.stringify` over an object literal built in the documented key order.
4. `GetAllEnums`: `data.enumNames ?? data.enumsNames ?? data.filter?.enumNames`; reply `data` is the
   map itself (no `items`/`entity`).
5. Heartbeat service: on module init create the topic if missing (`retention.ms=60000`,
   `segment.ms=120000`, 1 partition), then produce every 2 s; stop on shutdown.
6. Health: add the Kafka indicator; `/health` now has `database` and `kafka`.
7. Logging: one line per message at `log` level: type, correlation id (from
   `context.getMessage().headers`), duration, status.

Acceptance 4a: against local Kafka and the migrated prod dump, the BFF (`npm run start::api`
with `KAFKA_BROKER=localhost:9085`) gets a correct `GET /api/enums`; an unknown type yields the
`BadRequest` envelope; a non-JSON value yields `BadRequest` and the process survives;
`kafka-console-consumer` on `svt.db-agent.heartbeat` shows one record per 2 s; `/health` is `ok`.
Unit tests for the envelope builder and the dispatcher's error mapping.

## 4b. Read handlers

Every `GetAll*`, `Get*LocationHistory`, `GetWaferTypeMap`, `Get*ConfigBody`,
`GetEquipmentListForTestSetup`. Rules:

- `filter` and `pager` DTOs per type from the contract; unknown filter keys → `BadRequest`
  (`Error: <key> is not an allowed filter.` kept for parity).
- Lists: `{ items, totalCount }` with DB-side paging; `pager` absent → all rows; defaults
  `limit 20`, `offset 0` when `pager` is present; `offset` beyond the count → empty `items` with
  the real `totalCount` (the C++ throws; decision: do not throw).
- Ordering: by `id` ascending; location histories by `id` too.
- Items are mapped through one `toWire<Entity>()` function per entity that applies the wire formats
  (dates, timestamps, JSON strings) and the field set of the contract's DTO (`WaferDto`, `AsicDto`,
  …) as declared in `epic/entities`; extra fields the C++ returns (`Chip.asicId`) are kept.
- Scalar relations absent → `null` (`defaultConfigId`, `dutEntityName`, `dutId`); arrays absent
  → `[]` under the contract's key (`dutTypes`, `chips`, `asicFamilyTypes`).
- `GetAllChipBlocks` (not implemented in C++): implement from the contract.
- `GetEquipmentListForTestSetup`: return equipment objects (contract) **and** record it as an
  intentional difference (R-1) in `../03-parity-testing.md`.

Acceptance 4b: for every read type, a Vitest integration spec (DB-gated) sends the message through
the dispatcher (no Kafka needed: call `dispatcher.handle`) and asserts shape and a known value from
the prod dump; `GET /api/wafers`, `/api/asics?waferId=…`, `/api/wp/machines`, `/api/enums` work
end to end in the UI against the real data.

## 4c. Write handlers

In dependency order: equipment types and equipment; wafer types (`CreateWaferType` validates the
map with `validateWaferMap(text, enumsService.getEnumValues('asicFamilyType'))`, stores the type and
the map in one transaction); wafers (`CreateWafer`: wafer + initial location row + **all ASICs
generated with `generateAsics`** in one transaction via `insertMany`; `UpdateWafer` rejects
`generalLocation`; `UpdateWaferLocation`; `UpdateWafer` dates); ASICs; chips (`CreateChip`,
`CreateManyChips` returning the created chips; block generation behind the
`SVT_DB_AGENT_FEATURE_CHIP_BLOCKS` flag, default off, Q6); probing (`UpdateWpMachineLoadedWafer`
writes `Unloaded` for the previous wafer then `Loaded`; `UpdateWpMachineInstalledProbeCard` with a
null card → `BadRequest` "not supported yet" until D-13 is settled); test setups and configs
(`CreateSvtTestSetup` with its default config in one transaction, `UpdateSvtTestSetup` upserting
the default); test types (`CreateSvtTestType` with DUT types and first config; `UpdateSvtTestType`
accepts both the contract shape `{ id, update: { dutTypes } }` and the code shape
`{ testTypeId, dutTypes }`, add-only, until Q22); templates (`isEnabled` honoured); tests
(`CreateSvtTest` with the two link rows; start and finish updates; status validated against the
enum values).

Rules: every write type runs in one transaction; the reply is the entity re-read after the write,
mapped with the same `toWire<Entity>()` as the lists; `NotFound` for a missing id on updates;
unique violations → `BadRequest`; JSON fields must be strings (objects → `BadRequest`).

Acceptance 4c: DB-gated specs per write type on a **copy** of the prod dump (restore into
`svt_sw_db_test_writes`, point `SVT_DB_AGENT_TEST_DB_URL` at it): `CreateWafer` on the ER2 type
creates 3421 ASICs whose set equals `generateAsics`' output; a failing ASIC insert (duplicate serial
number) leaves no wafer, location or ASIC rows; the location flows; the machine load/swap/unload
sequence; the test lifecycle. The UI can create a wafer, a chip, a test setup and a test type
against the agent.

## 4d. Parity and documentation

1. Run the parity suite of `../03-parity-testing.md` against the C++ agent (Dev compose) and the
   clone on the same restored dump; record every difference in that document's §5 as intentional
   (with the decision row) or fix it.
2. Update `UI/CLAUDE.md` (apps table: the mock is now optional; the real agent runs locally against
   Postgres), `UI/docs/ARCHITECTURE.md` §1 diagram and §4, and `../README.md` status.
3. Hand over to the runtime phase: the image, CI and the dev deployment exist since phase 1
   (`../04-runtime-and-deployment.md` §6), so merging this phase to `master` makes the dev container
   a working DB agent. What remains is `../04-runtime-and-deployment.md` §7: parity on dev, then the
   prod swap.

## Ask before…

- deviating from a **fix** decision or implementing an **ask** row differently from the assumption
  in [00-context.md §13](00-context.md#13-open-questions-that-may-change-the-plan);
- changing anything under `UI/libs/epic/entities`;
- running the agent against a broker or database that is not local.

## Outcome (2026-11-08)

Delivered differently from the layout above, because phases 3 and 4 were built slice by slice
([05-e2e-testing.md](05-e2e-testing.md)): the dispatcher, the envelope and the validation helpers live in
`modules/dispatch/` since the first slice, every handlers class is discovered through the
`@SvtDbAgentNextHandlers()` decorator (no `register(dispatcher)`), and the request context is opened by the
dispatcher (no `@CreateRequestContext()` on the controller). What `modules/kafka/` adds:

| Piece | What it does |
|---|---|
| `svt-db-agent-next-kafka.models.ts` | `buildSvtDbAgentNextKafkaOptions(brokers)`: `Transport.KAFKA`, client id `svt-db-agent-next`, consumer group **`svt.db-agent.request`** (the C++ agent's, so a deployment swap is a consumer handover), 10 MiB / 50 MiB fetch limits, gzip replies, `fromBeginning: false`. `buildSvtDbAgentNextHeartbeat()`: `{ timestamp: '<seconds>.<6 decimals>' }`. |
| `svt-db-agent-next-kafka.controller.ts` | `@MessagePattern('svt.db-agent.request')`: hands the payload to the dispatcher, logs type, status, duration and correlation id, returns the reply as a **string**; never throws (a dispatcher failure becomes an `UnexpectedError` envelope). |
| `svt-db-agent-next-heartbeat.service.ts` | kafkajs producer, one record every 2 s; creates the heartbeat topic with `retention.ms=60000`, `segment.ms=120000` when the broker lacks it. Started by `main.ts` after the microservice is up, never by the e2e harness. |
| `svt-db-agent-next-kafka.health-indicator.ts` | `kafka` in `GET /health`: `admin.listTopics()` with a 3 s timeout, client created on first use and dropped after a failure. |
| `main.ts` | `connectMicroservice(...)`, `startAllMicroservices()`, heartbeat `start()`, then the HTTP listener. An unreachable broker ends the boot (as for the C++ agent) and the container restarts. |

Reply routing is NestJS's: the reply goes to the request's `kafka_replyTopic` with `kafka_correlationId`
and `kafka_replyPartition` copied from the request. The C++ ignored the topic header and always used
`svt.db-agent.request.reply`; every client in the repository (the BFF, WPAgent's `WPDbKafkaClient`) sends
the header with that value, so nothing changes for them. A request without `kafka_replyTopic` is treated
as an event and gets no reply; a client that omits it would need a custom `ServerKafka`.

A value that is not JSON reaches the dispatcher as a string and gets the `BadRequest` envelope
(`Malformed request: missing string "type"`); the process keeps serving (the C++ exited).

**Tests.** Unit: the options builder, the heartbeat format, the controller (never throws). e2e:
`test-e2e/kafka/kafka.e2e-spec.ts` is the broker-backed smoke spec, run only with
`SVT_DB_AGENT_E2E_KAFKA=1` against the broker of `.env.test` (`Dev/docker-compose.kafka-local.yml`,
`localhost:9085`): it plays a kafkajs client with the conventions' headers against the agent's real
microservice (`TestSetup({ kafka: true })`) and checks the envelope and correlation, an unknown type and a
non-JSON value with the agent still serving afterwards, a write through Kafka, and the heartbeat record.
CI has no broker, so the flag stays off there.

**Still open from this page.** 4d: the parity run against the C++ agent on the same dump
([../03-parity-testing.md](../03-parity-testing.md)) and the UI documentation updates that follow it.
Intentional differences so far are the findings sections of [05-e2e-testing.md](05-e2e-testing.md).

### End-to-end run (2026-11-09, local)

Postgres (`Dev/docker-compose.postgres.yml`, `svt_sw_db` restored from the June 2026 dump, migrations 0–3
applied with `npm run db-next:migration:up`), Kafka (`Dev/docker-compose.kafka-local.yml`, `localhost:9085`),
`npm run start::db-agent-next`, `npm run start::api`, `npm run start::ui`. Through the BFF, `GET /api/wafer-types`,
`/api/wafers`, `/api/asics?waferId=4` and `/api/enums` return the database's data (3 wafer types, 4 wafers,
3421 ASICs of wafer 4, 21 enum types); `GET /health` is `ok` with `database` and `kafka` up; the UI's pages
load their lists from the agent. Fixed on the way:

- `GetAllEnums` with `enumNames: []` (what the BFF sends for an unfiltered request) returned nothing: an empty
  list now means "all", as for every other list filter.
- A record consumed before the dispatcher's module-init hook had registered the handlers was answered
  `Unknown request type` (seen after a dev-server restart, when the consumer-group rejoin took 21 s):
  `main.ts` now awaits `app.init()` before `startAllMicroservices()`, as the e2e harness always did.
- Migration 3 for databases restored from the June dump (`ProbeCard.arrivalDate`, missing `pcModel` and
  `pcName` values), guarded, no-op elsewhere.
- BFF: the `enumNames` query filter of `GET /api/enums` failed with `value.split is not a function` for
  every form (the ValidationPipe's implicit conversion had already made it an array); the DTO transform now
  accepts strings, comma lists and arrays.
- BFF: every list-query DTO rejected a one-item array filter (`GET /api/svt-tests?dutEntityNames=ChipBlock&dutId=1`,
  the chip-block details page, was a 400 `dutEntityNames must be an array`): the UI appends the key once per
  item, so one item reaches the BFF as a plain string, and the number arrays went on to the agent as strings.
  `TransformQueryStringArray()` / `TransformQueryNumberArray()` (`libs/epic/entities/src/common/dtos`) now
  normalise string, comma-list and array forms on all nine query DTOs. The svt-tests `ids` filter is `number[]`
  end to end now (contract, DTO with `@IsInt({ each: true })`, UI): the UI's search box turns its integer tokens
  into ids and keeps the others from reaching the API (an explicit empty list, answered locally with no rows).
- A filter value that is no value of its enum type (`GetAllChips` with `familyTypes: ['ChipBlock']`) made the
  database throw and the agent answer `UnexpectedError`; the dispatcher now maps Postgres `22P02`
  (`invalid_text_representation`) to `BadRequest` — `Error: "ChipBlock" is not a value of the asicFamilyType enum`
  — alongside the unique-constraint mapping it already had. The enum catalogue the UI picks from matches the
  database, so the UI never sends such a value; Swagger users do.

UI pages walked through afterwards (Chrome, logged in): wafers list and details, chips list and details,
chip-block details, SVT tests list (a search term that is no id makes no API call and shows no rows; `1, x`
asks for `ids=1`), admin test setups (list, details, config body), test types (list, config body), test
templates, wafer types, equipment types, equipment, WP machines, WP projects, WP probe cards and enums. Every
`/api` call answered 200. The one console error, `couldn't load module ace/theme/ace/theme/github` on the two
config-body pages, comes from the ace editor's theme loading under the dev server and has nothing to do with the
agent; the editor shows the body regardless.
