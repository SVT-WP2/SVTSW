/*!
 * @file svt_db_agent.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief svt_db_agent executable
 */

#include "SVTDbAgentService/SvtDbAgentProducer.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include "version.h"

#include <nlohmann/json.hpp>

#include <cstdlib>
#include <iostream>

std::string version = std::string(VERSION);

SvtLogger &logger = Singleton<SvtLogger>::instance();

class Msg
{
 public:
  std::string GetMsg() { return msg.dump(); }

 private:
  nlohmann::ordered_json msg;
};

//========================================================================+
int main()
{
  logger.logInfo("********************** Svt Db Interface Test, version:" +
                     version,
                 SvtLogger::Mode::STANDARD);

  try
  {
    std::shared_ptr<SvtDbAgentProducer> m_Producer;
    m_Producer = std::shared_ptr<SvtDbAgentProducer>(
        new SvtDbAgentProducer("localhost:9092"));
  }
  catch (const std::exception &e)
  {
    std::cout << std::endl
              << "### Caught exception in the main thread ###" << std::endl
              << std::endl;
    std::cout << e.what() << std::endl;
    return EXIT_FAILURE;
  }
  return EXIT_SUCCESS;
}
