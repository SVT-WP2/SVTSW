set(TARGET_NAME ${SVT_KAFKA})

if(NOT TARGET ${SVT_UTILS})
  add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../utils
                   ${CMAKE_BINARY_DIR}/${SVT_UTILS})
endif()

find_package(PkgConfig REQUIRED)
pkg_check_modules(RDKAFKA REQUIRED IMPORTED_TARGET rdkafka)

find_library(RDKAFKA_CPP_LIB NAMES rdkafka++)
if(NOT RDKAFKA_CPP_LIB)
  message(
    FATAL_ERROR
      "librdkafka++ was not found. Install librdkafka with C++ bindings.")
endif()

if(NOT EXISTS "${modern_cpp_kafka_SOURCE_DIR}/include/kafka/KafkaProducer.h")
  message(FATAL_ERROR "modern-cpp-kafka headers were not fetched correctly.")
endif()

file(GLOB TARGET_SOURCES "src/*.cpp")

add_library(${TARGET_NAME} SHARED ${TARGET_SOURCES})
target_include_directories(${TARGET_NAME} SYSTEM PUBLIC
                           ${modern_cpp_kafka_SOURCE_DIR}/include)
target_include_directories(${TARGET_NAME} PUBLIC include/)
target_link_libraries(${TARGET_NAME} PUBLIC ${SVT_UTILS} PkgConfig::RDKAFKA
                                            "${RDKAFKA_CPP_LIB}")

# Add the install target
install(
  TARGETS ${TARGET_NAME}
  RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR} # .dll on Windows
  LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR} # .so on Linux
  ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR} # .a or .lib
)
