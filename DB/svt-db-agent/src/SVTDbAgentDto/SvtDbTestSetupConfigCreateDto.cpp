/*!
 * @file SvtDbTestSetupConfigDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Setup
 */

#include "SVTDbAgentDto/SvtDbTestSetupConfigCreateDto.h"
#include "SVTDbAgentDto/SvtDbBaseDto.h"

//========================================================================+
SvtDbAgent::SvtDbTestSetupConfigCreateDto::SvtDbTestSetupConfigCreateDto()
  : SvtDbBaseDto()
{
  setTableName("SvtTestSetupConfig");

  addColName("id");
  addColName("setupId");
  addColName("name");
  addColName("note");
  addColName("configBody");
  addColName("createdAt", false);

  // configBody = std::make_shared<SvtDbBaseListDto>("SvtTestSetupConfigBody", "setupConfigId", "configBody");

  createAllRequest();
}

// //========================================================================+
// void SvtDbAgent::SvtDbTestSetupConfigCreateDto::createEntry(const SvtKafka::SvtKafkaMessage &msg,
//                                                             SvtKafka::SvtKafkaReplyMsg &replyMsg)
// {
//   auto key = "configBody";
//   auto msgData = msg.getPayload()["data"]["create"];
//   if (!msgData.contains(key))
//   {
//     THROW_RUNTIME_ERROR("Missing field " + key);
//   }
//   const auto configBodyJson = msgData[key];
//   SvtUtils::recursive_erase_key(msgData, key);
//   SvtDbEntry entry;
//   if (!createAndReturnNewEntry(msgData, entry))
//   {
//     return;
//   }
//   configBody->addEntry(entry.getValue("id"), configBodyJson);
//   createReplyMsg(entry, replyMsg);
// }

//========================================================================+
void SvtDbAgent::SvtDbTestSetupConfigCreateDto::createAllRequest()
{
  //! SvtDbTestSetupConfigDto::CreateSvtTestSetup
  addRequest("CreateSvtTestSetupConfig",
             std::bind(&SvtDbTestSetupConfigCreateDto::createEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
}
