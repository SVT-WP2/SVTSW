#pragma once

/*!
 * @file SvtDbChipDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Svt Db chip DTO
 * */

#include "SvtDbBaseLocationDto.h"

namespace SvtDbAgent
{
  class SvtDbChipDto : public SvtDbBaseLocationDto
  {
   public:
    SvtDbChipDto();
    ~SvtDbChipDto() = default;

   private:
    //! request DTO funcions
    virtual void createManyEntries(const SvtKafka::SvtKafkaMessage &msg,
                                   SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void createEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg) final;

    bool createChip(const nlohmann::json &, SvtDbEntry &);
    void createAllRequest() final;
  };

};  // namespace SvtDbAgent
