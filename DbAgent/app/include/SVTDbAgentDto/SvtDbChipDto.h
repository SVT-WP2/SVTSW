#pragma once

/*!
 * @file SvtDbChipDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Svt Db chip DTO
 * */

#include "SVTDbAgentDto/SvtDbAsicDto.h"
#include "SVTDbAgentDto/SvtDbBlockDto.h"
#include "SvtDbBaseLocationDto.h"
#include "SvtUtilities.h"

namespace SvtDbAgent
{
  class SvtDbChipDto : public SvtDbBaseLocationDto
  {
   public:
    SvtDbChipDto();
    ~SvtDbChipDto() = default;

   private:
    SvtDbAsicDto *asicDto = SvtUtils::Singleton<SvtDbAsicDto>::instance();
    SvtDbBlockDto *blockDto = SvtUtils::Singleton<SvtDbBlockDto>::instance();
    SvtDbAsicFamilyTypeBlockList *asicFamilyTypeBlockListDto = SvtUtils::Singleton<SvtDbAsicFamilyTypeBlockList>::instance();

    //! request DTO funcions
    virtual void createManyEntries(const SvtKafka::SvtKafkaMessage &msg,
                                   SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void createEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg) final;

    bool createChip(const nlohmann::json &, SvtDbEntry &);
    void createAllRequest() final;
  };

};  // namespace SvtDbAgent
