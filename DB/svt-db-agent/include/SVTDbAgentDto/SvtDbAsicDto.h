#ifndef SVT_DB_ASIC_DTO_H
#define SVT_DB_ASIC_DTO_H

/*!
 * @file SvtDbAsicDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db asic DTO
 * */

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;

  class SvtDbAsicDto : public SvtDbBaseDto
  {
   public:
    SvtDbAsicDto();
    ~SvtDbAsicDto() = default;

    void getAllEntries(const SvtDbAgentMessage &msg,
                       SvtDbAgentReplyMsg &replyMsg) final;
    void getAllEntriesReplyMsg(const std::vector<SvtDbEntry> &entries,
                               SvtDbAgentReplyMsg &msgReply,
                               int totalCount = -1) final;
  };
};  // namespace SvtDbAgent
#endif  //! SVT_DB_WAFER_TYPE_DTO_H
