#ifndef ITSTHREAD_H
#define ITSTHREAD_H

#include <thread>
#include <atomic>
#include <functional>
#include "ITSUtilities/ItsLogger.h"

class itsDimChannel;
class itsStave;


enum class ThreadStatus {
  THREAD_STOPPED, 
  THREAD_RUNNING,
  THREAD_SUSPENDED
};


class itsThread {
  private:
    ItsLogger& logger_ = ItsLogger::getInstance();
    std::thread        mThread;
    std::atomic <bool> mRunning       = false;
    std::atomic <bool> mKeepRunning   = true;
    std::atomic <bool> mSuspended     = false;
    std::atomic <bool> mWasSuspended  = true;
    std::atomic <bool> mStopRequested = false;
    float              mMinFrequency;
    float              mMaxFrequency;    
    float              mFrequency;

    std::function<void(itsDimChannel*)> mThreadFunction;
  public:
    itsThread (std::function<void(itsDimChannel*)> func, float minFrequency = 0.001, float maxFrequency = 10);
    ~itsThread() {};
    bool dimEvent       (itsDimChannel* dc);
    bool start          (itsDimChannel* dc);
    bool stop           (itsDimChannel* dc);
    bool getKeepRunning ()                  {return mKeepRunning;};
    void setKeepRunning (bool keepRunning)  {mKeepRunning = keepRunning;};
    void setIsRunning   (bool running)      {mRunning = running;};
    bool getIsRunning   ()                  {return mRunning;};
    void setSuspended   (bool suspended)    {mSuspended = suspended;};
    bool getSuspended   ()                  {return mSuspended;};
    bool getWasSuspended()                  {return mWasSuspended;};
    void setWasSuspended(bool suspended)    {mWasSuspended = suspended;};
    int  getWaitTime    ()                  {return ((int)(1000.f / mFrequency));};
    ThreadStatus getStatus();
};

#endif
