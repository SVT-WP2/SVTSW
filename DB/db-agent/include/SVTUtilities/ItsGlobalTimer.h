#ifndef ITSGLOBALTIMER_H
#define ITSGLOBALTIMER_H

#include <chrono>


class ItsGlobalTimer
{
public:
    ItsGlobalTimer();
	static ItsGlobalTimer &getInstance();

    double getThicksMS();
    double getTicksInSeconds();
    std::chrono::time_point<std::chrono::system_clock> getSystemTimeNow();
    
private:
  
    std::chrono::time_point<std::chrono::steady_clock> start_;	
    std::chrono::time_point<std::chrono::steady_clock> now_;
    //std::chrono::time_point<std::chrono::system_clock> walltimeNow_;
    // std::chrono::time_point<std::chrono::steady_clock> time_point;

};
#endif

