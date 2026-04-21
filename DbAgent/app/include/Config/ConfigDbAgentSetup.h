#pragma once

/*!
 * @file SvtDbAgentSetupConfig.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief DbAgent setup configuration
 */

#include "SvtConfig.h"
#include "SvtLogger.h"

class ConfigDb;

namespace config
{
  class ConfigDbAgentSetup : SvtConfig::SvtConfig
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

    const std::shared_ptr<ConfigDb> &getDbConfig() const { return mDbConfig; }
    const std::string &getLogFilePath() const { return mLogFilePath; }
    const std::string &getKafkaServer() const { return mKafkaServer; }
    const std::string &getKafkaPort() const { return mKaflaPort; }
    SvtUtils::SvtLogger::Mode getTermVerbosity() const { return mTermVerbosity; }
    SvtUtils::SvtLogger::Mode getFileVebosity() const { return mFileVerbosity; }
  };

}  // namespace config
