/*!
 * @file SvtDbEquipTypeDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Equipment type dto
 */

#include "SVTDbAgentDto/SvtDbEquipTypeDto.h"

//========================================================================+
SvtDbAgent::SvtDbEquipTypeDto::SvtDbEquipTypeDto()
{
  setTableName("EquipmentType");

  addColName("id");
  addColName("name");

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbEquipTypeDto::createAllRequest()
{
  //! SvtDbEquipTypeDto::GetAllEquipTypes
  addRequest("GetAllEquipmentTypes",
             std::bind(&SvtDbEquipTypeDto::getAllEntries, this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbEquipTypeDto::CreateEquiptmentType
  addRequest("CreateEquipmentType",
             std::bind(&SvtDbEquipTypeDto::createEntry, this,
                       std::placeholders::_1, std::placeholders::_2));
}
