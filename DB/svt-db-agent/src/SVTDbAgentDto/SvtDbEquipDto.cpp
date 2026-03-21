/*!
 * @file SvtDbEquipDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Equipment dto
 */

#include "SVTDbAgentDto/SvtDbEquipDto.h"

//========================================================================+
SvtDbAgent::SvtDbEquipDto::SvtDbEquipDto()
  : SvtDbBaseLocationDto("EquipmentLocation", "equipmentId")
{
  setTableName("Equipment");

  addColName("id");
  addColName("name");
  addColName("equipmentTypeId");
  addColName("generalLocation");
  addColName("specification");

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbEquipDto::createAllRequest()
{
  //! SvtDbEquipDto::GetAllEquipment
  addRequest("GetAllEquipment",
             std::bind(&SvtDbEquipDto::getAllEntries, this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbEquipment::CreateEquipment
  addRequest("CreateEquipment",
             std::bind(&SvtDbEquipDto::createEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
  //! SvtDbEquipment::UpdateEquipment
  addRequest("UpdateEquipment",
             std::bind(&SvtDbEquipDto::updateEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
  //! SvtDbEquipment::UpdateEquipmentLocation
  addRequest("UpdateEquipmentLocation",
             std::bind(&SvtDbEquipDto::updateLocation, this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbEquipment::GetWaferLocationHistory
  addRequest("GetEquipmentLocationHistory",
             std::bind(&SvtDbEquipDto::getLocationHistory, this,
                       std::placeholders::_1, std::placeholders::_2));
}
