/*!
 * stname
 * @file SvtDbWPMachine.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWPMachine
 */

#include "SVTDbAgentDto/SvtDbWPMachineDto.h"
#include <string>
#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include "SvtKafkaMessage.h"
#include "SvtLogger.h"

using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaReplyMsg;
using bind_type = void (SvtDbAgent::SvtDbWPMachineDto::*)(const SvtKafkaMessage &, SvtKafkaReplyMsg &);
//========================================================================+
SvtDbAgent::SvtDbWPMachineDto::SvtDbWPMachineDto()
{
  setTableName("WaferProbeMachine");

  addColName("id");
  addColName("connectionPort");
  addColName("serialNumber");
  addColName("name");
  addColName("hostName");
  addColName("connectionType");
  addColName("generalLocation");
  addColName("software");
  addColName("swVersion");
  addColName("vendor");
  addColName("loadedWaferId", false);
  addColName("loadedWaferOrientation", false);
  addColName("installedProbeCardId", false);
  addColName("installedProbeCardOrientation", false);

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbWPMachineDto::createAllRequest()
{
  //! SvtDbWPMachineDto::GetAllWaferProbeMachines
  addRequest("GetAllWaferProbeMachines",
             std::bind(static_cast<bind_type>(&SvtDbWPMachineDto::getAllEntries), this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbWPMachineDto::CreateWaferProbeMachine
  addRequest("CreateWaferProbeMachine",
             std::bind(static_cast<bind_type>(&SvtDbWPMachineDto::createEntry), this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbWPMachineDto::UpdateWaferProbeMachine
  addRequest("UpdateWaferProbeMachine",
             std::bind(static_cast<bind_type>(&SvtDbWPMachineDto::updateEntry), this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbWPMachineDto::UpdateWaferProbeMachine
  addRequest("UpdateWpMachineLoadedWafer",
             std::bind(&SvtDbWPMachineDto::updateWaferLoadedInMachine, this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbWPMachineDto::UpdateWaferProbeMachine
  addRequest("UpdateWpMachineInstalledProbeCard",
             std::bind(&SvtDbWPMachineDto::updateProbeCardInstalledInMachine,
                       this, std::placeholders::_1, std::placeholders::_2));
}

//========================================================================+
void SvtDbAgent::SvtDbWPMachineDto::updateWaferLoadedInMachine(
    const SvtKafkaMessage &msg, SvtKafkaReplyMsg &replyMsg)
{
  const auto machineId_j = msg.getPayload()["data"]["wpMachineId"];
  const auto loadedWaferId_j = msg.getPayload()["data"]["loadedWaferId"];
  const auto loadedWaferOrientation_j = msg.getPayload()["data"]["loadedWaferOrientation"];
  if (machineId_j.is_null())
  {
    THROW_RUNTIME_ERROR("Mising data, machineId is not a nullable field.");
    return;
  }
  const auto wpMachineId = machineId_j.get<int>();
  SvtDbEntry wpMachine;
  getEntryWithId(wpMachine, wpMachineId);

  SvtDbEntry loadedWaferEntry;
  loadedWaferEntry.addValue("machineId", wpMachineId);
  const auto &oldLoadedWaferId = wpMachine.getValue("loadedWaferId");
  if (loadedWaferId_j.is_null())
  {
    if (!oldLoadedWaferId.is_null())
    {
      loadedWaferEntry.addValue("status", "Unloaded");
      loadedWaferEntry.addValue("waferId", oldLoadedWaferId.get<int>());
      waferLoaded->createEntryInDB(loadedWaferEntry);
    }
    else
    {
      THROW_RUNTIME_ERROR("WARN! No Wafer loaded.");
      return;
    }
  }
  else
  {
    if (loadedWaferOrientation_j.is_null())
    {
      THROW_RUNTIME_ERROR("ERROR: Mising orientation for loaded wafer");
      return;
    }
    if (!oldLoadedWaferId.is_null())
    {
      getLogger()->logWarning("WARN! Create entry for unloaded action waferId: " + std::to_string(oldLoadedWaferId.get<int>()));
      loadedWaferEntry.addValue("status", "Unloaded");
      loadedWaferEntry.addValue("waferId", oldLoadedWaferId);
    }
    loadedWaferEntry.addValue("status", "Loaded");
    loadedWaferEntry.addValue("waferId", loadedWaferId_j);
    loadedWaferEntry.addValue("orientation", loadedWaferOrientation_j);
    waferLoaded->createEntryInDB(loadedWaferEntry);
  }

  nlohmann::json update_j;
  update_j["loadedWaferId"] = loadedWaferId_j;
  update_j["loadedWaferOrientation"] = loadedWaferOrientation_j;
  updateEntryAndReply(machineId_j.get<int>(), update_j, replyMsg, true);
}

//========================================================================+
void SvtDbAgent::SvtDbWPMachineDto::updateProbeCardInstalledInMachine(
    const SvtKafkaMessage &msg, SvtKafkaReplyMsg &replyMsg)
{
  const auto machineId_j = msg.getPayload()["data"]["wpMachineId"];
  const auto installedProbeCardId_j = msg.getPayload()["data"]["installedProbeCardId"];
  const auto installedProbeCardOrientation_j = msg.getPayload()["data"]["installedProbeCardOrientation"];
  if (machineId_j.is_null())
  {
    THROW_RUNTIME_ERROR("Mising data, machineId is not a nullable field.");
    return;
  }
  SvtDbEntry installedPCardEntry;
  installedPCardEntry.addValue("machineId", machineId_j);
  installedPCardEntry.addValue("probeCardId", installedProbeCardId_j);
  installedPCardEntry.addValue("orientation", installedProbeCardOrientation_j);
  pcInstalled->createEntryInDB(installedPCardEntry);

  nlohmann::json update_j;
  update_j["installedProbeCardId"] = installedProbeCardId_j;
  update_j["installedProbeCardOrientation"] = installedProbeCardOrientation_j;
  updateEntryAndReply(machineId_j.get<int>(), update_j, replyMsg, true);
}
