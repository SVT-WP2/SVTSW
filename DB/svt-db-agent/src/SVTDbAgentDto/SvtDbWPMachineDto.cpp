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
  AddStrColName("serialNumber");
  AddStrColName("name");
  AddStrColName("hostName");
  AddStrColName("connectionType");
  AddStrColName("generalLocation");
  AddStrColName("software");
  AddStrColName("swVersion");
  AddStrColName("vendor");
}

//========================================================================+
SvtDbAgent::SvtDbWaferLoadedInMachine::SvtDbWaferLoadedInMachine()
{
  SetTableName("");
  AddIntColName("machineId");
  AddIntColName("waferId");
  AddStrColName("date");
  AddStrColName("username");
  AddStrColName("status");
}
