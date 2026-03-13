/*!
 * @file SvtJsonUtils.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief
 */

#include "SvtJsonUtils.h"
#include "SvtLogger.h"

//========================================================================+
bool SvtUtils::recursive_erase_key(json &j, const std::string_view &key)
{
  if (j.is_object())
  {
    // Iterate through object members
    for (auto it = j.begin(); it != j.end();)
    {
      if (it.key() == key)
      {
        // Erase the key if found
        it = j.erase(it);  // Erase returns the iterator to the next element
      }
      else
      {
        // Recursively call for nested objects/arrays
        recursive_erase_key(*it, key);
        ++it;
      }
    }
  }
  else if (j.is_array())
  {
    // Iterate through array elements
    for (auto &element : j)
    {
      recursive_erase_key(element, key);
    }
  }
  return true;
}

//========================================================================+
bool SvtUtils::readStringVariable(const json &config, const std::string &key,
                                  std::string &var)
{
  if (config.contains(key))
  {
    var = config.at(key);
    return true;
  }
  else
  {
    logWarning("No entry " + key + " found");
    return false;
  }
}

//========================================================================+
bool SvtUtils::readIntegerVariable(const json &config, const std::string &key,
                                   int &var)
{
  if (config.contains(key))
  {
    try
    {
      var = config.at(key).get<int>();  // Directly get the value as a int
    }
    catch (const json::type_error &e)
    {
      logError("Type error when accessing key " + key + ": " +
               std::string(e.what()));
      return false;
    }
  }
  else
  {
    logWarning("No entry " + key + " found");
    return false;
  }
  return true;
}

//========================================================================+
bool SvtUtils::readDoubleVariable(const json &config, const std::string &key,
                                  double &var)
{
  if (config.contains(key))
  {
    try
    {
      var = config.at(key).get<double>();  // Directly get the value as a double
    }
    catch (const json::type_error &e)
    {
      logError("Type error when accessing key " + key + ": " +
               std::string(e.what()));
      return false;
    }
  }
  else
  {
    logWarning("No entry " + key + " found");
    return false;
  }
  return true;
}

//========================================================================+
bool SvtUtils::readBooleanVariable(const json &config, const std::string &key,
                                   bool &var)
{
  if (!config.contains(key))
  {
    logWarning("No entry '" + key + "' found");
    return false;
  }

  const auto &val = config.at(key);

  if (val.is_boolean())
  {
    var = val.get<bool>();
    return true;
  }

  if (val.is_string())
  {
    std::string strVal = val.get<std::string>();
    std::transform(strVal.begin(), strVal.end(), strVal.begin(), ::tolower);
    if (strVal == "true" || strVal == "1")
    {
      var = true;
      return true;
    }
    else if (strVal == "false" || strVal == "0")
    {
      var = false;
      return true;
    }
  }

  logWarning("No entry " + key + " found");
  return false;
}

//========================================================================+
bool SvtUtils::readIntegerVector(const json &config, const std::string &key,
                                 std::vector<int> &var)
{
  if (config.contains(key))
  {
    try
    {
      for (const auto &item : config.at(key))
      {
        var.push_back(item.get<int>());  // Directly get the value as an int
      }
    }
    catch (const json::type_error &e)
    {
      logError("Type error when accessing key " + key + ": " +
               std::string(e.what()));
      return false;
    }
  }
  else
  {
    logWarning("No entry " + key + " found");
    return false;
  }
  return true;
}

//========================================================================+
bool SvtUtils::readDoubleVector(const json &config, const std::string &key,
                                std::vector<double> &var)
{
  if (config.contains(key))
  {
    try
    {
      for (const auto &item : config.at(key))
      {
        var.push_back(item.get<double>());  // Directly get the value as a double
      }
    }
    catch (const json::type_error &e)
    {
      logError("Type error when accessing key " + key + ": " +
               std::string(e.what()));
      return false;
    }
  }
  else
  {
    logWarning("No entry " + key + " found");
    return false;
  }
  return true;
}

//========================================================================+
bool SvtUtils::readStringVector(const json &config, const std::string &key,
                                std::vector<std::string> &var)
{
  if (config.contains(key))
  {
    try
    {
      for (const auto &item : config.at(key))
      {
        var.push_back(
            item.get<std::string>());  // Directly get the value as a string
      }
    }
    catch (const json::type_error &e)
    {
      logError("Type error when accessing key " + key + ": " +
               std::string(e.what()));
      return false;
    }
  }
  else
  {
    logWarning("No entry " + key + " found");
    return false;
  }
  return true;
}
