#pragma once

/*!
 * @file SvtDbAgentSetupConfig.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief DbAgent setup configuration
 */

#include "Config.h"
#include "SvtLogger.h"

class ConfigDb;

namespace config
{
  namespace dbagent
  {
    class ConfigDbAgentSetup : Config
    {
     private:
      struct _config_dbagent_setup_ctor_tag
      {
        _config_dbagent_setup_ctor_tag() = default;
      };

      std::shared_ptr<ConfigDb> mDbConfig;

      std::string mLogFilePath;
      SvtUtils::SvtLogger::Mode mTermVerbosity = SvtUtils::SvtLogger::PRODUCTION;
      SvtUtils::SvtLogger::Mode mFileVerbosity = SvtUtils::SvtLogger::ALL;

      std::string mKafkaServer;
      std::string mKaflaPort;

     protected:
      bool decodeJson(nlohmann::json &config) override;

     public:
      explicit ConfigDbAgentSetup(_config_dbagent_setup_ctor_tag) {};
      ~ConfigDbAgentSetup() override = default;
      static std::optional<std::shared_ptr<ConfigDbAgentSetup>>
      factory(const std::string &path);

      std::shared_ptr<ConfigDb> getDbConfig() { return mDbConfig; }
      std::string getLogFilePath() { return mLogFilePath; }
      SvtUtils::SvtLogger::Mode getTermVerbosity() { return mTermVerbosity; }
      SvtUtils::SvtLogger::Mode getFileVebosity() { return mFileVerbosity; }
      std::string getKafkaServer() { return mKafkaServer; }
      std::string getKafkaPort() { return mKaflaPort; }
    };

  }  // namespace dbagent

}  // namespace config
