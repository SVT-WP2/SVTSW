#! /bin/bash
set -euo pipefail

#get this script path
thisScriptPath=$(cd "$(dirname "${BASH_SOURCE[0]:-0}")" &>/dev/null && pwd -P)

# update git_tag before build the docker image
"${thisScriptPath}"/compile.sh -u -n
docker build -t localhost/svt.db-agent:latest .
