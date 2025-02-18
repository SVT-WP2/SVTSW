#include "ITSUtilities/ItsTimer.h"

ItsTimer::ItsTimer(double timeout)
{
    this->reset();	
    timeoutLenghtMS_=timeout;
}

ItsTimer::~ItsTimer()
{
}

void ItsTimer::reset()
{
    start_= std::chrono::steady_clock::now();
}
    
void ItsTimer::setTimeoutLenghtsMS(double val)
{
    timeoutLenghtMS_=val;
}


bool ItsTimer::isTimedOut()
{
    
    return (this->elapsedTimeMS()>timeoutLenghtMS_)? true : false;
}

double ItsTimer::elapsedTimeMS()
{
    now_= std::chrono::steady_clock::now();
    std::chrono::duration<double, std::milli> diff =now_ - start_;
    return diff.count();
	
    //std::cout << "Time to fill and iterate "  << diff.count() << " s\n";
	//	std::time ttp = std::chrono::steady_clock::to_time(time_point);
	// std::cout << "time: " << std::ctime(&time_point);
}

double ItsTimer::elapsedTimeUS()
{
    now_= std::chrono::steady_clock::now();
    std::chrono::duration<double, std::micro> diff =now_ - start_;
    return diff.count();
	
    //std::cout << "Time to fill and iterate "  << diff.count() << " s\n";
	//	std::time ttp = std::chrono::steady_clock::to_time(time_point);
	// std::cout << "time: " << std::ctime(&time_point);
}
