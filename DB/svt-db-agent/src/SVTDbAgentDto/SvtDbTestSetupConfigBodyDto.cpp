/*!
 * @file SvtDbTestSetupConfigDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Setup
 */

#include "SVTDbAgentDto/SvtDbTestSetupConfigBodyDto.h"
#include "SVTDbAgentDto/SvtDbBaseDto.h"

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
void SvtDbAgent::SvtDbTestSetupConfigBodyDto::createAllRequest()
{
  // ! SvtDbTestSetupConfigDto::GetSvtTestSetupConfigBody
  addRequest("GetSvtTestSetupConfigBody",
             std::bind(&SvtDbTestSetupConfigBodyDto::getConfigBody, this, std::placeholders::_1,
                       std::placeholders::_2));
}
