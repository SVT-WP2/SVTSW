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
}

//========================================================================+
SvtDbAgent::SvtDbWaferLoadedInMachine::SvtDbWaferLoadedInMachine()
{
  setTableName("");
  addColName("machineId");
  addColName("waferId");
  addColName("date");
  addColName("username");
  addColName("status");
}
