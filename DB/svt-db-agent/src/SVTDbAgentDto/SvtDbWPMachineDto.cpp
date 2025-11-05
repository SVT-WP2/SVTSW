/*!
 * stname
 * @file SvtDbWPMachine.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWPMachine
 */

#include "SVTDbAgentDto/SvtDbWPMachineDto.h"
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
  addColName("loadedWaferId");
  addColName("installedProbeCardId");

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
  if (machineId_j.is_null())
  {
    THROW_RUNTIME_ERROR("Failed parsing data, machineId is not a nullable field.");
  }
  nlohmann::json update_j;
  update_j["loadedWaferId"] = loadedWaferId_j;
  updateEntryAndReply(machineId_j.get<int>(), update_j, replyMsg, true);
}

//========================================================================+
void SvtDbAgent::SvtDbWPMachineDto::updateProbeCardInstalledInMachine(
    const SvtKafkaMessage &msg, SvtKafkaReplyMsg &replyMsg)
{
  const auto machineId_j = msg.getPayload()["data"]["wpMachineId"];
  const auto installedProbeCardId_j = msg.getPayload()["data"]["installedProbeCardId"];
  if (machineId_j.is_null())
  {
    THROW_RUNTIME_ERROR("Failed parsing data, machineId is not a nullable field.");
  }
  nlohmann::json update_j;
  update_j["installedProbeCardId"] = installedProbeCardId_j;
  updateEntryAndReply(machineId_j.get<int>(), update_j, replyMsg, true);
}
