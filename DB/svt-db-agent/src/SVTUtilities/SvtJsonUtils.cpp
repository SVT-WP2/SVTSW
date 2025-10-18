/*!
 * @file SvtJsonUtils.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief
 */

#include "SVTUtilities/SvtJsonUtils.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

namespace
{
  auto logger = Singleton<SvtLogger>::instance();
}

//========================================================================+
bool SvtDbAgent::readStringVariable(json &config, const std::string &key,
                                    std::string &var)
{
  if (config.contains(key))
  {
    var = config.at(key);
    return true;
  }
  else
  {
    logger->logWarning("No entry " + key + " found");
    return false;
  }
}

//========================================================================+
bool SvtDbAgent::readIntegerVariable(json &config, const std::string &key,
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
      logger->logError("Type error when accessing key " + key + ": " +
                       std::string(e.what()));
      return false;
    }
  }
  else
  {
    logger->logWarning("No entry " + key + " found");
    return false;
  }
  return true;
}

//========================================================================+
bool SvtDbAgent::readDoubleVariable(json &config, const std::string &key,
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
      logger->logError("Type error when accessing key " + key + ": " +
                       std::string(e.what()));
      return false;
    }
  }
  else
  {
    logger->logWarning("No entry " + key + " found");
    return false;
  }
  return true;
}

//========================================================================+
bool SvtDbAgent::readBooleanVariable(json &config, const std::string &key,
                                     bool &var)
{
  if (!config.contains(key))
  {
    logger->logWarning("No entry '" + key + "' found");
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

  logger->logWarning("No entry " + key + " found");
  return false;
}

//========================================================================+
bool SvtDbAgent::readIntegerVector(json &config, const std::string &key,
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
      logger->logError("Type error when accessing key " + key + ": " +
                       std::string(e.what()));
      return false;
    }
  }
  else
  {
    logger->logWarning("No entry " + key + " found");
    return false;
  }
  return true;
}

//========================================================================+
bool SvtDbAgent::readDoubleVector(json &config, const std::string &key,
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
      logger->logError("Type error when accessing key " + key + ": " +
                       std::string(e.what()));
      return false;
    }
  }
  else
  {
    logger->logWarning("No entry " + key + " found");
    return false;
  }
  return true;
}

//========================================================================+
bool SvtDbAgent::readStringVector(json &config, const std::string &key,
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
      logger->logError("Type error when accessing key " + key + ": " +
                       std::string(e.what()));
      return false;
    }
  }
  else
  {
    logger->logWarning("No entry " + key + " found");
    return false;
  }
  return true;
}
