/*!
 * stname
 * @file SvtDbWPMachine.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWPMachine
 */

#include "SVTDbAgentDto/SvtDbWPMachineDto.h"
#include <exception>
#include "SVTDbAgentService/SvtDbAgentMessage.h"

using bind_type = void (SvtDbAgent::SvtDbWPMachineDto::*)(const SvtDbAgent::SvtDbAgentMessage &, SvtDbAgent::SvtDbAgentReplyMsg &);
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
    const SvtDbAgentMessage &msg, SvtDbAgentReplyMsg &replyMsg)
{
  try
  {
    const auto machineId = msg.getPayload()["data"]["machineId"];
    const auto waferId = msg.getPayload()["data"]["waferId"];
  }
  catch (std::exception &e)
  {
    throw e;
    return;
  }
}

//========================================================================+
void SvtDbAgent::SvtDbWPMachineDto::updateProbeCardInstalledInMachine(
    const SvtDbAgentMessage &msg, SvtDbAgentReplyMsg &replyMsg) {}
