/*!
 * @file svt_db_agent.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief svt_db_agent executable
 */

#include <csignal>
#include <cstdlib>
#include <exception>
#include <iostream>
#include <string>
#include <thread>

#include "version.h"

#include "Database/DatabaseInterface.h"
#include "SVTConfig/SvtDbAgentSetupConfig.h"
#include "SVTDbAgentService/SvtDbAgentService.h"

#include "SvtLogger.h"
#include "SvtUtilities.h"

using DatabaseIF = SvtUtils::Singleton<DatabaseInterface>;

std::string version = std::string(VERSION);

SvtUtils::SvtLogger *logger = SvtUtils::Singleton<SvtUtils::SvtLogger>::instance();

bool run = true;
//========================================================================+
void sigterm_handler(int sig)
{
  std::ostringstream ss;
  ss << "Caught signal " << sig << ", initiating shutdown...";
  logger->logWarning(ss.str());
  run = false;
}

//========================================================================+
std::shared_ptr<SvtDbAgentSetupConfig>
createSbAgentSetupeConfig(const std::string &dbAgentSetupConfigFile)
{
  auto setupConfig = SvtDbAgentSetupConfig::factory(dbAgentSetupConfigFile);
  if (!setupConfig.has_value())
  {
    logger->logError("Unable to create test config");
    return nullptr;
  }
  return setupConfig.value();
}

//========================================================================+
bool connectToDB(DatabaseInterface *dbInterface, const std::string &user, const std::string &pass,
                 std::string &host, const std::string &port, const std::string &dbName, const std::string &dbSchema)
{
  if (!dbInterface->Init(user, pass, host, port, dbName, dbSchema))
  {
    return false;
  }

  if (dbInterface->connect())
  {
    logger->logInfo("Successfully connected to " + dbName + ".");
    return true;
  }
  else
  {
    logger->logError("Cannot connet to " + dbName + "!");
  }

  return false;
}

//========================================================================+
int main(int argc, const char *argv[])
{
  // Register signal handlers for graceful shutdown
  std::signal(SIGINT, sigterm_handler);   // Ctrl+C
  std::signal(SIGTERM, sigterm_handler);  // kill command

  if (argc < 2)
  {
    logger->logError("Usage svt-db-agent <setup config file>");
    exit(-1);
  }

  std::string setupConfigFile = argv[1];

  const auto setupConfig = createSbAgentSetupeConfig(setupConfigFile);
  const auto dbConfig = setupConfig->getDbConfig();

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
  std::string psqlDbName = dbConfig->getDbName();
  std::string psqlDbSchema = dbConfig->getDbSchema();

  if (!dbInterface->isConnected())
  {
    if (!connectToDB(dbInterface, psqluser, psqlpass, psqlhost,
                     psqlport, psqlDbName, psqlDbSchema))
    {
      logger->logError("Cannot connect to DB");
      return EXIT_FAILURE;
    }
    else
    {
      logger->logInfo("Databaseinterface is connected");
      logger->logInfo("Using Scheme: " + psqlDbSchema);
    }
  }
  try
  {
    std::string kafka_broker = setupConfig->getKafkaServer() + ":" + setupConfig->getKafkaPort();
    SvtDbAgent::SvtDbAgentService *_dbAgent =
        Singleton<SvtDbAgent::SvtDbAgentService>::instance();
    _dbAgent->setBrokerName(kafka_broker);
    // _dbAgent->setLogMessages(true);
    if (!_dbAgent->configureService(false))
    {
      return EXIT_FAILURE;
    }
    while (_dbAgent->getIsConsRunnning() && run)
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
