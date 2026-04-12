#! /bin/bash
set -euo pipefail

RED='\033[0;31m'
RESET='\033[0m'

usage() {
  cat <<EOF
  usage: ${0} [-u][-n]
EOF
}

update_git_tag() {
  # Define the output file
  GIT_TAG_FILE="version/.git_tag"

  # Check git is found
  command -v git >/dev/null 2>&1 || return 0

  # Check we are in a git repository
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0

  # Get current version info
  # --tags: include tags, --always: fallback to hash if no tags, --dirty: append -dirty if modified
  GIT_VERSION=$(git describe --tags --always --dirty)
  # GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "initial")

  # Generate the C/C++ header content
  cat <<EOF >"$GIT_TAG_FILE"
${GIT_VERSION}
EOF
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

update_git_tag

[[ -z "${UPDATE}" ]] &&
  cmake -B build -S . -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
[[ -n "$BUILD" ]] && cmake --build build -j"$(nproc)" || exit 0
