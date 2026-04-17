/*!
 * @file DbEquipTypeDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Equipment type dto
 */

#include "DbAgentDto/DbEquipTypeDto.h"

namespace dbagent
{
  //========================================================================+
  DbEquipTypeDto::DbEquipTypeDto()
  {
    setTableName("EquipmentType");

    addColName("id");
    addColName("name");

    createAllRequest();
  }

  //========================================================================+
  void DbEquipTypeDto::createAllRequest()
  {
    //! SvtDbEquipTypeDto::GetAllEquipTypes
    addRequest("GetAllEquipmentTypes",
               std::bind(&DbEquipTypeDto::getAllEntries, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbEquipTypeDto::CreateEquiptmentType
    addRequest("CreateEquipmentType",
               std::bind(&DbEquipTypeDto::createEntry, this,
                         std::placeholders::_1, std::placeholders::_2));
  }
}  // namespace dbagent
