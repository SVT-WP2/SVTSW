# SVT DB Agent (C++)

> **Frozen since 2026-11-15.** Development of the DB agent continues in the NestJS re-implementation
> [`DbAgentNext/`](../DbAgentNext/README.md). This code does not change, not even for a bug. Why, the
> state at the freeze: [the fork note](../Documentation/decisions/2026-11-db-agent-clone.md). Since 2026-11-18
> this agent gets no support, and `svt-db-agent-next` is the DB agent of every environment
> ([decision](../Documentation/decisions/2026-11-db-agent-next-only.md)).

C++ service that bridges Kafka and the project database for EpicMeasure: it consumes request
messages from Kafka, runs the matching database operations, and publishes the results back. It is
built as a Docker image ([`Dockerfile`](Dockerfile)).

## Documentation

| Where | What |
|---|---|
| [docs/README.md](docs/README.md) | What the agent does: runtime architecture, the agent's view of the domain, the database schema with ER diagrams, the generic list/create/update engine, every Kafka message handler, the wafer-map format and the ASIC generation rules, and the list of its defects. A frozen reference, **not** the description of the system under development. |
| [`svt.db-agent.kafka.yaml`](../Documentation/Kafka/svt.db-agent.kafka.yaml) | The Kafka contract of this agent, aligned with the code on 2026-11-18. |
| [the fork note](../Documentation/decisions/2026-11-db-agent-clone.md) | The freeze: the decision, the rules while both agents exist, the way back. |
| [`Environment/README.md`](../Environment/README.md#the-two-db-agent-services) | Where this agent and the re-implementation run. |
| [CLAUDE.md](CLAUDE.md) | The rules of this folder for AI coding agents. |

## Docker Usage

```
docker compose run --rm `
  -e SVT_DB_AGENT_DB_HOST=dbod-svt-sw-pgdb.cern.ch `
  -e SVT_DB_AGENT_DB_PORT=6600 `
  -e SVT_DB_AGENT_DB_USER=admin `
  -e SVT_DB_AGENT_DB_PASS=123456`
  -e SVT_DB_AGENT_DB_NAME=svt_sw_db `
  -e SVT_DB_AGENT_DB_SCHEMA=main `
  -e SVT_DB_AGENT_KAFKA_SERVER=localhost `
  -e SVT_DB_AGENT_KAFKA_PORT=9092 `
  svt-db-agent
```

## Versioning

This agent is frozen, and no new version is released. [`VERSION`](VERSION) keeps its last value,
`0.4.0-SNAPSHOT.0`, and no workflow changes it ([GitHub Actions (CI/CD)](#github-actions-cicd)).

What the releases before the freeze left:

- **Git tags:** `svt-db-agent-<version>`. The last one is `svt-db-agent-0.3.0`.
- **Release branches:** `release/svt-db-agent/<version>`.
- **Images:** `ghcr.io/svt-wp2/svt-db-agent:<version>`. No workflow pushes a new image.

### How the version reaches the binary

`compile.sh` resolves the version as **`$VERSION` env (set by CI/Docker) → the `VERSION` file**,
passes it to CMake as `-DVERSION=...`, which generates `version.h` from
[`app/version/version.h.in`](app/version/version.h.in). The agent logs it at startup
(`Svt Db Agent, version:<version>`).

- **The compile check of CI** passes the short commit SHA as `$VERSION`.
- **Local builds** (no `$VERSION`) read the `VERSION` file (a `-SNAPSHOT.N` string).

## GitHub Actions (CI/CD)

One workflow is left for this agent: [`db-agent.yml`](../.github/workflows/db-agent.yml) (`DbAgent`).

| Trigger | What it does |
|---|---|
| A pull request that touches `DbAgent/**` or `.github/workflows/db-agent.yml` | Builds the `db-agent-build` stage of the [`Dockerfile`](Dockerfile): a compile check. No image is pushed |
| A push to `master` that touches the same paths | The same compile check |

No workflow builds the runtime image, makes a release or deploys this agent. `DbAgent :: Release`
(`db-agent-release.yml`), `DbAgent :: Manual` (`db-agent-manual.yml`) and the image jobs of `db-agent.yml` were
removed in 2026-11, because `svt-db-agent-next` is the DB agent of every environment
([`Environment/README.md`](../Environment/README.md#the-two-db-agent-services)).

### To run this agent on a server again

No compose file defines this agent, and no workflow deploys it. A rollback to its container is described in
[`Environment/Prod/README.md`](../Environment/Prod/README.md#db-agent-switching-from-svt-db-agent-to-svt-db-agent-next).
