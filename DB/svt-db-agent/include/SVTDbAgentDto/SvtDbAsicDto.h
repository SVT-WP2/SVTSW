#pragma once

/*!
 * @file SvtDbAsicDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db asic DTO
 * */

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbAsicDto : public SvtDbBaseDto
  {
   public:
    SvtDbAsicDto();
    ~SvtDbAsicDto() = default;

   private:
    //! Request
    virtual void getAllEntries(const SvtKafka::SvtKafkaMessage &msg,
                               SvtKafka::SvtKafkaReplyMsg &replyMsg) final;

    void createAllRequest() final;
    virtual void createReplyMsg(const std::vector<SvtDbEntry> &entries,
                                SvtKafka::SvtKafkaReplyMsg &msgReply,
                                int totalCount = -1) final;
  };
};  // namespace SvtDbAgent
