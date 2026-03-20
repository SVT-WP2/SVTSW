#pragma once

/*!
 * @file SvtDbTestTypeConfigDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief SvtDbTestTypeConfigDto
 */

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbTestTypeConfigBodyDto : public SvtDbBaseDto
  {
   public:
    SvtDbTestTypeConfigBodyDto();
    ~SvtDbTestTypeConfigBodyDto() = default;

    void getConfigBody(const SvtKafka::SvtKafkaMessage &,
                       SvtKafka::SvtKafkaReplyMsg &);

   private:
    virtual void createAllRequest() final {};
  };

  class SvtDbTestTypeConfigDto : public SvtDbBaseDto
  {
   public:
    SvtDbTestTypeConfigDto();
    ~SvtDbTestTypeConfigDto() = default;

   private:
    std::shared_ptr<SvtDbTestTypeConfigBodyDto> testTypeConfigBody;

    virtual void createAllRequest() final;
  };
};  // namespace SvtDbAgent
