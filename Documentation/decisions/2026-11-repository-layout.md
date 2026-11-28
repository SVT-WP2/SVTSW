# 2026-11: where the DB agent and the shared contract types live

> **Extended on 2026-11-28 by [2026-11-wp-tool-phase-1.md](2026-11-wp-tool-phase-1.md).** `Shared/` also holds a
> Python package, `Shared/svt-wp-core`: code of WPAgent that the WP tool shares. The rule "dependency-free TypeScript only"
> below is the rule of `Shared/svt-ts-types`.

**Decided 2026-11-14.** The re-implementation of the DB agent is a standalone app, [`DbAgentNext/`](../../DbAgentNext/README.md),
at the top level of the repository. The contract types that the UI workspace and the agent both compile are in
[`Shared/svt-ts-types`](../../Shared/svt-ts-types/README.md). This replaced the decision of 2026-11-08, which put the
agent in the UI Nx workspace as `UI/apps/svt-db-agent-next`.

## The layout

```
SVTSW/
├── DbAgent/                   C++ agent, frozen
├── DbAgentNext/               standalone NestJS app: own package.json, lockfile, tsconfig, Dockerfile
│   ├── src/                   app code; database layer in src/db (orm, data)
│   ├── test-e2e/  test-parity/
│   └── docs/
├── Shared/
│   └── svt-ts-types/
│       ├── main/src/          HTTP contract types          alias `svt-ts-types`
│       └── kafka/src/         Kafka contract               alias `svt-ts-types/kafka`
└── UI/                        Nx workspace: epic-measure-ui, epic-measure-api, epic-db-agent (mock)
    └── libs/epic/entities     decorated DTOs and RxJS / NestJS helpers for the BFF and the mock
```

`UI/` and `DbAgentNext/` each map the two aliases in their own tsconfig, by a relative path:

```jsonc
"svt-ts-types":       ["../Shared/svt-ts-types/main/src/index.ts"],
"svt-ts-types/kafka": ["../Shared/svt-ts-types/kafka/src/index.ts"]
```

## Decisions and why

| Decision | Reason |
|---|---|
| The agent is a standalone NestJS app, outside the Nx workspace. | The top-level folders of `SVTSW` are the deployables, and the agent is one: its own image, version and release. In `UI/` it shared one `package.json`, one lockfile and one Node version with Angular. |
| The shared code is in `Shared/svt-ts-types`, with a `main` and a `kafka` entry point. | It has two consumers outside each other's folder. The Kafka contract is for the Node apps only, so the main barrel does not export it; ESLint rejects it in Angular code. |
| `Shared/` holds dependency-free TypeScript only: types, enums, plain classes. No npm imports, no decorators. | A file outside `UI/` resolves npm packages from its own folder, and `Shared/` has no `node_modules`. A second copy of a decorator library (`class-transformer`) keeps separate metadata, so validation would fail without an error. |
| The Kafka messages carry the HTTP contract types directly. A separate wire type exists only where the Kafka shape differs (`EpicSvtTestEntity`, the `*LocationUpdate` types, the Kafka filters). | An alias such as `EpicAsicEntity = EpicAsic` is the same type under a second name. It protects nothing. |
| The agent validates requests with its own DTO classes (`svt-db-agent-next-<domain>.dtos.ts`). Each class `implements` its contract type. | Decorated classes cannot go to `Shared/`. |
| The data layer (`src/db/orm`, `src/db/data`) is part of the agent. | The agent is its only consumer. |

## Why the decision of 2026-11-08 was revised

The first decision kept the agent in the UI workspace, so that "the contract types stay in one workspace".

- In the workspace, MikroORM 7's Node ≥ 22.17 became a constraint of the whole workspace. The agent's unit tests
  ran under the Angular test setup (`jsdom`, the zone wrapper). A change of the workspace's lint or tsconfig
  settings could break the agent.
- The reason for the workspace holds with `Shared/svt-ts-types` as well: one copy, compiled by both sides through
  a path alias. A type that one side no longer matches still breaks the build of that side.

## What follows from it

- Each side has its own pipelines. The path filter of the agent's workflows is `DbAgentNext/**` and `Shared/**`;
  `ui.yml` watches `UI/**` and `Shared/**`. A change of the contract types builds both.
- `npm run lint` in `UI/` also checks `Shared/svt-ts-types` (`lint:shared`: ESLint and a strict `tsc`).
- The Docker build context of both images is the repository root, because both compile `Shared/`.
- The Git hook of the repository is `UI/.husky/pre-commit` (`core.hooksPath`, set up by `npm install` in `UI/`).
  It also runs the lint-staged of `DbAgentNext/`.

Where the current state is described: [`DbAgentNext/README.md`](../../DbAgentNext/README.md) (commands, layout,
Docker, CI/CD), [`DbAgentNext/docs/04`](../../DbAgentNext/docs/04-runtime-and-deployment.md#6-build-versioning-and-where-it-runs)
(build and versioning), [`Shared/svt-ts-types/README.md`](../../Shared/svt-ts-types/README.md) (the rules of the
shared types).

## Open

- **Names.** `DbAgentNext` is a temporary name for a permanent folder. `svt-ts-types` holds enums and message
  classes too, not only types.
- **Contract changes between two releases.** The BFF and the agent build from the same commit, but they deploy
  separately. A new required field of a contract type breaks the agent build, which is a good signal; a new
  optional field breaks nothing. Whether a rule is needed (additive changes only, or a coordinated release) is
  not decided.
- **Where the Git hook lives.** A clone of the repository that never installs `UI/` has no hook.
