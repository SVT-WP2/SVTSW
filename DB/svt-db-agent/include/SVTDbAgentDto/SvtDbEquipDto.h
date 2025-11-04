#pragma once

/*!
 * @file SvtDbEquipDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Equipment type dto
 */

#include "SvtDbBaseLocationDto.h"

namespace SvtDbAgent
{
  class SvtDbEquipDto : public SvtDbBaseLocationDto
  {
   public:
    SvtDbEquipDto();
    ~SvtDbEquipDto() = default;

   private:
    //! request DTO funcions
    virtual void createEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg) final;

    virtual void createAllRequest() final;
  };
};  // namespace SvtDbAgent
