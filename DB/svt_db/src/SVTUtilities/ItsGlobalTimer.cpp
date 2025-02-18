#include "ITSUtilities/ItsGlobalTimer.h"

ItsGlobalTimer::ItsGlobalTimer() :
 start_(std::chrono::steady_clock::now()),
 now_(std::chrono::steady_clock::now())
{ 
}


double ItsGlobalTimer::getThicksMS(){
    now_= std::chrono::steady_clock::now();
    std::chrono::duration<double, std::milli> diff =now_ - start_;
    return diff.count();
	
    //std::cout << "Time to fill and iterate "  << diff.count() << " s\n";
	//	std::time ttp = std::chrono::steady_clock::to_time(time_point);
	// std::cout << "time: " << std::ctime(&time_point);
}


double ItsGlobalTimer::getTicksInSeconds(){
    now_= std::chrono::steady_clock::now();
    std::chrono::duration<double> diff =now_ - start_;
    return diff.count();
}


std::chrono::time_point<std::chrono::system_clock> getSystemTimeNow(){
    return std::chrono::system_clock::now();
}

ItsGlobalTimer & ItsGlobalTimer::getInstance(){

	static ItsGlobalTimer pinstance;
	return pinstance;

}
