/*!
 * @file DbEnum.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief DbEnum
 */

#include "DbAgentDto/DbEnumDto.h"
#include "Database/DbAPI.h"
#include "Database/DbInterface.h"

using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaReplyMsg;

namespace dbagent
{
  std::map<std::string, std::vector<std::string>> enum_type_value_map;

  //========================================================================+
  void DbEnumDto::init()
  {
    if (isInitialized)
    {
      return;
    }

    logInfo("Initialize enum type list");
    std::vector<std::string> enum_types;

    if (!getAllEnumTypesInDB(database::DbInterface::getDbSchema(), enum_types))
    {
      THROW_RUNTIME_ERROR("Failed getting types in the DB.");
      return;
    }
    for (auto &enum_type : enum_types)
    {
      std::string enum_name(database::DbInterface::getDbSchema());
      enum_name += std::string(".");
      enum_name += "\"" + enum_type + "\"";

      std::vector<std::string> enum_values;
      if (!getAllEnumValuesInDB(enum_name, enum_values))
      {
        THROW_RUNTIME_ERROR("Failed getting values in the DB for type: " + enum_name);
        return;
      }
      for (auto &value : enum_values)
      {
        addValue(enum_type, value);
      }
    }

    isInitialized = true;
    return;
  }

  //========================================================================+
  void DbEnumDto::createAllRequest()
  {
    //! SvtDbEnumDto::GetAllEnums
    addRequest("GetAllEnums",
               std::bind(&DbEnumDto::getAllEntries, this,
                         std::placeholders::_1, std::placeholders::_2));
  }

  //========================================================================+
  bool DbEnumDto::getAllEnumTypesInDB(
      const std::string &schema, std::vector<std::string> &enum_types)
  {
    database::rows_t rows;
    std::string query =
        "SELECT DISTINCT n.nspname AS enum_schema, t.typname AS enum_name\n";
    query += "FROM pg_type t\n";
    query += "join pg_enum e on t.oid = e.enumtypid\n";
    query += "join pg_catalog.pg_namespace n ON n.oid = t.typnamespace;";

    enum_types.clear();
    try
    {
      database::dbapi::doGenericQuery(query, rows);
      for (auto &rowValues : rows.values)
      {
        if (!schema.compare(rowValues.at(0).get<std::string>()))
        {
          enum_types.push_back(rowValues.at(1).get<std::string>());
        }
      }
      database::dbapi::finishQuery(rows);
    }
    catch (const std::exception &e)
    {
      enum_types.clear();
      throw e;
    }
    return true;
  }

  //========================================================================+
  bool DbEnumDto::getAllEnumValuesInDB(
      std::string type_name, std::vector<std::string> &enum_values)
  {
    database::rows_t rows;
    std::string query = "SELECT enum_range(null::" + type_name + ");";

    enum_values.clear();
    try
    {
      database::dbapi::doGenericQuery(query, rows);
      const auto &data_field = rows.values[0][0].get<std::string>();
      std::string_view res{data_field};
      database::dbapi::finishQuery(rows);

      res.remove_prefix(res.find('{') + 1);
      res.remove_suffix(res.size() - res.find_last_of('}'));

      const std::string_view delimiter(",");
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
  bool DbEnumDto::addEnumValueInDB(std::string type_name,
                                   std::string value)
  {
    std::string cmd =
        "ALTER TYPE " + type_name + " ADD VALUE IF NOT EXISTS '" + value + "';";

    if (!database::dbapi::doGenericUpdate(cmd))
    {
      database::dbapi::rollbackUpdate();
      return false;
    }
    database::dbapi::commitUpdate();
    return true;
  }

  //========================================================================+
  void DbEnumDto::addValue(const std::string &type,
                           std::string &value)
  {
    enum_type_value_map[type].push_back(value);
  }

  //========================================================================+
  std::vector<std::string> DbEnumDto::getTypeNames()
  {
    if (!isInitialized)
      init();

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
  DbEnumDto::getEnumValues(const std::string &enum_type)
  {
    if (!isInitialized)
      init();

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
  void DbEnumDto::print()
  {
    logInfo("Db Agent Enums");
    for (const auto &[enum_type, values] : enum_type_value_map)
    {
      logInfo("type " + enum_type);
      for (const auto &value : values)
      {
        logInfo("\t " + value);
      }
    }
  }

  //========================================================================+
  void DbEnumDto::getAllEntries(
      const SvtKafkaMessage &msg,
      SvtKafkaReplyMsg &replyMsg)
  {
    const auto &msgData = msg.getPayload()["data"];
    std::vector<std::string> enum_types =
        (msgData.contains("enumNames"))
            ? msgData["enumNames"].get<std::vector<std::string>>()
            : getTypeNames();
    getAllEnumValuesReplyMsg(enum_types, replyMsg);
  }

  //========================================================================+
  void DbEnumDto::getAllEnumValuesReplyMsg(
      const std::vector<std::string> &types,
      SvtKafkaReplyMsg &msgReply)
  {
    std::string enum_name(database::DbInterface::getDbSchema());
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
          SvtKafka::msgStatus[SvtKafka::SvtKafkaMsgStatus::Success]);
      msgReply.setError(0, "");
    }
    catch (const std::exception &e)
    {
      throw e;
    }
    return;
  }
}  // namespace dbagent
