/*!
 * @file SvtDbTestSetupConfigDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Setup Config
 */

#include "SVTDbAgentDto/SvtDbTestSetupConfigDto.h"
#include <memory>

//========================================================================+
SvtDbAgent::SvtDbTestSetupConfigBodyDto::SvtDbTestSetupConfigBodyDto()
  : SvtDbBaseDto()
{
  setTableName("SvtTestSetupConfig");

  addColName("id");
  addColName("configBody");

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbTestSetupConfigBodyDto::getConfigBody(const SvtKafka::SvtKafkaMessage &msg,
                                                            SvtKafka::SvtKafkaReplyMsg &replyMsg)
{
  int id = msg.getPayload()["data"]["id"].get<int>();
  SvtDbEntry entry;
  getEntryWithId(entry, id);

  createReplyMsg(entry, replyMsg);
}

//========================================================================+
SvtDbAgent::SvtDbTestSetupConfigDto::SvtDbTestSetupConfigDto()
  : SvtDbBaseDto()
{
  setTableName("SvtTestSetupConfig");

  addColName("id");
  addColName("setupId");
  addColName("name");
  addColName("note");
  addColName("configBody");
  addColName("createdAt", false);

  addItemToExclude("configBody");
  addColNameInJson("configBody");

  testSetupConfigBody = std::make_shared<SvtDbTestSetupConfigBodyDto>();

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbTestSetupConfigDto::createAllRequest()
{
  //! SvtDbTestSetupConfigDto::GetAllSvtTestSetup
  addRequest("GetAllSvtTestSetupConfigs",
             std::bind(&SvtDbTestSetupConfigDto::getAllEntries, this,
                       std::placeholders::_1, std::placeholders::_2));

  //! SvtDbTestSetupConfigDto::CreateSvtTestSetup
  addRequest("CreateSvtTestSetupConfig",
             std::bind(&SvtDbTestSetupConfigDto::createEntry, this, std::placeholders::_1,
                       std::placeholders::_2));

  // ! SvtDbTestSetupConfigDto::GetSvtTestSetupConfigBody
  addRequest("GetSvtTestSetupConfigBody",
             std::bind(&SvtDbTestSetupConfigBodyDto::getConfigBody, testSetupConfigBody, std::placeholders::_1,
                       std::placeholders::_2));
}
