/*!
 * @file SvtDbEquipDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Equipment dto
 */

#include <string>

#include "SVTDbAgentDto/SvtDbEquipDto.h"
#include "SvtKafkaMessage.h"

using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaReplyMsg;
using bind_type = void (SvtDbAgent::SvtDbEquipDto::*)(const SvtKafkaMessage &, SvtKafkaReplyMsg &);
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
  //! SvtDbEquipDto::GetAllEquipments
  addRequest("GetAllEquipments",
             std::bind(static_cast<bind_type>(&SvtDbEquipDto::getAllEntries), this,
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
             std::bind(static_cast<bind_type>(&SvtDbEquipDto::updateLocation), this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbEquipment::GetWaferLocationHistory
  addRequest("GetEquipmentLocationHistory",
             std::bind(static_cast<bind_type>(&SvtDbEquipDto::getLocationHistory), this,
                       std::placeholders::_1, std::placeholders::_2));
}

//========================================================================+
void SvtDbAgent::SvtDbEquipDto::createEntry(
    const SvtKafkaMessage &msg,
    SvtKafkaReplyMsg &replyMsg)
{
  SvtDbEntry entry;
  createEntryWithLocation(msg, entry);
  getLogger()->logInfo("Creating reply SvtKafkaMessage");
  createReplyMsg(entry, replyMsg);
}
