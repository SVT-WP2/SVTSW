#!/usr/bin/env bash
set -euo pipefail

THIS_SCRIPT_PATH=$(cd -- "$(dirname "${BASH_SOURCE[0]:-0}")" &>/dev/null && pwd -P)
APP_BIN="${THIS_SCRIPT_PATH}/svt-db-agent/bin/svt_db_agent"
DEFAULT_CONFIG="${THIS_SCRIPT_PATH}/configs/SvtDbAgent_config.example.json"
# Keep the runtime config on the container's OWN filesystem (never a shared or
# bind-mounted path). It holds the injected DB password, so it must not be
# visible on the host, and each container needs its own copy so the dev and prod
# containers can't clobber each other. It is chmod 600 once written (see below).
RUNTIME_CONFIG="${SVT_DB_AGENT_RUNTIME_CONFIG:-${THIS_SCRIPT_PATH}/SvtDbAgent_config.runtime.json}"

BASE_CONFIG="${SVT_DB_AGENT_CONFIG:-$DEFAULT_CONFIG}"
if [[ ${1:-} == *.json ]]; then
  BASE_CONFIG="$1"
  shift
fi

if [[ ! -f "$BASE_CONFIG" ]]; then
  echo "[svt-db-agent] Base config not found: $BASE_CONFIG" >&2
  exit 1
fi

cp "$BASE_CONFIG" "$RUNTIME_CONFIG"

# Apply optional env overrides to the runtime JSON config.
# Empty env vars are ignored to preserve base config values.
jq \
  --arg loggerFilePath "${SVT_DB_AGENT_LOGGER_FILE_PATH:-}" \
  --arg loggerTermVerbosity "${SVT_DB_AGENT_LOGGER_TERM_VERBOSITY:-}" \
  --arg loggerFileVerbosity "${SVT_DB_AGENT_LOGGER_FILE_VERBOSITY:-}" \
  --arg dbHost "${SVT_DB_AGENT_DB_HOST:-}" \
  --arg dbPort "${SVT_DB_AGENT_DB_PORT:-}" \
  --arg dbUser "${SVT_DB_AGENT_DB_USER:-}" \
  --arg dbPass "${SVT_DB_AGENT_DB_PASS:-}" \
  --arg dbName "${SVT_DB_AGENT_DB_NAME:-}" \
  --arg dbSchema "${SVT_DB_AGENT_DB_SCHEMA:-}" \
  --arg kafkaServer "${SVT_DB_AGENT_KAFKA_SERVER:-}" \
  --arg kafkaPort "${SVT_DB_AGENT_KAFKA_PORT:-}" \
  '
  if $loggerFilePath != "" then .logger.filePath = $loggerFilePath else . end |
  if $loggerTermVerbosity != "" then .logger.termVerbosity = $loggerTermVerbosity else . end |
  if $loggerFileVerbosity != "" then .logger.fileVerbosity = $loggerFileVerbosity else . end |
  if $dbHost != "" then .database.psqlHost = $dbHost else . end |
  if $dbPort != "" then .database.psqlPort = $dbPort else . end |
  if $dbUser != "" then .database.psqlUser = $dbUser else . end |
  if $dbPass != "" then .database.psqlPass = $dbPass else . end |
  if $dbName != "" then .database.psqlDbName = $dbName else . end |
  if $dbSchema != "" then .database.psqlDbSchema = $dbSchema else . end |
  if $kafkaServer != "" then .kafka.server = $kafkaServer else . end |
  if $kafkaPort != "" then .kafka.port = $kafkaPort else . end
  ' "$RUNTIME_CONFIG" >"$RUNTIME_CONFIG.tmp"

mv "$RUNTIME_CONFIG.tmp" "$RUNTIME_CONFIG"

# The runtime config holds the injected DB password — keep it private.
chmod 600 "$RUNTIME_CONFIG"

# The logger opens its file directly and does NOT create parent directories, so a
# missing log dir silently disables file logging. Ensure it exists: in deploys
# it's the bind-mount point (/var/log/svt-db-agent); this also covers un-mounted
# local runs. Derived from the runtime config so it tracks any env override.
LOG_FILE_PREFIX="$(jq -r '.logger.filePath // empty' "$RUNTIME_CONFIG")"
if [[ -n "$LOG_FILE_PREFIX" ]]; then
  mkdir -p "$(dirname "$LOG_FILE_PREFIX")"
fi

exec "$APP_BIN" "$RUNTIME_CONFIG" "$@"
