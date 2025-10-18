#pragma once

/*!
 * @file SvtDbAgentSetupConfig.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief DbAgent setup configuration
 */

#include "SvtConfig.h"

#include "SVTConfig/SvtDbConfig.h"

class SvtDbAgentSetupConfig : public SvtConfig
{
 private:
  struct _dbagent_setupconfig_ctor_tag
  {
    _dbagent_setupconfig_ctor_tag() = default;
  };
  std::shared_ptr<SvtDbConfig> mDbConfig;
  std::string mLogFilePath;
  SvtLogger::Mode mTermVerbosity = SvtLogger::PRODUCTION;
  SvtLogger::Mode mFileVerbosity = SvtLogger::ALL;
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
  SvtLogger::Mode getTermVerbosity() { return mTermVerbosity; }
  SvtLogger::Mode getFileVebosity() { return mFileVerbosity; }
  std::string getKafkaServer() { return mKafkaServer; }
  std::string getKafkaPort() { return mKaflaPort; }
};
