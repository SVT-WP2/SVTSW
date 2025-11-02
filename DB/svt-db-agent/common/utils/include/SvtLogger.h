#pragma once

/*!
 * @file SvtLogger.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief SVT db-agent logger
 */

#include <fstream>
#include <iostream>
#include <mutex>
#include <string>

#define ANSI_COLOR_RED "\x1b[31m"
#define ANSI_COLOR_GREEN "\x1b[32m"
#define ANSI_COLOR_YELLOW "\x1b[33m"
#define ANSI_COLOR_RESET "\x1b[0m"
#define ANSI_COLOR_BLUE "\x1b[38;5;27m"
#define ANSI_COLOR_CYAN "\x1b[36m"
#define ANSI_COLOR_WHITE "\x1b[37m"

#define THROW_RUNTIME_ERROR(msg)                               \
  throw std::runtime_error("[" + std::string(__FILE__) + ":" + \
                           std::to_string(__LINE__) + "\n] " + msg)
namespace SvtUtils
{
  class SvtLogger
  {
   public:
    enum Mode
    {
      PRODUCTION,
      STANDARD,
      VERBOSE,
      DEBUG,
      ALL
    };

   private:
    std::ofstream mLogfile;
    std::ostream &mTerminal = std::cout;

    uint32_t mTermVerbosity = Mode::VERBOSE;
    uint32_t mFileVerbosity = Mode::VERBOSE;

    std::mutex mutex_;

    void log(const std::string &type, const std::string &msg, uint32_t severity);

    std::string getTime();

   public:
    SvtLogger();
    ~SvtLogger();

    void logError(const std::string &msg, uint32_t severity = Mode::PRODUCTION);
    void logWarning(const std::string &msg, uint32_t severity = Mode::STANDARD);
    void logInfo(const std::string &msg, uint32_t severity = Mode::VERBOSE);
    void logDebug(const std::string &msg, uint32_t severity = Mode::DEBUG);
    void logSummary(const std::string &msg, uint32_t severity = Mode::PRODUCTION);
    void logLive(const std::string &msg, bool isEnd = false,
                 uint32_t severity = Mode::PRODUCTION);

    static std::string to_hex(uint64_t inValue, int width = 8);
    static std::string to_bin(uint32_t inValue, int width = 8);
    static std::string to_bin(uint64_t inValue, int width = 8);

    std::string stripAnsi(const std::string &input);

    void setVerbosity(Mode termVerbosity, Mode fileVerbosity);
    void setFile(const std::string &filename);
    void configure(const std::string &filename = "none",
                   Mode termVerbosity = Mode::VERBOSE,
                   Mode fileVerbosity = Mode::VERBOSE);
    void closeFile();
  };

}  // namespace SvtUtils
