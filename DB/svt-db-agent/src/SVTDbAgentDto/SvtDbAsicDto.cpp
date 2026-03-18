/*!
 * @file SvtDbAsicDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbAsicDto
 */

#include "SVTDbAgentDto/SvtDbAsicDto.h"
#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include "SvtKafkaMessage.h"
#include "SvtLogger.h"

#include <sstream>

using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaReplyMsg;

//========================================================================+
SvtDbAgent::SvtDbAsicDto::SvtDbAsicDto()
{
  setTableName("Asic");

  addColName("id");
  addColName("waferId");
  addColName("chipId");
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
void SvtDbAgent::SvtDbAsicDto::getAllEntries(
    const SvtKafkaMessage &msg,
    SvtKafkaReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  SvtDbFilters filters;
  parseJsonFilters(msgData, filters);

  std::vector<SvtDbAgent::SvtDbEntry> entries;
  if (getAllEntriesFromDB(entries, filters))
  {
    logInfo("Number of asics: " + std::to_string(entries.size()));
  }

  if (!msgData.contains("pager"))
  {
    auto empty_list = std::vector<SvtDbEntry>();
    auto &asics = entries.size() <= 5000 ? entries : empty_list;
    createReplyMsg(asics, replyMsg, asics.size());
  }
  else
  {
    size_t pager_limit = msgData["pager"]["limit"];
    size_t pager_offset = msgData["pager"]["offset"];

    if (entries.size() < pager_offset)
    {
      std::ostringstream err_msg;
      err_msg << "Pager offset out of "
                 "range, filtered asic "
                 "size: "
              << entries.size();

      THROW_RUNTIME_ERROR(err_msg.str());
      return;
    }
    size_t tail_size = entries.size() - pager_offset;
    std::vector<SvtDbEntry>::const_iterator first =
        entries.begin() + pager_offset;
    std::vector<SvtDbEntry>::const_iterator last =
        entries.begin() + pager_offset +
        ((tail_size < pager_limit) ? tail_size : pager_limit);
    std::vector<SvtDbEntry> asics(first, last);
    createReplyMsg(asics, replyMsg, entries.size());
  }
  return;
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
