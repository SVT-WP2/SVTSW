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

//========================================================================+
size_t SvtDbWPMachineDto::getAllWPMachinesInDB(
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
  }
  catch (const std::exception &e)
  {
    Singleton<SvtLogger>::instance().logError(e.what());
    wpMachines.clear();
  }

  return wpMachines.size();
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
    return -1;
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
  const auto n_wpMachines = getAllWPMachinesInDB(wpMachines, id_filters);

  if (id_filters.size() && n_wpMachines != id_filters.size())
  {
    throw std::runtime_error("ERROR: ");
  }
  getAllWPMachinesReplyMsg(wpMachines, replyMsg);
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
      nlohmann::ordered_json json_wpm;
      json_wpm["id"] = wpm.id;
      json_wpm["serialNumber"] = wpm.serialNumber;
      json_wpm["name"] = wpm.name;
      json_wpm["hostName"] = wpm.hostName;
      json_wpm["connectionType"] = wpm.connectionType;
      json_wpm["connectionPort"] = wpm.connectionPort;
      json_wpm["generalLocation"] = wpm.generalLocation;
      json_wpm["software"] = wpm.software;
      json_wpm["swVersion"] = wpm.swVersion;
      json_wpm["vendor"] = wpm.vendor;

      items.push_back(json_wpm);
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
void SvtDbWPMachineDto::createWPMachine(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    throw std::runtime_error("DbAgentService: Non object create was found");
  }
  auto json_wpm = msgData["create"];
  //! remove id record
  if (json_wpm.size() < (dbWPMachineRecords::val_names.size() - 1))
  {
    throw std::invalid_argument("insufficient number of parameters");
  }

  dbWPMachineRecords wpm;
  //! wpm.serialNumber
  wpm.serialNumber = json_wpm.value("serialNumber", "");
  //! wpm.name
  wpm.name = json_wpm.value("name", "");
  //! wpm.hostName
  wpm.hostName = json_wpm.value("hostName", "");
  //! wpm.connectionType
  wpm.connectionType = json_wpm.value("connectionType", "");
  //! wpm.connectionPort
  wpm.connectionPort = json_wpm.value("connectionPort", -1);
  //! wpm.generalLocation
  wpm.generalLocation = json_wpm.value("generalLocation", "");
  //! wpm.software
  wpm.software = json_wpm.value("software", "");
  //! wpm.swVersion
  wpm.swVersion = json_wpm.value("swVersion", "");
  //! wpm.vendor
  wpm.vendor = json_wpm.value("vendor", "");

  //! create wpm in DB
  if (!createWPMachineInDB(wpm))
  {
    throw std::runtime_error("ERROR: Wafer Probe Machine was not created");
    return;
  }
  const auto newWPMId = SvtDbInterface::getMaxId("WaferProbeMachine");
  std::vector<int> id_filters = {static_cast<int>(newWPMId)};

  std::vector<dbWPMachineRecords> wpMachines;
  const auto n_wpMachines = getAllWPMachinesInDB(wpMachines, id_filters);
  if (id_filters.size() && n_wpMachines != id_filters.size())
  {
    throw std::runtime_error(
        "ERROR: incomplete number of wafer Probe MAchines returning");
    return;
  }
  createWPMachineReplyMsg(wpMachines.at(0), replyMsg);

  return;
}

//========================================================================+
void SvtDbWPMachineDto::createWPMachineReplyMsg(
    const dbWPMachineRecords &wpm, SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::json ret_json_wpm;
    ret_json_wpm["id"] = wpm.id;
    ret_json_wpm["serialNumber"] = wpm.serialNumber;
    ret_json_wpm["name"] = wpm.name;
    ret_json_wpm["hostName"] = wpm.hostName;
    ret_json_wpm["connectionType"] = wpm.connectionType;
    ret_json_wpm["connectionPort"] = wpm.connectionPort;
    ret_json_wpm["generalLocation"] = wpm.generalLocation;
    ret_json_wpm["software"] = wpm.software;
    ret_json_wpm["swVersion"] = wpm.swVersion;
    ret_json_wpm["vendor"] = wpm.vendor;

    data["entity"] = ret_json_wpm;
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
  const auto json_wpm = msgData["update"];

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
  // if (!json_wpm["thinningDate"].is_null())
  // {
  //   wpm.thinningDate = json_wpm["thinningDate"];
  //   found_entry_to_update = true;
  // }
  // if (!json_wpm["dicingDate"].is_null())
  // {
  //   wpm.dicingDate = json_wpm["dicingDate"];
  //   found_entry_to_update = true;
  // }
  // if (!json_wpm["productionDate"].is_null())
  // {
  //   wpm.productionDate = json_wpm["productionDate"];
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

  std::vector<int> id_filters = {wpMachineId};

  std::vector<dbWPMachineRecords> wpMachines;
  const auto n_wpMachines = getAllWPMachinesInDB(wpMachines, id_filters);
  if (id_filters.size() && n_wpMachines != id_filters.size())
  {
    throw std::runtime_error(
        std::string("ERROR: could not find the updated wpm with id ") +
        std::string(wpMachineId));
  }
  createWPMachineReplyMsg(wpMachines.at(0), replyMsg);

  return;
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
