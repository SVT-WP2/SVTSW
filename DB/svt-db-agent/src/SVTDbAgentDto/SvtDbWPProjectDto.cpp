/*!
 * @file SvtDbWPProjectDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWPProjectDto
 */

#include "SVTDbAgentDto/SvtDbWPProjectDto.h"

using bind_type = void (SvtDbAgent::SvtDbWPProjectDto::*)(const SvtDbAgent::SvtDbAgentMessage &, SvtDbAgent::SvtDbAgentReplyMsg &);
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

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbWPProjectDto::createAllRequest()
{
  //! SvtDbWPProjectDto::GetAllWPProjects
  addRequest("GetAllWaferProbeProjects",
             std::bind(static_cast<bind_type>(&SvtDbWPProjectDto::getAllEntries), this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbWPProjectDto::CreateWPProject
  addRequest("CreateWaferProbeProject",
             std::bind(static_cast<bind_type>(&SvtDbWPProjectDto::createEntry), this,
                       std::placeholders::_1, std::placeholders::_2));
}
