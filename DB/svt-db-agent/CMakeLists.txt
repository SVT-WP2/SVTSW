cmake_minimum_required(VERSION 3.24)
set(CMAKE_CXX_STANDARD 20)
project(svt-db-agent)

include_directories(include ${CMAKE_CURRENT_BINARY_DIR})
# link_libraries(stdc++fs)

option(BUILD_TSAN "Compile with thread sanitizer" OFF)
option(BUILD_ASAN "Compile with address sanitizer" OFF)
option(BUILD_LSAN "Compile with leak sanitizer" OFF)
option(BUILD_UBSAN "Compile with undefined behaviour sanitizer" OFF)

# add_definitions("-DTIXML_USE_STL")
add_compile_options("-Wall" "-Wextra" "-g" "-O2")
# add_link_options("-lstdc++" "-ldl") SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS}
# -Wno-unknown-pragmas -Wno-conversion -Wpedantic -Wshadow -Wdouble-promotion
# -Wformat=2 -Wformat-truncation -Wundef -Wdeprecated -fno-common
# -fasynchronous-unwind-tables -Wl,-z,defs -D_FORTIFY_SOURCE=2
# -D_GLIBCXX_ASSERTIONS" )

if(BUILD_TSAN)
  set(CMAKE_CXX_FLAGS
      "${CMAKE_CXX_FLAGS} -fsanitize=thread -fno-omit-frame-pointer")
  add_link_options("-fsanitize=thread")
endif(BUILD_TSAN)
if(BUILD_ASAN)
  set(CMAKE_CXX_FLAGS
      "${CMAKE_CXX_FLAGS} -fsanitize=address -fno-omit-frame-pointer")
  add_link_options("-fsanitize=address")
endif(BUILD_ASAN)
if(BUILD_LSAN)
  set(CMAKE_CXX_FLAGS
      "${CMAKE_CXX_FLAGS} -fsanitize=leak -fno-omit-frame-pointer")
  add_link_options("-fsanitize=leak")
endif(BUILD_LSAN)
if(BUILD_UBSAN)
  set(CMAKE_CXX_FLAGS
      "${CMAKE_CXX_FLAGS} -fsanitize=undefined -fno-omit-frame-pointer")
  add_link_options("-fsanitize=undefined")
endif(BUILD_UBSAN)

set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY lib)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY lib)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY bin)
set(CMAKE_BUILD_TYPE RelWithDebInfo)

file(
  GLOB
  SOURCES_DB
  "src/Database/databaseinterface.cpp"
  "src/SVTConfig/*.cpp"
  "src/SVTDb/*.cpp"
  "src/SVTDbAgentDto/*.cpp"
  "src/SVTDbAgentService/*.cpp")

add_custom_target(
  version
  BYPRODUCTS ${CMAKE_CURRENT_BINARY_DIR}/version.h
  COMMAND
    ${CMAKE_COMMAND} -D SRC=${CMAKE_CURRENT_SOURCE_DIR}/include/version.h.in -D
    DST=${CMAKE_CURRENT_BINARY_DIR}/version.h -P
    ${CMAKE_CURRENT_SOURCE_DIR}/cmake/version.cmake
  DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/include/version.h.in
  DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/cmake/version.cmake
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})

include(FetchContent)
add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/common/utils svt-utils)
add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/common/kafka svt-kafka)

if(UNIX AND NOT APPLE)
  FetchContent_Declare(
    pqxx
    GIT_REPOSITORY https://github.com/jtv/libpqxx.git
    GIT_TAG 334bcd22 # Or a specific version
    FIND_PACKAGE_ARGS NAMES pqxx)
  FetchContent_MakeAvailable(pqxx)

  set(svt_db_agent_lib pqxx pthread svt-utils svt-kafka)

else()
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(PQXX REQUIRED libpqxx)

  set(svt_db_agent_lib ${PQXX_LINK_LIBRARIES} pthread svt-utils svt-kafka)
endif()

# Define the directory containing your source files
set(SRC_TEST_DIR "${CMAKE_CURRENT_SOURCE_DIR}/src/test")
# Get a list of all .cpp files in the SOURCE_DIR
file(GLOB_RECURSE CPP_FILES "${SRC_TEST_DIR}/*.cpp")
# Prepend main project executable source
list(PREPEND CPP_FILES "${SRC_TEST_DIR}/../svt_db_agent.cpp")
# Loop through each .cpp file and create an executable
foreach(CPP_FILE ${CPP_FILES})
  # Extract the base name (without path and extension) for the executable name
  get_filename_component(EXECUTABLE_NAME ${CPP_FILE} NAME_WE)

  # Add the executable
  add_executable(${EXECUTABLE_NAME} ${CPP_FILE} ${SOURCES_DB})
  add_dependencies(${EXECUTABLE_NAME} version)

  target_include_directories(
    ${EXECUTABLE_NAME} SYSTEM PRIVATE ${PQXX_INCLUDE_DIRS}
                                      ${RDKAFKA_INCLUDE_DIRS})
  target_link_libraries(${EXECUTABLE_NAME} PRIVATE ${svt_db_agent_lib})
endforeach()
