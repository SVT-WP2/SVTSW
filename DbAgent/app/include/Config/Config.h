#pragma once

/*!
 * @file Config.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @briefConfig base class
 */

#include <nlohmann/json.hpp>

namespace config
{
  class Config
  {
   public:
    Config() = default;
    virtual ~Config() = default;

    bool isInitialized() { return mInitialized; }
    void setInitialized(bool initialized) { mInitialized = initialized; }
    const std::string &getConfigFilePath() { return mConfigFilePath; }

   protected:
    bool mInitialized = false;
    std::string mConfigFilePath = {};

    virtual bool decodeJson(nlohmann::json & /*_config*/) = 0;

    bool readFile(const std::string & /*_path*/, nlohmann::json & /*_config*/);
    std::optional<uint32_t> parseHexValue(const std::string &str);
  };

}  // namespace config
