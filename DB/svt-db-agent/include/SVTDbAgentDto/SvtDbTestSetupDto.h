#pragma once

/*!
 * @file SvtDbTestSetupDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Setup Dto
 */

#include <memory>
#include "SvtDbBaseDto.h"
// #include "SvtKafkaMessage.h"

namespace SvtDbAgent
{
  class SvtDbEquipSvtTestSetupList : public SvtDbBaseDto
  {
   public:
    SvtDbEquipSvtTestSetupList();
    ~SvtDbEquipSvtTestSetupList() = default;
  };

  class SvtDbTestSetupDto : public SvtDbBaseDto
  {
   public:
    SvtDbTestSetupDto();
    ~SvtDbTestSetupDto() = default;

   private:
    std::shared_ptr<SvtDbEquipSvtTestSetupList> equipList = std::shared_ptr<SvtDbEquipSvtTestSetupList>();

    virtual void createEntry(const SvtKafka::SvtKafkaMessage &,
                             SvtKafka::SvtKafkaReplyMsg &) {};
    virtual void createAllRequest() final;
  };
};  // namespace SvtDbAgent
