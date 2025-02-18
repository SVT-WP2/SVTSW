#ifndef ITSTIMER_H
#define ITSTIMER_H

#include "ITSUtilities/ItsGlobalTimer.h"
#include <chrono>
#include <map>


class ItsTimer
{
public:
    ItsTimer(double timeout=0);
	~ItsTimer();
	
    void reset();
    void setTimeoutLenghtsMS(double);

    double elapsedTimeMS();
    double elapsedTimeUS();

   // void startLapTime(std::string&);
   // void stopLapTime(std::string&);
   // double elapsedLapTime(std::string&);
    bool isTimedOut();
private:
    
    
    std::chrono::time_point<std::chrono::steady_clock> start_;	
    std::chrono::time_point<std::chrono::steady_clock> now_;
    // std::chrono::time_point<std::chrono::steady_clock> time_point;
     

    double timeoutLenghtMS_;
    ItsGlobalTimer gTimer_=  ItsGlobalTimer::getInstance();

};
#endif

