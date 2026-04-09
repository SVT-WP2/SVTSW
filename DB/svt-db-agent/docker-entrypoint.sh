#!/usr/bin/env bash
set -euo pipefail

APP_BIN="/app/build/bin/svt_db_agent"
DEFAULT_CONFIG="/app/configs/SvtDbAgent_config-local.json"
RUNTIME_CONFIG="${SVT_DB_AGENT_RUNTIME_CONFIG:-/tmp/SvtDbAgent_config-runtime.json}"

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
  if $dbHost != "" then .DataBase.psqlHost = $dbHost else . end |
  if $dbPort != "" then .DataBase.psqlPort = $dbPort else . end |
  if $dbUser != "" then .DataBase.psqlUser = $dbUser else . end |
  if $dbPass != "" then .DataBase.psqlPass = $dbPass else . end |
  if $dbName != "" then .DataBase.psqlDbName = $dbName else . end |
  if $dbSchema != "" then .DataBase.psqlDbSchema = $dbSchema else . end |
  if $kafkaServer != "" then .kafka.server = $kafkaServer else . end |
  if $kafkaPort != "" then .kafka.port = $kafkaPort else . end
  ' "$RUNTIME_CONFIG" > "$RUNTIME_CONFIG.tmp"

mv "$RUNTIME_CONFIG.tmp" "$RUNTIME_CONFIG"

exec "$APP_BIN" "$RUNTIME_CONFIG" "$@"

