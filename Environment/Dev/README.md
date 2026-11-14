# Dev Environment

Docker Compose stacks for the SVTSW **development** environment, deployed to
`/opt/docker/svtsw/dev/` on the server. Shared concepts (the `.env` /
`versions.env` model, deployment flow, first-time setup, day-2 commands) live
in [`../README.md`](../README.md) — this page only lists what is dev-specific.

| File | Purpose |
| ---- | ------- |
| [`docker-compose-kafka-dev.yml`](docker-compose-kafka-dev.yml) | Kafka broker (KRaft) + Kafka UI; owns `svt-network--dev` |
| [`docker-compose-svtsw-dev.yml`](docker-compose-svtsw-dev.yml) | App services: `svt-ui`, `svt-db-agent-next` |
| [`svt.kafka--dev.service`](svt.kafka--dev.service) | systemd unit for the Kafka stack |
| [`svt.svtsw--dev.service`](svt.svtsw--dev.service) | systemd unit for the app stack |
| [`.env.example`](.env.example) | Template for `/opt/docker/svtsw/dev/.env` (config + secrets) |
| [`versions.env.example`](versions.env.example) | Template for `/opt/docker/svtsw/dev/versions.env` (image pins) |

## Dev-specific values

- Compose projects: `svt-kafka--dev`, `svt-svtsw--dev`; network `svt-network--dev`.
- Kafka host ports: **9094** (INSIDE), **9095** (TUNNEL), **9096** (OUTSIDE);
  Kafka UI on **8087**.
- UI on port **8090** (`SVT_UI_PORT` in `.env`).
- App containers reach the broker at `kafka:9094` (in-network INSIDE listener).
- The DB agent is **`svt-db-agent-next`** (container `svt.db-agent-next--dev`,
  image `ghcr.io/svt-wp2/svt-db-agent-next`), the NestJS re-implementation
  built from `DbAgentNext/`. Prod still runs the C++
  `svt-db-agent`; see [`../README.md`](../README.md#the-two-db-agent-services).
- Deploys to dev happen automatically on every master push touching a service,
  on every release tag, or manually via the `:: Manual` workflows
  (`UI :: Manual`, `DbAgent Next :: Manual`).

## DB agent: switching from `svt-db-agent` to `svt-db-agent-next`

The compose file defines `svt-db-agent-next` only, but a CI deploy recreates
just that one service (`up -d --no-deps`), so the old C++ container keeps
running next to it until it is removed **once**:

```bash
sudo docker rm -f svt.db-agent--dev
```

(or `sudo systemctl restart svt.svtsw--dev.service`, whose `--remove-orphans`
does the same while restarting the whole app stack). Keep the
`SVT_DB_AGENT_VERSION=` line in `versions.env` or delete it; nothing reads it.

Until the Kafka layer of the re-implementation lands (phase 4 of
`DbAgentNext/docs/dev-plan/`), the dev stack has **no consumer on
`svt.db-agent.request`**: the UI on dev gets no replies. To run the C++ agent
on dev again in the meantime, restore its service block in the compose file
from git history and deploy it with `bash Environment/deploy-service.sh dev
svt-db-agent <tag>`.

Health of the new agent (the port is not published on the host):

```bash
sudo docker inspect -f '{{ .State.Health.Status }}' svt.db-agent-next--dev
```

```bash
sudo docker exec svt.db-agent-next--dev wget -qO- http://localhost:7676/health
```

## Large Kafka messages

Kafka caps a single message at **1 MB** by default, which list replies (wafers,
chips, ...) exceed - the producer then fails with:

> The request included a message larger than the max message size the server will accept

The broker is configured for **50 MiB** instead (`KAFKA_MESSAGE_MAX_BYTES` and
friends in the compose file). Keep the value in sync with
[`../Prod`](../Prod/docker-compose-kafka-prod.yml) and `Dev/docker-compose.kafka-local.yml`
at the repo root - a payload that works locally must work here too.

Topics auto-created without an explicit override inherit the broker default, so
they pick up the new limit on restart. To check one - or to fix a topic that
*does* carry an override:

```bash
docker exec svt.kafka-broker--dev kafka-configs --bootstrap-server localhost:9094 --entity-type topics --entity-name svt.db-agent.request.reply --describe
```

```bash
docker exec svt.kafka-broker--dev kafka-configs --bootstrap-server localhost:9094 --entity-type topics --entity-name svt.db-agent.request.reply --alter --add-config max.message.bytes=52428800
```

## Quick commands

```bash
cd /opt/docker/svtsw/dev

# Kafka stack
docker compose -p svt-kafka--dev --env-file .env --env-file versions.env \
  -f docker-compose-kafka-dev.yml ps

# App stack
docker compose -p svt-svtsw--dev --env-file .env --env-file versions.env \
  -f docker-compose-svtsw-dev.yml ps
```

Full setup and operations: [`../README.md`](../README.md).
