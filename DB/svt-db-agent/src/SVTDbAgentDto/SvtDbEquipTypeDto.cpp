/*!
 * @file SvtDbEquipTypeDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Equipment type dto
 */

#include <string>
#include <string_view>

#include "SVTDbAgentDto/SvtDbEquipTypeDto.h"
#include "SvtKafkaMessage.h"

using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaReplyMsg;
using bind_type = void (SvtDbAgent::SvtDbEquipTypeDto::*)(const SvtKafkaMessage &, SvtKafkaReplyMsg &);
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
             std::bind(static_cast<bind_type>(&SvtDbEquipTypeDto::getAllEntries), this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbEquipTypeDto::CreateEquiptmentType
  addRequest("CreateEquipmentType",
             std::bind(static_cast<bind_type>(&SvtDbEquipTypeDto::createEntry), this,
                       std::placeholders::_1, std::placeholders::_2));
}
