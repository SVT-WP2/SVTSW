#pragma once

/*!
 * @file SvtDbAgentSetupConfig.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief DbAgent setup configuration
 */

#include "SvtConfig.h"
#include "SvtDbConfig.h"
#include "SvtLogger.h"

class SvtDbAgentSetupConfig : public SvtConfig
{
 private:
  struct _dbagent_setupconfig_ctor_tag
  {
    _dbagent_setupconfig_ctor_tag() = default;
  };
  std::shared_ptr<SvtDbConfig> mDbConfig;
  std::string mLogFilePath;
  SvtUtils::SvtLogger::Mode mTermVerbosity = SvtUtils::SvtLogger::PRODUCTION;
  SvtUtils::SvtLogger::Mode mFileVerbosity = SvtUtils::SvtLogger::ALL;
  std::string mKafkaServer;
  std::string mKaflaPort;

 protected:
  bool decodeJson(nlohmann::json &config) override;

 public:
  explicit SvtDbAgentSetupConfig(_dbagent_setupconfig_ctor_tag);
  ~SvtDbAgentSetupConfig() override = default;
  static std::optional<std::shared_ptr<SvtDbAgentSetupConfig>>
  factory(const std::string &path);

  std::shared_ptr<SvtDbConfig> getDbConfig() { return mDbConfig; }
  std::string getLogFilePath() { return mLogFilePath; }
  SvtUtils::SvtLogger::Mode getTermVerbosity() { return mTermVerbosity; }
  SvtUtils::SvtLogger::Mode getFileVebosity() { return mFileVerbosity; }
  std::string getKafkaServer() { return mKafkaServer; }
  std::string getKafkaPort() { return mKaflaPort; }
};
