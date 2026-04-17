/*!
 * @file DbTestSetupDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief  Test Type
 */

#include "DbAgentDto/DbTestTypeDto.h"
#include "DbAgentDto/DbTestTypeConfigDto.h"
#include "SvtUtilities.h"

namespace dbagent
{
  //========================================================================+
  DbTestTypeDto::DbTestTypeDto()
    : DbBaseDto()
  {
    setTableName("SvtTestType");

    addColName("id");
    addColName("name");

    asicFamilyTypeList = std::make_shared<DbBaseListDto>("SvtTestTypeAsicFamilyTypeList", "testTypeId", "asicFamilyType");
    addRelationDto(asicFamilyTypeList.get());

    createAllRequest();
  }

  //========================================================================+
  void DbTestTypeDto::getAllEntries(const SvtKafka::SvtKafkaMessage &msg,
                                    SvtKafka::SvtKafkaReplyMsg &replyMsg)
  {
    auto data_j = msg.getPayload()["data"];
    if (!data_j["filter"].contains("asicFamilyType"))
    {
      this->DbBaseDto::getAllEntries(msg, replyMsg);
    }
    else
    {
      const auto asicFamilyType = data_j["filter"]["asicFamilyType"];

      DbFilters asicFamilyTypeFilter;
      asicFamilyTypeFilter.mFilters.addValue("asicFamilyType", asicFamilyType);

      std::vector<DbEntry> asicFamilyTypeEntries;
      asicFamilyTypeList->getAllEntriesFromDB(asicFamilyTypeEntries, std::string(), asicFamilyTypeFilter);

      if (asicFamilyTypeEntries.size())
      {
        nlohmann::json ids = nlohmann::json::array();

        for (const auto &asicFamilyTypeEntry : asicFamilyTypeEntries)
        {
          ids.push_back(asicFamilyTypeEntry.getValue("testTypeId"));
        }

        auto newMsg = msg;
        SvtUtils::recursive_erase_key(data_j, "asicFamilyType");
        data_j["data"]["filters"]["ids"] = ids;
        newMsg.setPayload(data_j);
        getAllEntries(newMsg, replyMsg);
      }
      else
      {
        createReplyMsg(asicFamilyTypeEntries, replyMsg);
      }
    }
  }

  //========================================================================+
  void DbTestTypeDto::createEntry(const SvtKafka::SvtKafkaMessage &msg,
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
    auto key = "testTypeConfig";
    auto testTypeConfig_j = msgCreate_j[key];
    // remove config setting from json message
    SvtUtils::recursive_erase_key(msgCreate_j, key);

    // Create entry in the test setup table and get id from the returned entry
    DbEntry dummyEntry;
    createAndReturnNewEntry(msgCreate_j, dummyEntry);
    int testTypeId = dummyEntry.getValue("id");
    auto asicFamilyTypes_j = msgCreate_j["asicFamilyTypes"];
    asicFamilyTypeList->addEntries(testTypeId, asicFamilyTypes_j);
    // create test type config with correct testTypeId
    testTypeConfig_j["testTypeId"] = testTypeId;
    SvtUtils::Singleton<DbTestTypeConfigDto>::instance()->createAndReturnNewEntry(testTypeConfig_j, dummyEntry);
    getEntryWithId(dummyEntry, testTypeId);
    createReplyMsg(dummyEntry, replyMsg);
  }

  //========================================================================+
  void DbTestTypeDto::updateEntry(const SvtKafka::SvtKafkaMessage &msg,
                                  SvtKafka::SvtKafkaReplyMsg &replyMsg)
  {
    const auto &testTypeId = msg.getPayload()["data"]["testTypeId"];
    const auto &asicFamilyTypes = msg.getPayload()["data"]["asicFamilyTypes"];

    asicFamilyTypeList->addEntries(testTypeId, asicFamilyTypes);
    DbEntry entry;
    getEntryWithId(entry, testTypeId);
    createReplyMsg(entry, replyMsg);
  }

  //========================================================================+
  void DbTestTypeDto::createAllRequest()
  {
    // !SvtDbTestTypeDto::GetAllSvtTestType
    addRequest("GetAllSvtTestTypes",
               std::bind(&DbTestTypeDto::getAllEntries, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbTestTypeDto::CreateSvtTestType
    addRequest("CreateSvtTestType",
               std::bind(&DbTestTypeDto::createEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
    //! SvtDbTestTypeDto::UpdateSvtTestType
    addRequest("UpdateSvtTestType",
               std::bind(&DbTestTypeDto::updateEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
  }
}  // namespace dbagent
