/*!
 * @file SvtDbAgentSetupConfig.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief DbAgent setup config
 */

#include <optional>

#include <magic_enum/magic_enum.hpp>

#include "Config/ConfigDb.h"
#include "Config/ConfigDbAgentSetup.h"
#include "SvtJsonUtils.h"
#include "SvtLogger.h"
#include "SvtUtilities.h"

using json = nlohmann::json;
namespace config
{
  //========================================================================+
  std::optional<std::shared_ptr<ConfigDbAgentSetup>>
  ConfigDbAgentSetup::factory(const std::string &path)
  {
    json config;
    std::shared_ptr<ConfigDbAgentSetup> ptr =
        std::make_shared<ConfigDbAgentSetup>(_config_dbagent_setup_ctor_tag{});
    if (ptr->readFile(path, config) && ptr->decodeJson(config))
    {
      ptr->setInitialized(true);
    }
    else
    {
      logError(
          "Unable to read config file or incomplete information");
      ptr->setInitialized(false);
      return std::nullopt;
    }
    return ptr;
  }

  // decodes the JSON config file. Needs to find Db configuration
  //========================================================================+
  bool ConfigDbAgentSetup::decodeJson(json &config)
  {
    for (auto it = config.begin(); it != config.end(); ++it)
    {
      if (it.key() == "logger")
      {
        SvtUtils::readStringVariable(it.value(), "filePath", mLogFilePath);

        std::string termLogLevel, fileLogLevel;
        SvtUtils::readStringVariable(it.value(), "termVerbosity", termLogLevel);
        SvtUtils::readStringVariable(it.value(), "fileVerbosity", fileLogLevel);

        auto termVer = magic_enum::enum_cast<SvtUtils::SvtLogger::Mode>(termLogLevel);
        mTermVerbosity = termVer.has_value() ? termVer.value() : mTermVerbosity;

        auto fileVer = magic_enum::enum_cast<SvtUtils::SvtLogger::Mode>(fileLogLevel);
        mFileVerbosity = fileVer.has_value() ? fileVer.value() : mFileVerbosity;
      }
      if (it.key() == "kafka")
      {
        SvtUtils::readStringVariable(it.value(), "server", mKafkaServer);
        SvtUtils::readStringVariable(it.value(), "port", mKaflaPort);

        std::string recreateTopics;
        SvtUtils::readStringVariable(it.value(), "recreateTopics", recreateTopics, false);
        if (recreateTopics.empty())
        {
          mRecreateTopicAction = SvtUtils::HEARTBEAT_ONLY;
        }
        else
        {
          const auto &action = magic_enum::enum_cast<SvtUtils::RecreateTopics>(recreateTopics);
          mRecreateTopicAction = action.has_value() ? action.value() : SvtUtils::HEARTBEAT_ONLY;
        }
      }
      if (it.key() == "database")
      {
        mDbConfig = ConfigDb::factory(it.value());
        if (!mDbConfig->isInitialized())
          logWarning("Error in reading of board config");
      }
    }
    return mDbConfig->isInitialized();
  }
}  // namespace config
