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
  class SvtDbTestSetupConfigBodyDto : public SvtDbBaseDto
  {
   public:
    SvtDbTestSetupConfigBodyDto();
    ~SvtDbTestSetupConfigBodyDto() = default;

   private:
    void getConfigBody(const SvtKafka::SvtKafkaMessage &,
                       SvtKafka::SvtKafkaReplyMsg &);
    virtual void createAllRequest() final;
  };
};  // namespace SvtDbAgent
