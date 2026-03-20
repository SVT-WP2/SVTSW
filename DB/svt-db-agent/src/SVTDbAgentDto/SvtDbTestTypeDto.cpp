/*!
 * @file SvtDbTestSetupDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Type
 */

#include <string>

#include "SVTDbAgentDto/SvtDbTestTypeDto.h"
#include "SvtJsonUtils.h"

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
void SvtDbAgent::SvtDbTestTypeDto::createAllRequest()
{
  // !SvtDbTestTypeDto::GetAllSvtTestType
  addRequest("GetAllSvtTestTypes",
             std::bind(&SvtDbTestTypeDto::getAllEntries, this,
                       std::placeholders::_1, std::placeholders::_2));
  // //! SvtDbTestTypeDto::CreateSvtTestType
  // addRequest("CreateSvtTestType",
  //            std::bind(&SvtDbTestTypeDto::createEntry, this, std::placeholders::_1,
  //                      std::placeholders::_2));
  // //! SvtDbTestTypeDto::UpdateSvtTestTypeDefaultConfig
  // addRequest("UpdateSvtTestType",
  //            std::bind(&SvtDbTestTypeDto::updateEntry, this, std::placeholders::_1,
  //                      std::placeholders::_2));
  // // !SvtDbTestTypeDto::GetEquipmentListForTestType
  // addRequest("GetEquipmentListForTestType",
  //            std::bind(&SvtDbTestTypeDto::getAllEquipments, this, std::placeholders::_1,
  //                      std::placeholders::_2));
}
