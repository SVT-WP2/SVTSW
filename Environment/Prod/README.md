# Prod Environment

Docker Compose stacks for the SVTSW **production** environment, deployed to
`/opt/docker/svtsw/prod/` on the server. Shared concepts (the `.env` /
`versions.env` model, deployment flow, first-time setup, day-2 commands) live
in [`../README.md`](../README.md) — this page only lists what is prod-specific.

| File | Purpose |
| ---- | ------- |
| [`docker-compose-kafka-prod.yml`](docker-compose-kafka-prod.yml) | Kafka broker (KRaft) + Kafka UI; owns `svt-network--prod` |
| [`docker-compose-svtsw-prod.yml`](docker-compose-svtsw-prod.yml) | App services: `svt-ui`, `svt-db-agent-next` |
| [`svt.kafka--prod.service`](svt.kafka--prod.service) | systemd unit for the Kafka stack |
| [`svt.svtsw--prod.service`](svt.svtsw--prod.service) | systemd unit for the app stack |
| [`.env.example`](.env.example) | Template for `/opt/docker/svtsw/prod/.env` (config + secrets) |
| [`versions.env.example`](versions.env.example) | Template for `/opt/docker/svtsw/prod/versions.env` (image pins) |

## Prod-specific values

- Compose projects: `svt-kafka--prod`, `svt-svtsw--prod`; network `svt-network--prod`.
- Kafka host ports: **9090** (INSIDE), **9091** (TUNNEL), **9092** (OUTSIDE —
  public); Kafka UI on **8088**.
- UI on port **80** (`SVT_UI_PORT` in `.env`).
- App containers reach the broker at `kafka:9094` (in-network INSIDE listener).
- The DB agent is **`svt-db-agent-next`** (container `svt.db-agent-next--prod`,
  image `ghcr.io/svt-wp2/svt-db-agent-next`), the NestJS re-implementation
  built from `DbAgentNext/`; see [`../README.md`](../README.md#the-two-db-agent-services).
- Deploys to prod are **manual only**: Actions → `UI :: Manual` /
  `DbAgent Next :: Manual` → `deploy-prod--manual` with an explicit release
  `image_tag`, behind the `prod` environment approval gate (Required reviewers
  in repo Settings → Environments → prod).
- Bootstrap note: replace the `latest` seeds in `versions.env` with explicit
  release versions when creating the file.

## DB agent: switching from `svt-db-agent` to `svt-db-agent-next`

The compose file defines `svt-db-agent-next` only. The first deploy of that
service to the server has the two steps below. The full procedure, with the
release, is in
[`DbAgentNext/docs/04`](../../DbAgentNext/docs/04-runtime-and-deployment.md#7-swap-procedure).

1. Deploy the DB agent before any other service: `DbAgent Next :: Manual` →
   `deploy-prod--manual`. This deploy copies the new compose file to the
   server and adds the `SVT_DB_AGENT_NEXT_VERSION=` line to `versions.env`.
   At its first start the agent applies its migrations to the database.
   A deploy of `svt-ui` that comes first stops with
   `SVT_DB_AGENT_NEXT_VERSION is missing a value`, and it changes no container.
2. The deploy recreates just that one service (`up -d --no-deps`), so the old
   C++ container keeps running next to it until it is removed **once**:

   ```bash
   sudo docker rm -f svt.db-agent--prod
   ```

   (or `sudo systemctl restart svt.svtsw--prod.service`, whose
   `--remove-orphans` does the same while restarting the whole app stack).

Keep the `SVT_DB_AGENT_VERSION=` line in `versions.env` or delete it; nothing
reads it. The host folder `/var/log/svt-db-agent/prod` gets no new log: the
new agent logs to stdout.

The re-implementation consumes `svt.db-agent.request` with the C++ agent's
consumer group and skips the requests produced while no agent consumed it,
as the C++ did. To run the C++ agent on prod again (a rollback), restore its
service block in the compose file from git history and deploy it with
`bash Environment/deploy-service.sh prod svt-db-agent <tag>`; stop the other
agent first: both join the same group, and only one of them receives the
requests at a time. No workflow builds or deploys the C++ agent.

Health of the new agent (the port is not published on the host):

```bash
sudo docker inspect -f '{{ .State.Health.Status }}' svt.db-agent-next--prod
```

```bash
sudo docker exec svt.db-agent-next--prod wget -qO- http://localhost:7676/health
```

## Running Dev and Prod on the same host

The two environments are designed to coexist on one machine. Everything that
could clash is namespaced:

- **Containers / volumes / network:** suffixed `--prod` vs `--dev`.
- **Host ports:** Kafka `9090-9092` (prod) vs `9094-9096` (dev); Kafka UI
  `8088` vs `8087`; UI `80` vs `8090`.
- **KRaft cluster ID:** distinct per environment (a shared ID corrupts metadata).
- **Compose project names:** pinned via `name:` in each compose file and `-p`
  in the units/deploy script. Without them both environments would default to
  the same directory-derived project, and `--remove-orphans` from one stack
  would delete the other's containers.

## Notes

- `WorkingDirectory` in the units must be a **directory** (systemd `chdir`s
  into it); the compose file itself is passed explicitly via `-f`.
- Verify the Docker CLI path with `command -v docker`. The units use
  `/bin/docker` (on RHEL `/bin` is a symlink to `/usr/bin`); adjust if yours
  differs.
- After editing a unit: `sudo systemctl daemon-reload`, and if it had been
  failing, `sudo systemctl reset-failed <unit>`.

Full setup and operations: [`../README.md`](../README.md).
