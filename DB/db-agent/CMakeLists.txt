cmake_minimum_required(VERSION 3.1)
set(CMAKE_CXX_STANDARD 17)
project(SVT_db)

include_directories(include include/pqxx ${CMAKE_CURRENT_BINARY_DIR})
link_directories(lib)
link_libraries(stdc++fs)

option(BUILD_TSAN "Compile with thread sanitizer" OFF)
option(BUILD_ASAN "Compile with address sanitizer" OFF)
option(BUILD_LSAN "Compile with leak sanitizer" OFF)
option(BUILD_UBSAN "Compile with undefined behaviour sanitizer" OFF)

# add_definitions("-DTIXML_USE_STL")
add_compile_options("-Wall" "-Wextra" "-g" "-O2")
add_link_options("-lstdc++" "-ldl")
SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wno-unknown-pragmas -Wno-conversion -Wpedantic -Wshadow -Wdouble-promotion -Wformat=2 -Wformat-truncation -Wundef -Wdeprecated -fno-common -fasynchronous-unwind-tables -Wl,-z,defs -D_FORTIFY_SOURCE=2 -D_GLIBCXX_ASSERTIONS" )

if(BUILD_TSAN)
  SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=thread -fno-omit-frame-pointer")
  add_link_options("-fsanitize=thread")
endif(BUILD_TSAN)
if(BUILD_ASAN)
  SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=address -fno-omit-frame-pointer")
  add_link_options("-fsanitize=address")
endif(BUILD_ASAN)
if(BUILD_LSAN)
  SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=leak -fno-omit-frame-pointer")
  add_link_options("-fsanitize=leak")
endif(BUILD_LSAN)
if(BUILD_UBSAN)
  SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=undefined -fno-omit-frame-pointer")
  add_link_options("-fsanitize=undefined")
endif(BUILD_UBSAN)

set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY lib)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY lib)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY bin)
set(CMAKE_BUILD_TYPE RelWithDebInfo)

# set(RDKafka_DIR /usr/local/lib/cmake/RdKafka)
# set(Monitoring_DIR /usr/local/lib/cmake/Monitoring)
# find_package(RdKafka CONFIG REQUIRED)
# find_package(Monitoring CONFIG REQUIRED)

file(GLOB SOURCES_DB
  "src/SVTUtilities/SvtLogger.cpp"
  # "src/ITSUtilities/ItsTimer.cpp"
  # "src/ITSUtilities/ItsGlobalTimer.cpp"
  # "src/ITSUtilities/ItsUtility.cpp"
  # "src/ITSUtilities/itsThread.cpp"
  #"src/ITSUtilities/ItsBitsManager.cpp"


  "src/SVTDb/svtdb_if.cpp"
  "src/SVTDb/sqlmapi.cpp"
  "src/Database/multitype.cpp"
  "src/Database/databaseinterface.cpp"
)

add_custom_target(version
  BYPRODUCTS ${CMAKE_CURRENT_BINARY_DIR}/version.h
  COMMAND ${CMAKE_COMMAND}
    -D SRC=${CMAKE_CURRENT_SOURCE_DIR}/include/version.h.in
    -D DST=${CMAKE_CURRENT_BINARY_DIR}/version.h
    -P ${CMAKE_CURRENT_SOURCE_DIR}/cmake/version.cmake
  DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/include/version.h.in
  DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/cmake/version.cmake
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
)

add_executable(SVT_db_agent "src/SVT_db_agent.cpp" ${SOURCES_DB})
add_dependencies(SVT_db_agent version)

add_executable(test_db_if "src/test_db_if.cpp" ${SOURCES_DB})
add_dependencies(test_db_if version)

add_subdirectory(deps/libpqxx build-pqxx)

set(RDKAFKA_BUILD_STATIC ON CACHE BOOL "")
add_subdirectory(deps/librdkafka build-rdkafka)

target_link_libraries(SVT_db_agent PRIVATE pqxx rdkafka pthread)
target_link_libraries(test_db_if PRIVATE pqxx)
