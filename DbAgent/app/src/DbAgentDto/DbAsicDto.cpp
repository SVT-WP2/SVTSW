/*!
 * @file DbAsicDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief DbAsicDto
 */

#include "DbAgentDto/DbAsicDto.h"
#include "DbAgentDto/DbBaseDto.h"

using SvtKafka::SvtKafkaReplyMsg;

namespace dbagent
{
  //========================================================================+
  DbAsicDto::DbAsicDto()
  {
    setTableName("Asic");

    addColName("id");
    addColName("waferId");
    addColName("chipId", false);
    addColName("serialNumber");
    addColName("familyType");
    addColName("waferMapPosition");
    addColName("quality");

    addValidFilter("waferId");
    addValidFilter("chipId");
    addValidFilter("serialNumber");
    addValidFilter("familyTypes", "familyType");
    addValidFilter("quality");

    createAllRequest();
  }

  //========================================================================+
  void DbAsicDto::createAllRequest()
  {
    //! SvtDbAsicDto::GetAllAsics
    addRequest("GetAllAsics",
               std::bind(&DbAsicDto::getAllEntries, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbAsicDto::CreateAsic
    addRequest("CreateAsic",
               std::bind(&DbAsicDto::createEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
  }

  //========================================================================+
  bool DbAsicDto::getAllEntriesFromDB(std::vector<DbEntry> &entries,
                                      const std::string &,
                                      const DbEntry &filters,
                                      const std::string &orderBy, const bool orderDec)
  {
    std::string queryString = "";
    queryString += "SELECT T0.*, T1.\"id\" AS \"chipId\"";
    queryString += " FROM main.\"Asic\" AS T0";
    queryString += " LEFT JOIN main.\"Chip\" AS T1 ON T0.\"id\" = T1.\"asicId\"";

    return this->DbBaseDto::getAllEntriesFromDB(entries, queryString, filters, orderBy, orderDec);
  }

  //========================================================================+
  void DbAsicDto::createReplyMsg(
      const std::vector<DbEntry> &entries, SvtKafkaReplyMsg &msgReply,
      int totalCount)
  {
    logInfo("Creating message with " +
            std::to_string(entries.size()) + " out of " +
            std::to_string(totalCount));
    this->DbBaseDto::createReplyMsg(entries, msgReply, totalCount);
  }
}  // namespace dbagent
