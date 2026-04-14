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

    void getConfigBody(const SvtKafka::SvtKafkaMessage &,
                       SvtKafka::SvtKafkaReplyMsg &);

   private:
    virtual void createAllRequest() final {};
  };

  class SvtDbTestSetupConfigDto : public SvtDbBaseDto
  {
   public:
    SvtDbTestSetupConfigDto();
    ~SvtDbTestSetupConfigDto() = default;

   private:
    std::shared_ptr<SvtDbTestSetupConfigBodyDto> testSetupConfigBody;

    virtual void createAllRequest() final;
  };
};  // namespace SvtDbAgent
