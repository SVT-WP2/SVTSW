execute_process(COMMAND git describe --tags --dirty --always --long WORKING_DIRECTORY ${CMAKE_SOURCE_DIR} OUTPUT_STRIP_TRAILING_WHITESPACE OUTPUT_VARIABLE VERSION)
message(STATUS "Using git version: ${VERSION}")
configure_file(${SRC} ${DST} @ONLY)
