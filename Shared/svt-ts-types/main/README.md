# svt-ts-types (main entry point)

The HTTP contract between `epic-measure-ui` (Angular) and `epic-measure-api` (NestJS): the request bodies,
query strings and responses of the DB-agent-backed `/api/...` endpoints, as plain TypeScript types.

It is the **only** library compiled into both the browser bundle and the Node apps, which is why it has to
stay dependency-free:

- types, interfaces, enums and the occasional tiny pure function only;
- **no** decorators, **no** `@angular/*`, `@nestjs/*`, `class-validator`, `rxjs`, and **no** imports from
  `epic/*` or `epic-ui/*`. `../eslint.config.mjs` rejects them (`SVT_TS_TYPES_RESTRICTED_IMPORTS` of
  `UI/eslint.config.mjs`) and `tsc` rejects any npm import: `npm run lint:shared` in `UI/`, see
  [`../README.md`](../README.md).

## How each side uses it

| Side | Does | Example |
|---|---|---|
| Angular (`epic-ui/*`, `apps/epic-measure-ui`) | imports the types directly — there is no separate view model | `fetchOne(id): Observable<EpicAsic>` |
| NestJS (`UI/libs/epic/entities`) | the decorated DTO class `implements` the shared type, so a drifting field is a compile error; a type with optional members is also paired in `contract/epic-api-contract-checks.models.ts` | `class EpicAsicDto implements EpicAsic` + `EpicSameKeys<EpicAsicDto, EpicAsic>` |
| Kafka contract (`svt-ts-types/kafka`) | the messages carry the shared type directly while the wire shape equals the HTTP shape; a separate wire type exists only where the two differ | `PageReplyMessageData<EpicAsic>`, `type EpicSvtTestEntity = Omit<EpicSvtTest, 'status'>` |

The alias is `svt-ts-types` (see `UI/tsconfig.base.json`). The Kafka contract is the sibling entry point
`svt-ts-types/kafka` — see [`../kafka/README.md`](../kafka/README.md).

## Layout

```
src/
├── common/                 paging envelope shared by every list endpoint
└── <domain>/
    ├── requests/           bodies + query-string filters   (*-request.models.ts, *-query.models.ts)
    ├── responses/          what the endpoints return        (*.models.ts)
    └── enums/              string enums that are part of the contract (optional)
```

File naming follows the workspace rule `epic-<domain>-<thing>.models.ts`; every folder has an `index.ts`
barrel.

## Adding a domain

1. Create `src/<domain>/{requests,responses}` with the types + barrels and export the domain from `src/index.ts`.
2. BE: make the DTO classes in `UI/libs/epic/entities/src/<domain>/dtos` `implements` the shared types and use the
   shared types directly in the Kafka messages (`../kafka/src/db-agent/kafka-messages`) — `../kafka/src/db-agent/models`
   holds a type only for a wire shape that differs from the HTTP one. If a type has optional members (all `*ListQuery`
   types), also pair its DTO in `UI/libs/epic/entities/src/contract/epic-api-contract-checks.models.ts`: such a type
   is satisfied by a class sharing a single member, so without the pair a renamed or added filter compiles and is
   then dropped by the `ValidationPipe` (`whitelist: true`).
3. FE: delete the view models in `UI/libs/epic-ui/api/main/src/<domain>/models` and point every importer at
   `svt-ts-types`.

Every DB-agent-backed domain the BE exposes is in here, and nothing else: a request type exists only when the
Kafka contract (`Documentation/Kafka/svt.db-agent.kafka.yaml` at the repository root) defines the operation behind
it. The BFF's other endpoints (`iv-mnt`, `tcp`) are not DB-agent operations and still keep their types in
`UI/libs/epic-ui/api`. If the contract has no `UpdateX`, there is no `EpicXUpdateRequest` — the UI flow is removed,
not stubbed. See `UI/docs/RECIPES.md` → Recipe 1
for where this step sits in the end-to-end flow.
