/*!
 * @file Config.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief config base class implementation
 */

#include <fstream>
#include <sstream>

#include "Config/Config.h"

#include "SvtLogger.h"

using json = nlohmann::json;
using namespace config;
//========================================================================+
bool Config::readFile(const std::string &_path, json &_config)
{
  std::ifstream input(_path);
  if (!(input.is_open()))
  {
    logError("Cannot open config file " + _path + " for reading");
    return false;
  }

  if (input.peek() == std::ifstream::traits_type::eof())
  {
    logError("File is empty " + _path);
    input.close();
    return false;
  }

  try
  {
    _config = json::parse(input, nullptr, true, true);
  }
  catch (const json::parse_error &e)
  {
    logError("Error when parsing file " + _path);
    logError("message: " + std::string(e.what()) +
             ", exception id: " + std::to_string(e.id) +
             "byte position of error: " + std::to_string(e.byte));
    input.close();
    return false;
  }
  input.close();
  mConfigFilePath = _path;
  return true;
}

//========================================================================+
std::optional<uint32_t> Config::parseHexValue(const std::string &str)
{
  std::string s = str;
  // Trim whitespace
  s.erase(0, s.find_first_not_of(" \t\n\r"));
  s.erase(s.find_last_not_of(" \t\n\r") + 1);

  if (s.empty())
    return std::nullopt;

  uint32_t value = 0;
  try
  {
    if (s.rfind("0x", 0) == 0 || s.rfind("0X", 0) == 0)
    {
      std::stringstream ss;
      ss << std::hex << s;
      ss >> value;
      if (ss.fail() || !ss.eof())
        return std::nullopt;
    }
    else
    {
      for (char c : s)
      {
        if (!std::isdigit(c))
          return std::nullopt;
      }
      value = static_cast<uint32_t>(std::stoul(s));
    }
  }
  catch (...)
  {
    return std::nullopt;
  }
  return value;
}
