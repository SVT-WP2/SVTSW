# 2026-11: the DB agent clone, and the C++ agent frozen

> **Completed on 2026-11-18 by [2026-11-db-agent-next-only.md](2026-11-db-agent-next-only.md).** `svt-db-agent-next`
> is the DB agent of every environment, and the C++ agent gets no support. That record replaces three parts of this
> one: the rules 2 and 3 of "Rules while the fork lasts" (no log of differences is kept; `differences-from-cpp.md`
> is closed), the section "Going back to the C++" (not a goal), and
> the first point of "Open" (the schema authority is `DbAgentNext/docs/database-schema.md`; the schema file moved to
> `DbAgent/docs/DBTables/`). This record stays as it was written, apart from the path of that file.

**Decided 2026-11-15.** Development of the DB agent continues in the NestJS re-implementation
[`DbAgentNext/`](../../DbAgentNext/README.md) (`svt-db-agent-next`). The C++ agent [`DbAgent/`](../../DbAgent/README.md)
is frozen. Going back to the C++, and deprecating the clone, stays possible. This note is what such a return
starts from.

## Why

Only the author of the C++ agent knew its code, and the author is leaving; nobody left on the team writes C++. The
analysis of 2026-11-05 chose NestJS + MikroORM: the protocol the agent speaks is NestJS's Kafka convention, the
typed contract already existed for the UI and the BFF, and the team knows the stack. The reasons and the
counter-arguments are in [DbAgentNext/docs/README.md](../../DbAgentNext/docs/README.md#why-nestjs--mikroorm-summary-of-the-2026-11-05-analysis).

## Timeline

| Date | What |
|---|---|
| 2026-11-05 | analysis: rewrite rather than maintain the C++ |
| 2026-11-07 | [`DbAgent/docs`](../../DbAgent/docs/README.md) written from the C++ code on `master` (`850572ad`) |
| 2026-11-08 | the C++ author answers the open questions ([DbAgent/docs/08](../../DbAgent/docs/08-questions-for-the-author.md)); the clone starts |
| 2026-11-14 | the clone is the standalone app `DbAgentNext/`; first parity run against the C++ |
| 2026-11-15 | this decision: the clone is where development continues, the C++ is frozen |
| 2026-11-18 | the C++ contract is aligned with the C++ code, and `DbAgent/docs` is corrected against the replies recorded in the parity run |

## Where each side is described

| | The C++ agent (frozen) | The clone (living) |
|---|---|---|
| Behaviour | [`DbAgent/docs`](../../DbAgent/docs/README.md): the C++ at the freeze, quirks included | [`DbAgentNext/docs`](../../DbAgentNext/docs/README.md): what it does differently and why ([01](../../DbAgentNext/docs/01-behaviour-decisions.md)), how it is built ([05](../../DbAgentNext/docs/05-implementation-notes.md)) |
| Kafka contract | [`svt.db-agent.kafka.yaml`](../Kafka/svt.db-agent.kafka.yaml): what the C++ code does, defects included (aligned with the code on 2026-11-18; what it said before is in [DbAgent/docs/07](../../DbAgent/docs/07-contract-drift-and-quirks.md)) | [`svt.db-agent-next.kafka.yaml`](../Kafka/svt.db-agent-next.kafka.yaml), a full contract, not a delta |
| Database | the schema of [`SVT_DB_Tables_SourceOfTruth.txt`](../../DbAgent/docs/DBTables/SVT_DB_Tables_SourceOfTruth.txt) | the migrations of `DbAgentNext/src/migrations` ([02](../../DbAgentNext/docs/02-database-migration.md)) |
| What changed after the fork | n/a | [`differences-from-cpp.md`](../../DbAgentNext/docs/differences-from-cpp.md) |

The two sides describe almost the same entities, tables and messages, because the clone started as a copy of the
C++ behaviour. Only the right column is kept current. The left column is a frozen reference: it is not the source
of truth for the domain model, the schema or the contract of the system
([DbAgent/docs](../../DbAgent/docs/README.md#what-this-folder-is-not)).

## The state at the fork

- **The C++ code** is the one on `master` at `290a7da2` (2026-11-14); its last code change is `efb41102`
  (2026-10-31, the unreachable Module handlers). `DbAgent/VERSION` says `0.4.0-SNAPSHOT.0`; the last release is
  `svt-db-agent-0.3.0` (2026-06-23).
- **The freeze tag** is not created yet. Proposed: `freeze/svt-db-agent-2026-11-15` on `290a7da2`. It must not start
  with `svt-db-agent-`: `db-agent.yml` builds and publishes the C++ image for every tag matching `svt-db-agent-*`
  except the clone's `svt-db-agent-next-*` (excluded since 2026-11-15).
- **The parity run of 2026-11-14** (local, both agents on the same restored dev dump): 189 cases the same, 193
  different by a listed decision, 14 different with the question still open
  ([DbAgentNext/docs/03 §5.2](../../DbAgentNext/docs/03-parity-testing.md#52-after-the-two-fixes-2026-11-14)). The
  C++ recording is `DbAgentNext/test-parity/snapshots/cpp.json`.
- **The database**: migrations 1 to 4 only add what the C++ ignores
  ([DbAgentNext/docs/02 §2](../../DbAgentNext/docs/02-database-migration.md#2-what-migration-1-adds)); the C++ runs on
  a migrated database.
- **Where each agent runs**: prod runs the C++, dev runs the clone
  ([`Environment/README.md`](../../Environment/README.md#the-two-db-agent-services)).

## Rules while the fork lasts

1. **The C++ code does not change**, not even for a prod bug: a prod bug waits for the prod swap to the clone.
   `DbAgent/docs` and `svt.db-agent.kafka.yaml` may be corrected where they misdescribe the frozen code, and
   answers to the open questions of its 08 may still be recorded.
2. **A migration may break the C++.** Every migration that does gets a line in `differences-from-cpp.md` saying
   what the C++ would need. Such a migration runs only on a database that no C++ agent serves: dev after the
   switch, prod only after the prod swap.
3. **Every change of the clone's contract, behaviour or schema** adds a line to `differences-from-cpp.md` in the
   same pull request.

## Going back to the C++

1. Read `differences-from-cpp.md`: each line is a feature the C++ lacks or a schema change it cannot run on.
2. Compare the two contracts: `svt.db-agent.kafka.yaml` with `svt.db-agent-next.kafka.yaml`. Each says what its
   agent does, so their difference is the difference between the agents.
3. Re-run the parity suite against the C++ ([`DbAgentNext/test-parity/README.md`](../../DbAgentNext/test-parity/README.md)):
   the cases that changed since the fork are the gap in behaviour.
4. Reverse or adapt the schema breaks of step 1 before the C++ serves a database migrated past them.
5. Deploy the C++ image as before (`DbAgent :: Manual`). The compose services of both agents are in
   [`Environment/README.md`](../../Environment/README.md#the-two-db-agent-services).

## Open

- Which file is the schema authority after the fork: `SVT_DB_Tables_SourceOfTruth.txt` (declared authoritative by
  the C++ author, Q31) or the clone's migrations. Proposed until it is decided: a migration that changes the
  schema also updates the schema file.
- The freeze tag (above).
