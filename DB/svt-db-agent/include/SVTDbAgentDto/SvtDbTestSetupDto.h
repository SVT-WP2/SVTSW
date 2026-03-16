#pragma once

/*!
 * @file SvtDbTestSetupDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Setup Dto
 */

#include "SvtDbBaseDto.h"
// #include "SvtKafkaMessage.h"

namespace SvtDbAgent
{
  class SvtDbTestSetupDto : public SvtDbBaseDto
  {
   public:
    SvtDbTestSetupDto();
    ~SvtDbTestSetupDto() = default;

   private:
    // virtual void getAllEntries(const SvtKafka::SvtKafkaMessage &,
    //                            SvtKafka::SvtKafkaReplyMsg &);
    // virtual void createEntry(const SvtKafka::SvtKafkaMessage &,
    //                          SvtKafka::SvtKafkaReplyMsg &) {};
    // virtual void updateEntry(const SvtKafka::SvtKafkaMessage &,
    //                          SvtKafka::SvtKafkaReplyMsg &) {};
    // virtual void GetEquipList(const SvtKafka::SvtKafkaMessage &,
    //                           SvtKafka::SvtKafkaReplyMsg &) {};
    virtual void createAllRequest() final;
  };
};  // namespace SvtDbAgent
