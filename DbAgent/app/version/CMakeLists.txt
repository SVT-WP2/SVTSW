cmake_minimum_required(VERSION 3.24)
project(git_version)

# # 1. Find the Git executable on the system find_package(Git QUIET)
#
# if(Git_FOUND) # 1. Check if the current directory is actually inside a Git
# work tree execute_process( COMMAND ${GIT_EXECUTABLE} rev-parse
# --is-inside-work-tree WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
# RESULT_VARIABLE is_git_repo OUTPUT_QUIET ERROR_QUIET)
#
# # 1. If it is a Git repo (exit code 0), run your desired Git command
# if(is_git_repo EQUAL 0) execute_process( COMMAND ${GIT_EXECUTABLE} describe
# --tags --dirty --always --long WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
# OUTPUT_STRIP_TRAILING_WHITESPACE OUTPUT_VARIABLE VERSION
# OUTPUT_STRIP_TRAILING_WHITESPACE) message(STATUS "Using git version:
# ${VERSION}") else() message(STATUS "Not a git repository.") endif() else()
# message(STATUS "Git not found on this system.") endif()

file(READ "${CMAKE_CURRENT_SOURCE_DIR}/.git_tag" RAW_VERSION)
string(STRIP ${RAW_VERSION} VERSION)

set(SRC ${CMAKE_CURRENT_SOURCE_DIR}/version.h.in)
set(DST ${CMAKE_CURRENT_BINARY_DIR}/version.h)
configure_file(${SRC} ${DST} @ONLY)
