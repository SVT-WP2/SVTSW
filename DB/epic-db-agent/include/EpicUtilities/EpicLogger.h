#ifndef EPIC_LOGGER_H
#define EPIC_LOGGER_H

/*!
 * @file EpicLogger.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Epic db-agent logger
 */

#include "EpicUtilities.h"

#include <fstream>
#include <mutex>
#include <string>
#include <vector>

#define ANSI_COLOR_RED "\x1b[31m"
#define ANSI_COLOR_GREEN "\x1b[32m"
#define ANSI_COLOR_YELLOW "\x1b[33m"
#define ANSI_COLOR_RESET "\x1b[0m"
#define ANSI_COLOR_BLUE "\x1b[38;5;27m"

class EpicLogger
{
 public:
  EpicLogger();
  ~EpicLogger();

  enum Mode
  {
    STANDARD,
    VERBOSE,
    ALL
  };

  void logError(std::string msg, uint32_t severity = Mode::STANDARD);
  void logWarning(std::string msg, uint32_t severity = Mode::VERBOSE);
  void logInfo(std::string msg, uint32_t severity = Mode::ALL);

  uint32_t getLogVerbosity()
  {
    std::lock_guard lock(mutex_);
    return logVerbosity_;
  };
  uint32_t getLogVerbosityFile()
  {
    std::lock_guard lock(mutex_);
    return logVerbosityFile_;
  };

  bool setLogVerbosityFile(uint32_t verbosity);

  std::string to_hex(uint32_t) const;
  std::string to_hex(std::vector<uint32_t> &) const;
  std::string to_hex(std::vector<int> &) const;

  std::string to_dec(uint32_t) const;
  std::string to_dec(std::vector<uint32_t> &) const;

  std::string to_dec_d(double) const;
  std::string to_dec_d(std::vector<double> &) const;

  std::string success() const { return "SUCCESS"; };
  std::string failure() const { return "FAILURE"; };

 private:
  void log(const std::string type, const std::string message,
           uint32_t severity);
  std::string logFileRoot_;
  std::string logFileName_;
  std::ofstream logFile_;

  uint32_t logVerbosity_;
  uint32_t logVerbosityFile_;
  uint32_t msgId_;
  std::mutex mutex_;
};
#endif
