#ifndef SVT_DB_AGENT_ENUM_H
#define SVT_DB_AGENT_ENUM_H

/*!
 * @file SvtDbEnum.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db enum
 * */

#include <algorithm>
#include <map>
#include <string>
#include <vector>

class SvtDbAgentEnum
{
 public:
  void AddValue(const std::string &type, std::string &value)
  {
    enum_type_value_map[type].push_back(value);
  }
  std::vector<std::string> GetTypeNames() const
  {
    std::vector<std::string> keys;
    std::transform(
        enum_type_value_map.begin(), enum_type_value_map.end(),
        std::back_inserter(keys),
        [](const std::pair<std::string, std::vector<std::string>> &pair)
        {
          return pair.first;
        });
    return keys;
  }

  std::vector<std::string> GetEnumValues(const std::string &enum_type) const
  {
    if (enum_type_value_map.find(enum_type) != enum_type_value_map.cend())
    {
      return enum_type_value_map.at(enum_type);
    }
    else
    {
      return std::vector<std::string>();
    }
  }

  const std::map<std::string, std::vector<std::string>> &GetAllEnumList()
  {
    return enum_type_value_map;
  }

  void Print();

 private:
  std::map<std::string, std::vector<std::string>> enum_type_value_map;
};

#endif  // !SVT_DB_AGENT_ENUM_H
