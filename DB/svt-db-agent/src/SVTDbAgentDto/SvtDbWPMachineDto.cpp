/*!
 * stname
 * @file SvtDbWPMachine.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWPMachine
 */

#include "SVTDbAgentDto/SvtDbWPMachineDto.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDb/sqlmapi.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include <sstream>
#include <stdexcept>

using SvtDbAgent::Singleton;

//========================================================================+
bool SvtDbWPMachineDto::getAllWPMachinesFromDB(
    std::vector<dbWPMachineRecords> &wpMachines,
    const std::vector<int> &id_filters)
{
  wpMachines.clear();
  SimpleQuery query;

  std::string tableName =
      SvtDbAgent::db_schema + std::string(".WaferProbeMachine");
  query.setTableName(tableName);

  for (const auto &record : dbWPMachineRecords::val_names)
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
      if (row.size() != dbWPMachineRecords::val_names.size())
      {
        throw std::range_error("");
      }
      dbWPMachineRecords wpm;
      //! wpm id
      wpm.id = (row.at(0)) ? row.at(0)->getInt() : -1;
      //! wpm serialNumber
      wpm.serialNumber = (row.at(1)) ? row.at(1)->getString() : "";
      //! wpm name
      wpm.name = (row.at(2)) ? row.at(2)->getString() : "";
      //! wpm hostName
      wpm.hostName = (row.at(3)) ? row.at(3)->getString() : "";
      //! wpm connectionType
      wpm.connectionType = (row.at(4)) ? row.at(4)->getString() : "";
      //! wpm connectionPort
      wpm.connectionPort = (row.at(5)) ? row.at(5)->getInt() : -1;
      //! wpm generalLocation
      wpm.generalLocation = (row.at(6)) ? row.at(6)->getString() : "";
      //! wpm software
      wpm.software = (row.at(7)) ? row.at(7)->getString() : "";
      //! wpm swVersion
      wpm.swVersion = (row.at(8)) ? row.at(8)->getString() : "";
      //! wpm vendor
      wpm.vendor = (row.at(9)) ? row.at(9)->getString() : "";

      wpMachines.push_back(wpm);
    }
    if (id_filters.size() && wpMachines.size() != id_filters.size())
    {
      throw std::runtime_error("ERROR: ");
    }
  }
  catch (const std::exception &e)
  {
    Singleton<SvtLogger>::instance().logError(e.what());
    wpMachines.clear();
    return false;
  }

  return true;
}

//========================================================================+
bool SvtDbWPMachineDto::getWPMachineFromDB(dbWPMachineRecords &wpm, int id)
{
  std::vector<int> id_filters = {id};
  std::vector<dbWPMachineRecords> wpMachines;
  if (!getAllWPMachinesFromDB(wpMachines, id_filters))
  {
    return false;
  }
  wpm = std::move(wpMachines.at(0));

  return true;
}

//========================================================================+
bool SvtDbWPMachineDto::createWPMachineInDB(const dbWPMachineRecords &wpm)
{
  SimpleInsert insert;

  std::string tableName =
      SvtDbAgent::db_schema + std::string(".WaferProbeMachine");
  insert.setTableName(tableName);

  //! checkinput values
  if (wpm.serialNumber.empty() || wpm.name.empty() || wpm.hostName.empty() ||
      wpm.connectionType.empty() || (wpm.connectionPort < 1) ||
      wpm.generalLocation.empty() || wpm.software.empty() ||
      wpm.swVersion.empty() || wpm.vendor.empty())
  {
    return false;
  }

  //! Add columns & values
  insert.addColumnAndValue("serialNumber", wpm.serialNumber);
  insert.addColumnAndValue("name", wpm.name);
  insert.addColumnAndValue("hostName", wpm.hostName);
  insert.addColumnAndValue("connectionType", wpm.connectionType);
  insert.addColumnAndValue("connectionPort", wpm.connectionPort);
  insert.addColumnAndValue("generalLocation", wpm.generalLocation);
  insert.addColumnAndValue("software", wpm.software);
  insert.addColumnAndValue("swVersion", wpm.swVersion);
  insert.addColumnAndValue("vendor", wpm.vendor);

  if (!insert.doInsert())
  {
    rollbackUpdate();
    return -1;
  }
  commitUpdate();

  return true;
}

//========================================================================+
bool SvtDbWPMachineDto::updateWPMachineInDB(const dbWPMachineRecords &wpm)
{
  SimpleUpdate update;

  std::string tableName =
      SvtDbAgent::db_schema + std::string(".WaferProbeMachine");
  update.setTableName(tableName);

  //! Add columns & values
  if (!wpm.hostName.empty())
  {
    update.addColumnAndValue("hostName", wpm.hostName);
  }
  if (!wpm.connectionType.empty())
  {
    update.addColumnAndValue("connectionType", wpm.connectionType);
  }
  if (wpm.connectionPort >= 0)
  {
    update.addColumnAndValue("connectionPort", wpm.connectionPort);
  }
  if (!wpm.generalLocation.empty())
  {
    update.addColumnAndValue("generalLocation", wpm.generalLocation);
  }
  if (!wpm.software.empty())
  {
    update.addColumnAndValue("software", wpm.software);
  }
  if (!wpm.swVersion.empty())
  {
    update.addColumnAndValue("swVersion", wpm.generalLocation);
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
void SvtDbWPMachineDto::getAllWPMachines(
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
  std::vector<dbWPMachineRecords> wpMachines;
  if (getAllWPMachinesFromDB(wpMachines, id_filters))
  {
    getAllWPMachinesReplyMsg(wpMachines, replyMsg);
  }
}

//========================================================================+
void SvtDbWPMachineDto::getAllWPMachinesReplyMsg(
    const std::vector<dbWPMachineRecords> &wpMachines,
    SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::ordered_json items = nlohmann::json::array();
    for (const auto &wpm : wpMachines)
    {
      nlohmann::ordered_json wpm_j;
      wpm_j["id"] = wpm.id;
      wpm_j["serialNumber"] = wpm.serialNumber;
      wpm_j["name"] = wpm.name;
      wpm_j["hostName"] = wpm.hostName;
      wpm_j["connectionType"] = wpm.connectionType;
      wpm_j["connectionPort"] = wpm.connectionPort;
      wpm_j["generalLocation"] = wpm.generalLocation;
      wpm_j["software"] = wpm.software;
      wpm_j["swVersion"] = wpm.swVersion;
      wpm_j["vendor"] = wpm.vendor;

      items.push_back(wpm_j);
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
void SvtDbWPMachineDto::createWPMachine(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    throw std::runtime_error("DbAgentService: Non object create was found");
  }
  auto wpm_j = msgData["create"];
  //! remove id record
  if (wpm_j.size() < (dbWPMachineRecords::val_names.size() - 1))
  {
    throw std::invalid_argument("insufficient number of parameters");
  }

  dbWPMachineRecords wpm;
  //! wpm.serialNumber
  wpm.serialNumber = wpm_j.value("serialNumber", "");
  //! wpm.name
  wpm.name = wpm_j.value("name", "");
  //! wpm.hostName
  wpm.hostName = wpm_j.value("hostName", "");
  //! wpm.connectionType
  wpm.connectionType = wpm_j.value("connectionType", "");
  //! wpm.connectionPort
  wpm.connectionPort = wpm_j.value("connectionPort", -1);
  //! wpm.generalLocation
  wpm.generalLocation = wpm_j.value("generalLocation", "");
  //! wpm.software
  wpm.software = wpm_j.value("software", "");
  //! wpm.swVersion
  wpm.swVersion = wpm_j.value("swVersion", "");
  //! wpm.vendor
  wpm.vendor = wpm_j.value("vendor", "");

  //! create wpm in DB
  if (!createWPMachineInDB(wpm))
  {
    throw std::runtime_error("ERROR: Wafer Probe Machine was not created");
    return;
  }
  const auto newWPMId = SvtDbInterface::getMaxId("WaferProbeMachine");
  getWPMachineFromDB(wpm, newWPMId);
  createWPMachineReplyMsg(wpm, replyMsg);
}

//========================================================================+
void SvtDbWPMachineDto::createWPMachineReplyMsg(
    const dbWPMachineRecords &wpm, SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::json ret_wpm_j;
    ret_wpm_j["id"] = wpm.id;
    ret_wpm_j["serialNumber"] = wpm.serialNumber;
    ret_wpm_j["name"] = wpm.name;
    ret_wpm_j["hostName"] = wpm.hostName;
    ret_wpm_j["connectionType"] = wpm.connectionType;
    ret_wpm_j["connectionPort"] = wpm.connectionPort;
    ret_wpm_j["generalLocation"] = wpm.generalLocation;
    ret_wpm_j["software"] = wpm.software;
    ret_wpm_j["swVersion"] = wpm.swVersion;
    ret_wpm_j["vendor"] = wpm.vendor;

    data["entity"] = ret_wpm_j;
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
void SvtDbWPMachineDto::updateWPMachine(
    const SvtDbAgent::SvtDbAgentMessage &msg,
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

  const auto wpMachineId = msgData["id"];
  const auto wpm_j = msgData["update"];

  if (!SvtDbInterface::checkIdExist("WaferProbeMachine", wpMachineId))
  {
    std::ostringstream ss("");
    ss << "ERROR: Wafer Probe Machine with id " << wpMachineId
       << " does not found.";
    throw std::runtime_error(ss.str());
  }

  dbWPMachineRecords wpm;
  wpm.id = wpMachineId;
  bool found_entry_to_update = false;
  // if (!wpm_j["thinningDate"].is_null())
  // {
  //   wpm.thinningDate = wpm_j["thinningDate"];
  //   found_entry_to_update = true;
  // }
  // if (!wpm_j["dicingDate"].is_null())
  // {
  //   wpm.dicingDate = wpm_j["dicingDate"];
  //   found_entry_to_update = true;
  // }
  // if (!wpm_j["productionDate"].is_null())
  // {
  //   wpm.productionDate = wpm_j["productionDate"];
  //   found_entry_to_update = true;
  // }

  if (!found_entry_to_update)
  {
    throw std::runtime_error("ERROR: no entry to update found");
    return;
  }
  if (!updateWPMachineInDB(wpm))
  {
    throw std::runtime_error("ERROR: wpm was not updated");
  }

  getWPMachineFromDB(wpm, wpMachineId);
  createWPMachineReplyMsg(wpm, replyMsg);
}

// //========================================================================+
// void SvtDbWaferDto::updateWaferLocation(
//     const SvtDbAgent::SvtDbAgentMessage &msg,
//     SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
// {
//   const auto &msgData = msg.getPayload()["data"];
//   if (!msgData.contains("waferId") || !msgData.contains("generalLocation")
//   ||
//       !msgData.contains("date") || !msgData.contains("username"))
//   {
//     throw std::runtime_error("ERROR: Wron format for data");
//   }
//
//   auto waferId = msgData["waferId"];
//   if (!SvtDbInterface::checkIdExist("wafer", waferId))
//   {
//     std::ostringstream ss("");
//     ss << "ERROR: Wafer with id " << waferId << " does not found.";
//     throw std::runtime_error(ss.str());
//   }
//
//   //! Create waferLocations
//   dbWaferLocationRecords waferLoc;
//   waferLoc.waferId = msgData["waferId"];
//   waferLoc.generalLocation = msgData["generalLocation"];
//   waferLoc.creationTime = msgData["date"];
//   waferLoc.username = msgData["username"];
//   waferLoc.description = std::string("Update Location");
//   if (!createWaferLocationInDB(waferLoc))
//   {
//     throw std::runtime_error("ERROR: Could not create wafer location
//     entry"); return;
//   }
//
//   //! update general location for wafer with waferId
//   dbWaferRecords wafer;
//   wafer.id = waferId;
//   wafer.generalLocation = msgData["generalLocation"];
//   if (!updateWaferInDB(wafer))
//   {
//     throw std::runtime_error("ERROR: wafer was not updated");
//   }
//
//   std::vector<int> id_filters = {waferId};
//
//   std::vector<dbWaferRecords> wafers;
//   const auto n_wafers = getAllWafersInDB(wafers, id_filters);
//   if (id_filters.size() && n_wafers != id_filters.size())
//   {
//     throw std::runtime_error(
//         std::string("ERROR: could not find the updated wafer with id ") +
//         std::string(waferId));
//   }
//   createWaferReplyMsg(wafers.at(0), replyMsg);
// }
