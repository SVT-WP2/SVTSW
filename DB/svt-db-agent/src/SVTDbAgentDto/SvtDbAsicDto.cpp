/*!
 * @file SvtDbAsicDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbAsicDto
 */

#include "SVTDbAgentDto/SvtDbAsicDto.h"

using SvtKafka::SvtKafkaReplyMsg;

//========================================================================+
SvtDbAgent::SvtDbAsicDto::SvtDbAsicDto()
{
  setTableName("Asic");

  addColName("id");
  addColName("waferId");
  addColName("chipId", false);
  addColName("serialNumber");
  addColName("familyType");
  addColName("waferMapPosition");
  addColName("quality");

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbAsicDto::createAllRequest()
{
  //! SvtDbAsicDto::GetAllAsics
  addRequest("GetAllAsics",
             std::bind(&SvtDbAsicDto::getAllEntries, this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbAsicDto::CreateAsic
  addRequest("CreateAsic",
             std::bind(&SvtDbAsicDto::createEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
}

//========================================================================+
bool SvtDbAgent::SvtDbAsicDto::getAllEntriesFromDB(std::vector<SvtDbEntry> &entries,
                                                   const std::string &,
                                                   const SvtDbFilters &filters,
                                                   const std::string &orderBy, const bool orderDec)
{
  std::string queryString = "";
  queryString += "SELECT T0.*, T1.\"id\" AS \"chipId\"";
  queryString += " FROM main.\"Asic\" AS T0";
  queryString += " LEFT JOIN main.\"Chip\" AS T1 ON T0.\"id\" = T1.\"asicId\"";

  return this->SvtDbBaseDto::getAllEntriesFromDB(entries, queryString, filters, orderBy, orderDec);
}

//========================================================================+
void SvtDbAgent::SvtDbAsicDto::createReplyMsg(
    const std::vector<SvtDbEntry> &entries, SvtKafkaReplyMsg &msgReply,
    int totalCount)
{
  logInfo("Creating message with " +
          std::to_string(entries.size()) + " out of " +
          std::to_string(totalCount));
  this->SvtDbBaseDto::createReplyMsg(entries, msgReply, totalCount);
}
