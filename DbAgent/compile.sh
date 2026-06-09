#! /bin/bash
set -euo pipefail

RED='\033[0;31m'
RESET='\033[0m'

usage() {
  cat <<EOF
  usage: ${0} [-u][-n]
EOF
}

THIS_SCRIPT_PATH=$(cd "$(dirname "${BASH_SOURCE[0]:-0}")" &>/dev/null && pwd -P)

# Resolve the app version. In Docker builds the workflow passes VERSION as
# a build arg, which the Dockerfile exports into the env. Locally we mirror
# the GitHub workflow logic: if HEAD is exactly at a `svt-dbagent-*` tag,
# strip the prefix (svt-dbagent-1.2.3 -> 1.2.3); otherwise use the short SHA.
resolve_version() {
  if [[ -n "${VERSION:-}" ]]; then
    return 0
  fi
  if ! command -v git >/dev/null 2>&1 \
    || ! git -C "$THIS_SCRIPT_PATH" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo -e "${RED}ERROR: VERSION not set and not in a git repo${RESET}" >&2
    exit 1
  fi
  local tag
  if tag=$(git -C "$THIS_SCRIPT_PATH" describe --tags --exact-match --match 'svt-dbagent-*' 2>/dev/null); then
    VERSION="${tag#svt-dbagent-}"
  else
    VERSION=$(git -C "$THIS_SCRIPT_PATH" rev-parse --short=8 HEAD)
  fi
}

UPDATE=
BUILD=1
while [ $# -gt 0 ]; do
  case $1 in
  -u) UPDATE=1 ;;
  -n) BUILD= ;;
  *)
    echo -e "${RED}ERROR: Unkown option $1${RESET}"
    usage
    exit 1
    ;;
  esac
  shift
done

resolve_version

[[ -z "${UPDATE}" ]] &&
  cmake -B build -S ./app -DVERSION="${VERSION}" -DCMAKE_INSTALL_PREFIX=install -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
[[ -n "$BUILD" ]] && cmake --build build -j"$(nproc)" --target install || exit 0
