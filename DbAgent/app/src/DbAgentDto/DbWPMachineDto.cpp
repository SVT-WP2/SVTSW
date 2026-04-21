/*!
 * stname
 * @file DbWPMachine.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief DbWPMachine
 */

#include "DbAgentDto/DbWPMachineDto.h"

using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaReplyMsg;

namespace dbagent
{
  //========================================================================+
  DbWPMachineDto::DbWPMachineDto()
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
  void DbWPMachineDto::createAllRequest()
  {
    //! SvtDbWPMachineDto::GetAllWaferProbeMachines
    addRequest("GetAllWaferProbeMachines",
               std::bind(&DbWPMachineDto::getAllEntries, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbWPMachineDto::CreateWaferProbeMachine
    addRequest("CreateWaferProbeMachine",
               std::bind(&DbWPMachineDto::createEntry, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbWPMachineDto::UpdateWaferProbeMachine
    addRequest("UpdateWaferProbeMachine",
               std::bind(&DbWPMachineDto::updateEntry, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbWPMachineDto::UpdateWaferProbeMachine
    addRequest("UpdateWpMachineLoadedWafer",
               std::bind(&DbWPMachineDto::updateWaferLoadedInMachine, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbWPMachineDto::UpdateWaferProbeMachine
    addRequest("UpdateWpMachineInstalledProbeCard",
               std::bind(&DbWPMachineDto::updateProbeCardInstalledInMachine,
                         this, std::placeholders::_1, std::placeholders::_2));
  }

  //========================================================================+
  void DbWPMachineDto::updateWaferLoadedInMachine(
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
    DbEntry wpMachine;
    getEntryWithId(wpMachine, wpMachineId);

    DbEntry loadedWaferEntry;
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
        THROW_RUNTIME_ERROR("WARN! No Wafer was loaded in the machine. Ignoring action.");
        return;
      }
    }
    else
    {
      if (loadedWaferOrientation_j.is_null())
      {
        THROW_RUNTIME_ERROR("ERROR: Mising orientation for the loaded wafer");
        return;
      }
      if (!oldLoadedWaferId.is_null())
      {
        logWarning("WARN! Create entry for unloaded action waferId: " + std::to_string(oldLoadedWaferId.get<int>()));
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
  void DbWPMachineDto::updateProbeCardInstalledInMachine(
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
    DbEntry installedPCardEntry;
    installedPCardEntry.addValue("machineId", machineId_j);
    installedPCardEntry.addValue("probeCardId", installedProbeCardId_j);
    installedPCardEntry.addValue("orientation", installedProbeCardOrientation_j);
    pcInstalled->createEntryInDB(installedPCardEntry);

    nlohmann::json update_j;
    update_j["installedProbeCardId"] = installedProbeCardId_j;
    update_j["installedProbeCardOrientation"] = installedProbeCardOrientation_j;
    updateEntryAndReply(machineId_j.get<int>(), update_j, replyMsg, true);
  }
}  // namespace dbagent
