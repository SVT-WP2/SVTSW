/*!
 * @file DbTestSetupDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief  Test Setup
 */

#include "DbAgentDto/DbTestSetupDto.h"
#include "DbAgentDto/DbTestSetupConfigDto.h"
#include "SvtUtilities.h"

namespace dbagent
{
  //========================================================================+
  DbTestSetupDto::DbTestSetupDto()
    : DbBaseDto()
  {
    setTableName("SvtTestSetup");

    addColName("id");
    addColName("name");
    addColName("generalLocation");

    addValidFilter("ids", "id");

    equipList = std::make_shared<DbBaseListDto>("SvtTestSetupEquipList", "setupId", "equipId");
    setupDefaultConfigId = std::make_shared<DbBaseListDto>("SvtTestSetupDefaultConfig", "setupId", "defaultConfigId");

    addRelationDto(setupDefaultConfigId.get());

    createAllRequest();
  }

  //========================================================================+
  void DbTestSetupDto::getAllEquipments(const SvtKafka::SvtKafkaMessage &msg,
                                        SvtKafka::SvtKafkaReplyMsg &replyMsg)
  {
    equipList->getAllEntries(msg, replyMsg);
  }

  //========================================================================+
  void DbTestSetupDto::updateEntry(const SvtKafka::SvtKafkaMessage &msg,
                                   SvtKafka::SvtKafkaReplyMsg &replyMsg)
  {
    updateEntryInRelationTable(setupDefaultConfigId.get(), msg, replyMsg);
  }

  //========================================================================+
  void DbTestSetupDto::createEntry(const SvtKafka::SvtKafkaMessage &msg,
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
    DbEntry setupEntry;
    createAndReturnNewEntry(msgCreate_j, setupEntry);
    int setupId = setupEntry.getValue("id");
    // create test setup config with correct setupId
    defaultConfig_j["setupId"] = setupId;
    DbEntry setupConfigEntry;
    SvtUtils::Singleton<DbTestSetupConfigDto>::instance()->createAndReturnNewEntry(defaultConfig_j, setupConfigEntry);
    // get created config id
    auto setupConfigId = setupConfigEntry.getValue("id");
    setupDefaultConfigId->addEntries(setupId, setupConfigId);
    getEntryWithId(setupEntry, setupId);
    createReplyMsg(setupEntry, replyMsg);
  }

  //========================================================================+
  void DbTestSetupDto::createAllRequest()
  {
    // !SvtDbTestSetupDto::GetAllSvtTestSetup
    addRequest("GetAllSvtTestSetups",
               std::bind(&DbTestSetupDto::getAllEntries, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbTestSetupDto::CreateSvtTestSetup
    addRequest("CreateSvtTestSetup",
               std::bind(&DbTestSetupDto::createEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
    //! SvtDbTestSetupDto::UpdateSvtTestSetupDefaultConfig
    addRequest("UpdateSvtTestSetup",
               std::bind(&DbTestSetupDto::updateEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
    // !SvtDbTestSetupDto::GetEquipmentListForTestSetup
    addRequest("GetEquipmentListForTestSetup",
               std::bind(&DbTestSetupDto::getAllEquipments, this, std::placeholders::_1,
                         std::placeholders::_2));
  }
}  // namespace dbagent
