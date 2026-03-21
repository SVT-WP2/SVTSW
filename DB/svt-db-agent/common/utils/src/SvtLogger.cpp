/*!
 * @file SvtLogger.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Logger implementation
 */

#include <stdarg.h>
#include <bitset>
#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>

#include "SvtLogger.h"
using SvtUtils::SvtLogger;

void logInfo(const std::string &msg, uint32_t severity)
{
  LogInstance.logInfo(msg, severity);
}

void logError(const std::string &msg, uint32_t severity)
{
  LogInstance.logError(msg, severity);
}

void logWarning(const std::string &msg, uint32_t severity)
{
  LogInstance.logWarning(msg, severity);
}

void logDebug(const std::string &msg, uint32_t severity)
{
  LogInstance.logDebug(msg, severity);
}

void logSummary(const std::string &msg, uint32_t severity)
{
  LogInstance.logSummary(msg, severity);
}

void logLive(const std::string &msg, bool isEnd, uint32_t severity)
{
  LogInstance.logLive(msg, isEnd, severity);
}

void setLogVerbosity(SvtLogger::Mode termVerbosity, SvtLogger::Mode fileVerbosity)
{
  LogInstance.setVerbosity(termVerbosity, fileVerbosity);
}

void setLogFile(const std::string &filename)
{
  LogInstance.setFile(filename);
}

void configureLogger(const std::string &filename, SvtLogger::Mode termVerbosity, SvtLogger::Mode fileVerbosity)
{
  LogInstance.configure(filename, termVerbosity, fileVerbosity);
}

void closeLogFile()
{
  LogInstance.closeFile();
}

uint64_t getTimestamp()
{
  return LogInstance.getTimestamp();
}

std::string getTime(SvtLogger::TimestampFormat format)
{
  return LogInstance.getTime(format);
}

//========================================================================+
SvtLogger::SvtLogger() = default;

//========================================================================+
uint64_t SvtLogger::getTimestamp() const
{
  return static_cast<uint64_t>(
      std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch())
          .count());
}

//========================================================================+
std::string SvtLogger::getTime(TimestampFormat format) const
{
  uint64_t msSinceEpoch = getTimestamp();

  // Split into seconds and milliseconds
  std::time_t secondsPart = msSinceEpoch / 1000;
  uint64_t millisPart = msSinceEpoch % 1000;

  std::tm *tmTime = std::localtime(&secondsPart);

  std::ostringstream oss;
  switch (format)
  {
  case TimestampFormat::DATE_TIME:
    oss << std::put_time(tmTime, "%Y-%m-%d %H:%M:%S");
    break;
  case TimestampFormat::DATE_TIME_MILLIS:
    oss << std::put_time(tmTime, "%Y-%m-%d %H:%M:%S");
    oss << '.' << std::setw(3) << std::setfill('0') << millisPart;
    break;
  case TimestampFormat::TIME:
    oss << std::put_time(tmTime, "%H:%M:%S");
    break;
  case TimestampFormat::TIME_MILLIS:
    oss << std::put_time(tmTime, "%H:%M:%S");
    oss << '.' << std::setw(3) << std::setfill('0') << millisPart;
    break;
  }

  return oss.str();
}

//========================================================================+
void SvtLogger::logError(const std::string &msg, uint32_t severity)
{
  log(std::string(ANSI_COLOR_RED) + "ERROR: [" + getTime() +
          "]: " + ANSI_COLOR_RESET,
      msg, severity);
}

//========================================================================+
void SvtLogger::logWarning(const std::string &msg, uint32_t severity)
{
  log(std::string(ANSI_COLOR_YELLOW) + "WARNING: [" + getTime() +
          "]: " + ANSI_COLOR_RESET,
      msg, severity);
}

//========================================================================+
void SvtLogger::logInfo(const std::string &msg, uint32_t severity)
{
  log(std::string(ANSI_COLOR_GREEN) + "INFO [" + getTime() +
          "]: " + ANSI_COLOR_RESET,
      msg, severity);
}

//========================================================================+
void SvtLogger::logDebug(const std::string &msg, uint32_t severity)
{
  log(std::string(ANSI_COLOR_BLUE) + "DEBUG [" + getTime() +
          "]: " + ANSI_COLOR_RESET,
      msg, severity);
}

//========================================================================+
void SvtLogger::logSummary(const std::string &msg, uint32_t severity)
{
  log(std::string(ANSI_COLOR_WHITE) + "SUMMARY " + ANSI_COLOR_BLUE + "[" +
          getTime() + "]: " + ANSI_COLOR_RESET,
      msg, severity);
}

//========================================================================+
void SvtLogger::logLive(const std::string &msg, bool isEnd, uint32_t severity)
{
  if (severity <= mTermVerbosity)
  {
    mTerminal << "\r" << ANSI_COLOR_GREEN << "LIVE [" << getTime()
              << "]: " << ANSI_COLOR_RESET << msg;
    if (isEnd)
    {
      mTerminal << "\n";  // Move to next line when ending
    }
    mTerminal << std::flush;
  }
  if (severity <= mFileVerbosity)
  {
    if (mLogfile.is_open())
    {
      mLogfile << "[" << getTime() << "]: " << msg << std::endl;
    }
  }
}

//========================================================================+
void SvtLogger::log(const std::string &type, const std::string &msg,
                    uint32_t severity)
{
  std::string fullMessage = stripAnsi(type) + msg;

  if (severity <= mTermVerbosity)
  {
    mTerminal << type << msg << std::endl;
  }
  if (severity <= mFileVerbosity)
  {
    if (mLogfile.is_open())
    {
      mLogfile << fullMessage << std::endl;
    }
  }
}

//========================================================================+
void SvtLogger::closeFile()
{
  if (mLogfile.is_open())
  {
    mLogfile.close();
  }
}

//========================================================================+
void SvtLogger::setVerbosity(SvtLogger::Mode termVerbosity,
                             SvtLogger::Mode fileVerbosity)
{
  mTermVerbosity = termVerbosity;
  mFileVerbosity = fileVerbosity;
}

//========================================================================+
void SvtLogger::setFile(const std::string &filename)
{
  std::string time = getTime();
  std::string date = time.substr(0, time.find(' '));

  std::string _filename = filename + "-" + date + ".log";
  logInfo(_filename);

  if (mLogfile.is_open())
  {
    mLogfile.close();
  }
  mLogfile.open(_filename, std::ios::app);
  if (!mLogfile.is_open())
  {
    logError("Failed to open log file: " + filename);
  }
}

//========================================================================+
void SvtLogger::configure(const std::string &filename,
                          SvtLogger::Mode termVerbosity,
                          SvtLogger::Mode fileVerbosity)
{
  setVerbosity(termVerbosity, fileVerbosity);
  if (filename == "none")
  {
    logWarning(
        "No logFileName provided, log informations will not be saved to any file");
  }
  else
  {
    setFile(filename);
  }
}

//========================================================================+
std::string SvtLogger::to_hex(uint64_t inValue, int width)
{
  std::stringstream ss;
  ss << "0x" << std::uppercase << std::setfill('0') << std::setw(width)
     << std::hex << inValue;
  return ss.str();
}

//========================================================================+
std::string SvtLogger::to_bin(uint32_t inValue, int width)
{
  std::stringstream ss;
  ss << "0b" << std::uppercase << std::setfill('0') << std::setw(width);
  ss << std::bitset<32>(inValue).to_string().substr(32 - width);
  return ss.str();
}

//========================================================================+
std::string SvtLogger::to_bin(uint64_t inValue, int width)
{
  std::stringstream ss;
  ss << "0b" << std::uppercase << std::setfill('0') << std::setw(width);
  ss << std::bitset<64>(inValue).to_string().substr(64 - width);
  return ss.str();
}

//========================================================================+
std::string SvtLogger::to_bool(bool inValue)
{
  return inValue ? "true" : "false";
}

//========================================================================+
std::string SvtLogger::to_scientific(double value, int precision)
{
  std::ostringstream oss;
  oss << std::scientific << std::setprecision(precision) << value;
  return oss.str();
}

//========================================================================+
std::string SvtLogger::stripAnsi(const std::string &input)
{
  std::string output;
  bool inEscape = false;
  for (char c : input)
  {
    if (c == '\033')
    {
      inEscape = true;
    }
    else if (inEscape && c == 'm')
    {
      inEscape = false;
    }
    else if (!inEscape)
    {
      output += c;
    }
  }
  return output;
}
