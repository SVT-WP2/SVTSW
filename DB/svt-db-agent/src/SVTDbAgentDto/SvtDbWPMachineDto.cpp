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

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbWPMachineDto::createAllRequest()
{
  //! SvtDbWPMachineDto::GetAllWaferProbeMachines
  addRequest("GetAllWaferProbeMachines",
             std::bind(&SvtDbWPMachineDto::getAllEntries, this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbWPMachineDto::CreateWaferProbeMachine
  addRequest("CreateWaferProbeMachine",
             std::bind(&SvtDbWPMachineDto::createEntry, this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbWPMachineDto::UpdateWaferProbeMachine
  addRequest("UpdateWaferProbeMachine",
             std::bind(&SvtDbWPMachineDto::updateEntry, this,
                       std::placeholders::_1, std::placeholders::_2));
}

//========================================================================+
SvtDbAgent::SvtDbWaferLoadedInMachineDto::SvtDbWaferLoadedInMachineDto()
{
  setTableName("");

  addColName("machineId");
  addColName("waferId");
  addColName("date");
  addColName("username");
  addColName("status");

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbWaferLoadedInMachineDto::createAllRequest() {}
