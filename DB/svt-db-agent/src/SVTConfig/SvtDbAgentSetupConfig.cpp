/*!
 * @file SvtDbAgentSetupConfig.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief DbAgent setup config
 */

#include <optional>

#include "SVTConfig/SvtDbAgentSetupConfig.h"
#include "SvtJsonUtils.h"
#include "SvtLogger.h"
#include "SvtUtilities.h"

using json = nlohmann::json;
using SvtUtils::Singleton;
using SvtUtils::SvtLogger;

SvtDbAgentSetupConfig::SvtDbAgentSetupConfig(_dbagent_setupconfig_ctor_tag) {}

std::optional<std::shared_ptr<SvtDbAgentSetupConfig>>
SvtDbAgentSetupConfig::factory(const std::string &path)
{
  json config;
  std::shared_ptr<SvtDbAgentSetupConfig> ptr =
      std::make_shared<SvtDbAgentSetupConfig>(_dbagent_setupconfig_ctor_tag{});
  if (ptr->readFile(path, config) && ptr->decodeJson(config))
  {
    ptr->setInitialized(true);
  }
  else
  {
    Singleton<SvtLogger>::instance()->logError(
        "Unable to read config file or incomplete information");
    ptr->setInitialized(false);
    return std::nullopt;
  }
  return ptr;
}

// decodes the JSON config file. Needs to find Db configuration
bool SvtDbAgentSetupConfig::decodeJson(json &config)
{
  for (auto it = config.begin(); it != config.end(); ++it)
  {
    if (it.key() == "logger")
    {
      SvtUtils::readStringVariable(it.value(), "filePath", mLogFilePath);
    }
    if (it.key() == "kafka")
    {
      SvtUtils::readStringVariable(it.value(), "server", mKafkaServer);
      SvtUtils::readStringVariable(it.value(), "port", mKaflaPort);
    }
    if (it.key() == "DataBase")
    {
      mDbConfig = SvtDbConfig::factory(it.value());
      if (!mDbConfig->isInitialized())
        logger->logWarning("Error in reading of board config");
    }
  }
  return mDbConfig->isInitialized();
}
