if(NOT TARGET svt-utils)
  add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../utils svt-utils)
endif()

if(UNIX AND NOT APPLE)
  set(svt-kafka-lib rdkafka)

else()
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(RDKAFKA REQUIRED rdkafka)

  set(svt-kafka-lib ${RDKAFKA_LINK_LIBRARIES})

endif()

FetchContent_Declare(
  modern_cpp_kafka
  GIT_REPOSITORY https://github.com/morganstanley/modern-cpp-kafka.git
  GIT_TAG main # Or a specific release version
)
FetchContent_MakeAvailable(modern_cpp_kafka)

file(GLOB SOURCES_DB "src/*.cpp")

add_library(svt-kafka SHARED ${SOURCES_DB})

target_include_directories(svt-kafka SYSTEM
                           PUBLIC ${modern_cpp_kafka_SOURCE_DIR}/include)
target_include_directories(svt-kafka PUBLIC include/)
target_link_libraries(svt-kafka PUBLIC svt-utils ${svt-kafka-lib})
