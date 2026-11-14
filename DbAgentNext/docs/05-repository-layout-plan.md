# Repository layout: the DB agent and the shared types leave `UI/`

**Status: in progress (2026-11-14).** Steps 1 to 7 are done on the branch
`371-db-next-instance-proposal` (§3, §5); step 8 (records) is open. This file is the handover: it assumes no knowledge
of the sessions that produced it.

It replaces the decision of [04-runtime-and-deployment.md §6](04-runtime-and-deployment.md#6-where-the-code-lives-build-and-versioning)
(2026-11-08: "the agent lives in the UI workspace"). Update that section when step 8 is done.

## 1. Target

```
SVTSW/
├── DbAgent/                   C++ agent, unchanged
├── DbAgentNext/               standalone NestJS app: own package.json, lockfile, tsconfig, Dockerfile
│   ├── src/                   app code; database layer in src/db (orm, data)
│   ├── test-e2e/  test-parity/
│   └── docs/                  today UI/docs/db-agent-clone
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

## 2. Decisions and why

| Decision | Reason |
|---|---|
| The agent leaves the Nx workspace and becomes a standalone NestJS app. | Top-level folders of `SVTSW` are deployables. The agent has its own image, version and release. In `UI/` it shares one `package.json`, one lockfile and one Node version with Angular: MikroORM 7 already forces `engines` ≥ 22.17 on the whole workspace. |
| The shared code moves to `Shared/svt-ts-types`, with a `main` and a `kafka` entry point (the `epic-ui` lib layout). | Two consumers outside each other's folder. The Kafka contract is for the Node apps only, so it is not exported by the main barrel; ESLint rejects it in Angular code. |
| `Shared/` holds dependency-free TypeScript only: types, enums, plain classes. No npm imports, no decorators. | A file outside `UI/` resolves npm packages from its own folder, and `Shared/` has no `node_modules`. A second copy of a decorator library (`class-transformer`) keeps separate metadata, so validation would fail with no error. |
| The Kafka messages carry the HTTP contract types directly. A separate wire type exists only where the Kafka shape differs (`EpicSvtTestEntity`, the `*LocationUpdate` types, the Kafka filters). | The 49 former aliases (`EpicAsicEntity = EpicAsic`) were the same type under a second name. They protected nothing. |
| The agent validates requests with its own DTO classes (`svt-db-agent-next-<domain>.dtos.ts`), each `implements` its contract type. | Decorated classes cannot go to `Shared/`. The agent already had local DTOs for four domains. The copies do not need Swagger. |
| The data layer (`svt-db/orm`, `svt-db/data`) is part of the agent: `src/db/orm`, `src/db/data`. | The agent was the only consumer, and the two libs imported no other workspace code. |

## 3. Done

| # | Step | State |
|---|---|---|
| 1 | The 49 alias wire types of `epic/entities` are removed; all code uses the `epic-api-types` names. | Commit `64b5de4e`, pushed. |
| 2 | Kafka contract in its own entry point. `libs/epic-api-types/main` (alias `epic-api-types`) and `libs/epic-api-types/kafka` (alias `epic-api-types/kafka`). `epic/entities` keeps the DTOs, the RxJS operators, `processKafkaReplyError`, the reply bus and the two SVT test status functions. | Commit `75f5b700`, pushed. |
| 3 | 24 app-local DTO classes in the agent (21 + 3 nested). The agent has zero imports of `epic/entities`. | Commit `20bffc78`. |
| 4 | `libs/svt-db/{orm,data}` moved to `apps/svt-db-agent-next/src/db/{orm,data}`; aliases `svt-db/*` removed; relative imports. | Commit `17ef01ff`. |

Two changes in these steps were not mechanical:

- `EpicKafkaReplyMessage`: `data` and `error` are typed nullable as well as optional. `EpicKafkaReplyMessageClass`
  always writes `null`, and the `strict` settings of `epic-api-types` rejected the old typing. No runtime change.
- `src/db` keeps what the two libs had: `strict` (`src/db/tsconfig.json`, which also type-checks its 6 spec files)
  and the import rules (the app's `eslint.config.mjs`: no Kafka contract, no `modules/`). The rest of the agent is
  **not** strict: its handlers have 21 errors under `strict` (§7).

## 4. Where the code stood before step 7

The inventory step 7 worked from. The paths it names have moved; §5, step 7 says where to.

- The agent imports, outside its own folder: `svt-ts-types`, `svt-ts-types/kafka` (`Shared/svt-ts-types`, since
  step 6) and npm packages. Nothing else.
- Runtime packages of the agent: `@nestjs/{common,config,core,microservices,terminus}` (plus `platform-express`),
  `@mikro-orm/{core,decorators,migrations,nestjs,postgresql}`, `pg`, `kafkajs`, `class-validator`,
  `class-transformer`, `reflect-metadata`, `rxjs`.
- Test and tool packages of the agent: `@mikro-orm/{cli,reflection}`, `@nestjs/testing`, `dotenv`, `unplugin-swc`,
  `@swc/core`, `vitest`.
- No other app or lib imports `@mikro-orm/*`, `pg`, `unplugin-swc`, `dotenv` or `@nestjs/testing`. They are the
  candidates to leave `UI/package.json` in step 7 (check the build tooling for `dotenv` first), together with the
  Node 22.17 `engines` constraint and the `mikro-orm` block.
- `epic-api-types` was imported in 352 files, `epic-api-types/kafka` in 76 files; step 6 renamed both.
- Paths in the agent that depend on its place in the repository (all change in step 7):
  - `tsconfig.json` (`extends ../../tsconfig.base.json`), `tsconfig.app.json` / `tsconfig.spec.json` (`outDir`),
    `src/db/tsconfig.json` (`typeRoots`), `eslint.config.mjs`, `project.json`, `webpack.config.js` (output path).
  - `vitest.shared.ts`: reads `../../tsconfig.base.json` for the aliases, `workspaceRoot`.
  - `mikro-orm.config.ts`: `workspaceRoot = ../..`, entity and migration paths relative to it.
  - Tests that read `Configurations/WaferTypeMappings` at the repository root:
    `src/db/data/wafer-maps/svt-db-asic-generation.spec.ts`, `svt-db-wafer-map-validation.spec.ts` (7 levels up),
    `test-e2e/wafers/wafers.e2e-spec.ts`, `test-e2e/wafer-types/wafer-types.e2e-spec.ts` (5 levels up).
- Files outside the agent that name `apps/svt-db-agent-next`: the three `db-agent-next*.yml` workflows, `ui.yml`,
  `DbAgent/README.md`, `Documentation/Kafka/svt.db-agent-next.kafka.yaml`, `Environment/README.md`,
  `Environment/Dev/README.md`, `Environment/Dev/docker-compose-svtsw-dev.yml`, `UI/.gitignore`, `UI/CLAUDE.md`,
  `UI/README.md`, `UI/package.json`, these documents.

## 5. Remaining steps

Do them in this order. Each step is one commit (or two where stated). Verify with §8 after each step.

### Step 5: spike, an alias that points outside `UI/`

Not for merge. The question: do all tools of the UI workspace accept a source file that is outside `UI/`?

**Done 2026-11-14: yes, every row has a clean fix; the fallback is not needed.** The spike was a
`Shared/svt-ts-types/main/src` with an enum, an interface and a class behind an `export *` barrel, the alias
`svt-ts-types` in `UI/tsconfig.base.json`, an import in `apps/epic-measure-ui/src/main.ts` and
`apps/epic-measure-api/src/main.ts`, and two specs. It was reverted; step 6 applies the fixes.

| Tool | Result | Fix |
|---|---|---|
| TypeScript | TS6059 in both apps (`"rootDir": "."`). In the BFF also TS2354: the `export *` of the barrel, compiled to CommonJS with `importHelpers`, imports `tslib`, which does not resolve from `Shared/`. The Angular app emits ES modules and needs no helper. | Remove `rootDir` from `tsconfig.base.json` (no target emits with `tsc`: the builds are webpack, esbuild and Vitest). `"importHelpers": false` in the `tsconfig.app.json` of the three CommonJS Node apps: TypeScript then writes the helper inline. |
| Angular | `nx build epic-measure-ui` passes. `nx serve` rebuilt after an edit of the shared file; the served `main.js` had the new value. | None. |
| Nest builds (webpack) | Fails with the TS2354 above. With the fix it builds, and the bundle runs (it printed the spike value). | As above. |
| Vitest | The root config (Analog plugin, `jsdom`) and the agent's e2e config (swc) both resolve the alias and run the spec. A spec **inside** `Shared/` is not found by `npx vitest run` (its root is `UI/`); with `--dir ..` it fails: `Cannot find module '/@fs/G:/…'`. | `Shared/` holds no spec files. The library has none today; its checks are compile-time. |
| ESLint | The root config: "File ignored because outside of base path". With lookup from the file: "couldn't find an eslint.config". | `Shared/svt-ts-types/eslint.config.mjs` imports `UI/eslint.config.mjs` (its npm packages resolve from `UI/node_modules`) and adds the import restriction. Run it as `eslint --flag v10_config_lookup_from_file ../Shared/svt-ts-types` (a folder: a `../` glob matches nothing). The type-aware rules work through `Shared/svt-ts-types/tsconfig.json`, a strict tsconfig with no `extends`; `tsc` on it also rejects an npm import (TS2307). |
| Nx cache | A change in `Shared/` reused the cached build. An input `{workspaceRoot}/../Shared/**/*` is ignored as well. | `"sharedGlobals": [{ "runtime": "node tools/shared-sources-hash.mjs" }]` in `nx.json`: the script hashes the paths and contents of `Shared/`. A changed file and a new file both rebuild. A failing runtime command does not fail the task, it only stops the invalidation, so the script must stay where `nx.json` says. |
| Docker | The context `UI/` has no `../Shared`. | The repository root as context, with an ignore file next to the Dockerfile (`UI/Dockerfile.dockerignore`, read by BuildKit): `*`, then `!UI` and `!Shared`, then the old exclusions with a `UI/` prefix. The context was 1.8 MB. |
| Husky / lint-staged | The hook runs in `UI/`. lint-staged sees the staged `Shared/` file, but `*.ts` matches files under `UI/` only: "No staged files match any configured task". | An entry `"../Shared/**/*.ts"` in `UI/.lintstagedrc`: lint-staged matches a file outside its folder only by a pattern that starts with `../`. Its ESLint flag `unstable_config_lookup_from_file` is renamed in ESLint 9.39 (warning); use `v10_config_lookup_from_file`. |
| CI | Not run. | `Shared/**` in the path filters of `ui.yml` and `db-agent-next.yml`; the Docker context of both is the repository root. |

The plan before the spike, for reference:

| Tool | What to check | Expected problem |
|---|---|---|
| TypeScript | `tsc` on an app and on a lib | `"rootDir": "."` in `tsconfig.base.json`: error TS6059 for a file outside `UI/`. Remove the option or widen it. |
| Angular | `nx build epic-measure-ui`, then `nx serve` and edit the shared file | The dev server must rebuild on a change in `Shared/`. |
| Nest builds (webpack) | `nx build epic-measure-api` | `importHelpers: true` can emit an import of `tslib` in the shared file, which resolves from `Shared/`. |
| Vitest | `npx vitest run` with a spec that imports the alias | The alias code in `vitest.config.ts` uses `resolve(__dirname, target)`; this is correct for `../`. Check Vite's file-system limits. |
| ESLint | `npm run lint` | Files outside `UI/` are not linted by the root config. `EPIC_API_TYPES_RESTRICTED_IMPORTS` then guards nothing; `Shared/` needs its own config or lint run. |
| Nx cache | change the shared file, run `nx build` again without `--skip-nx-cache` | Nx does not see files outside the workspace: the cached build is reused. Add a `runtime` input that hashes `Shared/`, or stop caching the builds that use it. |
| Docker | `docker build` of the UI image | The context is `UI/`, so `../Shared` is missing. Use the repository root as context, or a second build context. |
| Husky / lint-staged | commit a change in `Shared/` | The hook runs inside `UI/`. |
| CI | — | `ui.yml` and `db-agent-next.yml` need `Shared/**` in their path filters. |

3. Exit: every row has a clean fix. If one has not, use the fallback: the library stays in `UI/libs/epic-api-types`
   and only `DbAgentNext/` maps its aliases into `../UI/libs/epic-api-types/...`. Then no UI tool sees a file
   outside its workspace; only the agent build and its Docker context must handle the outside path.

### Step 6: move the library, then rename the alias (two commits)

1. `git mv UI/libs/epic-api-types Shared/svt-ts-types` (keep `main/` and `kafka/`). Point the two aliases at the
   new place. Apply the fixes of the spike. The two Nx `project.json` files go, because `Shared/` is not in the
   workspace. Verify.

   **Done 2026-11-14.** The per-entry `project.json`, `package.json`, `tsconfig*.json` and `eslint.config.mjs`
   gave way to one `tsconfig.json` and one `eslint.config.mjs` in `Shared/svt-ts-types`, and a README there lists
   what a consumer must set up. Beyond the spike: `importHelpers` is off in `libs/epic/{core,entities}` too (both
   CommonJS), the root ESLint block for the old path is gone (`npm run lint:shared` replaces it), the UI image
   and the agent image build from the repository root (`UI/.dockerignore` became a `Dockerfile.dockerignore` per
   image), and `UI/docker-compose.yml` and `Dev/docker-compose.swtsw.yml` build with the root as context. One new
   trap: a comment in an app's `tsconfig.app.json` broke every alias with a `/` in its webpack build (§9).
2. Second commit: rename the aliases `epic-api-types` → `svt-ts-types` and `epic-api-types/kafka` →
   `svt-ts-types/kafka` (351 + 76 files, mechanical). Do **not** rename the `Epic*` symbols in this work.

   **Done 2026-11-14.** A Node codemod over the tracked `.ts`, `.mjs` and `.json` files of `UI/` and `Shared/`
   (376 files) and 8 README / guide files; `EPIC_API_TYPES_RESTRICTED_IMPORTS` became
   `SVT_TS_TYPES_RESTRICTED_IMPORTS`. `eslint --fix` then moved the import in 16 files to its new alphabetical
   place. The documents of `docs/db-agent-clone` keep the old name where they describe the past.
3. Update `UI/CLAUDE.md`, `UI/docs/ARCHITECTURE.md`, `UI/docs/RECIPES.md` and the two library README files.
   **Done** in the two commits (paths in the first, alias names in the second), plus `Shared/README.md` and
   `Shared/svt-ts-types/README.md`.

On Windows a folder rename fails while the IDE holds the folder open. Close the IDE or move the files one by one
(step 6 did: `git mv` per file).

### Step 7: move the agent to `DbAgentNext/`

1. `git mv UI/apps/svt-db-agent-next DbAgentNext` and `git mv UI/docs/db-agent-clone DbAgentNext/docs`.
2. Own `package.json` and lockfile with the packages of §4. Move the scripts (`start`, `build`, `e2e`, `parity:*`,
   `db-next:*`) and the `mikro-orm` block from `UI/package.json`.
3. Build without Nx. Today the build uses `NxAppWebpackPlugin` and its `generatePackageJson`, which the runtime
   image installs from. Replace it with the Nest CLI webpack build (it bundles the `svt-ts-types` alias, because
   the alias is not in `node_modules`), and install the runtime image from the app's own `package.json`
   (`npm ci --omit=dev`).
4. Own `tsconfig` (no `extends` into `UI/`), own `eslint.config.mjs` (copy the non-Angular rules of
   `UI/eslint.config.mjs`), own unit Vitest config for Node (today the unit tests run with the UI root config:
   Angular plugin and `jsdom`).
5. Correct every path of §4: `vitest.shared.ts`, `mikro-orm.config.ts`, the four test files that read
   `Configurations/`, `src/db/tsconfig.json`.
6. Dockerfile: the context must contain `DbAgentNext/` and `Shared/`.
7. Workflows `db-agent-next.yml`, `db-agent-next-manual.yml`, `db-agent-next-release.yml`: working directory,
   path filters (`DbAgentNext/**`, `Shared/**`), npm cache path, Docker context and file, the version file the
   release bumps. `ui.yml`: remove the `!UI/apps/svt-db-agent-next/**` exclusion, add `Shared/**`.
8. Clean `UI/`: remove the agent-only packages and scripts, the `mikro-orm` block and the `engines` constraint
   from `UI/package.json`; check the Node version of `UI/Dockerfile`; remove the agent from `UI/CLAUDE.md`,
   `UI/README.md` and `UI/.gitignore`.
9. Run the parity suite before and after this step ([03-parity-testing.md](03-parity-testing.md)); it compares the
   replies on the wire. It was not run in steps 1 to 4.

**Done 2026-11-14**, in two commits (the move, then the clean-up of `UI/`). What was done and what differs from
the list above:

- **Parity:** the clone was recorded on a fresh restore of the dev dump (migrations 0–4) as `move-before`, built
  and run from `UI/` (after step 6), and as `move-after`, built and run from `DbAgentNext/`; the comparer gave
  **396 of 396 cases the same**. The two recordings were not committed (`snapshots/next.json` is still the clone's
  recording of 2026-11-09).
- **Packages:** the versions of `UI/package.json` for every package of §4; new are `@nestjs/cli` 11.0.24,
  `ts-loader` 9.6.2 (the Nest webpack build) and `@swc-node/register` (the TypeScript loader the MikroORM CLI picks).
  `pg` comes with `@mikro-orm/postgresql`. The **lockfile was seeded from `UI/package-lock.json`** and pruned by
  `npm install`: a fresh resolution crashes npm 10.9 (`Cannot read properties of null (reading 'edgesOut')`, in
  the optional peer set of vitest 4.1.11), so the transitive versions are those of `UI/` today.
- **Scripts** lost the `::db-agent-next` / `db-next:` prefixes: `start`, `build`, `lint`, `typecheck`, `test`,
  `e2e`, `parity:record`, `parity:compare`, `db:migration:*`, `db:schema:update:dump`.
- **Build:** `nest build` with `"builder": "webpack"` (`nest-cli.json`): `dist/main.js`, `../Shared` bundled, 13 npm
  packages required at run time; a type error fails it. The runtime image runs `npm ci --omit=dev` on the app's
  lockfile; the old `npm install` on a generated `package.json` is gone.
- **tsconfig:** standalone, `lib` without `dom`, `importHelpers` off. The spec project now type-checks without the
  `--typeRoots` work-around of §8 (only the 4 old errors of §7 remain). New: `tsconfig.mikro-orm.json` for the
  MikroORM CLI, without `emitDecoratorMetadata` (§9).
- **Unit tests** run with `vitest.config.ts` (Node, swc). The spec that needs `SVT_DB_AGENT_TEST_DB_URL` uses
  `describe.skipIf` now; the work-around for the Angular zone setup of the UI config is gone.
- **CI** runs `npm run typecheck` as well, so the `strict` check of `src/db` runs on every PR.
- **Hook:** `UI/.husky/pre-commit` also runs `DbAgentNext`'s lint-staged when `.ts` files of the agent are staged;
  `.gitattributes` keeps the hook files LF.
- **`UI/`:** `@mikro-orm/*`, `pg`, `unplugin-swc` and `dotenv` removed (43 packages); `@nestjs/terminus` and
  `@nestjs/testing` stay (the BFF has them since #241); `engines.node` back to `^20.19.0 || ^22.12.0 || >=24.0.0`;
  `UI/Dockerfile` on `node:22-alpine` (it was on Node 20, which reached its end of life in April 2026, while CI
  builds on 22.17). The UI image was built and answered on `/api/health/version` and `/app/`.
- **Docs:** the relative Markdown links of the whole repository were rewritten by a script that resolves each link
  from the file's old place (46 links in 11 files); all relative links resolve.

### Step 8: records

- Rewrite §6 of `04-runtime-and-deployment.md` with the new decision and its date.
- Update `Environment/README.md`, `Environment/Dev/README.md`, `DbAgent/README.md` and the comment in
  `Documentation/Kafka/svt.db-agent-next.kafka.yaml` where they name the old path.
- The phase documents in `dev-plan/` describe the workspace of their time. Keep them, and keep the note at the top
  of `dev-plan/README.md` correct.

## 6. Open decisions

- **Names.** `DbAgentNext` is a temporary name for a permanent folder (the first proposal said `DbAgentNode`).
  `svt-ts-types` holds enums and message classes too, not only types (`svt-ts-contract` is more exact).
- **Strict mode for the whole agent.** A standalone app with one strict `tsconfig` is the natural end state. It
  needs the 21 handler errors fixed first (§7), and then `src/db/tsconfig.json` can go.
- **Contract changes between two releases.** The BFF and the agent build from the same commit but deploy
  separately. A change of an `Epic*` type for the UI also changes the Kafka contract. A new required field breaks
  the agent build, which is a good signal; a new optional field breaks nothing. Decide if a rule is needed
  (additive changes only, or a coordinated release).

## 7. Found on the way, not part of the move

- **4 type errors in the agent's test files**, older than this work (they exist in `a54dadde`):
  `src/modules/kafka/svt-db-agent-next-kafka.controller.spec.ts:15` (`'Success'` for `EpicKafkaReplyStatus`),
  `test-e2e/svt-test-setup-configs/svt-test-setup-configs.e2e-spec.ts:73` and `:76` (`setupId` is not in the filter
  type), `test-e2e/svt-tests/svt-tests.e2e-spec.ts:307` (`'PARTIAL_SUCCESS'` for `EpicSvtTestResultStatus`).
  The tests pass, because Vitest does not type-check.
- **`tsconfig.spec.json` of the agent cannot be type-checked as it is.** `types: ["vitest/globals"]` is not found
  (`typeRoots` of `tsconfig.base.json`), and `tsc` then stops before it examines any file. That hid the 4 errors.
  Until it is fixed, use the command of §8.
- **21 `strict` errors in the handlers** (`src/modules/handlers`): 14 × TS2322, 6 × TS2345, 1 × TS2416. Most are a
  `string | null` or `number | null` from the database assigned to a contract field typed without `null`.
- **`db-agent-next.yml` still triggers on `UI/libs/epic/**`.** The agent no longer imports that folder.
- **`epic/entities` is no longer about entities.** It holds the BFF's decorated DTOs and the Kafka helpers.

## 8. How to verify

Since step 7 the checks run in two folders. PostgreSQL must listen on 5500 for the e2e suite and Kafka on 9085
for the Kafka spec (`Dev/` has the compose files).

**`DbAgentNext/`**, after `npm ci`:

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npx tsc --noEmit -p tsconfig.spec.json
```

The spec project must show exactly the 4 errors of §7.

```bash
npm test
```

```bash
npm run build
```

```bash
npm run e2e
```

```bash
SVT_DB_AGENT_E2E_KAFKA=1 npx vitest run --config vitest.e2e.config.ts test-e2e/kafka
```

```bash
NODE_ENV=test npm run db:migration:pending
```

```bash
cd .. && docker build -f DbAgentNext/Dockerfile -t svt-db-agent-next .
```

**`UI/`**:

```bash
npm run lint
```

It includes `npm run lint:shared`: ESLint and the strict `tsc` of `../Shared/svt-ts-types`.

```bash
npx vitest run
```

```bash
npx nx run-many -t build -p epic-measure-ui epic-measure-api epic-db-agent --skip-nx-cache
```

`tsc --noEmit -p` on `libs/epic/entities` and `libs/epic/core` (`tsconfig.lib.json`), `apps/epic-measure-api` and
`apps/epic-db-agent` (`tsconfig.app.json`, `tsconfig.spec.json`) and `apps/epic-measure-ui/tsconfig.app.json`:
0 errors each.

```bash
cd .. && docker build -f UI/Dockerfile -t svt-ui .
```

Results on 2026-11-14, after step 4: 56 unit tests, 148 e2e tests (4 skipped without the Kafka flag), 4 Kafka
tests, all builds, lint clean, `No pending migrations`. After step 6.1: the same, without the Kafka run (no broker
that day); both images build from the repository root. After step 7: `DbAgentNext` 47 unit tests (3 more skipped
without `SVT_DB_AGENT_TEST_DB_URL`), 148 e2e tests, 4 Kafka tests, `No pending migrations`, its image answers
`GET /health` with database and Kafka up; `UI/` 9 unit tests (47 + 9 = the 56 of before), lint clean, the three
builds, its image on Node 22 answers. Parity before and after the move: 396 of 396 cases the same (§5, step 7).

## 9. Traps met in steps 1 to 7

- **A moved file changes the depth of its relative paths.** Step 4 broke two specs that read
  `Configurations/WaferTypeMappings`; only the unit tests showed it. Step 7 moves the same files again (§4).
- **`tsc` reports a missing `types` entry and then checks nothing.** An exit code with one TS2688 error does not
  mean that the files are correct.
- **Windows PowerShell 5.1 reads UTF-8 files as ANSI by default.** Do not rewrite source files with `Get-Content` /
  `Set-Content`; the documents contain non-ASCII characters. The codemods of steps 1 to 4 were Node scripts.
- **lint-staged with partly staged files.** The pre-commit hook runs ESLint on the staged content only. If a
  commit is made while other changes of the same files are not staged, check the result of the hook.
- **The IDE adds new files to the index by itself.** Before a commit that must hold one step only, look at
  `git diff --cached --stat`.
- **Import order after a codemod.** `eslint --fix` moves a changed import to its group; run it on the changed files.
- **No comments in a tsconfig that an Nx webpack build reads** (step 6). Nx 22.7 `resolvePathsBaseUrl` reads the
  `extends` chain with `JSON.parse`; on a comment it silently takes the app folder as `baseUrl`, and webpack then
  fails with "Module not found" for `epic/entities`, `epic-api-types/kafka` and every other alias with a `/`.
  `tsc` and `tsconfig-paths` accept the same file, so only the build shows it.
- **The MikroORM CLI and `emitDecoratorMetadata`** (step 7). The CLI loads `mikro-orm.config.ts` with
  `@swc-node/register`, which emits `design:type` metadata when the tsconfig asks for it; the circular imports of
  the entities then fail with "Cannot access 'SvtDbWaferTypeMapEntity' before initialization". In `UI/` the CLI
  read `tsconfig.base.json`, which has no `emitDecoratorMetadata`; `DbAgentNext` gives the CLI
  `tsconfig.mikro-orm.json`.
- **npm 10.9 cannot resolve vitest 4.1.11 from scratch** (step 7): "Cannot read properties of null (reading
  'edgesOut')" in `#loadPeerSet`, with npm 10.9.2 and 10.9.8, an empty cache, and vitest alone in a new folder.
  An existing lockfile avoids it; `DbAgentNext/package-lock.json` was seeded from `UI/package-lock.json`.
- **Git Bash rewrites `/tmp/...` arguments** of `docker exec` into Windows paths (`pg_restore` then cannot open
  `C:/Users/.../Temp/dev.dump`); set `MSYS_NO_PATHCONV=1`.
- **`Dev/docker-compose.kafka-local.yml` will not start** when `svt-network--local` was created by hand (as the
  Postgres compose file expects: `external: true`): "network ... has incorrect label". A one-off override file that
  declares the network `external: true` starts it. The two compose files disagree; not changed in this work.
- **A broker that has just started** fails the agent's boot ("This server does not host this topic-partition");
  start the agent once the broker reports healthy.
