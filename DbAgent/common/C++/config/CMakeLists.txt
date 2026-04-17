set(TARGET_NAME ${SVT_CONFIG})

if(NOT TARGET ${SVT_UTILS})
  add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../utils ${CMAKE_BINARY_DIR}/${SVT_UTILS})
endif()

file(GLOB TARGET_SOURCES "src/*.cpp")

add_library(${TARGET_NAME} SHARED ${TARGET_SOURCES})
target_include_directories(${TARGET_NAME} PUBLIC include/)
target_link_libraries(${TARGET_NAME} PRIVATE nlohmann_json::nlohmann_json)
target_link_libraries(${TARGET_NAME} PRIVATE ${SVT_UTILS})

# Add the install target
install(
  TARGETS ${TARGET_NAME}
  RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR} # .dll on Windows
  LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR} # .so on Linux
  ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR} # .a or .lib
)
