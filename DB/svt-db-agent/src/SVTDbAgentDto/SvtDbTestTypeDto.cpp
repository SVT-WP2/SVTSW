/*!
 * @file SvtDbTestSetupDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Type
 */

#include <string>

#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include "SVTDbAgentDto/SvtDbTestTypeConfigDto.h"
#include "SVTDbAgentDto/SvtDbTestTypeDto.h"
#include "SvtJsonUtils.h"
#include "SvtUtilities.h"

//========================================================================+
SvtDbAgent::SvtDbTestTypeDto::SvtDbTestTypeDto()
  : SvtDbBaseDto()
{
  setTableName("SvtTestType");

  addColName("id");
  addColName("name");

  asicFamilyTypeList = std::make_shared<SvtDbBaseListDto>("SvtTestTypeAsicFamilyTypeList", "testTypeId", "asicFamilyType");
  addRelationDto(asicFamilyTypeList.get());

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbTestTypeDto::getAllEntries(const SvtKafka::SvtKafkaMessage &msg,
                                                 SvtKafka::SvtKafkaReplyMsg &replyMsg)
{
  auto data_j = msg.getPayload()["data"];
  if (!data_j["filter"].contains("asicFamilyType"))
  {
    this->SvtDbBaseDto::getAllEntries(msg, replyMsg);
  }
  else
  {
    const auto asicFamilyType = data_j["filter"]["asicFamilyType"];

    SvtDbFilters asicFamilyTypeFilter;
    asicFamilyTypeFilter.mFilters.addValue("asicFamilyType", asicFamilyType);

    std::vector<SvtDbAgent::SvtDbEntry> asicFamilyTypeEntries;
    asicFamilyTypeList->getAllEntriesFromDB(asicFamilyTypeEntries, asicFamilyTypeFilter);

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
void SvtDbAgent::SvtDbTestTypeDto::createEntry(const SvtKafka::SvtKafkaMessage &msg,
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
  SvtDbEntry dummyEntry;
  createAndReturnNewEntry(msgCreate_j, dummyEntry);
  int testTypeId = dummyEntry.getValue("id");
  auto asicFamilyTypes_j = msgCreate_j["asicFamilyTypes"];
  asicFamilyTypeList->addEntries(testTypeId, asicFamilyTypes_j);
  // create test type config with correct testTypeId
  testTypeConfig_j["testTypeId"] = testTypeId;
  SvtUtils::Singleton<SvtDbTestTypeConfigDto>::instance()->createAndReturnNewEntry(testTypeConfig_j, dummyEntry);
  getEntryWithId(dummyEntry, testTypeId);
  createReplyMsg(dummyEntry, replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbTestTypeDto::updateEntry(const SvtKafka::SvtKafkaMessage &msg,
                                               SvtKafka::SvtKafkaReplyMsg &replyMsg)
{
  const auto &testTypeId = msg.getPayload()["data"]["testTypeId"];
  const auto &asicFamilyTypes = msg.getPayload()["data"]["asicFamilyTypes"];

  asicFamilyTypeList->addEntries(testTypeId, asicFamilyTypes);
  SvtDbEntry entry;
  getEntryWithId(entry, testTypeId);
  createReplyMsg(entry, replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbTestTypeDto::createAllRequest()
{
  // !SvtDbTestTypeDto::GetAllSvtTestType
  addRequest("GetAllSvtTestTypes",
             std::bind(&SvtDbTestTypeDto::getAllEntries, this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbTestTypeDto::CreateSvtTestType
  addRequest("CreateSvtTestType",
             std::bind(&SvtDbTestTypeDto::createEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
  //! SvtDbTestTypeDto::UpdateSvtTestType
  addRequest("UpdateSvtTestType",
             std::bind(&SvtDbTestTypeDto::updateEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
}
