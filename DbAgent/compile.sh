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

# Resolve the app version. CI/Docker pass VERSION as a build arg, which the
# Dockerfile exports into the env, and it takes precedence. Otherwise fall back to
# the DbAgent/VERSION file — the single source of truth (bumped by the DbAgent :: Release workflow).
resolve_version() {
  if [[ -n "${VERSION:-}" ]]; then
    return 0
  fi
  if [[ -f "$THIS_SCRIPT_PATH/VERSION" ]]; then
    VERSION=$(tr -d '[:space:]' < "$THIS_SCRIPT_PATH/VERSION")
  fi
  if [[ -z "${VERSION:-}" ]]; then
    echo -e "${RED}ERROR: VERSION not set and $THIS_SCRIPT_PATH/VERSION not found${RESET}" >&2
    exit 1
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
