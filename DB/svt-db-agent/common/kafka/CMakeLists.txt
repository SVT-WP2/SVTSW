set(TARGET_NAME ${SVT_KAFKA})

if(NOT TARGET ${SVT_UTILS})
  add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../utils ${SVT_UTILS})
endif()

if(UNIX AND NOT APPLE)
  set(kafka-lib rdkafka)

else()
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(RDKAFKA REQUIRED rdkafka)

  set(kafka-lib ${RDKAFKA_LINK_LIBRARIES})

endif()

FetchContent_Declare(
  modern_cpp_kafka
  GIT_REPOSITORY https://github.com/morganstanley/modern-cpp-kafka.git
  GIT_TAG main # Or a specific release version
)
FetchContent_MakeAvailable(modern_cpp_kafka)

file(GLOB TARGET_SOURCES "src/*.cpp")

add_library(${TARGET_NAME} SHARED ${TARGET_SOURCES})
target_include_directories(${TARGET_NAME} SYSTEM
                           PUBLIC ${modern_cpp_kafka_SOURCE_DIR}/include)
target_include_directories(${TARGET_NAME} PUBLIC include/)
target_link_libraries(${TARGET_NAME} PUBLIC ${SVT_UTILS} ${kafka-lib})

# Add the install target
install(
  TARGETS ${TARGET_NAME}
  RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR} # .dll on Windows
  LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR} # .so on Linux
  ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR} # .a or .lib
)
