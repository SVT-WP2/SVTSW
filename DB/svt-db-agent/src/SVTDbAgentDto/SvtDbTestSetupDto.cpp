/*!
 * @file SvtDbTestSetupDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Setup
 */

#include <string>

#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include "SVTDbAgentDto/SvtDbTestSetupDto.h"

//========================================================================+
SvtDbAgent::SvtDbEquipSvtTestSetupList::SvtDbEquipSvtTestSetupList()
  : SvtDbBaseDto()
{
  setTableName("SvtTestSetupEquipList");

  addColName("setupId");
  addColName("equipId");
}

//========================================================================+
SvtDbAgent::SvtDbTestSetupDto::SvtDbTestSetupDto()
  : SvtDbBaseDto()
{
  setTableName("SvtTestSetup");

  addColName("id");
  addColName("name");
  addColName("defaultConfigId");
  addColName("generalLocation");

  createAllRequest();
}

// //========================================================================+
// void SvtDbAgent::SvtDbTestSetupDto::getAllEntries(const SvtKafka::SvtKafkaMessage &msg,
//                                                   SvtKafka::SvtKafkaReplyMsg &replyMsg)
// {
//   SvtDbFilters filters;
//   parseJsonFilters(msg.getPayload()["data"], filters);
//
//   std::vector<SvtDbAgent::SvtDbEntry> entries;
//   bool result = getAllEntriesFromDB(entries, filters, "id", false);
//
//   if (result)
//   {
//     for (auto &entry : entries)
//     {
//       SvtUtils::Singleton<SvtDbAgent::SvtTestSetupAsicFamilyRelationDto>::instance()->getEntityEntries(entry.getValue("id"), entry);
//     }
//     createReplyMsg(entries, replyMsg);
//   }
// }

//========================================================================+
void SvtDbAgent::SvtDbTestSetupDto::createAllRequest()
{
  // !SvtDbTestSetupDto::GetAllSvtTestSetup
  addRequest("GetAllSvtTestSetups",
             std::bind(&SvtDbTestSetupDto::getAllEntries, this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbTestSetupDto::CreateSvtTestSetup
  addRequest("CreateSvtTestSetup",
             std::bind(&SvtDbTestSetupDto::createEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
  //! SvtDbTestSetupDto::UpdateSvtTestSetupDefaultConfig
  addRequest("UpdateSvtTestSetup",
             std::bind(&SvtDbTestSetupDto::updateEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
  // !SvtDbTestSetupDto::GetEquipmentListForTestSetup
  addRequest("GetEquipmentListForTestSetup",
             std::bind(&SvtDbEquipSvtTestSetupList::getAllEntries, equipList.get(), std::placeholders::_1,
                       std::placeholders::_2));
}
