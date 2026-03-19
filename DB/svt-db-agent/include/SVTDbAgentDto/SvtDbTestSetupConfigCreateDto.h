#pragma once

/*!
 * @file SvtDbTestSetupConfigDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief SvtDbTestSetupConfigDto
 */

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbTestSetupConfigCreateDto : public SvtDbBaseDto
  {
   public:
    SvtDbTestSetupConfigCreateDto();
    ~SvtDbTestSetupConfigCreateDto() = default;

   private:
    // virtual void createEntry(const SvtKafka::SvtKafkaMessage &msg,
    //                          SvtKafka::SvtKafkaReplyMsg &replyMsg) final;
    virtual void createAllRequest() final;
  };
};  // namespace SvtDbAgent
