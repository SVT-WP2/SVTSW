#pragma once

/*!
 * @file SvtConfig.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Svt config base class
 */

#include <nlohmann/json.hpp>

#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

class SvtConfig
{
 protected:
  bool mInitialized = false;
  std::string mConfigFilePath = {};

  virtual bool decodeJson(nlohmann::json &config) = 0;

  bool readFile(const std::string &path, nlohmann::json &config);
  std::optional<uint32_t> parseHexValue(const std::string &str);

 public:
  SvtConfig() = default;
  virtual ~SvtConfig() = default;

  SvtLogger *logger = Singleton<SvtLogger>::instance();

  bool isInitialized() { return mInitialized; }
  void setInitialized(bool initialized) { mInitialized = initialized; }
  const std::string &getConfigFilePath() { return mConfigFilePath; }
};
