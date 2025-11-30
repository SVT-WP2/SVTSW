#pragma once

/*!
 * @file SvtJsonUtils.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Some function to decode json data
 */

#include <nlohmann/json.hpp>
using json = nlohmann::json;

namespace SvtUtils
{
  bool readStringVariable(const json &config, const std::string &key, std::string &var);
  bool readIntegerVariable(const json &config, const std::string &key, int &var);
  bool readDoubleVariable(const json &config, const std::string &key, double &var);
  bool readBooleanVariable(const json &config, const std::string &key, bool &var);
  bool readStringVector(const json &config, const std::string &key,
                        std::vector<std::string> &var);
  bool readIntegerVector(const json &config, const std::string &key,
                         std::vector<int> &var);
  bool readDoubleVector(const json &config, const std::string &key,
                        std::vector<double> &var);
  bool recursive_erase_key(json &j, const std::string_view &key);
}  // namespace SvtUtils
