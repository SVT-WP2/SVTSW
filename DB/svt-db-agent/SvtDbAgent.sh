#! /usr/bin/env bash
(
  set -euo pipefail

  thisScriptPath="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]:-0}")")" && pwd)"

  # set +u
  # if [ -n "$1" ]; then
  #   CONF_FILE=${1:-}
  #   read -ra options < <(grep -E -v "(^#|^$)" "$CONF_FILE" | xargs -0 -L 1)
  #   export "${options[@]}"
  #   echo "$SVT_DB_AGENT_LOG_FILE"
  # fi
  # set -u
  "$thisScriptPath"/build/bin/svt_db_agent "$@"
)
