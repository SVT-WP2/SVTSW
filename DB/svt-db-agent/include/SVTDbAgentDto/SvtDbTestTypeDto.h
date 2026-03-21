#pragma once

/*!
 * @file SvtDbTestTypeDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Type Dto
 */

#include <memory>
#include "SvtDbBaseDto.h"
#include "SvtDbBaseListDto.h"

namespace SvtDbAgent
{
  class SvtDbTestTypeDto : public SvtDbBaseDto
  {
   public:
    SvtDbTestTypeDto();
    ~SvtDbTestTypeDto() = default;

   private:
    std::shared_ptr<SvtDbBaseListDto> asicFamilyTypeList;

    virtual void getAllEntries(const SvtKafka::SvtKafkaMessage &,
                               SvtKafka::SvtKafkaReplyMsg &);

    virtual void createEntry(const SvtKafka::SvtKafkaMessage &,
                             SvtKafka::SvtKafkaReplyMsg &) final;

    virtual void updateEntry(const SvtKafka::SvtKafkaMessage &,
                             SvtKafka::SvtKafkaReplyMsg &) final;

    virtual void createAllRequest() final;
  };
};  // namespace SvtDbAgent
