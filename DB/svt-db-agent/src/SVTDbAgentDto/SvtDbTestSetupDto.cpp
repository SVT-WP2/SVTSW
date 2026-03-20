/*!
 * @file SvtDbTestSetupDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Setup
 */

#include <string>

#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include "SVTDbAgentDto/SvtDbBaseListDto.h"
#include "SVTDbAgentDto/SvtDbTestSetupConfigDto.h"
#include "SVTDbAgentDto/SvtDbTestSetupDto.h"
#include "SvtJsonUtils.h"
#include "SvtLogger.h"
#include "SvtUtilities.h"

//========================================================================+
SvtDbAgent::SvtDbTestSetupDto::SvtDbTestSetupDto()
  : SvtDbBaseDto()
{
  setTableName("SvtTestSetup");

  addColName("id");
  addColName("name");
  addColName("generalLocation");

  equipList = std::make_shared<SvtDbBaseListDto>("SvtTestSetupEquipList", "setupId", "equipId");
  setupDefaultConfigId = std::make_shared<SvtDbBaseListDto>("SvtTestSetupDefaultConfig", "setupId", "defaultConfigId");

  addRelationDto(setupDefaultConfigId.get());

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbTestSetupDto::getAllEquipments(const SvtKafka::SvtKafkaMessage &msg,
                                                     SvtKafka::SvtKafkaReplyMsg &replyMsg)
{
  equipList->getAllEntries(msg, replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbTestSetupDto::updateEntry(const SvtKafka::SvtKafkaMessage &msg,
                                                SvtKafka::SvtKafkaReplyMsg &replyMsg)
{
  updateEntryInRelationTable(setupDefaultConfigId.get(), msg, replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbTestSetupDto::createEntry(const SvtKafka::SvtKafkaMessage &msg,
                                                SvtKafka::SvtKafkaReplyMsg &replyMsg)
{
  // Check create object exist
  auto msgCreate_j = msg.getPayload()["data"]["create"];
  if (msgCreate_j.is_null())
  {
    THROW_RUNTIME_ERROR("Wrong request message format");
    return;
  }
  // extract setup config from the message
  auto key = "defaultConfig";
  auto defaultConfig_j = msgCreate_j[key];
  // remove config setting from json message
  SvtUtils::recursive_erase_key(msgCreate_j, key);

  // Create entry in the test setup table and get id from the returned entry
  SvtDbEntry setupEntry;
  createAndReturnNewEntry(msgCreate_j, setupEntry);
  int setupId = setupEntry.getValue("id");
  // create test setup config with correct setupId
  defaultConfig_j["setupId"] = setupId;
  SvtDbEntry setupConfigEntry;
  SvtUtils::Singleton<SvtDbTestSetupConfigDto>::instance()->createAndReturnNewEntry(defaultConfig_j, setupConfigEntry);
  // get created config id
  auto setupConfigId = setupConfigEntry.getValue("id");
  setupDefaultConfigId->addEntries(setupId, setupConfigId);
  getEntryWithId(setupEntry, setupId);
  createReplyMsg(setupEntry, replyMsg);
}

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
             std::bind(&SvtDbTestSetupDto::getAllEquipments, this, std::placeholders::_1,
                       std::placeholders::_2));
}
