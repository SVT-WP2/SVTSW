cmake_minimum_required(VERSION 3.12)
set(CMAKE_CXX_STANDARD 17)
project(svt-kafka)

add_compile_options("-Wall" "-Wextra" "-g" "-O2")

set(CMAKE_BUILD_TYPE RelWithDebInfo)

file(GLOB SOURCES_DB
  "src/*.cpp"
)

IF (NOT TARGET svt-utils)
  add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../utils svt-utils)
ENDIF()

IF (UNIX AND NOT APPLE)
  set(svt-kafka-lib rdkafka++)

ELSE()
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(RDKAFKA REQUIRED rdkafka++)

  set(svt-kafka-lib ${RDKAFKA_LINK_LIBRARIES})

ENDIF()

add_library(svt-kafka SHARED ${SOURCES_DB})
target_include_directories(svt-kafka PUBLIC ${RDKAFKA_INCLUDE_DIRS} include/)
target_link_libraries(svt-kafka PUBLIC svt-utils ${svt-kafka-lib})


