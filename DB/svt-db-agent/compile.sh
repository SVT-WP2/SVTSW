#! /usr/bin/env bash

if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  git submodule status | grep --quiet '^-' && git submodule update --init
fi
[[ $(uname -s) == 'Darwin' ]] && export PKG_CONFIG_PATH="/opt/homebrew/lib/postgresql@17/pkgconfig:/opt/homebrew/lib/pkgconfig:$PKG_CONFIG_PATH"

[[ ! ${1} == '-u' ]] &&
  cmake -B build -S . -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
cmake --build build -j"$(nproc)"
