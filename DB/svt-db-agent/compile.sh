mkdir -p build && cd build || exit

[[ ! ${1} == '-u' ]] &&
  cmake -DCMAKE_EXPORT_COMPILE_COMMANDS=ON ../ -B.
make -j
