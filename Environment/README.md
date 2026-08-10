# Server Environments (Dev / Prod)

How the SVTSW services run on the server and how deployments work.

## The model

Each environment (**dev**, **prod**) is a pair of Docker Compose stacks running
as systemd services on the same host:

| Stack | Compose file | systemd unit | Contents |
| ----- | ------------ | ------------ | -------- |
| kafka | `docker-compose-kafka-<env>.yml` | `svt.kafka--<env>.service` | Kafka broker (KRaft) + Kafka UI; **owns** the `svt-network--<env>` network |
| svtsw (apps) | `docker-compose-svtsw-<env>.yml` | `svt.svtsw--<env>.service` | `svt-ui`, `svt-db-agent` (joins the network as `external`) |

On the server each environment is one self-contained folder:

```
/opt/docker/svtsw/dev/
├── docker-compose-kafka-dev.yml    <- from git (re-synced by every CI deploy)
├── docker-compose-svtsw-dev.yml    <- from git (re-synced by every CI deploy)
├── .env                            <- SERVER-ONLY: config + secrets (admin-managed, chmod 600)
└── versions.env                    <- image tag of every service (CI-managed)
/opt/docker/svtsw/prod/             <- same structure
```

Ownership is strict:

- **git** owns the compose files — never edit them on the server, the next
  deploy overwrites them.
- **the admin** owns `.env` — secrets exist only on the server; GitHub and CI
  never see them (templates: `Dev/.env.example`, `Prod/.env.example`).
- **CI** owns `versions.env` — the deployment manifest: one `<SERVICE>_VERSION=`
  line per service, rewritten one line at a time by deploys (templates:
  `Dev/versions.env.example`, `Prod/versions.env.example`). Hand-edit it only
  to roll back or bootstrap.

`versions.env` is a plain env file so `docker compose` consumes it directly via
`--env-file` — no extra tooling. Compose interpolates it into the `image:` tags
(`ghcr.io/svt-wp2/svt-ui:${SVT_UI_VERSION}`), so *file = deployed state*.

## How a deployment works

1. The build jobs push the image to ghcr.io (unchanged: `:dev` + short-SHA tags
   from master pushes, `:<version>` + `:latest` from release tags).
2. The deploy job on the self-hosted runner calls
   [`deploy-service.sh`](deploy-service.sh) `<env> <service> <tag>`, which:
   - re-syncs the two compose files from the checkout to `/opt/docker/svtsw/<env>/`;
   - pins `<SERVICE>_VERSION=<tag>` in `versions.env`;
   - `docker compose pull <service>` + `up -d --no-deps <service>` — **only that
     one container is recreated**, the rest of the stack keeps running.
3. systemd is only involved at boot/stop: the units run `compose up -d` with
   `.env` + `versions.env`, so after a reboot the host comes back with exactly
   the versions that were last deployed.

Services can therefore be deployed/redeployed one by one — from the Actions UI
(`UI :: Manual` / `DbAgent :: Manual` → `deploy-dev--manual` /
`deploy-prod--manual`) or on the server itself:

```bash
bash Environment/deploy-service.sh dev svt-ui 1a2b3c4d
```

## First-time server setup

Per environment; **dev** shown, replace with `prod` (and `Prod/`) accordingly.
Run from a checkout of this repo, inside `Environment/Dev/`:

```bash
# 1. Folder + files
sudo mkdir -p /opt/docker/svtsw/dev
sudo cp docker-compose-kafka-dev.yml docker-compose-svtsw-dev.yml /opt/docker/svtsw/dev/
sudo cp versions.env.example /opt/docker/svtsw/dev/versions.env

# 2. Secrets (admin-only file; fill in every SVT_DB_* value)
sudo cp .env.example /opt/docker/svtsw/dev/.env
sudo chmod 600 /opt/docker/svtsw/dev/.env
sudoedit /opt/docker/svtsw/dev/.env

# 3. systemd units
sudo cp svt.kafka--dev.service svt.svtsw--dev.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now svt.kafka--dev.service
sudo systemctl enable --now svt.svtsw--dev.service
```

For **prod**, first replace the bootstrap `latest` tags in
`/opt/docker/svtsw/prod/versions.env` with the release versions you actually
want running.

> **Registry credentials (once per host):** the app packages
> (`ghcr.io/svt-wp2/svt-ui`, `svt-db-agent`) are private. Install a long-lived
> pull login for root — a classic PAT with only `read:packages` (ideally on a
> service account): `sudo docker login ghcr.io -u <account>` (paste the PAT at
> the password prompt). The systemd units' boot-time pulls use it. CI deploys
> use their own job-scoped login in an isolated docker config
> (`<env dir>/.docker-ci`), so they never overwrite or depend on root's login.
> Even without any login, reboots stay safe: the pinned images are already
> local and the units' `pull` is non-fatal — the PAT matters for fresh hosts,
> pruned images and manual pulls.

## Migrating from the old setup

The previous setup ran the kafka compose from flat `/opt/docker/` and the app
containers via plain `docker run` from the workflows, with config/secrets in
GitHub. To migrate an environment (dev shown):

1. Do the [first-time setup](#first-time-server-setup) above. Copy the values
   for `.env` out of GitHub → Settings → Environments → dev (the mapping table
   is in `.env.example`).
2. The kafka unit is already active, so `enable --now` alone won't re-run it —
   apply the new paths with `sudo systemctl restart svt.kafka--dev.service`
   (brief broker downtime; the compose project name is unchanged
   (`svt-kafka--dev`) and the data lives in named volumes, so nothing is lost).
   Then remove the old copy: `sudo rm /opt/docker/docker-compose-kafka-dev.yml`.
3. Install the pull credentials, once per host (not per env):
   `sudo docker login ghcr.io -u <account>` with a `read:packages` PAT — see
   the callout under [first-time setup](#first-time-server-setup). This also
   replaces the stale `GITHUB_TOKEN` entry the old deploys left in root's
   docker config (stored stale credentials make every pull fail with `denied`).
4. The old `docker run` app containers are replaced automatically: the first
   compose deploy of each service removes the legacy container with the same
   name (`svt.ui--dev`, `svt.db-agent--dev`) and recreates it inside the
   compose project. No manual cleanup needed — just push to master or run a
   manual deploy.
5. Once both services have deployed successfully, delete the now-unused values
   from GitHub → Settings → Environments (dev and prod):
   - secrets: `SVT_DB_USER`, `SVT_DB_PASS`, `SVT_DB_NAME`, `SVT_DB_SCHEMA`
   - variables: `SVT_KAFKA_HOST`, `SVT_KAFKA_PORT`, `SVT_DB_HOST`,
     `SVT_DB_PORT`, `SVT_UI_PORT`

   Keep the `dev`/`prod` **environments themselves** (deploy gates/approvals)
   and the repo-level `RELEASE_PAT` (used by the release workflows).

## Day-2 operations

All commands assume the environment folder, e.g. `cd /opt/docker/svtsw/dev`.
The `-p` project names below are `svt-svtsw--dev` / `svt-kafka--dev` (swap the
suffix for prod).

```bash
# What is deployed right now?
cat versions.env
sudo docker compose -p svt-svtsw--dev --env-file .env --env-file versions.env \
  -f docker-compose-svtsw-dev.yml ps

# Restart ONE service (same version)
sudo docker compose -p svt-svtsw--dev --env-file .env --env-file versions.env \
  -f docker-compose-svtsw-dev.yml restart svt-ui

# Roll back / pin ONE service: edit versions.env, then recreate just it
sudoedit versions.env
sudo docker compose -p svt-svtsw--dev --env-file .env --env-file versions.env \
  -f docker-compose-svtsw-dev.yml up -d --no-deps svt-ui

# Whole stack (apps / kafka)
sudo systemctl restart svt.svtsw--dev.service
sudo systemctl status  svt.svtsw--dev.service
sudo journalctl -xeu   svt.svtsw--dev.service
sudo systemctl restart svt.kafka--dev.service   # applies KAFKA_* pin/config changes

# Logs of one service
sudo docker logs -f svt.ui--dev
```

After changing a `.env` value, recreate the affected service(s) with `up -d`
(a plain `restart` does **not** re-read env files).

## Host requirements

- Docker Engine with the **Compose v2.24+** plugin (multiple `--env-file`
  support; `deploy-service.sh` verifies this and fails loudly otherwise).
- `git` on the self-hosted runner host (the deploy jobs use `actions/checkout`).
- The GitHub runner user needs passwordless `sudo` (it already runs
  `sudo docker` today).
- Dev and prod coexist on one host: every name is suffixed (`--dev`/`--prod`),
  host ports differ per environment, and the compose **project names** are
  pinned via `name:`/`-p` — see [`Prod/README.md`](Prod/README.md) for the
  details.
