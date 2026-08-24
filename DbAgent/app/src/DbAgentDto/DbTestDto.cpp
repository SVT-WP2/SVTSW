/*!
 * @file DbTestDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief  Test Type
 */

#include "DbAgentDto/DbTestDto.h"
// #include "SvtLogger.h"

namespace dbagent
{
  //========================================================================+
  DbTestDto::DbTestDto()
    : DbBaseDto()
  {
    setTableName("SvtTestList");

    addColName("id");
    addColName("testTypeConfigId");
    addColName("testSetupConfigId");
    addColName("createdAt");
    addColName("startedAt");
    addColName("finishedAt");
    addColName("pathToResult");
    addColName("testResultStatus");

    dutEntityName = std::make_shared<DbBaseListDto>("SvtTestListToEntityName", "testId", "dutEntityName");
    dutEntityName->addValidFilter("testId");
    addRelationDto(dutEntityName.get());

    dutId = std::make_shared<DbBaseListDto>("SvtTestListToEntityName", "testId", "dutId");
    dutId->addValidFilter("testId");
    addRelationDto(dutId.get());

    createAllRequest();
  }

  //========================================================================+
  void DbTestDto::getAllEntries(const SvtKafka::SvtKafkaMessage &msg,
                                SvtKafka::SvtKafkaReplyMsg &replyMsg)
  {
    // auto data_j = msg.getPayload()["data"];
    // if (!data_j["filter"].contains("dutTypes"))
    // {
    //   this->DbBaseDto::getAllEntries(msg, replyMsg);
    // }
    // else
    // {
    //   const auto dutType = data_j["filter"]["dutType"];
    //
    //   DbEntry dutTypeFilter;
    //   dutTypeFilter.addValue("dutType", dutType);
    //
    //   std::vector<DbEntry> dutTypeEntries;
    //   dutTypeList->getAllEntriesFromDB(dutTypeEntries, std::string(), dutTypeFilter);
    //
    //   if (dutTypeEntries.size())
    //   {
    //     nlohmann::json ids = nlohmann::json::array();
    //
    //     for (const auto &dutTypeEntry : dutTypeEntries)
    //     {
    //       ids.push_back(dutTypeEntry.getValue("testTypeId"));
    //     }
    //
    //     auto newMsg = msg;
    //     SvtUtils::recursive_erase_key(data_j, "dutTypes");
    //     data_j["data"]["filters"]["ids"] = ids;
    //     newMsg.setPayload(data_j);
    //     getAllEntries(newMsg, replyMsg);
    //   }
    //   else
    //   {
    //     createReplyMsg(dutTypeEntries, replyMsg);
    //   }
    // }
    this->DbBaseDto::getAllEntries(msg, replyMsg);
  }

  //========================================================================+
  void DbTestDto::createEntry(const SvtKafka::SvtKafkaMessage &msg,
                              SvtKafka::SvtKafkaReplyMsg &replyMsg)
  {
    // // Check create object exist
    // auto msgCreate_j = msg.getPayload()["data"]["create"];
    // if (msgCreate_j.is_null())
    // {
    //   THROW_RUNTIME_ERROR("Wrong request message format");
    //   return;
    // }
    // // extract test config from the message
    // auto key = "testTypeConfig";
    // auto testTypeConfig_j = msgCreate_j[key];
    // // remove config setting from json message
    // SvtUtils::recursive_erase_key(msgCreate_j, key);
    //
    // // Create entry in the test setup table and get id from the returned entry
    // DbEntry dummyEntry;
    // createAndReturnNewEntry(msgCreate_j, dummyEntry);
    // int testTypeId = dummyEntry.getValue("id");
    // auto dutTypes_j = msgCreate_j["dutTypes"];
    // dutTypeList->addEntries(testTypeId, dutTypes_j);
    // // create test type config with correct testTypeId
    // testTypeConfig_j["testTypeId"] = testTypeId;
    // SvtUtils::Singleton<DbTestTypeConfigDto>::instance()->createAndReturnNewEntry(testTypeConfig_j, dummyEntry);
    // getEntryWithId(dummyEntry, testTypeId);
    // createReplyMsg(dummyEntry, replyMsg);
    this->DbBaseDto::createEntry(msg, replyMsg);
  }

  //========================================================================+
  void DbTestDto::updateSvtTestStart(const SvtKafka::SvtKafkaMessage & /*msg*/,
                                     SvtKafka::SvtKafkaReplyMsg & /*replyMsg*/)
  {
    // const auto &testTypeId = msg.getPayload()["data"]["testTypeId"];
    // const auto &dutTypes = msg.getPayload()["data"]["dutTypes"];
    //
    // dutTypeList->addEntries(testTypeId, dutTypes);
    // DbEntry entry;
    // getEntryWithId(entry, testTypeId);
    // createReplyMsg(entry, replyMsg);
  }

  //========================================================================+
  void DbTestDto::updateSvtTestFinish(const SvtKafka::SvtKafkaMessage & /*msg*/,
                                      SvtKafka::SvtKafkaReplyMsg & /*replyMsg*/)
  {
    // const auto &testTypeId = msg.getPayload()["data"]["testTypeId"];
    // const auto &dutTypes = msg.getPayload()["data"]["dutTypes"];
    //
    // dutTypeList->addEntries(testTypeId, dutTypes);
    // DbEntry entry;
    // getEntryWithId(entry, testTypeId);
    // createReplyMsg(entry, replyMsg);
  }

  //========================================================================+
  void DbTestDto::createAllRequest()
  {
    // !SvtDbTestDto::GetAllSvtTests
    addRequest("GetAllSvtTests",
               std::bind(&DbTestDto::getAllEntries, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbTestDto::CreateSvtTest
    addRequest("CreateSvtTest",
               std::bind(&DbTestDto::createEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
    //! SvtDbTestDto::UpdateSvtTestStart
    addRequest("UpdateSvtTestStart",
               std::bind(&DbTestDto::updateSvtTestStart, this, std::placeholders::_1,
                         std::placeholders::_2));
    //! SvtDbTestDto::UpdateSvtTestFinish
    addRequest("UpdateSvtTestFinish",
               std::bind(&DbTestDto::updateSvtTestFinish, this, std::placeholders::_1,
                         std::placeholders::_2));
  }
}  // namespace dbagent
