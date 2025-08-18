/*!
 * @file SvtDbAsicDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbAsicDto
 */

#include "SVTDbAgentDto/SvtDbAsicDto.h"
#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

//========================================================================+
SvtDbAgent::SvtDbAsicDto::SvtDbAsicDto()
{
  SetTableName("Asic");

  AddIntColName("id");
  AddIntColName("waferId");

  AddStrColName("serialNumber");
  AddStrColName("familyType");
  AddStrColName("waferMapPosition");
  AddStrColName("quality");
}

//========================================================================+
void SvtDbAgent::SvtDbAsicDto::getAllEntries(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  SvtDbFilters filters;
  parseFilter(msgData, filters);

  std::vector<SvtDbAgent::SvtDbEntry> entries;
  if (getAllEntriesFromDB(entries, filters))
  {
    Singleton<SvtLogger>::instance().logInfo("Number of asics: " +
                                             std::to_string(entries.size()));
  }

  if (!msgData.contains("pager"))
  {
    auto empty_list = std::vector<SvtDbEntry>();
    auto &asics = entries.size() <= 5000 ? entries : empty_list;
    getAllEntriesReplyMsg(asics, replyMsg, asics.size());
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

      throw std::runtime_error(err_msg.str());
      return;
    }
    size_t tail_size = entries.size() - pager_offset;
    std::vector<SvtDbEntry>::const_iterator first =
        entries.begin() + pager_offset;
    std::vector<SvtDbEntry>::const_iterator last =
        entries.begin() + pager_offset +
        ((tail_size < pager_limit) ? tail_size : pager_limit);
    std::vector<SvtDbEntry> asics(first, last);
    getAllEntriesReplyMsg(asics, replyMsg, entries.size());
  }
  return;
}

//========================================================================+
void SvtDbAgent::SvtDbAsicDto::getAllEntriesReplyMsg(
    const std::vector<SvtDbEntry> &entries, SvtDbAgentReplyMsg &msgReply,
    int totalCount)
{
  Singleton<SvtLogger>::instance().logInfo(
      "Creating message with " + std::to_string(entries.size()) + " out of " +
      std::to_string(totalCount));
  this->SvtDbBaseDto::getAllEntriesReplyMsg(entries, msgReply, totalCount);
}
