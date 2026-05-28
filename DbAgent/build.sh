#! /bin/bash
set -euo pipefail

usage() {
  cat <<EOF
  usage: $0 [release]
EOF
}
# get this script path
THIS_SCRIPT_PATH=$(cd "$(dirname "${BASH_SOURCE[0]:-0}")" &>/dev/null && pwd -P)

# update git_tag before build the docker image
"${THIS_SCRIPT_PATH}"/compile.sh -u -n

RELEASE=
DOCKER_TAG="ycorrales/svt.db-agent:latest"
while [[ ! $# -eq 0 ]]; do
  case ${1:-} in
  release)
    RELEASE=1
    DOCKER_TAG="ycorrales/svt.db-agent:release"
    ;;
  *)
    echo "ERROR: unknow option $1"
    usage
    exit 1
    ;;
  esac
  shift
done

if [[ -n "$RELEASE" ]]; then
  docker build -f Dockerfile --platform linux/amd64 --platform linux/arm64 --target db-agent -t ${DOCKER_TAG} .
  docker push ${DOCKER_TAG}
else
  docker build -f Dockerfile --target db-agent -t ${DOCKER_TAG} .
fi
