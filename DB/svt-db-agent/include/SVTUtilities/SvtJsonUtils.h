#pragma once

/*!
 * @file SvtJsonUtils.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Some function to decode json data
 */

#include <nlohmann/json.hpp>
using json = nlohmann::json;

namespace SvtDbAgent
{
  bool readStringVariable(json &config, const std::string &key, std::string &var);
  bool readIntegerVariable(json &config, const std::string &key, int &var);
  bool readDoubleVariable(json &config, const std::string &key, double &var);
  bool readBooleanVariable(json &config, const std::string &key, bool &var);
  bool readStringVector(json &config, const std::string &key,
                        std::vector<std::string> &var);
  bool readIntegerVector(json &config, const std::string &key,
                         std::vector<int> &var);
  bool readDoubleVector(json &config, const std::string &key,
                        std::vector<double> &var);
  bool recursive_erase_key(json &j, const std::string_view &key);
}  // namespace SvtDbAgent
