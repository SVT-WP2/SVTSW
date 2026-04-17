#! /bin/bash
set -euo pipefail

#get this script path
THIS_SCRIPT_PATH=$(cd "$(dirname "${BASH_SOURCE[0]:-0}")" &>/dev/null && pwd -P)

# update git_tag before build the docker image
"${THIS_SCRIPT_PATH}"/app/compile.sh -u -n
# docker build --target db-agent-deploy -t ycorrales/svt.db-agent.deploy:latest .
docker compose build "$@"
