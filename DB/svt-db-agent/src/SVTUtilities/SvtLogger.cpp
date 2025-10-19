/*!
 * @file SvtLogger.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Logger implementation
 */

#include <stdarg.h>
#include <bitset>
#include <ctime>
#include <iomanip>
#include <mutex>
#include <sstream>

#include "SVTUtilities/SvtLogger.h"

//========================================================================+
SvtLogger::SvtLogger() = default;

//========================================================================+
SvtLogger::~SvtLogger() { closeFile(); }

//========================================================================+
std::string SvtLogger::getTime()
{
  std::lock_guard<std::mutex> lock(mutex_);
  std::time_t timer =
      std::chrono::system_clock::to_time_t(std::chrono::system_clock::now());
  struct tm timeinfo;
  localtime_r(&timer, &timeinfo);
  std::stringstream ss;
  ss << std::put_time(&timeinfo, "%d-%m-%Y %X");
  return ss.str();
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
  std::lock_guard lock(mutex_);

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
  std::lock_guard<std::mutex> lock(mutex_);
  if (mLogfile.is_open())
  {
    mLogfile.close();
  }
}

//========================================================================+
void SvtLogger::setVerbosity(SvtLogger::Mode termVerbosity,
                             SvtLogger::Mode fileVerbosity)
{
  std::lock_guard<std::mutex> lock(mutex_);
  mTermVerbosity = termVerbosity;
  mFileVerbosity = fileVerbosity;
}

//========================================================================+
void SvtLogger::setFile(const std::string &filename)
{
  std::string time = getTime();
  std::string date = time.substr(0, time.find(' '));

  std::string _filename = filename + "-" + date + ".log";

  std::lock_guard<std::mutex> lock(mutex_);

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
        "No logFileName provided, log informations will not be saved to "
        "any file");
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

/*
 * @param inValue: the value to convert to binary
 * @param width: the width of the binary string
 * @return: the binary string
 */
//========================================================================+
std::string SvtLogger::to_bin(uint32_t inValue, int width)
{
  std::stringstream ss;
  ss << "0b" << std::uppercase << std::setfill('0') << std::setw(width);
  ss << std::bitset<32>(inValue).to_string().substr(32 - width);
  return ss.str();
}

/*
 * @param inValue: the value to convert to binary
 * @param width: the width of the binary string
 * @return: the binary string
 */
//========================================================================+
std::string SvtLogger::to_bin(uint64_t inValue, int width)
{
  std::stringstream ss;
  ss << "0b" << std::uppercase << std::setfill('0') << std::setw(width);
  ss << std::bitset<64>(inValue).to_string().substr(64 - width);
  return ss.str();
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
