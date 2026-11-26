# Server Environments (Dev / Prod)

How the SVTSW services run on the server and how deployments work.

## The model

Each environment (**dev**, **prod**) is a pair of Docker Compose stacks running
as systemd services on the same host:

| Stack | Compose file | systemd unit | Contents |
| ----- | ------------ | ------------ | -------- |
| kafka | `docker-compose-kafka-<env>.yml` | `svt.kafka--<env>.service` | Kafka broker (KRaft) + Kafka UI; **owns** the `svt-network--<env>` network |
| svtsw (apps) | `docker-compose-svtsw-<env>.yml` | `svt.svtsw--<env>.service` | `svt-ui`, the DB agent `svt-db-agent-next` and one `svt-wp-agent-<machine>` per WP machine (prepared, commented out in both environments for now) (join the network as `external`) |

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
   - `docker compose pull <service>` + `up -d --no-deps --wait <service>` — **only that
     one container is recreated**, the rest of the stack keeps running. The job
     fails when the container stops, or its `HEALTHCHECK` fails, within 180 s; it
     then prints the container state and its last 100 log lines.
3. systemd is only involved at boot/stop: the units run `compose up -d` with
   `.env` + `versions.env`, so after a reboot the host comes back with exactly
   the versions that were last deployed.

Services can therefore be deployed/redeployed one by one — from the Actions UI
(`UI :: Manual` / `DbAgent Next :: Manual` → `deploy-dev--manual` /
`deploy-prod--manual`) or on the
server itself:

```bash
bash Environment/deploy-service.sh dev svt-ui 1a2b3c4d
```

## Compose changes without a new image

A deploy copies both compose files to the server but recreates only its own
service. A change to the block of another service (for example a new
environment variable for `svt-db-agent-next`) waits for the next deploy of
that service.

To apply it now, run `Environment :: Apply` from the Actions UI on master and
pick the environment, or run on the server:

```bash
bash Environment/deploy-service.sh dev --apply-compose
```

Compose recreates only the services whose config or pinned version differs
from the running container; every service keeps its version in `versions.env`.
It also starts a service that an admin stopped by hand, and it removes the
container of a service that is no longer in the file (`--remove-orphans`, as
the systemd unit does at boot). The Kafka stack is not
touched: apply Kafka changes with `sudo systemctl restart svt.kafka--<env>.service`.

## WPAgent: one service per WP machine

**Off for now (temporary).** The WP machine services are commented out in both
environments. A push to master that changes `WPAgent/` tests and builds the image
(`wp-agent.yml`) and deploys nothing. The rest of this section says how the services
work when they are on.

- **Dev:** off until an agent that gets stuck no longer needs a manual restart: a
  command that SENTIO never answers (for example after an Abort on the machine) blocks
  the agent. To enable: uncomment the block in `docker-compose-svtsw-dev.yml`, the
  version line in `Dev/versions.env.example`, the `deploy-dev--manual` option in
  `wp-agent-manual.yml` and the two deploy jobs in `wp-agent.yml`, and change the
  `WPMIT` record first ([Switching WPMIT from the old agent](#switching-wpmit-from-the-old-agent)).
- **Prod:** off until the first WPAgent release (`WPAgent :: Release`). Before it there
  is no release image, and a missing image or version line stops every compose command
  of the prod stack. To enable: uncomment the block in `docker-compose-svtsw-prod.yml`,
  the version line in `Prod/versions.env.example` and the `deploy-prod--manual` option
  in `wp-agent-manual.yml`, and change the `WPMIT` record first
  ([Switching WPMIT from the old agent](#switching-wpmit-from-the-old-agent)).

Each WP machine has its own compose service `svt-wp-agent-<machine>` (all use the
image `svt-wp-agent`) with its own version line `SVT_WP_AGENT_<MACHINE>_VERSION`.
Compose sets the machine name (`WaferProbeMachine.name`) and the Kafka broker as
env vars; the agent gets the rest from the record of the machine in the DB, and it
runs also while the machine is off. A started agent does not connect to the machine:
it connects when it gets the `Initialize` command (see the WPAgent README, "One agent
per WP machine").

**A deploy restarts the agent, and the user sends `Initialize` again.** Stop the
measurements before a deploy. Docker sends SIGTERM to the old container. The agent reads no more requests, lets the running command
finish (up to 20 s), switches the machine to local mode, closes its connection to the
machine and ends with exit code 0. The service has `stop_grace_period: 30s` for that:
keep it above the 20 s (`STOP_COMMAND_WAIT` in `WPAgent/WPKafkaClient.py`), because
docker kills the container after it. The new container is not initialized and sends
nothing to the machine. When the machine is needed, the user sends `Initialize`, logs
in and opens the project again (see the WPAgent README, "Start, Initialize, stop").

To add a machine:

1. Create the `WaferProbeMachine` record in the DB of the environment first. Its `name`
   is the machine name of the service. The agent connects to `hostName`:`connectionPort`
   exactly as the record has them, so `hostName` is the full host name of the machine
   (e.g. `wpmit01.cern.ch`). An agent without its record stops at start.
2. Copy the `svt-wp-agent-wpmit` block in `docker-compose-svtsw-<env>.yml` and change
   the service, the container, the version variable and `SVT_WP_AGENT_MACHINE_NAME`.
3. Add the version line to `versions.env.example`. A deploy adds a template line that
   is missing from the server's `versions.env`.
4. Add the service to `WP_AGENT_SERVICES` in `wp-agent.yml` and `wp-agent-manual.yml`:
   a WPAgent deploy deploys every service of the list.

A later change of the record (`UpdateWaferProbeMachine`) needs no restart of the agent:
it reads the record again while the machine is off and before every connect.

Every single-service deploy removes the containers of the retired service
`svt-wp-agent` (`RETIRED_SERVICES` in `deploy-service.sh`): the first deploy of
`svt-wp-agent-wpmit` removes the old `svt.wp-agent--<env>` container, so two agents
never drive the same machine. A single-service deploy removes no other container (no
`--remove-orphans`): its compose file comes from the deployed ref, which can be older
than the running stack.

### Switching WPMIT from the old agent

The `WPMIT` record has `hostName: cern.ch`. The old agent (the system service on the CERN
side, `ProbeConfigCERN*.json`) builds the host from it as `wpmit01.` + `hostName`; the new
agent uses `hostName` as it is and would try `cern.ch:35555`. The record can hold only
one of the two forms, so change it when the new agent replaces the old one, in each
environment:

1. Stop the old agent (its system service), so that only one agent drives the machine.
2. Read the record: `GetAllWaferProbeMachines` with `{"filter": {"name": "WPMIT"}}` on
   `svt.db-agent.request` (e.g. from the Kafka UI of the environment, with the headers
   `kafka_correlationId` and `kafka_replyTopic: svt.db-agent.request.reply`).
3. Send `UpdateWaferProbeMachine` with the `id` of the record and its current values,
   `hostName` changed. The update takes all six fields:

   ```json
   {
     "type": "UpdateWaferProbeMachine",
     "data": {
       "id": <id of WPMIT>,
       "update": {
         "hostName": "wpmit01.cern.ch",
         "connectionType": "<as in the record>",
         "connectionPort": <as in the record>,
         "generalLocation": "<as in the record>",
         "software": "<as in the record>",
         "swVersion": "<as in the record>"
       }
     }
   }
   ```
4. Start the new service (uncomment it, deploy), then send `Initialize`.

To go back to the old agent, set `hostName` to `cern.ch` again before you start it.

## The two DB agent services

The DB agent is developed as the NestJS app `DbAgentNext/` (docs in
`DbAgentNext/docs/`). The C++ agent `DbAgent/` is frozen
([fork note](../Documentation/decisions/2026-11-db-agent-clone.md)) and gets no
support: `svt-db-agent-next` is the DB agent of every environment
([decision](../Documentation/decisions/2026-11-db-agent-next-only.md)). The compose
files of both environments define `svt-db-agent-next`, and no compose file
defines the C++ `svt-db-agent`:

| | `svt-db-agent-next` | `svt-db-agent` (C++, frozen) |
| --- | --- | --- |
| Compose service / container | `svt-db-agent-next` / `svt.db-agent-next--<env>` | none; its container was `svt.db-agent--<env>` |
| Image | `ghcr.io/svt-wp2/svt-db-agent-next` (built from the repository root, `DbAgentNext/Dockerfile`) | `ghcr.io/svt-wp2/svt-db-agent` (no workflow builds it) |
| `versions.env` line | `SVT_DB_AGENT_NEXT_VERSION` | `SVT_DB_AGENT_VERSION` (nothing reads it) |
| Workflows | `db-agent-next.yml`, `DbAgent Next :: Manual`, `DbAgent Next :: Release` | none: `db-agent.yml` only compiles the C++ code, it pushes no image |
| Deploys | dev: automatic on master pushes and release tags, or manual. prod: manual only (`deploy-prod--manual`) | no workflow |

Both read the same `SVT_DB_*` values from `.env`; the new one has no log
volume (stdout only) and exposes `GET /health` on port 7676 inside the network.
`svt-db-agent-next` applies its pending database migrations at each start, so
`SVT_DB_USER` must own the schema `main` with its tables and enum types, and
must have the CREATE privilege on the database. A migration that fails
ends the start and changes nothing; deploy the previous version then
([`DbAgentNext/docs/02`](../DbAgentNext/docs/02-database-migration.md#1-baseline-from-the-live-database-not-from-the-files)).

The first deploy of `svt-db-agent-next` to a server that ran the C++ agent
recreates one service only, so the old C++ container is removed once, by hand:
[`Dev/README.md`](Dev/README.md#db-agent-switching-from-svt-db-agent-to-svt-db-agent-next),
[`Prod/README.md`](Prod/README.md#db-agent-switching-from-svt-db-agent-to-svt-db-agent-next).
The full procedure, with the release, is in
[`DbAgentNext/docs/04`](../DbAgentNext/docs/04-runtime-and-deployment.md#7-swap-procedure).

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
> (`ghcr.io/svt-wp2/svt-ui`, `svt-db-agent`, `svt-db-agent-next`) are private. Install a long-lived
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

## Users and the log-in of the UI

The UI logs people in against the table `SvtUser` of the database. The BFF in `svt-ui` checks the password and
keeps the session in a signed cookie; every `/api` route needs a session, except the log-in, the log-out,
`/api/health`, `/api/health/version` and Swagger (`/api/swagger`, `/api/swagger-json`, `/api/swagger-yaml`). The
decisions are in
[`Documentation/decisions/2026-11-users-and-roles.md`](../Documentation/decisions/2026-11-users-and-roles.md).

### The variables of `svt-ui`

They go into the server `.env` of the environment; the compose files pass them to `svt-ui`.

| Variable | | Meaning |
| --- | --- | --- |
| `SVT_UI_AUTH_SECRET` | required | The key that signs the sessions. At least 32 random characters, a different value for dev and prod, only in the server `.env`. Compose refuses the file without it, and the BFF does not start without it. A new value ends every open session. |
| `SVT_UI_AUTH_SESSION_HOURS` | optional, `12` | How long a session lasts, in hours. |
| `SVT_UI_AUTH_COOKIE_SECURE` | optional, `false` | The `Secure` flag of the session cookie. Set `true` only when the UI is served over HTTPS; the servers have plain HTTP today. |
| `SVT_UI_AUTH_COOKIE_NAME` | optional, `svt_session` | The name of the session cookie: letters, digits, `_` and `-`. The dev compose file sets `svt_session_dev` itself (not in `.env`): dev and prod run on one host, a cookie belongs to the host and not to the port, and with one name a log-in at one environment would replace the session of the other. |

Make a secret on the server, then put it into `.env` (`sudoedit /opt/docker/svtsw/<env>/.env`):

```bash
openssl rand -base64 48
```

Compose reads the whole file, so **no service of the stack starts while `SVT_UI_AUTH_SECRET` is missing**, the DB
agent included. Add it to the `.env` of dev and of prod before the first deploy of a version that contains it.

**The secrets of dev and prod must differ.** A token says only "user 42": with one secret, a session of dev would be
a valid session of the user with the same id in prod.

### The first Admin

A new installation has no user, and nobody can log in to the UI: that is intended (no account with a known
password exists). Enter the first Admin by hand, once per environment, after `svt-db-agent-next` has run its
migrations (the table `SvtUser` exists). That Admin then creates the other users in the UI.

1. Make the hash of the password, on any machine with a checkout of this repository and Node 22:

   ```bash
   cd UI && npm ci && npm run auth:hash-password
   ```

   It asks for the password twice (8 to 128 characters) without showing it, and prints only the hash
   (`scrypt$16384$8$5$…`). Never give the password as an argument (it stays in the shell history), and do not
   paste the hash into a ticket or a chat.

2. Insert the user with `psql`, connected to `SVT_DB_NAME` as `SVT_DB_USER` (`main` is the schema of
   `SVT_DB_SCHEMA` on our servers):

   ```sql
   INSERT INTO main."SvtUser" ("login", "name", "role", "passwordHash")
   VALUES ('jdoe', 'Jane Doe', 'Admin', '<the hash>');
   ```

   - **The login must be in lower case**: 3 to 50 characters of `a-z`, `0-9`, `.`, `_` and `-`. The check
     `SvtUser_login_check` refuses any other login. At the log-in the BFF compares the login in lower case.
   - Give no `id`: the database sets it. A row with its own `id` leaves the identity behind
     ([`DbAgentNext/docs/database-schema.md` §5a.1](../DbAgentNext/docs/database-schema.md#5a1-svtuser)).
   - Type the statement into `psql` itself: the hash holds `$`, which a shell would expand inside double quotes.
   - If the `INSERT` fails, make a new password and a new hash before you try again: `psql` prints the failing row,
     hash included, and PostgreSQL writes a failing statement to its log.
   - Do not reuse the password of the old `admin` user of the browser log-in (before ticket 395): its hash is in the
     public git history.

3. Open the UI and log in with that login and password; reload the page (you stay logged in) and log out.

### Roll-out order

Once, for the deploy that brings the log-in:

1. Add `SVT_UI_AUTH_SECRET` to the `.env` of the environment (a different value for dev and prod). Do it first:
   from a `master` that has this change, compose starts no service without it, the DB agent included.
2. Deploy `svt-db-agent-next` with the users table. Its migration creates `SvtUser`.
3. Insert the first Admin (above).
4. Deploy `svt-ui`. From then on nobody uses the UI without a log-in.

A person does steps 1 and 3 on the server, for dev and for prod.
