/*!
 * @file SvtDbWaferDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWaferDto
 */

#include "SVTDbAgentDto/SvtDbWaferDto.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDb/sqlmapi.h"
#include "SVTDbAgentDto/SvtDbAsicDto.h"
#include "SVTDbAgentDto/SvtDbWaferTypeDto.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include <algorithm>
#include <cassert>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>

using SvtDbAgent::Singleton;

//========================================================================+
bool SvtDbWaferDto::getAllWafersFromDB(std::vector<dbWaferRecords> &wafers,
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
    if (id_filters.size() && wafers.size() != id_filters.size())
    {
      throw std::runtime_error("ERROR: ");
    }
  }
  catch (const std::exception &e)
  {
    Singleton<SvtLogger>::instance().logError(e.what());
    wafers.clear();
    return false;
  }

  return true;
}

//========================================================================+
bool SvtDbWaferDto::getWaferFromDB(dbWaferRecords &wafer, int id)
{
  std::vector<int> id_filters = {id};
  std::vector<dbWaferRecords> wafers;
  if (!getAllWafersFromDB(wafers, id_filters))
  {
    return false;
  }
  wafer = std::move(wafers.at(0));

  return true;
}

//========================================================================+
bool SvtDbWaferDto::createWaferInDB(const dbWaferRecords &wafer)
{
  SimpleInsert insert;

  std::string tableName = SvtDbAgent::db_schema + std::string(".Wafer");
  insert.setTableName(tableName);

  //! check input values
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
    return false;
  }
  commitUpdate();

  return true;
}

//========================================================================+
bool SvtDbWaferDto::getAllWaferLocationsFromDB(
    std::vector<dbWaferLocationRecords> &waferLocations, const int &waferId)
{
  waferLocations.clear();
  SimpleQuery query;

  std::string tableName = SvtDbAgent::db_schema + std::string(".WaferLocation");
  query.setTableName(tableName);

  for (const auto &record : dbWaferRecords::val_names)
  {
    query.addColumn(std::string(record));
  }

  query.addWhereEquals("id", waferId);

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
    return false;
  }

  return true;
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
  if (getAllWafersFromDB(wafers, id_filters))
  {
    getAllWafersReplyMsg(wafers, replyMsg);
  }
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
      nlohmann::ordered_json wafer_j;
      wafer_j["id"] = wafer.id;
      wafer_j["serialNumber"] = wafer.serialNumber;
      wafer_j["batchNumber"] = wafer.batchNumber;
      wafer_j["generalLocation"] = wafer.generalLocation;
      wafer_j["thinningDate"] = wafer.thinningDate;
      wafer_j["dicingDate"] = wafer.dicingDate;
      wafer_j["productionDate"] = wafer.productionDate;
      wafer_j["waferTypeId"] = wafer.waferTypeId;

      items.push_back(wafer_j);
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
    return;
  }
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
  auto wafer_j = msgData["create"];
  //! remove id record
  if (wafer_j.size() < (dbWaferRecords::val_names.size() - 1))
  {
    throw std::invalid_argument("insufficient number of parameters");
  }

  dbWaferRecords wafer;
  //! wafer.serialNumber
  wafer.serialNumber = wafer_j.value("serialNumber", "");
  //! wafer.batchNumber
  wafer.batchNumber = wafer_j.value("batchNumber", -1);
  //! wafer.generalLocation
  wafer.generalLocation = wafer_j.value("generalLocation", "");
  //! wafer.thinningDate
  SvtDbAgent::get_v(wafer_j, "thinningDate", wafer.thinningDate);
  //! wafer.dicingDate
  SvtDbAgent::get_v(wafer_j, "dicingDate", wafer.dicingDate);
  //! wafer.productionDate
  SvtDbAgent::get_v(wafer_j, "productionDate", wafer.productionDate);
  //! wafer.waferTypeId
  wafer.waferTypeId = wafer_j.value("waferTypeId", -1);

  //! create wafer in DB
  if (!createWaferInDB(wafer))
  {
    throw std::runtime_error("ERROR: wafer type was not created");
    return;
  }
  const auto newWaferId = SvtDbInterface::getMaxId("Wafer");
  getWaferFromDB(wafer, newWaferId);

  //! Create waferLocations
  dbWaferLocationRecords waferLoc;
  waferLoc.waferId = newWaferId;
  waferLoc.generalLocation = wafer.generalLocation;
  waferLoc.description = std::string("Location at creation");
  if (!createWaferLocationInDB(waferLoc))
  {
    throw std::runtime_error("ERROR: Could not create wafer location entry");
    return;
  }

  // createAllAsics(wafer);
  createWaferReplyMsg(wafer, replyMsg);
}

//========================================================================+
void SvtDbWaferDto::createWaferReplyMsg(
    const dbWaferRecords &wafer, SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::json ret_wafer_j;
    ret_wafer_j["id"] = wafer.id;
    ret_wafer_j["serialNumber"] = wafer.serialNumber;
    ret_wafer_j["batchNumber"] = wafer.batchNumber;
    ret_wafer_j["generalLocation"] = wafer.generalLocation;
    ret_wafer_j["thinningDate"] = wafer.thinningDate;
    ret_wafer_j["dicingDate"] = wafer.dicingDate;
    ret_wafer_j["productionDate"] = wafer.productionDate;
    ret_wafer_j["waferTypeId"] = wafer.waferTypeId;

    data["entity"] = ret_wafer_j;
    msgReply.setData(data);
    msgReply.setStatus(
        SvtDbAgent::msgStatus[SvtDbAgent::SvtDbAgentMsgStatus::Success]);
    msgReply.setError(0, "");
  }
  catch (const std::exception &e)
  {
    throw e;
    return;
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
  const auto wafer_j = msgData["update"];

  if (!SvtDbInterface::checkIdExist("wafer", waferId))
  {
    std::ostringstream ss("");
    ss << "ERROR: Wafer with id " << waferId << " does not found.";
    throw std::runtime_error(ss.str());
  }

  dbWaferRecords wafer;
  wafer.id = waferId;
  bool found_entry_to_update = false;
  if (!wafer_j["thinningDate"].is_null())
  {
    wafer.thinningDate = wafer_j["thinningDate"];
    found_entry_to_update = true;
  }
  if (!wafer_j["dicingDate"].is_null())
  {
    wafer.dicingDate = wafer_j["dicingDate"];
    found_entry_to_update = true;
  }
  if (!wafer_j["productionDate"].is_null())
  {
    wafer.productionDate = wafer_j["productionDate"];
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
    return;
  }

  getWaferFromDB(wafer, waferId);
  createWaferReplyMsg(wafer, replyMsg);
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
  if (!SvtDbInterface::checkIdExist("wafer", waferId))
  {
    std::ostringstream ss("");
    ss << "ERROR: Wafer with id " << waferId << " does not found.";
    throw std::runtime_error(ss.str());
  }

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
    return;
  }

  getWaferFromDB(wafer, waferId);
  createWaferReplyMsg(wafer, replyMsg);
}

//========================================================================+
void SvtDbWaferDto::createAllAsics(const dbWaferRecords &wafer)
{
  dbWaferTypeRecords waferType;
  SvtDbWaferTypeDto::getWaferTypeFromDB(waferType, wafer.waferTypeId);
  std::string_view waferMap = waferType.waferMap;

  nlohmann::json waferMap_j = nlohmann::json::parse(waferMap);

  auto get_range = [&waferMap_j](const std::string_view g_name,
                                 const nlohmann::json &array_j,
                                 std::vector<int> &range)
  {
    std::cout << "Group: " << g_name << std::endl;
    if (!array_j.is_null() && array_j.size())
    {
      if (array_j.begin()->is_string() && array_j.begin().value() == "All")
      {
        std::cout << "Size : " << waferMap_j["Groups"][g_name].size()
                  << std::endl;
        range.resize(waferMap_j["Groups"][g_name].size());
        std::iota(range.begin(), range.end(), 0);
      }
      else if (std::all_of(
                   array_j.begin(), array_j.end(),
                   [](const nlohmann::json &el)
                   { return el.is_number(); }))
      {
        range = array_j.get<std::vector<int>>();
      }
      else
      {
        return false;
      }
    }
    return true;
  };

  //! loop group rows
  for (auto &[g_row, g_cols] : waferMap_j["MapGroups"].items())
  {
    int asic_row = std::stoi(std::string(g_row).erase(0, 12));
    int asic_col = 0;
    int g_col_index = 0;
    for (auto &g_col : g_cols["MapGroupsColumns"])
    {
      std::string g_name = g_col["GroupName"];
      std::cout << asic_row << ", " << asic_col << std::endl;

      std::vector<int> existingAsics;
      std::vector<int> mecDamagedAsics;
      std::vector<int> coveredAsics;
      std::vector<int> mecIntegerAsics;
      if (!get_range(g_name, g_col["ExistingAsics"], existingAsics) ||
          !get_range(g_name, g_col["MechanicallyDamagedASICs"],
                     mecDamagedAsics) ||
          !get_range(g_name, g_col["ASICsCoveredByGreenLayer"], coveredAsics) ||
          !get_range(g_name, g_col["MechanicallyIntergerASICs"],
                     mecIntegerAsics))
      {
        std::ostringstream ss;
        ss << "ERROR: Map Group: " << g_row << " Col: " << asic_col
           << " Wrong array found";

        throw std::runtime_error(ss.str());
      }
      //! create asics from existingAsics
      for (const auto &asic_index : existingAsics)
      {
        std::ostringstream asic_waferMapPos;
        asic_waferMapPos << asic_row << "_" << asic_col;
        std::ostringstream asic_SN(wafer.serialNumber);
        asic_SN << "_" << asic_waferMapPos.str();

        std::string asic_quality;
        if (std::find(mecDamagedAsics.begin(), mecDamagedAsics.end(),
                      asic_index) != mecDamagedAsics.end())
        {
          asic_quality = "MechanicalDamaged";
        }
        else if (std::find(coveredAsics.begin(), coveredAsics.end(),
                           asic_index) != coveredAsics.end())
        {
          asic_quality = "CoveredByGreenLayer";
        }
        else if (std::find(mecIntegerAsics.begin(), mecIntegerAsics.end(),
                           asic_index) != mecIntegerAsics.end())
        {
          asic_quality = "MechanicallyInteger";
        }
        else
        {
          std::ostringstream ss;
          ss << "ERROT: Wrong Asic quality property for asic  " << asic_index
             << " of row " << asic_row << " and group col " << g_col_index;
          throw std::runtime_error(ss.str());
        }

        dbAsicRecords asic;
        asic.waferId = wafer.id;
        asic.serialNumber = asic_SN.str();
        // asic.familyType =
        //     waferMap_j["Groups"][g_name][asic_index]["familyType"];
        asic.waferMapPosition = asic_waferMapPos.str();
        asic.quality = asic_quality;
        // SvtDbAsicDto::createAsicInDB(asic);
        ++asic_col;
      }
      ++g_col_index;
    }
  }

  return;
}
