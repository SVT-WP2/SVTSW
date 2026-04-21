/*!
 * @file DbTestTypeConfigDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief  Test Type
 */

#include "DbAgentDto/DbTestTypeConfigDto.h"

namespace dbagent
{
  //========================================================================+
  DbTestTypeConfigBodyDto::DbTestTypeConfigBodyDto()
    : DbBaseDto()
  {
    setTableName("SvtTestTypeConfig");

    addColName("id");
    addColName("configBody");

    createAllRequest();
  }

  //========================================================================+
  void DbTestTypeConfigBodyDto::getConfigBody(const SvtKafka::SvtKafkaMessage &msg,
                                              SvtKafka::SvtKafkaReplyMsg &replyMsg)
  {
    int id = msg.getPayload()["data"]["id"].get<int>();
    DbEntry entry;
    getEntryWithId(entry, id);

    createReplyMsg(entry, replyMsg);
  }

  //========================================================================+
  DbTestTypeConfigDto::DbTestTypeConfigDto()
    : DbBaseDto()
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

    addValidFilter("testTypeId");

    testTypeConfigBody = std::make_shared<DbTestTypeConfigBodyDto>();

    createAllRequest();
  }

  //========================================================================+
  void DbTestTypeConfigDto::createAllRequest()
  {
    //! SvtDbTestTypeConfigDto::GetAllSvtTestType
    addRequest("GetAllSvtTestTypeConfigs",
               std::bind(&DbTestTypeConfigDto::getAllEntries, this,
                         std::placeholders::_1, std::placeholders::_2));

    //! SvtDbTestTypeConfigDto::CreateSvtTestType
    addRequest("CreateSvtTestTypeConfig",
               std::bind(&DbTestTypeConfigDto::createEntry, this, std::placeholders::_1,
                         std::placeholders::_2));

    // ! SvtDbTestTypeConfigDto::GetSvtTestTypeConfigBody
    addRequest("GetSvtTestTypeConfigBody",
               std::bind(&DbTestTypeConfigBodyDto::getConfigBody, testTypeConfigBody, std::placeholders::_1,
                         std::placeholders::_2));
  }
}  // namespace dbagent
