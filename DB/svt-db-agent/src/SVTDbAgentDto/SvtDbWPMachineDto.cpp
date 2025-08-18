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
