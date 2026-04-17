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

set(CMAKE_BUILD_TYPE RelWithDebInfo)

# Include standard installation directories (lib, bin, include, etc.)
include(GNUInstallDirs)

# Assign RPATH
if(APPLE)
  # 1. Enable RPATH for macOS (essential)
  set(CMAKE_MACOSX_RPATH ON)
  set(CMAKE_INSTALL_RPATH "@loader_path/../lib")

else()
  set(CMAKE_INSTALL_RPATH "\$ORIGIN/../lib")

endif()

set(SVT_UTILS "svt-utils")
set(SVT_KAFKA "svt-kafka")

include(FetchContent)
add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/common/utils svt-utils)
add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/common/kafka svt-kafka)

# Define version build paths
set(VERSION_SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/version)
set(VERSION_BINARY_DIR ${CMAKE_CURRENT_BINARY_DIR}/version-build)

# Configure and build the helper sub-project Configure step
execute_process(
  COMMAND ${CMAKE_COMMAND} -B ${VERSION_BINARY_DIR} -S ${VERSION_SOURCE_DIR}
          -DCMAKE_BUILD_TYPE=${CMAKE_BUILD_TYPE} RESULT_VARIABLE CONFIG_RESULT)
message(STATUS "Configuring version sub-project...")

if(NOT CONFIG_RESULT EQUAL 0)
  message(FATAL_ERROR "Version sub-project configuration failed!")
endif()

# Build step
message(STATUS "Building version sub-project...")
execute_process(COMMAND ${CMAKE_COMMAND} --build ${VERSION_BINARY_DIR} --config
                        ${CMAKE_BUILD_TYPE} RESULT_VARIABLE BUILD_RESULT)

if(NOT BUILD_RESULT EQUAL 0)
  message(FATAL_ERROR "Version sub-project build failed!")
endif()

# add_custom_target( version BYPRODUCTS ${CMAKE_CURRENT_BINARY_DIR}/version.h
# COMMAND ${CMAKE_COMMAND} -D
# SRC=${CMAKE_CURRENT_SOURCE_DIR}/include/version.h.in -D
# DST=${CMAKE_CURRENT_BINARY_DIR}/version.h -P
# ${CMAKE_CURRENT_SOURCE_DIR}/cmake/version.cmake DEPENDS
# ${CMAKE_CURRENT_SOURCE_DIR}/include/version.h.in DEPENDS
# ${CMAKE_CURRENT_SOURCE_DIR}/cmake/version.cmake WORKING_DIRECTORY
# ${CMAKE_SOURCE_DIR} ALL)

if(UNIX AND NOT APPLE)
  FetchContent_Declare(
    pqxx
    GIT_REPOSITORY https://github.com/jtv/libpqxx.git
    GIT_TAG 8.0.1 # Or a specific version
    FIND_PACKAGE_ARGS NAMES pqxx)

  # Optional: Skip building libpqxx's internal tests to save time
  set(SKIP_BUILD_TEST
      ON
      CACHE INTERNAL "")
  FetchContent_MakeAvailable(pqxx)

  set(svt_db_agent_lib pqxx pthread ${SVT_UTILS} ${SVT_KAFKA})

else()

  set(ENV{PKG_CONFIG_PATH}
      "/opt/homebrew/lib/postgresql@17/pkgconfig:/opt/homebrew/lib/pkgconfig:$ENV{PKG_CONFIG_PATH}"
  )
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(PQXX REQUIRED libpqxx)

  set(svt_db_agent_lib ${PQXX_LINK_LIBRARIES} pthread ${SVT_UTILS} ${SVT_KAFKA})
endif()

# Find or fetch magic enum
FetchContent_Declare(
  magic_enum
  GIT_REPOSITORY https://github.com/Neargye/magic_enum.git
  GIT_TAG master # Replace with latest version
  FIND_PACKAGE_ARGS NAMES magic_enum)
FetchContent_MakeAvailable(magic_enum)

list(PREPEND svt_db_agent_lib magic_enum::magic_enum)

file(GLOB SVT_DB_AGENT_SOURCES "src/Database/*.cpp" src/Config/*.cpp
     "src/DbAgentDto/*.cpp" "src/DbAgentService/*.cpp")

# Define the directory containing your source files
set(SVT_DB_AGENT_TEST_DIR "${CMAKE_CURRENT_SOURCE_DIR}/src/test")
# Get a list of all .cpp files in the SOURCE_DIR
file(GLOB_RECURSE CPP_FILES "${SVT_DB_AGENT_TEST_DIR}/*.cpp")
# Prepend main project executable source
list(PREPEND CPP_FILES "${SVT_DB_AGENT_TEST_DIR}/../svt_db_agent.cpp")

# Loop through each .cpp file and create an executable
foreach(CPP_FILE ${CPP_FILES})
  # Extract the base name (without path and extension) for the executable name
  get_filename_component(EXECUTABLE_NAME ${CPP_FILE} NAME_WE)

  list(APPEND targets ${EXECUTABLE_NAME})

  # Add the executable
  add_executable(${EXECUTABLE_NAME} ${CPP_FILE} ${SVT_DB_AGENT_SOURCES})
  # add_dependencies(${EXECUTABLE_NAME} version)

  target_include_directories(${EXECUTABLE_NAME} SYSTEM
                             PRIVATE ${PQXX_INCLUDE_DIRS})
  target_include_directories(${EXECUTABLE_NAME} PRIVATE ${VERSION_BINARY_DIR})
  target_link_libraries(${EXECUTABLE_NAME} PRIVATE ${svt_db_agent_lib})
endforeach()

# Add the install target
install(
  TARGETS ${targets}
  RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR} # .dll on Windows
  LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR} # .so on Linux
  ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR} # .a or .lib
)
