/*!
 * @file DbModuleDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief  Test Type
 */

#include "DbAgentDto/DbModuleDto.h"
#include <memory>
// #include "SvtLogger.h"

namespace dbagent
{
  //========================================================================+
  DbModuleDto::DbModuleDto()
    : DbBaseLocationDto("ModuleLocation", "modId")
  {
    setTableName("Module");

    addColName("id");
    addColName("modType");
    addColName("serialNumber", false);
    addColName("generalLocation");

    addValidFilter("generalLocation");
    addValidFilter("serialNumber");
    addValidFilter("modTypes", "modType");

    chipIds = std::make_shared<DbBaseListDto>("ModuleChipList", "modId", "chipId", "chips", true);
    chipIds->addValidFilter("testId");
    addRelationDto(chipIds.get());

    createAllRequest();
  }

  //========================================================================+
  void DbModuleDto::createAllRequest()
  {
    // !SvtDbModuleDto::GetAllSvtTests
    addRequest("GetAllSvtTests",
               std::bind(&DbModuleDto::getAllEntries, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbModuleDto::CreateSvtTest
    addRequest("CreateSvtTest",
               std::bind(&DbModuleDto::createEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
    //! SvtDbModuleDto::UpdateSvtTestStart
    addRequest("UpdateSvtTestStart",
               std::bind(&DbModuleDto::updateEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
    //! SvtDbModuleDto::UpdateSvtTestFinish
    addRequest("UpdateSvtTestFinish",
               std::bind(&DbModuleDto::updateEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
  }
}  // namespace dbagent
