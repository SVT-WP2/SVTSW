/*!
 * @file SvtDbWPProjectDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWPProjectDto
 */

#include "SVTDbAgentDto/SvtDbWPProjectDto.h"

//========================================================================+
SvtDbAgent::SvtDbWPProjectDto::SvtDbWPProjectDto()
{
  SetTableName("WaferProbeProject");
  AddIntColName("id");
  AddIntColName("wpMachineId");
  AddIntColName("waferTypeId");
  AddStrColName("asicFamilyType");
  AddStrColName("orientation");
  AddStrColName("name");
  AddStrColName("alignmentDie");
  AddStrColName("homeDie");
  AddStrColName("local2GlobalMap");
}
