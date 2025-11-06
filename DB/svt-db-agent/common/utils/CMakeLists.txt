cmake_minimum_required(VERSION 3.12)
set(CMAKE_CXX_STANDARD 17)
project(svt-utils)

add_compile_options("-Wall" "-Wextra" "-g" "-O2")

set(CMAKE_BUILD_TYPE RelWithDebInfo)

file(GLOB SOURCES_DB
  "src/*.cpp"
)

if (NOT TARGET nlohmann_json)
  set(JSON_BuildTests OFF CACHE INTERNAL "")
  add_subdirectory(../../deps/nlohmann_json build-nlohmann_json)
endif()

add_library(svt-utils SHARED ${SOURCES_DB})
target_include_directories(svt-utils PUBLIC include/)
target_link_libraries(svt-utils PUBLIC nlohmann_json::nlohmann_json)


