cmake_minimum_required(VERSION 3.24)

project(
  svt-db-agent
  VERSION 1.0.0
  LANGUAGES CXX)

include(FetchContent)
include(GNUInstallDirs)
find_package(Threads REQUIRED)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE
      RelWithDebInfo
      CACHE STRING "Build type" FORCE)
endif()

option(BUILD_TSAN "Compile with thread sanitizer" OFF)
option(BUILD_ASAN "Compile with address sanitizer" OFF)
option(BUILD_LSAN "Compile with leak sanitizer" OFF)
option(BUILD_UBSAN "Compile with undefined behaviour sanitizer" OFF)

add_compile_options(-Wall -Wextra -g -O2)

if(BUILD_TSAN)
  set(CMAKE_CXX_FLAGS
      "${CMAKE_CXX_FLAGS} -fsanitize=thread -fno-omit-frame-pointer")
  add_link_options("-fsanitize=thread")
endif()

if(BUILD_ASAN)
  set(CMAKE_CXX_FLAGS
      "${CMAKE_CXX_FLAGS} -fsanitize=address -fno-omit-frame-pointer")
  add_link_options("-fsanitize=address")
endif()

if(BUILD_LSAN)
  set(CMAKE_CXX_FLAGS
      "${CMAKE_CXX_FLAGS} -fsanitize=leak -fno-omit-frame-pointer")
  add_link_options("-fsanitize=leak")
endif()

if(BUILD_UBSAN)
  set(CMAKE_CXX_FLAGS
      "${CMAKE_CXX_FLAGS} -fsanitize=undefined -fno-omit-frame-pointer")
  add_link_options("-fsanitize=undefined")
endif()

if(APPLE)
  set(CMAKE_MACOSX_RPATH ON)
  set(CMAKE_INSTALL_RPATH "@loader_path/../lib")
else()
  set(CMAKE_INSTALL_RPATH "\$ORIGIN/../lib")
endif()

set(SVT_COMMON_CPP svt-common-cpp)
set(SVT_COMMON_CPP_SOURCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../common/C++")
set(SVT_COMMON_CPP_BINARY_DIR "${CMAKE_CURRENT_BINARY_DIR}/svt-common")

add_subdirectory(${SVT_COMMON_CPP_SOURCE_DIR} ${SVT_COMMON_CPP_BINARY_DIR})

#file(READ "${CMAKE_CURRENT_SOURCE_DIR}/version/.git_tag" RAW_VERSION)
#string(STRIP "${RAW_VERSION}" VERSION)
configure_file(${CMAKE_CURRENT_SOURCE_DIR}/version/version.h.in
               ${CMAKE_CURRENT_BINARY_DIR}/version.h @ONLY)

set(FETCHCONTENT_TRY_FIND_PACKAGE_MODE ALWAYS)
set(FETCHCONTENT_UPDATES_DISCONNECTED ON)

if(UNIX AND NOT APPLE)
  FetchContent_Declare(
    pqxx
    GIT_REPOSITORY https://github.com/jtv/libpqxx.git
    GIT_TAG 8.0.1
    FIND_PACKAGE_ARGS NAMES pqxx)

  set(SKIP_BUILD_TEST
      ON
      CACHE INTERNAL "")
  FetchContent_MakeAvailable(pqxx)
  set(PQXX_TARGET pqxx)
else()
  set(ENV{PKG_CONFIG_PATH}
      "/opt/homebrew/lib/postgresql@17/pkgconfig:/opt/homebrew/lib/pkgconfig:$ENV{PKG_CONFIG_PATH}"
  )
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(PQXX REQUIRED IMPORTED_TARGET libpqxx)
  set(PQXX_TARGET PkgConfig::PQXX)
endif()

FetchContent_Declare(
  magic_enum
  GIT_REPOSITORY https://github.com/Neargye/magic_enum.git
  GIT_TAG v0.9.8 # pinned release (was: master) - keep reproducible builds
  GIT_SHALLOW TRUE
  FIND_PACKAGE_ARGS NAMES magic_enum)
FetchContent_MakeAvailable(magic_enum)

set(SVT_DB_AGENT_LIBS Threads::Threads magic_enum::magic_enum ${PQXX_TARGET}
                      ${SVT_COMMON_CPP})

file(GLOB SVT_DB_AGENT_SOURCES "src/Database/*.cpp" "src/Config/*.cpp"
     "src/DbAgentDto/*.cpp" "src/DbAgentService/*.cpp")

set(TARGETS svt_db_agent)

add_executable(svt_db_agent src/svt_db_agent.cpp ${SVT_DB_AGENT_SOURCES})
target_include_directories(svt_db_agent PRIVATE include
                                                ${CMAKE_CURRENT_BINARY_DIR})
if(APPLE)
  target_include_directories(svt_db_agent SYSTEM PRIVATE ${PQXX_INCLUDE_DIRS})
endif()
target_link_libraries(svt_db_agent PRIVATE ${SVT_DB_AGENT_LIBS})

file(GLOB_RECURSE TEST_CPP_FILES "${CMAKE_CURRENT_SOURCE_DIR}/src/test/*.cpp")

foreach(CPP_FILE ${TEST_CPP_FILES})
  get_filename_component(EXECUTABLE_NAME ${CPP_FILE} NAME_WE)
  list(APPEND TARGETS ${EXECUTABLE_NAME})

  add_executable(${EXECUTABLE_NAME} ${CPP_FILE} ${SVT_DB_AGENT_SOURCES})
  target_include_directories(${EXECUTABLE_NAME}
                             PRIVATE include ${CMAKE_CURRENT_BINARY_DIR})
  if(APPLE)
    target_include_directories(${EXECUTABLE_NAME} SYSTEM
                               PRIVATE ${PQXX_INCLUDE_DIRS})
  endif()
  target_link_libraries(${EXECUTABLE_NAME} PRIVATE ${SVT_DB_AGENT_LIBS})
endforeach()

install(
  TARGETS ${TARGETS}
  RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
  LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
  ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR})
