cmake_minimum_required(VERSION 3.1)
set(CMAKE_CXX_STANDARD 17)
project(svt-db-agent)

include_directories(include ${CMAKE_CURRENT_BINARY_DIR})
link_libraries(stdc++fs)

option(BUILD_TSAN "Compile with thread sanitizer" OFF)
option(BUILD_ASAN "Compile with address sanitizer" OFF)
option(BUILD_LSAN "Compile with leak sanitizer" OFF)
option(BUILD_UBSAN "Compile with undefined behaviour sanitizer" OFF)

# add_definitions("-DTIXML_USE_STL")
add_compile_options("-Wall" "-Wextra" "-g" "-O2")
add_link_options("-lstdc++" "-ldl")
SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wno-unknown-pragmas -Wno-conversion -Wpedantic -Wshadow -Wdouble-promotion -Wformat=2 -Wformat-truncation -Wundef -Wdeprecated -fno-common -fasynchronous-unwind-tables -Wl,-z,defs -D_FORTIFY_SOURCE=2 -D_GLIBCXX_ASSERTIONS" )

if(BUILD_TSAN)
  SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=thread -fno-omit-frame-pointer")
  add_link_options("-fsanitize=thread")
endif(BUILD_TSAN)
if(BUILD_ASAN)
  SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=address -fno-omit-frame-pointer")
  add_link_options("-fsanitize=address")
endif(BUILD_ASAN)
if(BUILD_LSAN)
  SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=leak -fno-omit-frame-pointer")
  add_link_options("-fsanitize=leak")
endif(BUILD_LSAN)
if(BUILD_UBSAN)
  SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=undefined -fno-omit-frame-pointer")
  add_link_options("-fsanitize=undefined")
endif(BUILD_UBSAN)

set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY lib)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY lib)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY bin)
set(CMAKE_BUILD_TYPE RelWithDebInfo)

file(GLOB SOURCES_DB
  "src/SVTUtilities/SvtUtilities.cpp"
  "src/SVTUtilities/SvtLogger.cpp"
  "src/Database/databaseinterface.cpp"
  "src/Database/multitype.cpp"
  "src/SVTDb/sqlmapi.cpp"
  "src/SVTDb/SvtDbInterface.cpp"
  "src/SVTDbAgentDto/SvtDbEnumDto.cpp"
  "src/SVTDbAgentDto/SvtDbWaferTypeDto.cpp"
  "src/SVTDbAgentDto/SvtDbWaferDto.cpp"
  "src/SVTDbAgentDto/SvtDbAsicDto.cpp"
  "src/SVTDbAgentDto/SvtDbWPMachineDto.cpp"
  "src/SVTDbAgentDto/SvtDbWPProjectDto.cpp"
  "src/SVTDbAgentDto/SvtDbProbeCardDto.cpp"
  "src/SVTDbAgentService/SvtDbAgentConsumer.cpp"
  "src/SVTDbAgentService/SvtDbAgentProducer.cpp"
  "src/SVTDbAgentService/SvtDbAgentRequest.cpp"
  "src/SVTDbAgentService/SvtDbAgentService.cpp"
)

add_custom_target(version
  BYPRODUCTS ${CMAKE_CURRENT_BINARY_DIR}/version.h
  COMMAND ${CMAKE_COMMAND}
    -D SRC=${CMAKE_CURRENT_SOURCE_DIR}/include/version.h.in
    -D DST=${CMAKE_CURRENT_BINARY_DIR}/version.h
    -P ${CMAKE_CURRENT_SOURCE_DIR}/cmake/version.cmake
  DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/include/version.h.in
  DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/cmake/version.cmake
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
)

add_subdirectory(deps/libpqxx build-pqxx)

set(JSON_BuildTests OFF CACHE INTERNAL "")
add_subdirectory(deps/nlohmann_json build-nlohmann_json)

add_executable(svt_db_agent "src/svt_db_agent.cpp" ${SOURCES_DB})
add_dependencies(svt_db_agent version)

add_executable(db_IF_test "src/db_IF_test.cpp" ${SOURCES_DB})
add_dependencies(db_IF_test version)

set(svt_db_agent_lib pqxx rdkafka++ nlohmann_json::nlohmann_json pthread)
target_link_libraries(svt_db_agent PRIVATE ${svt_db_agent_lib})
target_link_libraries(db_IF_test PRIVATE ${svt_db_agent_lib})
