set(TARGET_NAME ${SVT_UTILS})

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

file(GLOB TARGET_SOURCES "src/*.cpp")

add_library(${TARGET_NAME} SHARED ${TARGET_SOURCES})
target_include_directories(${TARGET_NAME} PUBLIC include/)
target_link_libraries(${TARGET_NAME} PUBLIC nlohmann_json::nlohmann_json)

# Add the install target
install(
  TARGETS ${TARGET_NAME}
  RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR} # .dll on Windows
  LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR} # .so on Linux
  ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR} # .a or .lib
)
