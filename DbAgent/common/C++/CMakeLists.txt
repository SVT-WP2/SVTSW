cmake_minimum_required(VERSION 3.24)

project(svt-common-cpp VERSION 1.0.0 LANGUAGES CXX)

include(FetchContent)
include(GNUInstallDirs)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE RelWithDebInfo CACHE STRING "Build type" FORCE)
endif()

add_compile_options(-Wall -Wextra -g -O2)

set(SVT_COMMON_CPP svt-common-cpp)
set(SVT_UTILS svt-utils)
set(SVT_KAFKA svt-kafka)
set(SVT_CONFIG svt-config)

set(FETCHCONTENT_TRY_FIND_PACKAGE_MODE ALWAYS)
set(FETCHCONTENT_UPDATES_DISCONNECTED ON)

FetchContent_Declare(
  nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.12.0
  FIND_PACKAGE_ARGS NAMES nlohmann_json
)

FetchContent_Declare(
  modern_cpp_kafka
  GIT_REPOSITORY https://github.com/morganstanley/modern-cpp-kafka.git
  GIT_TAG v2024.07.03 # pinned release (was: main) - keep reproducible builds
  GIT_SHALLOW TRUE
)

FetchContent_MakeAvailable(nlohmann_json modern_cpp_kafka)

add_subdirectory(utils)
add_subdirectory(kafka)
add_subdirectory(config)

add_library(${SVT_COMMON_CPP} INTERFACE)
target_link_libraries(${SVT_COMMON_CPP} INTERFACE ${SVT_UTILS} ${SVT_KAFKA} ${SVT_CONFIG})

add_library(${PROJECT_NAME}::${SVT_COMMON_CPP} ALIAS ${SVT_COMMON_CPP})

install(
  TARGETS ${SVT_COMMON_CPP}
  EXPORT ${PROJECT_NAME}-targets
)
