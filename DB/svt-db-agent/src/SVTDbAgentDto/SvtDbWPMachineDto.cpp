/*!
 * stname
 * @file SvtDbWPMachine.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWPMachine
 */

#include "SVTDbAgentDto/SvtDbWPMachineDto.h"

//========================================================================+
SvtDbAgent::SvtDbWPMachineDto::SvtDbWPMachineDto()
{
  SetTableName("WaferProbeMachine");
  AddIntColName("id");
  AddIntColName("connectionPort");
  AddStringColName("serialNumber");
  AddStringColName("name");
  AddStringColName("hostName");
  AddStringColName("connectionType");
  AddStringColName("generalLocation");
  AddStringColName("software");
  AddStringColName("swVersion");
  AddStringColName("vendor");
}

//========================================================================+
SvtDbAgent::SvtDbWaferLoadedInMachine::SvtDbWaferLoadedInMachine()
{
  SetTableName("");
  AddIntColName("machineId");
  AddIntColName("waferId");
  AddStringColName("date");
  AddStringColName("username");
  AddStringColName("status");
}

// //========================================================================+
// bool SvtDbWPMachineDto::updateWPMachineInDB(const dbWPMachineRecords &wpm)
// {
//   SimpleUpdate update;
//
//   std::string tableName =
//       SvtDbAgent::db_schema + std::string(".WaferProbeMachine");
//   update.setTableName(tableName);
//
//   //! Add columns & values
//   if (!wpm.hostName.empty())
//   {
//     update.addColumnAndValue("hostName", wpm.hostName);
//   }
//   if (!wpm.connectionType.empty())
//   {
//     update.addColumnAndValue("connectionType", wpm.connectionType);
//   }
//   if (wpm.connectionPort >= 0)
//   {
//     update.addColumnAndValue("connectionPort", wpm.connectionPort);
//   }
//   if (!wpm.generalLocation.empty())
//   {
//     update.addColumnAndValue("generalLocation", wpm.generalLocation);
//   }
//   if (!wpm.software.empty())
//   {
//     update.addColumnAndValue("software", wpm.software);
//   }
//   if (!wpm.swVersion.empty())
//   {
//     update.addColumnAndValue("swVersion", wpm.generalLocation);
//   }
//
//   if (!update.doUpdate())
//   {
//     rollbackUpdate();
//     return false;
//   }
//   commitUpdate();
//
//   return true;
// }

// //========================================================================+
// void SvtDbWPMachineDto::updateWPMachine(
//     const SvtDbAgent::SvtDbAgentMessage &msg,
//     SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
// {
//   const auto &msgData = msg.getPayload()["data"];
//   if (!msgData.contains("id"))
//   {
//     throw std::runtime_error("Object item id was found");
//   }
//   if (!msgData.contains("update"))
//   {
//     throw std::runtime_error("Object item update was found");
//   }
//
//   const auto wpMachineId = msgData["id"];
//   const auto wpm_j = msgData["update"];
//
//   if (!SvtDbInterface::checkIdExist("WaferProbeMachine", wpMachineId))
//   {
//     std::ostringstream ss("");
//     ss << "Wafer Probe Machine with id " << wpMachineId << " does not
//     found."; throw std::runtime_error(ss.str());
//   }
//
//   dbWPMachineRecords wpm;
//   wpm.id = wpMachineId;
//   bool found_entry_to_update = false;
//   // if (!wpm_j["thinningDate"].is_null())
//   // {
//   //   wpm.thinningDate = wpm_j["thinningDate"];
//   //   found_entry_to_update = true;
//   // }
//   // if (!wpm_j["dicingDate"].is_null())
//   // {
//   //   wpm.dicingDate = wpm_j["dicingDate"];
//   //   found_entry_to_update = true;
//   // }
//   // if (!wpm_j["productionDate"].is_null())
//   // {
//   //   wpm.productionDate = wpm_j["productionDate"];
//   //   found_entry_to_update = true;
//   // }
//
//   if (!found_entry_to_update)
//   {
//     throw std::runtime_error("no entry to update found");
//     return;
//   }
//   if (!updateWPMachineInDB(wpm))
//   {
//     throw std::runtime_error("wpm was not updated");
//   }
//
//   getWPMachineFromDB(wpm, wpMachineId);
//   createWPMachineReplyMsg(wpm, replyMsg);
// }
