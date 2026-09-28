/*!
 * @file DbTestDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief  Test Type
 */

#include "DbAgentDto/DbTestDto.h"
// #include "SvtLogger.h"

namespace dbagent
{
  //========================================================================+
  DbTestDto::DbTestDto()
    : DbBaseDto()
  {
    setTableName("SvtTestList");

    addColName("id");
    addColName("testTypeConfigId");
    addColName("testSetupConfigId");
    addColName("createdAt", false);
    addColName("startedAt", false);
    addColName("finishedAt", false);
    addColName("pathToResult", false);
    addColName("testResultStatus", false);

    dutEntityName = std::make_shared<DbBaseListDto>("SvtTestListToEntityName", "testId", "dutEntityName");
    dutEntityName->addValidFilter("testId");
    addRelationDto(dutEntityName.get());

    dutId = std::make_shared<DbBaseListDto>("SvtTestListToEntityId", "testId", "dutId");
    dutId->addValidFilter("testId");
    addRelationDto(dutId.get());

    createAllRequest();
  }

  //========================================================================+
  void DbTestDto::createAllRequest()
  {
    // !SvtDbTestDto::GetAllSvtTests
    addRequest("GetAllSvtTests",
               std::bind(&DbTestDto::getAllEntries, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbTestDto::CreateSvtTest
    addRequest("CreateSvtTest",
               std::bind(&DbTestDto::createEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
    //! SvtDbTestDto::UpdateSvtTestStart
    addRequest("UpdateSvtTestStart",
               std::bind(&DbTestDto::updateEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
    //! SvtDbTestDto::UpdateSvtTestFinish
    addRequest("UpdateSvtTestFinish",
               std::bind(&DbTestDto::updateEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
  }
}  // namespace dbagent
