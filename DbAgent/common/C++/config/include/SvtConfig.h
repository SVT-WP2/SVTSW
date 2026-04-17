#pragma once

/*!
 * @file SvtConfig.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Svt Config base class
 */

#include <nlohmann/json.hpp>

namespace SvtConfig
{
  class SvtConfig
  {
   public:
    SvtConfig() = default;
    virtual ~SvtConfig() = default;

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

}  // namespace SvtConfig
