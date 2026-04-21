/*!
 * @file DbWPProjectDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief DbWPProjectDto
 */

#include "DbAgentDto/DbWPProjectDto.h"

namespace dbagent
{
  //========================================================================+
  DbWPProjectDto::DbWPProjectDto()
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
  void DbWPProjectDto::createAllRequest()
  {
    //! SvtDbWPProjectDto::GetAllWPProjects
    addRequest("GetAllWaferProbeProjects",
               std::bind(&DbWPProjectDto::getAllEntries, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbWPProjectDto::CreateWPProject
    addRequest("CreateWaferProbeProject",
               std::bind(&DbWPProjectDto::createEntry, this,
                         std::placeholders::_1, std::placeholders::_2));
  }
}  // namespace dbagent
