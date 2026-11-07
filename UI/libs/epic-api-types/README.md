# epic-api-types

The HTTP contract between `epic-measure-ui` (Angular) and `epic-measure-api` (NestJS): the request bodies,
query strings and responses of `/api/...`, as plain TypeScript types.

It is the **only** library compiled into both the browser bundle and the Node apps, which is why it has to
stay dependency-free:

- types, interfaces, enums and the occasional tiny pure function only;
- **no** decorators, **no** `@angular/*`, `@nestjs/*`, `class-validator`, `rxjs`, and **no** imports from
  `epic/*` or `epic-ui/*` (lint-enforced in `eslint.config.mjs`).

## How each side uses it

| Side | Does | Example |
|---|---|---|
| Angular (`epic-ui/*`, `apps/epic-measure-ui`) | imports the types directly — there is no separate view model | `fetchOne(id): Observable<EpicAsic>` |
| NestJS (`epic/entities`) | the decorated DTO class `implements` the shared type, so a drifting field is a compile error | `class EpicAsicDto implements EpicAsic` |
| Kafka contract (`epic/entities`) | the wire type is a one-line alias while it equals the HTTP shape | `type EpicAsicEntity = EpicAsic` |

The alias is `epic-api-types` (see `tsconfig.base.json`).

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
2. BE: make the DTO classes in `libs/epic/entities/src/<domain>/dtos` `implements` the shared types and turn the
   duplicated plain models in `.../models` into aliases of them.
3. FE: delete the view models in `libs/epic-ui/api/main/src/<domain>/models` and point every importer at
   `epic-api-types`.

Every domain the BE exposes is in here, and nothing else: a request type exists only when the Kafka contract
(`../Documentation/Kafka/svt.db-agent.kafka.yaml`) defines the operation behind it. If the contract has no
`UpdateX`, there is no `EpicXUpdateRequest` — the UI flow is removed, not stubbed. See `docs/RECIPES.md` → Recipe 1
for where this step sits in the end-to-end flow.
