/*!
 * @file SvtDbTestSetupDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Setup
 */

#include <string>

#include "SVTDbAgentDto/SvtDbTestSetupDto.h"
#include "SvtKafkaMessage.h"

using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaReplyMsg;
using bind_type = void (SvtDbAgent::SvtDbTestSetupDto::*)(const SvtKafkaMessage &, SvtKafkaReplyMsg &);
//========================================================================+
SvtDbAgent::SvtDbTestSetupDto::SvtDbTestSetupDto()
  : SvtDbBaseDto()
{
  setTableName("SvtTestSetup");

  addColName("id");
  addColName("name");
  addColName("defaultConfigId");
  addColName("generalLocation");

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbTestSetupDto::createAllRequest()
{
  //! SvtDbTestSetupDto::GetAllSvtTestSetup
  addRequest("GetAllSvtTestSetup",
             std::bind(static_cast<bind_type>(&SvtDbTestSetupDto::getAllEntries), this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbTestSetupDto::CreateSvtTestSetup
  addRequest("CreateSvtTestSetup",
             std::bind(&SvtDbTestSetupDto::createEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
  //! SvtDbTestSetupDto::UpdateSvtTestSetupDefaultConfig
  addRequest("UpdateSvtTestSetupDefaultConfig",
             std::bind(&SvtDbTestSetupDto::updateEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
  //! SvtDbTestSetupDto::GetEquipmentListForTestSetup
  addRequest("GetEquipmentListForTestSetup",
             std::bind(&SvtDbTestSetupDto::GetEquipList, this, std::placeholders::_1,
                       std::placeholders::_2));
}
