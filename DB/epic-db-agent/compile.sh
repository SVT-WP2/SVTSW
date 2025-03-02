mkdir -p build && cd build || exit
cmake -DCMAKE_EXPORT_COMPILE_COMMANDS=ON ../ -B.
make -j
