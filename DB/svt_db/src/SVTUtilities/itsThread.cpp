#include "ITSUtilities/itsThread.h"
#include "ITSComm/itsDimChannel.h"
#include "ITSDetector/itsStave.h"


itsThread::itsThread (std::function<void(itsDimChannel*)> func, float minFrequency, float maxFrequency)
{
  mThreadFunction = func;
  mMinFrequency   = minFrequency;
  mMaxFrequency   = maxFrequency;
}


bool itsThread::dimEvent(itsDimChannel* dc) 
{
  struct pars commandParameters;
  float       upperParLimits[2] = {1.1, mMaxFrequency};
  float       lowerParLimits[2] = {0,   mMinFrequency};

  bool result = dc->getCommandParsString(commandParameters, upperParLimits, lowerParLimits);  
  if (!result) return false;

  if (commandParameters.intPars.at(0) > 0) {
    mFrequency = commandParameters.floatPars.at(0);
    dc->setIsThread(true);
    return start(dc);
  }
  else {
    return stop(dc);
  }
}


bool itsThread::start(itsDimChannel* dc) 
{
  mKeepRunning   = true;
  mStopRequested = false;
  if (mRunning) {
    if (getSuspended()) {
      setSuspended(false);
      return true; 
    }
    else {
      if (dc) {
        dc->setErrorMessage("Error, thread already running.", true, true);
      }
      else {
        ItsLogger::getInstance().logError("Error, start requested for already running thread");
      }
      return false;  // start thread only once
    }
  }

  // catch cases where previous execution has not been stopped correctly
  if (mThread.joinable()) mThread.join();
  setSuspended(false);
  mRunning       = true;  
  mThread        = std::thread(mThreadFunction, dc);

  return true;
}


bool itsThread::stop(itsDimChannel*)
{
  setSuspended(true);
  return true;  
}


ThreadStatus itsThread::getStatus()
{
  if (!mRunning) {
    return ThreadStatus::THREAD_STOPPED;
  }
  else if (mSuspended) {
    return ThreadStatus::THREAD_SUSPENDED;
  }
  else {
    return ThreadStatus::THREAD_RUNNING;
  }
}
