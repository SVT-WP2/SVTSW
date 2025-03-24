#include "SVTUtilities/SvtLogger.h"

#include <stdarg.h>
#include <ctime>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <sstream>

//========================================================================+
SvtLogger::SvtLogger()
  : logVerbosity_(0U)
  , logVerbosityFile_(0U)
  , msgId_(0U)
{
  std::lock_guard<std::mutex> lock(mutex_);
  std::time_t time_now = std::time(nullptr);
  std::stringstream ss;
  ss << std::put_time(std::localtime(&time_now), "%Y-%m-%d");
  std::string date(ss.str());

  char *logFilePath = getenv("SVT_DB_AGENT_LOG_FILE");
  if (logFilePath == nullptr)
    logFileRoot_ = "./Svt_db_agent";
  else
    logFileRoot_ = std::string(logFilePath);
  logFileName_ = logFileRoot_ + "-" + date + ".log";

  logFile_.open(logFileName_, std::ios::app);
  if (!logFile_.is_open() || !logFile_.good())
  {
    logFileName_ = "";  //
    std::cerr << "SvtLogger::log unable to create the file " << logFileName_
              << std::endl;
  }

  char *logVer = getenv("SVT_DB_AGENT_LOG_VERBOSITY");
  if (logVer != nullptr)
  {
    if (std::string(logVer).find("STANDARD") != std::string::npos)
      logVerbosity_ = Mode::STANDARD;
    else if (std::string(logVer).find("VERBOSE") != std::string::npos)
      logVerbosity_ = Mode::VERBOSE;
    else if (std::string(logVer).find("ALL") != std::string::npos)
      logVerbosity_ = Mode::ALL;
    else
      logVerbosity_ = Mode::STANDARD;
  }
  else
    logVerbosity_ = Mode::STANDARD;

  logVerbosityFile_ = logVerbosity_;
}

//========================================================================+
SvtLogger::~SvtLogger()
{
  std::lock_guard lock(mutex_);
  logFile_.close();
}

//========================================================================+
bool SvtLogger::setLogVerbosityFile(uint32_t verbosity)
{
  if (verbosity > Mode::ALL)
  {
    return false;
  }
  else
  {
    std::lock_guard lock(mutex_);
    logVerbosityFile_ = verbosity;
    return true;
  }
}

//========================================================================+
void SvtLogger::logError(std::string message, uint32_t severity)
{
  if ((severity <= logVerbosity_) || (severity <= logVerbosityFile_))
  {
    // if (dimChannel != "")
    //   message = "DIM channel " + dimChannel + ": " + message;
    this->log(std::string(ANSI_COLOR_RED) + "ERROR" + ANSI_COLOR_RESET, message,
              severity);
  }
}

//========================================================================+
void SvtLogger::logWarning(std::string message, uint32_t severity)
{
  if ((severity <= logVerbosity_) || (severity <= logVerbosityFile_))
  {
    this->log(std::string(ANSI_COLOR_YELLOW) + "WARNING" + ANSI_COLOR_RESET,
              message, severity);
  }
}

//========================================================================+
void SvtLogger::logInfo(std::string message, uint32_t severity)
{
  if ((severity <= logVerbosity_) || (severity <= logVerbosityFile_))
  {
    this->log(std::string(ANSI_COLOR_GREEN) + "INFO" + ANSI_COLOR_RESET,
              message, severity);
  }
}

// logs one message, adds date
//========================================================================+
void SvtLogger::log(const std::string type, const std::string message,
                    uint32_t severity)
{
  std::string desiredLogFile = "";
  std::string logMsg = "";
  {
    std::lock_guard lock(mutex_);
    // get timestamps
    std::time_t time_now = std::time(nullptr);
    std::stringstream ss;
    ss << std::put_time(std::localtime(&time_now), "%Y-%m-%d");
    std::string date = ss.str();
    ss << std::put_time(std::localtime(&time_now), " %OH:%OM:%OS");
    std::string time = ss.str();

    // get message id
    std::stringstream ssMsgId;
    ssMsgId << std::setfill('0') << std::setw(10) << msgId_++;

    desiredLogFile = logFileRoot_ + "-" + date + ".log";
    logMsg = time + "::" + ssMsgId.str() + "::[" + type + "]:" + message + "\n";

    if (severity <= logVerbosityFile_)
    {
      if (logFileName_ != desiredLogFile)
      {
        logFile_.close();
        logFile_.open(desiredLogFile, std::ios::app);
        if (logFile_.is_open())
        {
          if (!logFile_.fail())
            logFileName_ = desiredLogFile;
        }
        else
        {
          std::cerr << "SvtLogger::log unable to create the file "
                    << desiredLogFile << std::endl;
          return;
        }
      }
      logFile_ << logMsg;
      logFile_.flush();
    }
  }

  if (severity <= logVerbosity_)
    std::cout << logMsg;  // is thread-safe
}

//========================================================================+
std::string SvtLogger::to_hex(uint32_t inValue) const
{
  std::stringstream ss;
  ss << "0x" << std::uppercase << std::setfill('0') << std::setw(8) << std::hex
     << inValue;
  return ss.str();
}

//========================================================================+
std::string SvtLogger::to_hex(std::vector<uint32_t> &inVect) const
{
  std::string ss = " ";
  // for(auto itinVect : inVect) ss += SvtLogger::to_hex(inVect[i])+"\n";
  for (uint32_t i = 0; i < inVect.size(); ++i)
    ss += SvtLogger::to_hex(inVect[i]) + " ";
  return ss;
}

//========================================================================+
std::string SvtLogger::to_hex(std::vector<int> &inVect) const
{
  std::string ss = " ";
  // for(auto itinVect : inVect) ss += SvtLogger::to_hex(inVect[i])+"\n";
  for (uint32_t i = 0; i < inVect.size(); ++i)
    ss += SvtLogger::to_hex(inVect[i]) + " ";
  return ss;
}

//========================================================================+
std::string SvtLogger::to_dec(uint32_t inValue) const
{
  std::stringstream ss;
  ss << std::setfill('0') << std::setw(8) << inValue;
  return ss.str();
}

//========================================================================+
std::string SvtLogger::to_dec(std::vector<uint32_t> &inVect) const
{
  std::string ss = " ";
  // for(auto itinVect : inVect) ss += SvtLogger::to_hex(inVect[i])+"\n";
  for (uint32_t i = 0; i < inVect.size(); ++i)
    ss += SvtLogger::to_dec(inVect[i]) + " ";
  return ss;
}

//========================================================================+
std::string SvtLogger::to_dec_d(double inValue) const
{
  return std::to_string(inValue);
}

//========================================================================+
std::string SvtLogger::to_dec_d(std::vector<double> &inVect) const
{
  std::string ss = " ";
  for (uint32_t i = 0; i < inVect.size(); ++i)
  {
    ss += SvtLogger::to_dec_d(inVect[i]) + " ";
  }
  return ss;
}
