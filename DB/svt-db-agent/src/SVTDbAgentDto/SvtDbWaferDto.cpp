/*!
 * @file SvtDbWaferTypeDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWaferTypeDto
 */

#include "SVTDbAgentDto/SvtDbWaferDto.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDb/sqlmapi.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include <stdexcept>

//========================================================================+
size_t SvtDbWaferDto::getAllWafersInDB(std::vector<dbWaferRecords> &wafers,
                                       const std::vector<int> &id_filters)
{
  wafers.clear();
  SimpleQuery query;

  std::string tableName = SvtDbAgent::db_schema + std::string(".Wafer");
  query.setTableName(tableName);

  for (const auto &record : dbWaferRecords::val_names)
  {
    query.addColumn(std::string(record));
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
      if (row.size() != dbWaferRecords::val_names.size())
      {
        throw std::range_error("");
      }
      dbWaferRecords wafer;
      //! wafer id
      wafer.id = (row.at(0)) ? row.at(0)->getInt() : -1;
      //! wafer serialNumber
      wafer.serialNumber = (row.at(1)) ? row.at(1)->getString() : "";
      //! wafer batchNumber
      wafer.batchNumber = (row.at(2)) ? row.at(2)->getInt() : -1;
      //! wafer generalLocation
      wafer.generalLocation = (row.at(3)) ? row.at(3)->getString() : "";
      //! wafer waferTypeId
      wafer.waferTypeId = (row.at(4)) ? row.at(4)->getInt() : -1;
      //! wafer thiningDate
      wafer.thinningDate = (row.at(5)) ? row.at(5)->getString() : "";
      //! wafer dicingDate
      wafer.dicingDate = (row.at(6)) ? row.at(6)->getString() : "";
      //! wafer productionDate
      wafer.productionDate = (row.at(7)) ? row.at(7)->getString() : "";

      wafers.push_back(wafer);
    }
  }
  catch (const std::exception &e)
  {
    Singleton<SvtLogger>::instance().logError(e.what());
    wafers.clear();
  }

  return wafers.size();
}

//========================================================================+
bool SvtDbWaferDto::createWaferInDB(const dbWaferRecords &wafer)
{
  SimpleInsert insert;

  std::string tableName = SvtDbAgent::db_schema + std::string(".Wafer");
  insert.setTableName(tableName);

  //! checkinput values
  if (wafer.serialNumber.empty() || wafer.generalLocation.empty() ||
      (wafer.batchNumber < 0) || (wafer.waferTypeId < 0))
  {
    return false;
  }

  //! Add columns & values
  insert.addColumnAndValue("serialNumber", wafer.serialNumber);
  insert.addColumnAndValue("batchNumber", wafer.batchNumber);
  insert.addColumnAndValue("waferTypeId", wafer.waferTypeId);
  insert.addColumnAndValue("generalLocation", wafer.generalLocation);

  //! thinningDate ()
  if (!wafer.thinningDate.empty())
  {
    insert.addColumnAndValue("thinningDate", wafer.thinningDate);
  }

  //! dicingDate
  if (!wafer.dicingDate.empty())
  {
    insert.addColumnAndValue("dicingDate", wafer.dicingDate);
  }

  //! productionDate
  if (!wafer.productionDate.empty())
  {
    insert.addColumnAndValue("productionDate", wafer.productionDate);
  }

  if (!insert.doInsert())
  {
    rollbackUpdate();
    return -1;
  }
  commitUpdate();
  return true;
}

//========================================================================+
bool SvtDbWaferDto::updateWaferInDB(const dbWaferRecords &wafer)
{
  SimpleUpdate update;

  std::string tableName = SvtDbAgent::db_schema + std::string(".Wafer");
  update.setTableName(tableName);

  //! Add columns & values
  if (!wafer.generalLocation.empty())
  {
    update.addColumnAndValue("generalLocation", wafer.generalLocation);
  }

  if (!wafer.thinningDate.empty())
  {
    update.addColumnAndValue("thinningDate", wafer.thinningDate);
  }

  if (!wafer.dicingDate.empty())
  {
    update.addColumnAndValue("dicingDate", wafer.dicingDate);
  }

  if (!wafer.productionDate.empty())
  {
    update.addColumnAndValue("productionDate", wafer.productionDate);
  }

  if (!update.doUpdate())
  {
    rollbackUpdate();
    return -1;
  }
  commitUpdate();
  return true;
}

//========================================================================+
size_t SvtDbWaferDto::getAllWaferLocationsInDB(
    std::vector<dbWaferLocationRecords> &waferLocations, const int &waferId)
{
  try
  {
    waferLocations.clear();
    SimpleQuery query;

    std::string tableName =
        SvtDbAgent::db_schema + std::string(".WaferLocation");
    query.setTableName(tableName);

    for (const auto &record : dbWaferRecords::val_names)
    {
      query.addColumn(std::string(record));
    }

    query.addWhereEquals("id", waferId);

    vector<vector<MultiBase *>> rows;
    query.doQuery(rows);

    for (vector<MultiBase *> row : rows)
    {
      if (row.size() != dbWaferRecords::val_names.size())
      {
        throw std::range_error("");
      }
      dbWaferLocationRecords waferLoc;
      //! waferId
      waferLoc.waferId = (row.at(0)) ? row.at(0)->getInt() : -1;
      //! generalLocation
      waferLoc.generalLocation = (row.at(1)) ? row.at(1)->getString() : "";
      //! creationTime
      waferLoc.creationTime = (row.at(2)) ? row.at(2)->getString() : "";
      //! username
      waferLoc.username = (row.at(3)) ? row.at(3)->getString() : "";
      //! description
      waferLoc.description = (row.at(4)) ? row.at(4)->getString() : "";

      waferLocations.push_back(waferLoc);
    }
  }
  catch (const std::exception &e)
  {
    Singleton<SvtLogger>::instance().logError(e.what());
    waferLocations.clear();
  }

  return waferLocations.size();
}

//========================================================================+
bool SvtDbWaferDto::createWaferLocationInDB(
    const dbWaferLocationRecords &waferLoc)
{
  SimpleInsert insert;

  std::string tableName = SvtDbAgent::db_schema + std::string(".WaferLocation");
  insert.setTableName(tableName);

  //! checkinput values
  if (waferLoc.generalLocation.empty() || (waferLoc.waferId < 0))
  {
    return false;
  }
  //! Add columns & values
  insert.addColumnAndValue("waferId", waferLoc.waferId);
  insert.addColumnAndValue("generalLocation", waferLoc.generalLocation);
  insert.addColumnAndValue("username", waferLoc.username);
  insert.addColumnAndValue("description", waferLoc.description);

  //! creationTime
  if (!waferLoc.creationTime.empty())
  {
    insert.addColumnAndValue("creationTime", waferLoc.creationTime);
  }

  if (!insert.doInsert())
  {
    rollbackUpdate();
    return -1;
  }
  commitUpdate();
  return true;
}
//========================================================================+
void SvtDbWaferDto::getAllWafers(const SvtDbAgent::SvtDbAgentMessage &msg,
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
  std::vector<dbWaferRecords> wafers;
  const auto n_wafers = getAllWafersInDB(wafers, id_filters);
  if (id_filters.size() && n_wafers != id_filters.size())
  {
    throw std::runtime_error("ERROR: ");
  }
  getAllWafersReplyMsg(wafers, replyMsg);
}

//========================================================================+
void SvtDbWaferDto::getAllWafersReplyMsg(
    const std::vector<dbWaferRecords> &wafers,
    SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::ordered_json items = nlohmann::json::array();
    for (const auto &wafer : wafers)
    {
      nlohmann::ordered_json json_wafer;
      json_wafer["id"] = wafer.id;
      json_wafer["serialNumber"] = wafer.serialNumber;
      json_wafer["batchNumber"] = wafer.batchNumber;
      json_wafer["generalLocation"] = wafer.generalLocation;
      json_wafer["thinningDate"] = wafer.thinningDate;
      json_wafer["dicingDate"] = wafer.dicingDate;
      json_wafer["productionDate"] = wafer.productionDate;
      json_wafer["waferTypeId"] = wafer.waferTypeId;

      items.push_back(json_wafer);
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
void SvtDbWaferDto::createWafer(const SvtDbAgent::SvtDbAgentMessage &msg,
                                SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    throw std::runtime_error("DbAgentService: Non object create was found");
  }
  auto json_wafer = msgData["create"];
  //! remove id record
  if (json_wafer.size() < (dbWaferRecords::val_names.size() - 1))
  {
    throw std::invalid_argument("insufficient number of parameters");
  }

  dbWaferRecords wafer;
  //! wafer.serialNumber
  wafer.serialNumber = json_wafer.value("serialNumber", "");
  //! wafer.batchNumber
  wafer.batchNumber = json_wafer.value("batchNumber", -1);
  //! wafer.generalLocation
  wafer.generalLocation = json_wafer.value("generalLocation", "");
  //! wafer.thinningDate
  SvtDbAgent::get_v(json_wafer, "thinningDate", wafer.thinningDate);
  //! wafer.dicingDate
  SvtDbAgent::get_v(json_wafer, "dicingDate", wafer.dicingDate);
  //! wafer.productionDate
  SvtDbAgent::get_v(json_wafer, "productionDate", wafer.productionDate);
  //! wafer.waferTypeId
  wafer.waferTypeId = json_wafer.value("waferTypeId", -1);

  //! create wafer in DB
  if (!createWaferInDB(wafer))
  {
    throw std::runtime_error("ERROR: wafer type was not created");
    return;
  }
  const auto newWaferId = SvtDbInterface::getMaxId("Wafer");
  std::vector<int> id_filters = {static_cast<int>(newWaferId)};

  std::vector<dbWaferRecords> wafers;
  const auto n_wafers = getAllWafersInDB(wafers, id_filters);
  if (id_filters.size() && n_wafers != id_filters.size())
  {
    throw std::runtime_error("ERROR: incomplete number of wafers returning");
    return;
  }
  createWaferReplyMsg(wafers.at(0), replyMsg);

  //! Create waferLocations
  dbWaferLocationRecords waferLoc;
  waferLoc.waferId = newWaferId;
  waferLoc.generalLocation = wafers.at(0).generalLocation;
  waferLoc.description = std::string("Location at creation");
  if (!createWaferLocationInDB(waferLoc))
  {
    throw std::runtime_error("ERROR: Could not create wafer location entry");
    return;
  }
  return;
}

//========================================================================+
void SvtDbWaferDto::createWaferReplyMsg(
    const dbWaferRecords &wafer, SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::json ret_json_wafer;
    ret_json_wafer["id"] = wafer.id;
    ret_json_wafer["serialNumber"] = wafer.serialNumber;
    ret_json_wafer["batchNumber"] = wafer.batchNumber;
    ret_json_wafer["generalLocation"] = wafer.generalLocation;
    ret_json_wafer["thinningDate"] = wafer.thinningDate;
    ret_json_wafer["dicingDate"] = wafer.dicingDate;
    ret_json_wafer["productionDate"] = wafer.productionDate;
    ret_json_wafer["waferTypeId"] = wafer.waferTypeId;

    data["entity"] = ret_json_wafer;
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

//========================================================================+
void SvtDbWaferDto::updateWafer(const SvtDbAgent::SvtDbAgentMessage &msg,
                                SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("id"))
  {
    throw std::runtime_error("DbAgentService: Non object id was found");
  }
  if (!msgData.contains("update"))
  {
    throw std::runtime_error("DbAgentService: Non object update was found");
  }

  const auto waferId = msgData["id"];
  const auto json_wafer = msgData["update"];

  dbWaferRecords wafer;
  wafer.id = waferId;
  bool found_entry_to_update = false;
  if (!json_wafer["thinningDate"].is_null())
  {
    wafer.thinningDate = json_wafer["thinningDate"];
    found_entry_to_update = true;
  }
  if (!json_wafer["dicingDate"].is_null())
  {
    wafer.dicingDate = json_wafer["dicingDate"];
    found_entry_to_update = true;
  }
  if (!json_wafer["productionDate"].is_null())
  {
    wafer.productionDate = json_wafer["productionDate"];
    found_entry_to_update = true;
  }

  if (!found_entry_to_update)
  {
    throw std::runtime_error("ERROR: no entry to update found");
    return;
  }
  if (!updateWaferInDB(wafer))
  {
    throw std::runtime_error("ERROR: wafer was not updated");
  }

  std::vector<int> id_filters = {waferId};

  std::vector<dbWaferRecords> wafers;
  const auto n_wafers = getAllWafersInDB(wafers, id_filters);
  if (id_filters.size() && n_wafers != id_filters.size())
  {
    throw std::runtime_error(
        std::string("ERROR: could not find the updated wafer with id ") +
        std::string(waferId));
  }
  createWaferReplyMsg(wafers.at(0), replyMsg);

  return;
}

//========================================================================+
void SvtDbWaferDto::updateWaferLocation(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("waferId") || !msgData.contains("generalLocation") ||
      !msgData.contains("date") || !msgData.contains("username"))
  {
    throw std::runtime_error("ERROR: Wron format for data");
  }

  auto waferId = msgData["waferId"];
  //! Create waferLocations
  dbWaferLocationRecords waferLoc;
  waferLoc.waferId = msgData["waferId"];
  waferLoc.generalLocation = msgData["generalLocation"];
  waferLoc.creationTime = msgData["date"];
  waferLoc.username = msgData["username"];
  waferLoc.description = std::string("Update Location");
  if (!createWaferLocationInDB(waferLoc))
  {
    throw std::runtime_error("ERROR: Could not create wafer location entry");
    return;
  }

  //! update general location for wafer with waferId
  dbWaferRecords wafer;
  wafer.id = waferId;
  wafer.generalLocation = msgData["generalLocation"];
  if (!updateWaferInDB(wafer))
  {
    throw std::runtime_error("ERROR: wafer was not updated");
  }

  std::vector<int> id_filters = {waferId};

  std::vector<dbWaferRecords> wafers;
  const auto n_wafers = getAllWafersInDB(wafers, id_filters);
  if (id_filters.size() && n_wafers != id_filters.size())
  {
    throw std::runtime_error(
        std::string("ERROR: could not find the updated wafer with id ") +
        std::string(waferId));
  }
  createWaferReplyMsg(wafers.at(0), replyMsg);
}
