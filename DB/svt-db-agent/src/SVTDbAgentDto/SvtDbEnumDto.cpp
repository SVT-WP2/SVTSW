/*!
 * @file SvtDbEnum.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbEnum
 */

#include "SVTDbAgentDto/SvtDbEnumDto.h"
#include "SVTDb/sqlmapi.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

using SvtDbAgent::Singleton;

std::map<std::string, std::vector<std::string>>
    SvtDbEnumDto::enum_type_value_map;

//========================================================================+
bool SvtDbEnumDto::getAllEnumTypesInDB(const std::string &schema,
                                       std::vector<std::string> &enum_types)
{
  vector<vector<MultiBase *>> rows;
  std::string query =
      "SELECT DISTINCT n.nspname AS enum_schema, t.typname AS enum_name\n";
  query += "FROM pg_type t\n";
  query += "join pg_enum e on t.oid = e.enumtypid\n";
  query += "join pg_catalog.pg_namespace n ON n.oid = t.typnamespace;";

  enum_types.clear();
  try
  {
    doGenericQuery(query, rows);
    for (auto &row : rows)
    {
      if (!schema.compare(row.at(0)->getString()))
      {
        enum_types.push_back(row.at(1)->getString());
      }
    }
    finishQuery(rows);
  }
  catch (const std::exception &e)
  {
    enum_types.clear();
    throw e;
  }
  return true;
}

//========================================================================+
bool SvtDbEnumDto::getAllEnumValuesInDB(std::string type_name,
                                        std::vector<std::string> &enum_values)
{
  vector<vector<MultiBase *>> rows;
  std::string query = "SELECT enum_range(null::" + type_name + ");";

  enum_values.clear();
  try
  {
    doGenericQuery(query, rows);
    const auto str_res = rows[0][0]->getString();
    std::string_view res{str_res};
    finishQuery(rows);

    res.remove_prefix(res.find('{') + 1);
    res.remove_suffix(res.size() - res.find_last_of('}'));

    const string_view delimiter(",");
    size_t start = 0;
    size_t end = res.find(delimiter);
    while (end != std::string_view::npos)
    {
      enum_values.push_back(std::string(res.substr(start, end - start)));
      start = end + 1;
      end = res.find(delimiter, start);
    }
    enum_values.push_back(std::string(res.substr(start)));
  }
  catch (const std::exception &e)
  {
    enum_values.clear();
    throw e;
  }
  return true;
}

//========================================================================+
bool SvtDbEnumDto::addEnumValueInDB(std::string type_name, std::string value)
{
  std::string cmd =
      "ALTER TYPE " + type_name + " ADD VALUE IF NOT EXISTS '" + value + "';";

  if (!doGenericUpdate(cmd))
  {
    rollbackUpdate();
    return false;
  }
  commitUpdate();
  return true;
}

//========================================================================+
void SvtDbEnumDto::addValue(const std::string &type, std::string &value)
{
  enum_type_value_map[type].push_back(value);
}

//========================================================================+
std::vector<std::string> SvtDbEnumDto::getTypeNames()
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

//========================================================================+
std::vector<std::string>
SvtDbEnumDto::getEnumValues(const std::string &enum_type)
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

//========================================================================+
void SvtDbEnumDto::print()
{
  SvtLogger &logger = Singleton<SvtLogger>::instance();
  logger.logInfo("Db Agent Enums");
  for (const auto &[enum_type, values] : enum_type_value_map)
  {
    logger.logInfo("type " + enum_type);
    for (const auto &value : values)
    {
      logger.logInfo("\t " + value);
    }
  }
}

//========================================================================+
void SvtDbEnumDto::getAllEnumValues(const SvtDbAgent::SvtDbAgentMessage &msg,
                                    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  std::vector<std::string> enum_types =
      (msgData.contains("enumNames"))
          ? msgData["enumNames"].get<std::vector<std::string>>()
          : getTypeNames();
  getAllEnumValuesReplyMsg(enum_types, replyMsg);
}

//========================================================================+
void SvtDbEnumDto::getAllEnumValuesReplyMsg(
    const std::vector<std::string> &types,
    SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  std::string enum_name(SvtDbAgent::db_schema);
  try
  {
    nlohmann::ordered_json data;
    for (const auto &enum_type : types)
    {
      data[enum_type] = nlohmann::ordered_json::array();
      for (const auto &enum_value : getEnumValues(enum_type))
      {
        data[enum_type].push_back(enum_value);
      }
    }
    msgReply.setData(data);
    msgReply.setStatus(
        SvtDbAgent::msgStatus[SvtDbAgent::SvtDbAgentMsgStatus::Success]);
    msgReply.setError(0, "");
  }
  catch (const std::exception &e)
  {
    throw e;
  }
  return;
}
