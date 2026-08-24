#pragma once

/*!
 * @file DbTestDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief  Test Type Dto
 */

#include <memory>

#include "DbBaseDto.h"
#include "DbBaseListDto.h"

namespace dbagent
{
  class DbTestDto : public DbBaseDto
  {
   public:
    DbTestDto();
    ~DbTestDto() = default;

   private:
    std::shared_ptr<DbBaseListDto> dutEntityName;
    std::shared_ptr<DbBaseListDto> dutId;

    virtual void getAllEntries(const SvtKafka::SvtKafkaMessage &,
                               SvtKafka::SvtKafkaReplyMsg &);

    virtual void createEntry(const SvtKafka::SvtKafkaMessage &,
                             SvtKafka::SvtKafkaReplyMsg &) final;

    virtual void updateSvtTestStart(const SvtKafka::SvtKafkaMessage &,
                                    SvtKafka::SvtKafkaReplyMsg &) final;

    virtual void updateSvtTestFinish(const SvtKafka::SvtKafkaMessage &,
                                     SvtKafka::SvtKafkaReplyMsg &) final;

    virtual void createAllRequest() final;
  };
};  // namespace dbagent
