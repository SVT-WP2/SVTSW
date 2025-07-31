#! /usr/bin/env bash
(
  set -euo pipefail

  thisScriptPath="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]:-0}")")" && pwd)"

  set +u
  if [ -n "$1" ]; then
    CONF_FILE=${1:-}
    export "$(grep -E -v "(^#.*|^$)" "$CONF_FILE" | xargs -0)"
  fi
  set -u
  "$thisScriptPath"/build/bin/svt_db_agent
)
