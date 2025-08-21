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
  setTableName("WaferProbeProject");
  addColName("id");
  addColName("wpMachineId");
  addColName("waferTypeId");
  addColName("asicFamilyType");
  addColName("orientation");
  addColName("name");
  addColName("alignmentDie");
  addColName("homeDie");
  addColName("local2GlobalMap");
}
