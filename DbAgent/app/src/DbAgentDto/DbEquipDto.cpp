/*!
 * @file DbEquipDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Equipment dto
 */

#include "DbAgentDto/DbEquipDto.h"

namespace dbagent
{  //========================================================================+
  DbEquipDto::DbEquipDto()
    : DbBaseLocationDto("EquipmentLocation", "equipmentId")
  {
    setTableName("Equipment");

    addColName("id");
    addColName("name");
    addColName("equipmentTypeId");
    addColName("generalLocation");
    addColName("specification");

    addValidFilter("ids", "id");

    createAllRequest();
  }

  //========================================================================+
  void DbEquipDto::createAllRequest()
  {
    //! SvtDbEquipDto::GetAllEquipment
    addRequest("GetAllEquipment",
               std::bind(&DbEquipDto::getAllEntries, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbEquipment::CreateEquipment
    addRequest("CreateEquipment",
               std::bind(&DbEquipDto::createEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
    //! SvtDbEquipment::UpdateEquipment
    addRequest("UpdateEquipment",
               std::bind(&DbEquipDto::updateEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
    //! SvtDbEquipment::UpdateEquipmentLocation
    addRequest("UpdateEquipmentLocation",
               std::bind(&DbEquipDto::updateLocation, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbEquipment::GetWaferLocationHistory
    addRequest("GetEquipmentLocationHistory",
               std::bind(&DbEquipDto::getLocationHistory, this,
                         std::placeholders::_1, std::placeholders::_2));
  }
}  // namespace dbagent
