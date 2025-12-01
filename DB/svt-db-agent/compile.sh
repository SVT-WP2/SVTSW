#! /usr/bin/env bash

[[ $(uname -s) == 'Darwin' ]] && export PKG_CONFIG_PATH="/opt/homebrew/lib/postgresql@17/pkgconfig:/opt/homebrew/lib/pkgconfig:$PKG_CONFIG_PATH"

mkdir -p build && cd build || exit
[[ ! ${1} == "-u" ]] &&
  cmake -DCMAKE_EXPORT_COMPILE_COMMANDS=ON -S ../ -B .
make -j
