
#include <fstream>
#include <iterator>
#include <string>

#include <nlohmann/json.hpp>

#include "SvtLogger.h"
#include "SvtUtilities.h"

#include "Database/DatabaseInterface.h"

#include "SVTConfig/SvtDbAgentSetupConfig.h"

#include "SVTDbAgentDto/SvtDbWaferTypeDto.h"

using DatabaseIF = SvtUtils::Singleton<DatabaseInterface>;

SvtUtils::SvtLogger *logger = SvtUtils::Singleton<SvtUtils::SvtLogger>::instance();

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
  if (argc < 2)
  {
    logger->logError("Usage test-er2-waferMap <setup config file>");
    exit(-1);
  }

  std::string setupConfigFile = argv[1];

  const auto setupConfig = createSbAgentSetupeConfig(setupConfigFile);
  const auto dbConfig = setupConfig->getDbConfig();

  logger->configure(setupConfig->getLogFilePath(),
                    setupConfig->getTermVerbosity(),
                    setupConfig->getFileVebosity());

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
    std::string waferMap_fl_name = "/Users/ycorrales/Work/EIC/SVT/SVTSW/Configurations/WaferTypeMappings/ER2WaferMap_v0.json";
    std::ifstream waferMap_fl(waferMap_fl_name);
    if (!waferMap_fl.is_open() || !waferMap_fl.good())
    {
      THROW_RUNTIME_ERROR("File: " + waferMap_fl_name + " not found.");
    }

    std::string errorMsg;
    std::vector<char> str_buffer;
    str_buffer.assign(std::istreambuf_iterator<char>(waferMap_fl), std::istreambuf_iterator<char>());
    auto isWaferMap = SvtDbAgent::SvtDbWaferTypeDto::checkWaferTypeMap(std::string_view(str_buffer.data(), str_buffer.size()), errorMsg);
    if (!isWaferMap)
    {
      logger->logError(errorMsg);
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
