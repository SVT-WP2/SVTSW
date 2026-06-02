#! /bin/bash
set -euo pipefail

usage() {
  cat <<EOF
  usage: $0 [release]
EOF
}
# get this script path
THIS_SCRIPT_PATH=$(cd "$(dirname "${BASH_SOURCE[0]:-0}")" &>/dev/null && pwd -P)

# Resolve VERSION to pass to the docker build. Mirrors the GitHub workflow:
# if HEAD is exactly at a `svt-dbagent-*` tag, strip the prefix; otherwise
# use the short SHA. The Dockerfile receives it via `ARG VERSION` and
# forwards it to compile.sh (which would otherwise fail inside the
# container — no .git there).
if [[ -z "${VERSION:-}" ]]; then
  if TAG=$(git -C "${THIS_SCRIPT_PATH}" describe --tags --exact-match --match 'svt-dbagent-*' 2>/dev/null); then
    VERSION="${TAG#svt-dbagent-}"
  else
    VERSION=$(git -C "${THIS_SCRIPT_PATH}" rev-parse --short=8 HEAD)
  fi
fi

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
  docker build -f Dockerfile --platform linux/amd64 --platform linux/arm64 --target db-agent --build-arg VERSION="${VERSION}" -t ${DOCKER_TAG} .
  docker push ${DOCKER_TAG}
else
  docker build -f Dockerfile --target db-agent --build-arg VERSION="${VERSION}" -t ${DOCKER_TAG} .
fi
