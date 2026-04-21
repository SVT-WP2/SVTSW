/*!
 * @file DbTestSetupConfigDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief  Test Setup Config
 */

#include "DbAgentDto/DbTestSetupConfigDto.h"

namespace dbagent
{
  //========================================================================+
  DbTestSetupConfigBodyDto::DbTestSetupConfigBodyDto()
    : DbBaseDto()
  {
    setTableName("SvtTestSetupConfig");

    addColName("id");
    addColName("configBody");

    createAllRequest();
  }

  //========================================================================+
  void DbTestSetupConfigBodyDto::getConfigBody(const SvtKafka::SvtKafkaMessage &msg,
                                               SvtKafka::SvtKafkaReplyMsg &replyMsg)
  {
    int id = msg.getPayload()["data"]["id"].get<int>();
    DbEntry entry;
    getEntryWithId(entry, id);

    createReplyMsg(entry, replyMsg);
  }

  //========================================================================+
  DbTestSetupConfigDto::DbTestSetupConfigDto()
    : DbBaseDto()
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

    addValidFilter("setupId");

    testSetupConfigBody = std::make_shared<DbTestSetupConfigBodyDto>();

    createAllRequest();
  }

  //========================================================================+
  void DbTestSetupConfigDto::createAllRequest()
  {
    //! SvtDbTestSetupConfigDto::GetAllSvtTestSetup
    addRequest("GetAllSvtTestSetupConfigs",
               std::bind(&DbTestSetupConfigDto::getAllEntries, this,
                         std::placeholders::_1, std::placeholders::_2));

    //! SvtDbTestSetupConfigDto::CreateSvtTestSetup
    addRequest("CreateSvtTestSetupConfig",
               std::bind(&DbTestSetupConfigDto::createEntry, this, std::placeholders::_1,
                         std::placeholders::_2));

    // ! SvtDbTestSetupConfigDto::GetSvtTestSetupConfigBody
    addRequest("GetSvtTestSetupConfigBody",
               std::bind(&DbTestSetupConfigBodyDto::getConfigBody, testSetupConfigBody, std::placeholders::_1,
                         std::placeholders::_2));
  }
}  // namespace dbagent
