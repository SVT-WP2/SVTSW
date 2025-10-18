/*!
 * @file svt_db_agent.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief svt_db_agent executable
 */

#include <cstdlib>
#include <exception>
#include <iostream>
#include <string>
#include <thread>

#include "version.h"

#include "Database/DatabaseInterface.h"
#include "SVTConfig/SvtDbAgentSetupConfig.h"
#include "SVTDbAgentService/SvtDbAgentService.h"
#include "SVTUtilities/SvtDbAgentGlobal.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

using DatabaseIF = Singleton<DatabaseInterface>;

std::string version = std::string(VERSION);

SvtLogger *logger = Singleton<SvtLogger>::instance();

//========================================================================+
std::shared_ptr<SvtDbAgentSetupConfig>
createSbAgentSetupeConfig(const std::string &dbAgentSetuwpConfigFile)
{
  auto setupConfig = SvtDbAgentSetupConfig::factory(dbAgentSetuwpConfigFile);
  if (!setupConfig.has_value())
  {
    logger->logError("Unable to create test config");
    return nullptr;
  }
  return setupConfig.value();
}

//========================================================================+
bool connectToDB(std::string &user, std::string &pass, std::string &conn,
                 std::string &host, std::string &port)
{
  DatabaseInterface *dbInterface = DatabaseIF::instance();
  if (!dbInterface->Init(user, pass, conn, host, port))
  {
    return false;
  }

  if (dbInterface->connect())
  {
    logger->logInfo("Successfully connected to " + conn + ".");
    return true;
  }
  else
  {
    logger->logError("Cannot connet to " + conn + "!");
  }

  return false;
}

//========================================================================+
int main(int argc, const char *argv[])
{
  if (argc < 2)
  {
    logger->logError("Usage svt-db-agent <setup config file>");
    exit(-1);
  }

  std::string setupConfigFile = argv[1];

  const auto setupConfig = createSbAgentSetupeConfig(setupConfigFile);
  const auto dbConfig = setupConfig->getDbConfig();

  //! Set Global variables
  SvtDbAgent::db_name = dbConfig->getDbName();
  SvtDbAgent::db_schema = dbConfig->getDbSchema();
  SvtDbAgent::kafka_server = setupConfig->getKafkaServer();
  SvtDbAgent::kafka_port = setupConfig->getKafkaPort();

  logger->configure(setupConfig->getLogFilePath(),
                    setupConfig->getTermVerbosity(),
                    setupConfig->getFileVebosity());
  logger->logInfo("********************** Svt Db Agent, version:" + version);

  DatabaseInterface *dbInterface = DatabaseIF::instance();

  // take the DB connection out once integrated with FRED
  // but just in case, perhaps checking for connection first will prevent
  // problems
  std::string psqlhost = dbConfig->getHost();
  std::string psqlport = dbConfig->getPort();
  std::string psqluser = dbConfig->getUser();
  std::string psqlpass = dbConfig->getPass();

  if (!dbInterface->isConnected())
  {
    if (!connectToDB(psqluser, psqlpass, SvtDbAgent::db_name, psqlhost,
                     psqlport))
    {
      logger->logError("Cannot connect to DB");
      return EXIT_FAILURE;
    }
    else
    {
      logger->logInfo("Databaseinterface is connected");
      logger->logInfo("Using Scheme: " + SvtDbAgent::db_schema);
    }
  }
  try
  {
    SvtDbAgent::SvtDbAgentService *_dbAgent =
        Singleton<SvtDbAgent::SvtDbAgentService>::instance();
    if (!_dbAgent->initEnumTypeList(SvtDbAgent::db_schema))
    {
      logger->logError("ERROR: We could not initialize enum from DB.");
      return EXIT_FAILURE;
    }
    if (!_dbAgent->configureService(false))
    {
      return EXIT_FAILURE;
    }
    while (_dbAgent->getIsConsRunnning())
    {
      std::this_thread::sleep_for(std::chrono::milliseconds(1000));
      // int time = gTimer.getTicksInSeconds();
      // heartbeatService->updateService(time);
    }
  }
  catch (const std::exception &e)
  {
    logger->logError("\n### Caught exception in the main thread ###\n");
    std::cout << e.what() << std::endl;
    return EXIT_FAILURE;
  }
  return EXIT_SUCCESS;
}
