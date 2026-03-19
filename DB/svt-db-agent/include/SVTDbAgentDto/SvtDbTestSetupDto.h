#pragma once

/*!
 * @file SvtDbTestSetupDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Setup Dto
 */

#include <memory>
#include "SvtDbBaseDto.h"
#include "SvtDbBaseListDto.h"

namespace SvtDbAgent
{
  class SvtDbTestSetupDto : public SvtDbBaseDto
  {
   public:
    SvtDbTestSetupDto();
    ~SvtDbTestSetupDto() = default;

   private:
    std::shared_ptr<SvtDbBaseListDto> equipList;

    virtual void createEntry(const SvtKafka::SvtKafkaMessage &,
                             SvtKafka::SvtKafkaReplyMsg &);
    virtual void getAllEquipments(const SvtKafka::SvtKafkaMessage &,
                                  SvtKafka::SvtKafkaReplyMsg &);
    virtual void createAllRequest() final;
  };
};  // namespace SvtDbAgent
