# SVTSW - Local Development Environment

SVTSW is a **monorepo**: each team owns a top-level folder, and each folder is a
service (`UI`, `DbAgent`, `WPAgent`, ...). To test your service you bring the rest
of the stack up locally - Kafka, an (optional) database, and the other services -
all on a shared Docker network.

## Prerequisites

- [Docker Desktop](https://docs.docker.com/desktop/) (includes Docker Compose v2).
- Nothing else. Images are built from each team's folder on first run.

## The files

| File | What it gives you | Required? |
| --- | --- | --- |
| `docker-compose.kafka-local.yml` | Kafka broker + Kafka UI. **Creates the shared `svt-network--local` network** that everything else attaches to. | **Yes - start it first.** |
| `docker-compose.postgres.yml` | A Postgres 17 database in a container. | Optional - only if you do **not** have Postgres installed natively. |
| `docker-compose.swtsw.yml` | The application services (`svt-db-agent`, `svt-ui`, ...), built from each team's folder. Reads its DB connection from `.env`. | Yes |
| `.env.example` | Template for the variables (DB host/password, ports). Copy to `.env`. | Yes (copy once) |

There is **no separate native-DB compose file** - switching between a containerised
and a native Postgres is one variable in `.env`.

> **Why Kafka first?** `docker-compose.kafka-local.yml` *owns* the
> `svt-network--local` network; the other files join it as `external`. If you start
> them before Kafka you'll get `network svt-network--local not found`.

## One-time setup

```powershell
cd Dev
Copy-Item .env.example .env
```

The defaults in `.env` already target the containerised Postgres, so for **Setup A**
you don't need to change anything.

## Two database setups

Both setups share the same `docker-compose.swtsw.yml`; only `.env` differs.

- **Setup A - Containerised Postgres.** Keep the `.env` defaults
  (`DB_HOST=postgres-db--local`). Run `docker-compose.postgres.yml` for the database.
- **Setup B - Native Postgres.** Edit `.env`:

  ```dotenv
  DB_HOST=host.docker.internal
  DB_PASS=<your native Postgres password>
  ```

  Then **skip** `docker-compose.postgres.yml`.

## Quick start

All commands assume you are in this folder (`cd Dev`).

### Setup A - containerised Postgres

```powershell
# 1) Kafka + Kafka UI (required, first - creates the network)
docker compose -f docker-compose.kafka-local.yml up -d

# 2) Postgres (optional infra)
docker compose -f docker-compose.postgres.yml up -d

# 3) Application services (build from source on first run)
docker compose -f docker-compose.swtsw.yml up -d --build
```

### Setup B - native Postgres

```powershell
# (after editing .env: DB_HOST=host.docker.internal, DB_PASS=...)

# 1) Kafka (required, first)
docker compose -f docker-compose.kafka-local.yml up -d

# 2) Application services - they pick up DB_HOST/DB_PASS from .env
docker compose -f docker-compose.swtsw.yml up -d --build
```

## Working on one service natively

The common case: you're developing **one** service (say the UI) and want everything
else running in Docker.

**Don't copy the compose file to delete a service.** Compose lets you start a
subset directly - either name the services you want, or start everything and stop
the one you'll run yourself:

```powershell
# Option 1 - start only the services you want (everything except the UI):
docker compose -f docker-compose.swtsw.yml up -d --build svt-db-agent

# Option 2 - start everything, then stop the one you'll run locally:
docker compose -f docker-compose.swtsw.yml up -d --build
docker compose -f docker-compose.swtsw.yml stop svt-ui
```

Then run your own service from its folder with its dev tooling, pointing it at the
host-exposed ports (see below) - e.g. Kafka on `localhost:9085`, the containerised
Postgres on `localhost:5500`.

## Ports & addresses

| Service | From other containers | From your host / a native service |
| --- | --- | --- |
| Kafka | `kafka:9084` (INSIDE) | `localhost:9085` (TUNNEL) |
| Kafka UI | - | http://localhost:8087 |
| Postgres (container) | `postgres-db--local:5432` | `localhost:5500` |
| Postgres (native) | `host.docker.internal:5432` | `localhost:5432` |
| UI | `svt-ui:7575` | http://localhost:7575 |

Containerised Postgres defaults: database `svt_sw_db`, user `postgres`, password
`postgres` (all driven by `.env`).

## Stopping & cleanup

Tear down in reverse order (apps and DB first, Kafka last, since Kafka owns the
network):

```powershell
docker compose -f docker-compose.swtsw.yml down
docker compose -f docker-compose.postgres.yml down
docker compose -f docker-compose.kafka-local.yml down

# add -v to also delete the volumes (wipes Kafka + Postgres data):
docker compose -f docker-compose.kafka-local.yml down -v
```

## Adding your service to the stack

Each team adds its service to `docker-compose.swtsw.yml` following the existing
pattern: a `build.context` pointing at your folder (e.g. `../WPAgent`), attachment
to `svt-network--local`, and the env vars your service needs. Only `svt-db-agent`
and `svt-ui` are wired up today.
