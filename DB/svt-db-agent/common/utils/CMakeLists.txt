# Find or fetch nlohmann_json
include(FetchContent)
FetchContent_Declare(
  nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json
  GIT_TAG v3.12.0
  FIND_PACKAGE_ARGS NAMES nlohmann_json # Tries find_package(nlohmann_json)
                                        # first
)
FetchContent_MakeAvailable(nlohmann_json)

file(GLOB SOURCES_DB "src/*.cpp")

add_library(svt-utils SHARED ${SOURCES_DB})
target_include_directories(svt-utils PUBLIC include/)
target_link_libraries(svt-utils PUBLIC nlohmann_json::nlohmann_json)
