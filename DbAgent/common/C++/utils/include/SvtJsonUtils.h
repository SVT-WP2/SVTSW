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
  bool readStringVariable(const json &config, const std::string &key, std::string &var, bool log = true);
  bool readIntegerVariable(const json &config, const std::string &key, int &var, bool log = true);
  bool readDoubleVariable(const json &config, const std::string &key, double &var, bool log = true);
  bool readBooleanVariable(const json &config, const std::string &key, bool &var, bool log = true);
  bool readStringVector(const json &config, const std::string &key,
                        std::vector<std::string> &var, bool log = true);
  bool readIntegerVector(const json &config, const std::string &key,
                         std::vector<int> &var, bool log = true);
  bool readDoubleVector(const json &config, const std::string &key,
                        std::vector<double> &var, bool log = true);
  bool recursive_erase_key(json &j, const std::string_view &key);
}  // namespace SvtUtils
