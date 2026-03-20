/*!
 * @file SvtDbTestTypeConfigDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Type
 */

#include "SVTDbAgentDto/SvtDbTestTypeConfigDto.h"
#include <memory>

//========================================================================+
SvtDbAgent::SvtDbTestTypeConfigBodyDto::SvtDbTestTypeConfigBodyDto()
  : SvtDbBaseDto()
{
  setTableName("SvtTestTypeConfig");

  addColName("id");
  addColName("configBody");

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbTestTypeConfigBodyDto::getConfigBody(const SvtKafka::SvtKafkaMessage &msg,
                                                           SvtKafka::SvtKafkaReplyMsg &replyMsg)
{
  int id = msg.getPayload()["data"]["id"].get<int>();
  SvtDbEntry entry;
  getEntryWithId(entry, id);

  createReplyMsg(entry, replyMsg);
}

//========================================================================+
SvtDbAgent::SvtDbTestTypeConfigDto::SvtDbTestTypeConfigDto()
  : SvtDbBaseDto()
{
  setTableName("SvtTestTypeConfig");

  addColName("id");
  addColName("testTypeId");
  addColName("name");
  addColName("note");
  addColName("configBody");
  addColName("createdAt", false);

  addItemToExclude("configBody");
  addColNameInJson("configBody");

  testTypeConfigBody = std::make_shared<SvtDbTestTypeConfigBodyDto>();

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbTestTypeConfigDto::createAllRequest()
{
  //! SvtDbTestTypeConfigDto::GetAllSvtTestType
  addRequest("GetAllSvtTestTypeConfigs",
             std::bind(&SvtDbTestTypeConfigDto::getAllEntries, this,
                       std::placeholders::_1, std::placeholders::_2));

  //! SvtDbTestTypeConfigDto::CreateSvtTestType
  addRequest("CreateSvtTestTypeConfig",
             std::bind(&SvtDbTestTypeConfigDto::createEntry, this, std::placeholders::_1,
                       std::placeholders::_2));

  // ! SvtDbTestTypeConfigDto::GetSvtTestTypeConfigBody
  addRequest("GetSvtTestTypeConfigBody",
             std::bind(&SvtDbTestTypeConfigBodyDto::getConfigBody, testTypeConfigBody, std::placeholders::_1,
                       std::placeholders::_2));
}
