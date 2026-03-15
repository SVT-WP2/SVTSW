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

const std::string version = std::string(VERSION);

bool run = true;
//========================================================================+
void sigterm_handler(int sig)
{
  std::ostringstream ss;
  ss << "Caught signal " << sig << ", initiating shutdown...";
  logWarning(ss.str());
  run = false;
}

//========================================================================+
std::shared_ptr<SvtDbAgentSetupConfig>
createDbAgentSetupConfig(const std::string &dbAgentSetupConfigFile)
{
  auto setupConfig = SvtDbAgentSetupConfig::factory(dbAgentSetupConfigFile);
  if (!setupConfig.has_value())
  {
    logError("Unable to create setup config");
    return nullptr;
  }
  return setupConfig.value();
}

//========================================================================+
bool connectToDB(DatabaseInterface *dbInterface, const std::string &user, const std::string &pass,
                 const std::string &host, const std::string &port, const std::string &dbName,
                 const std::string &dbSchema)
{
  if (!dbInterface->Init(user, pass, host, port, dbName, dbSchema))
  {
    return false;
  }

  if (dbInterface->connect())
  {
    logInfo("Successfully connected to " + dbName + ".");
    return true;
  }
  logError("Cannot connect to " + dbName + "!");

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
    logError("Usage svt-db-agent <setup config file>");
    exit(-1);
  }

  std::string setupConfigFile = argv[1];

  const auto setupConfig = createDbAgentSetupConfig(setupConfigFile);
  if (!setupConfig)
  {
    return EXIT_FAILURE;
  }
  const auto dbConfig = setupConfig->getDbConfig();

  configureLogger(setupConfig->getLogFilePath(),
                  setupConfig->getTermVerbosity(),
                  setupConfig->getFileVebosity());
  logInfo("********************** Svt Db Agent, version:" + version);

  DatabaseInterface *dbInterface = DatabaseIF::instance();

  // take the DB connection out once integrated with FRED
  // but just in case, perhaps checking for connection first will prevent
  // problems
  std::string psqlHost = dbConfig->getHost();
  std::string psqlPort = dbConfig->getPort();
  std::string psqlUser = dbConfig->getUser();
  std::string psqlPass = dbConfig->getPass();
  std::string psqlDbName = dbConfig->getDbName();
  std::string psqlDbSchema = dbConfig->getDbSchema();

  if (!dbInterface->isConnected() &&
      !connectToDB(dbInterface, psqlUser, psqlPass, psqlHost,
                   psqlPort, psqlDbName, psqlDbSchema))
  {
    logError("Cannot connect to DB");
    closeLogFile();
    return EXIT_FAILURE;
  }
  logInfo("DatabaseInterface is connected");
  logInfo("Using Schema: " + psqlDbSchema);
  try
  {
    std::string kafkaBroker = setupConfig->getKafkaServer() + ":" + setupConfig->getKafkaPort();
    SvtDbAgent::SvtDbAgentService *dbAgent =
        SvtUtils::Singleton<SvtDbAgent::SvtDbAgentService>::instance();
    dbAgent->setBrokerName(kafkaBroker);
    // dbAgent->setLogMessages(true);
    if (!dbAgent->configureService(false))
    {
      return EXIT_FAILURE;
    }
    while (dbAgent->getIsConsRunnning() && run)
    {
      std::this_thread::sleep_for(std::chrono::milliseconds(1000));
      // int time = gTimer.getTicksInSeconds();
      // heartbeatService->updateService(time);
    }
  }
  catch (const std::exception &e)
  {
    logError("\n### Caught exception in the main thread ###\n");
    std::cout << e.what() << std::endl;
    return EXIT_FAILURE;
  }
  return EXIT_SUCCESS;
}
