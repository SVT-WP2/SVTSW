# Prod Environment

Docker Compose stacks for the SVTSW **production** environment, deployed to
`/opt/docker/svtsw/prod/` on the server. Shared concepts (the `.env` /
`versions.env` model, deployment flow, first-time setup, day-2 commands) live
in [`../README.md`](../README.md) — this page only lists what is prod-specific.

| File | Purpose |
| ---- | ------- |
| [`docker-compose-kafka-prod.yml`](docker-compose-kafka-prod.yml) | Kafka broker (KRaft) + Kafka UI; owns `svt-network--prod` |
| [`docker-compose-svtsw-prod.yml`](docker-compose-svtsw-prod.yml) | App services: `svt-ui`, `svt-db-agent` |
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
- Deploys to prod are **manual only**: Actions → `UI :: Manual` /
  `DbAgent :: Manual` → `deploy-prod--manual` with an explicit release
  `image_tag`, behind the `prod` environment approval gate (Required reviewers
  in repo Settings → Environments → prod).
- Bootstrap note: replace the `latest` seeds in `versions.env` with explicit
  release versions when creating the file.

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
