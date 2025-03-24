#! /usr/bin/env bash
(
  set -euo pipefail

  thisScriptPath="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]:-0}")")" && pwd)"

  "$thisScriptPath"/build/bin/svt_db_agent
)
