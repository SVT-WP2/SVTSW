# svt-ts-types

The TypeScript contract types of SVTSW, compiled into more than one deployable: the Angular SPA, the BFF and the
mock DB agent of `UI/`, and the NestJS DB agent. It lives outside `UI/` because its consumers are not all in
that workspace ([05-repository-layout-plan.md](../../UI/docs/db-agent-clone/05-repository-layout-plan.md)).

| Entry point | Alias | Holds | Consumers |
|---|---|---|---|
| [`main/`](main/README.md) | `svt-ts-types` | HTTP contract: request bodies, query strings, responses | SPA, BFF, DB agents |
| [`kafka/`](kafka/README.md) | `svt-ts-types/kafka` | Kafka contract: envelope, `SvtDbAgentKafka<X>` messages, wire types | Node apps only |

## The rule

Dependency-free TypeScript only: types, interfaces, enums and plain classes.

- **No npm imports, no decorators.** A file here resolves npm packages from its own folder, and `Shared/` has no
  `node_modules`. A decorator library imported from here would also be a second copy with its own metadata.
  The ESLint config rejects framework imports; `tsc` rejects any npm import (TS2307).
- **No spec files.** Vitest runs from the consumer's folder and does not find them. The checks of the contract
  are compile-time: a consumer's DTO class `implements` the type.
- **No project files.** It is not an Nx project and has no `package.json`. Each consumer maps the aliases in
  its own tsconfig, by a relative path, and compiles the sources with its own options:

```jsonc
"svt-ts-types":       ["../Shared/svt-ts-types/main/src/index.ts"],
"svt-ts-types/kafka": ["../Shared/svt-ts-types/kafka/src/index.ts"]
```

## Checks

From `UI/`:

```bash
npm run lint:shared
```

It runs ESLint with `eslint.config.mjs` of this folder (the `UI/` root config plus the import restriction; its
plugins resolve from `UI/node_modules`) and `tsc` with `tsconfig.json` of this folder (`strict`, no `extends`, no
`node_modules`). `npm run lint` and the UI CI include it; lint-staged in `UI/` lints a staged file of this folder
too.

## What a consumer must do

Found in the spike of 2026-11-14 (step 5 of the layout plan). Each point is set up in `UI/`:

- **No `rootDir`** that excludes this folder (TS6059).
- **`"importHelpers": false` in every tsconfig that compiles to CommonJS.** The `export *` of the barrels then
  needs `tslib`, which does not resolve from here (TS2354). With the option off, TypeScript writes the helper
  inline. ES-module output (the SPA) needs no helper.
- **No comments in a tsconfig that an Nx webpack build reads**, nor in its `extends` chain. Nx 22.7 reads the
  chain with `JSON.parse` to find the `baseUrl` of the aliases; on a comment it falls back to the app folder,
  and every alias with a `/` fails with "Module not found". This folder's `tsconfig.json` has none either.
- **Nx cache:** Nx hashes only files inside its workspace. `UI/nx.json` adds `node tools/shared-sources-hash.mjs`
  as a `runtime` input to `sharedGlobals`, so a change here rebuilds.
- **Docker:** the build context is the repository root, limited by an ignore file next to the Dockerfile
  (`<Dockerfile>.dockerignore`) to the consumer's folder and `Shared/`.
- **lint-staged:** a pattern that starts with `../` (`"../Shared/**/*.ts"`); `*.ts` matches only files under the
  folder of the lint-staged config.
- **CI:** `Shared/**` in the path filters of the consumer's workflow.
