# CLAUDE.md — DbAgentNext (svt-db-agent-next)

The DB agent of SVTSW: the NestJS service that reads and writes the database for all other services. Read
[README.md](README.md) for what it is and the commands, then [docs/README.md](docs/README.md): the domain model,
the database schema, what the agent does for each message, and the decisions behind it.

> A standalone app, not part of the UI Nx workspace: run every command from this folder, with this folder's
> `node_modules`. It shares one thing with `../UI`: the contract types of `../Shared/svt-ts-types`.

## Commands

```bash
npm start              # watch build + run, .env.development (Postgres 5500, Kafka 9085); http://localhost:7676/health
```

```bash
npm run pre-pull-request   # lint + typecheck + unit tests — run this before opening a PR
```

```bash
npm run e2e            # needs Postgres on 5500 with database svt_sw_db_e2e_test (.env.test; override in .env.test.local)
```

`SVT_DB_AGENT_E2E_KAFKA=1 npx vitest run --config vitest.e2e.config.ts test-e2e/kafka` adds the broker-backed
smoke spec (Kafka on 9085). Migrations: `npm run db:migration:create`, `db:migration:up`, `db:migration:pending`.
The agent applies the pending migrations at start (`main.ts`), from the list `SVT_DB_MIGRATIONS` in
`src/migrations/svt-db-migrations.ts`: add each new migration to that list, and keep the previous release working
on the new schema (`docs/02-database-migration.md` §1).

## Code style

The rules of the UI workspace (`../UI/CLAUDE.md` → Code style), enforced by this folder's `eslint.config.mjs`:
4-space indent, single quotes, no semicolons, trailing commas, Stroustrup braces, `max-len` 140,
`padded-blocks` for classes, no member delimiters, `import/order` with two blank lines after the imports, never
name anything `e`. An `index.ts` barrel in every folder; import from the barrel.

## Rules

- **The contract is the authority.** `../Documentation/Kafka/svt.db-agent-next.kafka.yaml` is the contract of this
  agent: change it in the same pull request as the behaviour. `svt.db-agent.kafka.yaml` next to it is the contract
  of the frozen C++ agent; it says what the C++ code does, and it is not the contract to build on. Every difference
  between the two has a decision in `docs/01-behaviour-decisions.md`. The message types are `svt-ts-types/kafka`,
  the shapes `svt-ts-types`.
- **The docs describe the current state, and they change with the code.** `docs/domain-model.md` (entities and
  rules), `docs/database-schema.md` (tables, columns, keys, enum types), `docs/messages.md` (what each message
  does) and `docs/wafer-map.md` say what this agent stores and does. A pull request that changes one of these
  facts changes the page.
- **A schema change starts as a proposal on `docs/database-schema.md`.** A feature starts from its Story (the
  GitHub issue). First change `docs/database-schema.md` to the schema that the feature needs, and
  `docs/domain-model.md` if a rule changes: that diff is the proposal. Then write the migration and change the
  entities. The pull request delivers the migration, the entities and the page together, so that the page is
  always the current schema (`docs/database-schema.md` §8).
- **This agent is the DB agent of every environment. The C++ agent (`../DbAgent`) is frozen and gets no support**
  (`../Documentation/decisions/2026-11-db-agent-next-only.md`). A change of this agent does not have to keep the
  C++ agent working. No log of differences from the C++ agent is kept: a new feature gets no parity case and no
  line in `docs/differences-from-cpp.md` (closed). The docs above are kept complete instead.
- **Do not read `../DbAgent` to learn what this agent does, and do not link to its docs.** That folder is the
  frozen C++ agent, and its docs describe its frozen state. They look like the docs of this agent because this
  agent started as a copy of that behaviour. The domain model, the schema and the behaviour of this agent are in
  `docs/`, and they change only here. Do not change the C++ code or describe this agent there.
- **Requests are validated by this app's own DTO classes** (`src/modules/handlers/**/svt-db-agent-next-*.dtos.ts`),
  each `implements` its contract type. Decorated classes cannot go to `../Shared` (no `node_modules` there).
- **`src/db` is the database layer** (`orm`: MikroORM setup, `data`: entities, repositories, domain logic). It is
  `strict` (`src/db/tsconfig.json`, checked by `npm run typecheck`), and ESLint keeps it from importing the Kafka
  contract or `modules/`. The rest of the app is not strict yet (18 handler errors under `strict`). Conventions for
  entities and migrations: `docs/02-database-migration.md`; for the rest of the code:
  `docs/05-implementation-notes.md`.
- MikroORM 7 is ESM-first and needs Node ≥ 22.17. Import its decorators from `@mikro-orm/decorators/legacy`; the
  app compiles with `moduleResolution: nodenext` because v7's types are invisible to the legacy `node` resolution.

## Gotchas

- **`tsconfig.json` must stay plain JSON** (no comments): `vitest.shared.ts` imports it for the aliases.
- **The MikroORM CLI reads `tsconfig.mikro-orm.json`**, which turns `emitDecoratorMetadata` off. With the
  metadata, its swc loader (`@swc-node/register`) fails on the circular entity imports with
  "Cannot access 'SvtDbWaferTypeMapEntity' before initialization". The CLI needs the TypeScript sources only.
- **Kafka: `postfixId: ''` and the backlog skip stay.** NestJS appends `-server` to the client and group ids
  unless `postfixId` is `''`, and the agent must consume as `svt.db-agent.request`, the C++ agent's group.
  kafkajs resumes from the group's committed offset (`fromBeginning: false` only covers a group without one),
  so `SvtDbAgentNextKafkaBacklogService.skip()` moves the offsets to the end before the consumer starts, as the
  C++ seeks to the end (`docs/04-runtime-and-deployment.md` §2). `main.ts` and the e2e `TestSetup` both call it.
- **`importHelpers` stays off** (the default): the app compiles to CommonJS, and the `export *` of the
  `../Shared` barrels would import `tslib`, which does not resolve from there.
- **The lockfile was seeded from `../UI/package-lock.json`** (2026-11-14). A fresh resolution with npm 10.9
  crashes in vitest 4.1's optional peer set (`Cannot read properties of null (reading 'edgesOut')`). `npm ci` and
  `npm install` on the existing lockfile work; to add or bump a package, change `package.json` and run
  `npm install`, never delete the lockfile.
- `.env.development` / `.env.production` / `.env.test` **are committed**; no secrets there. The app reads
  `.env.<NODE_ENV>` from the working directory, so run it from this folder. A container gets the variables from
  its environment only.
- The e2e harness refuses any database whose name does not end with `_e2e_test`: it truncates every table.
- The pre-commit hook (`../UI/.husky/pre-commit`) runs this folder's lint-staged for staged `.ts` files here; it
  fails when this folder has no `node_modules`.

## External sources of truth

- `../Documentation/Kafka/` — the Kafka contract (above).
- `../Documentation/` — what spans services: the meaning of the entities (`domain-model.md`), the glossary, the
  flows, the decisions. The schema and the data model of the system are in this folder's `docs/`, not there.
- `../Shared/svt-ts-types/README.md` — the rules of the shared contract types and what a consumer must set up.
- `../Environment/README.md` — how the agent is deployed (dev and prod).
