#pragma once

/*!
 * @file SvtLogger.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief SVT db-agent logger
 */

#include <cstdint>
#include <fstream>
#include <iostream>
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
                           std::to_string(__LINE__) + "]\n" + msg)
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

    enum class TimestampFormat
    {
      DATE_TIME,
      DATE_TIME_MILLIS,
      TIME,
      TIME_MILLIS
    };

   private:
    std::ofstream mLogfile;
    std::ostream &mTerminal = std::cout;

    uint32_t mTermVerbosity = Mode::VERBOSE;
    uint32_t mFileVerbosity = Mode::VERBOSE;

    void log(const std::string &type, const std::string &msg, uint32_t severity);

   public:
    SvtLogger();
    ~SvtLogger() = default;

    void logError(const std::string &msg, uint32_t severity = Mode::PRODUCTION);
    void logWarning(const std::string &msg, uint32_t severity = Mode::STANDARD);
    void logInfo(const std::string &msg, uint32_t severity = Mode::VERBOSE);
    void logDebug(const std::string &msg, uint32_t severity = Mode::DEBUG);
    void logSummary(const std::string &msg, uint32_t severity = Mode::PRODUCTION);
    void logLive(const std::string &msg, bool isEnd = false,
                 uint32_t severity = Mode::PRODUCTION);
    static std::string to_hex(uint64_t inValue, int width = 8);
    /* @brief Convert int to hex string

    * @param inValue: the value to convert to binary
    * @param width: the width of the binary string
    * @return: the binary string
    */
    static std::string to_bin(uint32_t inValue, int width = 8);
    /* @brief Convert int to binary string

    * @param inValue: the value to convert to binary
    * @param width: the width of the binary string
    * @return: the binary string
    */
    static std::string to_bin(uint64_t inValue, int width = 8);
    /* @brief Convert boolean to string

     * @param inValue: the value to convert to boolean string
     * @return: the boolean string
     */
    static std::string to_bool(bool inValue);
    /* @brief Convert double to scientific notation string

    * @param value: the value to format in scientific notation
    * @param precision: the number of decimal places
    * @return: the formatted string in scientific notation
    */
    static std::string to_scientific(double value, int precision = 2);
    std::string stripAnsi(const std::string &input);
    void setVerbosity(Mode termVerbosity, Mode fileVerbosity);
    void setFile(const std::string &filename);
    void configure(const std::string &filename = "none",
                   Mode termVerbosity = Mode::VERBOSE,
                   Mode fileVerbosity = Mode::VERBOSE);
    void closeFile();
    std::string getTime(TimestampFormat format = SvtLogger::TimestampFormat::DATE_TIME_MILLIS) const;
    uint64_t getTimestamp() const;
  };

}  // namespace SvtUtils

inline static SvtUtils::SvtLogger LogInstance;

void logError(const std::string &msg, uint32_t severity = SvtUtils::SvtLogger::Mode::PRODUCTION);
void logWarning(const std::string &msg, uint32_t severity = SvtUtils::SvtLogger::Mode::STANDARD);
void logInfo(const std::string &msg, uint32_t severity = SvtUtils::SvtLogger::Mode::VERBOSE);
void logDebug(const std::string &msg, uint32_t severity = SvtUtils::SvtLogger::Mode::DEBUG);
void logSummary(const std::string &msg, uint32_t severity = SvtUtils::SvtLogger::Mode::PRODUCTION);
void logLive(const std::string &msg, bool isEnd = false, uint32_t severity = SvtUtils::SvtLogger::Mode::PRODUCTION);
void setLogVerbosity(SvtUtils::SvtLogger::Mode termVerbosity, SvtUtils::SvtLogger::Mode fileVerbosity);
void setLogFile(const std::string &filename);
void configureLogger(const std::string &filename = "none", SvtUtils::SvtLogger::Mode termVerbosity = SvtUtils::SvtLogger::Mode::VERBOSE,
                     SvtUtils::SvtLogger::Mode fileVerbosity = SvtUtils::SvtLogger::Mode::VERBOSE);
void closeLogFile();
std::string getTime(SvtUtils::SvtLogger::TimestampFormat format = SvtUtils::SvtLogger::TimestampFormat::DATE_TIME_MILLIS);
uint64_t getTimestamp();
