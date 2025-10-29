#pragma once

#include <string>
#include <thread>

#include "SvtLogger.h"
#include "SvtUtilities.h"

namespace SvtKafka
{
  using SvtUtils::Singleton;
  using SvtUtils::SvtLogger;
  class SvtKafkaThread
  {
   public:
    SvtKafkaThread() = default;
    ~SvtKafkaThread()
    {
      if (mThread.joinable())
      {
        mThread.join();
      }
    };

    bool getIsRunning() { return mRunning; }
    bool getSuspended() { return mSuspended; }

    void setIsRunning(const bool running) { mRunning = running; }
    void setSuspended(const bool suspended) { mSuspended = suspended; }
    void setName(const std::string& name) { mName = name; }

    bool start(std::function<void()> fun)
    {
      if (mRunning)
      {
        if (getSuspended())
        {
          setSuspended(false);
          return true;
        }
        else
        {
          mLogger->logError("Error, start requested for already running thread");
          return false;  // start thread only once
        }
      }

      if (mThread.joinable())
      {
        mThread.join();
      }
      setSuspended(false);
      mRunning = true;
      mThread = std::thread(fun);

      return true;
    }

    bool stop(const bool suspended = false)
    {
      if (suspended)
      {
        mLogger->logWarning("Suspended thread " + this->name());
        setSuspended(true);
        return true;
      }
      mLogger->logWarning("Stopping thread " + this->name());
      setIsRunning(false);
      if (mThread.joinable())
      {
        mThread.join();
      }
      return true;
    };

    std::string& name() { return mName; }

   private:
    SvtLogger* mLogger = Singleton<SvtLogger>::instance();
    std::thread mThread;

    std::atomic<bool> mRunning = false;
    std::atomic<bool> mSuspended = false;
    std::string mName;
  };

};  // namespace SvtKafka
