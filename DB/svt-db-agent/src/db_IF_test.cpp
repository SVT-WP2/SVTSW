/*!
 * @file svt_db_agent.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief svt_db_agent executable
 */

#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include "version.h"

#include <nlohmann/json.hpp>

#include <cstdlib>
#include <iostream>

std::string version = std::string(VERSION);

SvtLogger &logger = SvtDbAgent::Singleton<SvtLogger>::instance();

//========================================================================+
int main()
{
  logger.logInfo("********************** Svt Db Interface Test, version:" +
                     version,
                 SvtLogger::Mode::STANDARD);

  try
  {
    logger.logInfo("Before", SvtLogger::Mode::STANDARD);
    nlohmann::basic_json<> value = std::string("Hello");
    logger.logInfo(value.dump(), SvtLogger::Mode::STANDARD);
    logger.logInfo("End", SvtLogger::Mode::STANDARD);
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
