if(NOT TARGET svt-utils)
  add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../utils svt-utils)
endif()

if(UNIX AND NOT APPLE)
  set(svt-kafka-lib rdkafka++)

else()
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(RDKAFKA REQUIRED rdkafka++)

  set(svt-kafka-lib ${RDKAFKA_LINK_LIBRARIES})

endif()

file(GLOB SOURCES_DB "src/*.cpp")

add_library(svt-kafka SHARED ${SOURCES_DB})

target_include_directories(svt-kafka SYSTEM PUBLIC ${RDKAFKA_INCLUDE_DIRS})
target_include_directories(svt-kafka PUBLIC include/)
target_link_libraries(svt-kafka PUBLIC svt-utils ${svt-kafka-lib})
