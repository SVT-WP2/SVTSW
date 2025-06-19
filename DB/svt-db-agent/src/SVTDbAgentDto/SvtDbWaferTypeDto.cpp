/*!
 * @file SvtDbWaferTypeDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWaferTypeDto
 */

#include "SVTDbAgentDto/SvtDbWaferTypeDto.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDb/sqlmapi.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include <stdexcept>

//========================================================================+
size_t SvtDbWaferTypeDto::getAllWaferTypesInDB(
    std::vector<dbWaferTypeRecords> &waferTypes,
    const std::vector<int> &id_filters)
{
  waferTypes.clear();
  SimpleQuery query;

  std::string tableName = SvtDbAgent::db_schema + std::string(".WaferType");
  query.setTableName(tableName);

  for (const auto &record : dbWaferTypeRecords::val_names)
  {
    query.addColumn(record);
  }

  if (!id_filters.empty())
  {
    query.addWhereIn("id", id_filters);
  }

  try
  {
    vector<vector<MultiBase *>> rows;
    query.doQuery(rows);

    for (vector<MultiBase *> row : rows)
    {
      if (row.size() != dbWaferTypeRecords::val_names.size())
      {
        throw std::range_error("");
      }
      dbWaferTypeRecords waferType;
      //! waferTyoe id
      waferType.id = (row.at(0)) ? row.at(0)->getInt() : -1;
      //! waferType serialNumber
      waferType.name = (row.at(1)) ? row.at(1)->getString() : "";
      //! waferType engineeringRun
      waferType.engineeringRun = (row.at(2)) ? row.at(2)->getString() : "";
      //! waferType foundry
      waferType.foundry = (row.at(3)) ? row.at(3)->getString() : "";
      //! waferType technology
      waferType.technology = (row.at(4)) ? row.at(4)->getString() : "";
      // //! waferType imageBase64String
      // waferType.imageBase64String = (row.at(5)) ? row.at(5)->getString() :
      // "";
      //! waferType waferMap
      waferType.waferMap = (row.at(5)) ? row.at(5)->getString() : "";

      waferTypes.push_back(waferType);
    }
  }
  catch (const std::exception &e)
  {
    Singleton<SvtLogger>::instance().logError(e.what());
    waferTypes.clear();
  }

  return waferTypes.size();
}

//========================================================================+
bool SvtDbWaferTypeDto::createWaferTypeInDB(
    const dbWaferTypeRecords &waferType)
{
  SimpleInsert insert;

  std::string tableName = SvtDbAgent::db_schema + std::string(".WaferType");
  insert.setTableName(tableName);

  //! checkinput values
  if (waferType.name.empty() || waferType.foundry.empty() ||
      waferType.technology.empty() || waferType.engineeringRun.empty() ||
      waferType.waferMap.empty())
  {
    return false;
  }

  //! Add columns & values
  insert.addColumnAndValue("name", waferType.name);
  insert.addColumnAndValue("foundry", waferType.foundry);
  insert.addColumnAndValue("technology", waferType.technology);
  insert.addColumnAndValue("engineeringRun", waferType.engineeringRun);
  insert.addColumnAndValue("waferMap", waferType.waferMap);

  if (!insert.doInsert())
  {
    rollbackUpdate();
    return -1;
  }
  commitUpdate();
  return true;
}
//========================================================================+
void SvtDbWaferTypeDto::getAllWaferTypes(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  std::vector<int> id_filters;
  if (msgData.contains("filter"))
  {
    if (msgData.contains("ids"))
    {
      id_filters = msgData["filter"]["ids"].get<std::vector<int>>();
    }
  }
  std::vector<dbWaferTypeRecords> waferTypes;
  const auto n_wafer_types = getAllWaferTypesInDB(waferTypes, id_filters);
  if (id_filters.size() && n_wafer_types != id_filters.size())
  {
    throw std::runtime_error("ERROR: ");
  }
  getAllWaferTypesReplyMsg(waferTypes, replyMsg);
}

//========================================================================+
void SvtDbWaferTypeDto::getAllWaferTypesReplyMsg(
    const std::vector<dbWaferTypeRecords> &waferTypes,
    SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::ordered_json items = nlohmann::json::array();
    for (const auto &waferType : waferTypes)
    {
      nlohmann::ordered_json json_wafer_type;
      json_wafer_type["id"] = waferType.id;
      json_wafer_type["name"] = waferType.name;
      json_wafer_type["foundry"] = waferType.foundry;
      json_wafer_type["technology"] = waferType.technology;
      json_wafer_type["engineeringRun"] = waferType.engineeringRun;
      // json_wafer_type["imageBase64String"] = waferType.imageBase64String;
      json_wafer_type["waferMap"] = waferType.waferMap;

      items.push_back(json_wafer_type);
    }
    data["items"] = items;
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

//========================================================================+
void SvtDbWaferTypeDto::createWaferType(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    throw std::runtime_error("DbAgentService: Non object create was found");
  }

  auto json_wafer_type = msgData["create"];
  //! remove id record
  if (json_wafer_type.size() < (dbWaferTypeRecords::val_names.size() - 1))
  {
    throw std::invalid_argument("insufficient number of parameters");
  }

  dbWaferTypeRecords waferType;
  //! waferType.name
  waferType.name = json_wafer_type.value("name", "");
  //! waferType.foundry
  waferType.foundry = json_wafer_type.value("foundry", "");
  //! waferType.technology
  waferType.technology = json_wafer_type.value("technology", "");
  //! waferType.engineeringRun
  waferType.engineeringRun = json_wafer_type.value("engineeringRun", "");
  // //! waferType.imageBase64String
  // waferType.imageBase64String = json_wafer_type.value("imageBase64String",
  // "");
  //! waferType.waferMap
  if (nlohmann::json::accept(json_wafer_type.value("waferMap", "")))
  {
    waferType.waferMap = json_wafer_type.value("waferMap", "");
  }
  else
  {
    throw std::runtime_error("ERROR: invalid JSON format found for waferMap");
    return;
  }

  //! create wafer type in DB
  if (!createWaferTypeInDB(waferType))
  {
    throw std::runtime_error("ERROR: wafer type was not created");
    return;
  }

  const auto newWaferTypeId = SvtDbInterface::getMaxId("WaferType");
  std::vector<int> id_filters = {static_cast<int>(newWaferTypeId)};

  std::vector<dbWaferTypeRecords> waferTypes;
  const auto n_wafer_types = getAllWaferTypesInDB(waferTypes, id_filters);
  if (id_filters.size() && n_wafer_types != id_filters.size())
  {
    throw std::runtime_error(
        "ERROR: incomplete number of returned wafer types");
    return;
  }
  createWaferTypeReplyMsg(waferTypes.at(0), replyMsg);
  return;
}

//========================================================================+
void SvtDbWaferTypeDto::createWaferTypeReplyMsg(
    const dbWaferTypeRecords &waferType,
    SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::json ret_json_waferType;
    ret_json_waferType["id"] = waferType.id;
    ret_json_waferType["name"] = waferType.name;
    ret_json_waferType["foundry"] = waferType.foundry;
    ret_json_waferType["technology"] = waferType.technology;
    ret_json_waferType["engineeringRun"] = waferType.engineeringRun;
    // ret_json_waferType["imageBase64String"] = waferType.imageBase64String;
    ret_json_waferType["waferMap"] = waferType.waferMap;

    data["entity"] = ret_json_waferType;
    msgReply.setData(data);
    msgReply.setStatus(
        SvtDbAgent::msgStatus[SvtDbAgent::SvtDbAgentMsgStatus::Success]);
    msgReply.setError(0, "");
  }
  catch (const std::exception &e)
  {
    throw e;
  }
}
