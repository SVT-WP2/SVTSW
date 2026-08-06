#!/usr/bin/env bash
#
# deploy-service.sh - deploy (or redeploy) ONE SVTSW service on this host.
#
# Runs on the deployment server (called by the GitHub Actions deploy jobs on
# the self-hosted runner, or by an admin from a repo checkout).
#
# Usage:
#   bash Environment/deploy-service.sh <dev|prod> <compose-service> <image-tag>
#
# Examples:
#   bash Environment/deploy-service.sh dev  svt-ui       1a2b3c4d
#   bash Environment/deploy-service.sh prod svt-db-agent 1.4.0
#
# What it does (idempotent):
#   1. Syncs the environment's compose files from this checkout to
#      /opt/docker/svtsw/<env>/ (git is their source of truth; .env and
#      versions.env are NEVER overwritten).
#   2. Refuses to run until the admin has created /opt/docker/svtsw/<env>/.env
#      (secrets never leave the server, so CI cannot create it); bootstraps
#      versions.env from versions.env.example on the first run.
#   3. Pins <SERVICE>_VERSION=<image-tag> in versions.env.
#   4. Pulls the image and recreates ONLY that service:
#      docker compose up -d --no-deps <service>.
#
# The rest of the stack is untouched. On reboot the svt.svtsw--<env> systemd
# unit re-runs the same compose project with the same pinned versions.
#
# Registry access (the ghcr.io app packages are PRIVATE):
#   - CI passes REGISTRY_USER + REGISTRY_TOKEN (the job-scoped GITHUB_TOKEN).
#     That login goes into an ISOLATED docker config dir: the token expires
#     when the job ends, and letting `docker login` store it in
#     /root/.docker/config.json would clobber the host's long-lived login -
#     docker always presents stored credentials, so a stale token makes every
#     later pull fail with `denied`.
#   - Root's own config holds a long-lived read:packages PAT (installed once
#     per host with `sudo docker login ghcr.io`, see Environment/README.md).
#     The systemd units' boot-time pulls use it, and admin runs of this script
#     (no REGISTRY_TOKEN set) use it too.
#
# Host requirements: docker compose >= 2.24 (multiple --env-file support) and
# passwordless sudo for docker/file ops (the GitHub runner user has both).

set -euo pipefail

usage() {
  echo "usage: deploy-service.sh <dev|prod> <compose-service> <image-tag>" >&2
  exit 2
}

ENV_NAME="${1:-}"
SERVICE="${2:-}"
IMAGE_TAG="${3:-}"
[ -n "$ENV_NAME" ] && [ -n "$SERVICE" ] && [ -n "$IMAGE_TAG" ] || usage

case "$ENV_NAME" in
  dev)  ENV_SRC_SUBDIR="Dev" ;;
  prod) ENV_SRC_SUBDIR="Prod" ;;
  *) echo "ERROR: environment must be 'dev' or 'prod', got '${ENV_NAME}'" >&2; exit 2 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="${SCRIPT_DIR}/${ENV_SRC_SUBDIR}"
TARGET_DIR="/opt/docker/svtsw/${ENV_NAME}"
COMPOSE_FILE="${TARGET_DIR}/docker-compose-svtsw-${ENV_NAME}.yml"
ENV_FILE="${TARGET_DIR}/.env"
VERSIONS_FILE="${TARGET_DIR}/versions.env"
# Must match `name:` in the compose file and -p in the systemd unit.
PROJECT="svt-svtsw--${ENV_NAME}"

# CI deploys (REGISTRY_TOKEN set) run docker against an isolated DOCKER_CONFIG
# so the job-scoped login never touches root's persistent read:packages login
# (see header). Admin runs use root's default config as-is.
DOCKER=(sudo)
if [ -n "${REGISTRY_TOKEN:-}" ]; then
  CI_DOCKER_CONFIG="${TARGET_DIR}/.docker-ci"
  DOCKER=(sudo env "DOCKER_CONFIG=${CI_DOCKER_CONFIG}")
fi

COMPOSE=("${DOCKER[@]}" docker compose -p "$PROJECT"
         --env-file "$ENV_FILE" --env-file "$VERSIONS_FILE"
         -f "$COMPOSE_FILE")

# --- serialize deploys per environment ----------------------------------------
# Two workflows (ui + db-agent) may deploy at the same time; both edit
# versions.env, so hold an exclusive lock for the whole deploy.
LOCK_FILE="/tmp/svtsw-deploy-${ENV_NAME}.lock"
exec 200>"$LOCK_FILE"
flock 200

# --- preflight: docker compose v2.24+ ------------------------------------------
if ! sudo docker compose version --short >/dev/null 2>&1; then
  echo "ERROR: the docker compose v2 plugin is not available on this host." >&2
  exit 1
fi
COMPOSE_MIN="2.24.0"
COMPOSE_VER="$(sudo docker compose version --short)"
COMPOSE_VER="${COMPOSE_VER#v}"
if [ "$(printf '%s\n' "$COMPOSE_MIN" "$COMPOSE_VER" | sort -V | head -n1)" != "$COMPOSE_MIN" ]; then
  echo "ERROR: docker compose >= ${COMPOSE_MIN} is required (multiple --env-file);" >&2
  echo "       found ${COMPOSE_VER}. Update the docker-compose-plugin package." >&2
  exit 1
fi

# --- 1. sync compose files (git is their source of truth) ----------------------
sudo mkdir -p "$TARGET_DIR"
sudo cp "${SRC_DIR}/docker-compose-svtsw-${ENV_NAME}.yml" \
        "${SRC_DIR}/docker-compose-kafka-${ENV_NAME}.yml" \
        "${TARGET_DIR}/"

# --- 2. env files --------------------------------------------------------------
if ! sudo test -f "$ENV_FILE"; then
  echo "ERROR: ${ENV_FILE} does not exist." >&2
  echo "       Secrets live only on the server: create the file from" >&2
  echo "       Environment/${ENV_SRC_SUBDIR}/.env.example, fill it in, then run" >&2
  echo "       sudo chmod 600 ${ENV_FILE}" >&2
  exit 1
fi
if ! sudo test -f "$VERSIONS_FILE"; then
  echo "First deploy to ${ENV_NAME}: bootstrapping ${VERSIONS_FILE} from the template."
  sudo cp "${SRC_DIR}/versions.env.example" "$VERSIONS_FILE"
fi

# --- 3. pin the new version ----------------------------------------------------
# svt-ui -> SVT_UI_VERSION, svt-db-agent -> SVT_DB_AGENT_VERSION, ...
VERSION_VAR="$(printf '%s' "$SERVICE" | tr 'a-z-' 'A-Z_')_VERSION"
if sudo grep -q "^${VERSION_VAR}=" "$VERSIONS_FILE"; then
  sudo sed -i "s|^${VERSION_VAR}=.*|${VERSION_VAR}=${IMAGE_TAG}|" "$VERSIONS_FILE"
else
  printf '%s=%s\n' "$VERSION_VAR" "$IMAGE_TAG" | sudo tee -a "$VERSIONS_FILE" >/dev/null
fi
echo "Pinned ${VERSION_VAR}=${IMAGE_TAG} in ${VERSIONS_FILE}"

# --- 4. registry login (CI only; isolated config, see header) ------------------
if [ -n "${REGISTRY_TOKEN:-}" ]; then
  sudo mkdir -p "$CI_DOCKER_CONFIG"
  printf '%s' "$REGISTRY_TOKEN" | "${DOCKER[@]}" docker login "${REGISTRY:-ghcr.io}" \
    -u "${REGISTRY_USER:?REGISTRY_USER must be set when REGISTRY_TOKEN is}" \
    --password-stdin
fi

# --- 5. one-time migration: replace pre-compose containers ---------------------
# Before this compose setup the services ran as plain `docker run` containers
# with the same container_name. `docker compose up` refuses to reuse a name it
# does not own, so remove such a container once. Containers already owned by
# this compose project are never touched.
CONTAINER_NAME="svt.${SERVICE#svt-}--${ENV_NAME}"
if sudo docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  OWNER="$(sudo docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$CONTAINER_NAME")"
  if [ "$OWNER" != "$PROJECT" ]; then
    echo "Removing legacy container ${CONTAINER_NAME} (owned by '${OWNER:-plain docker run}', not '${PROJECT}')"
    sudo docker rm -f "$CONTAINER_NAME"
  fi
fi

# --- 6. deploy just this service -----------------------------------------------
"${COMPOSE[@]}" pull "$SERVICE"
"${COMPOSE[@]}" up -d --no-deps "$SERVICE"
"${COMPOSE[@]}" ps "$SERVICE"
echo "Deployed ${SERVICE}=${IMAGE_TAG} to ${ENV_NAME}."
