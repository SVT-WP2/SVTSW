#pragma once

/*!
 * @file DbTestTypeDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief  Test Type Dto
 */

#include <memory>

#include "DbBaseDto.h"
#include "DbBaseListDto.h"

namespace dbagent
{
  class DbTestTypeDto : public DbBaseDto
  {
   public:
    DbTestTypeDto();
    ~DbTestTypeDto() = default;

   private:
    std::shared_ptr<DbBaseListDto> asicFamilyTypeList;

    virtual void getAllEntries(const SvtKafka::SvtKafkaMessage &,
                               SvtKafka::SvtKafkaReplyMsg &);

    virtual void createEntry(const SvtKafka::SvtKafkaMessage &,
                             SvtKafka::SvtKafkaReplyMsg &) final;

    virtual void updateEntry(const SvtKafka::SvtKafkaMessage &,
                             SvtKafka::SvtKafkaReplyMsg &) final;

    virtual void createAllRequest() final;
  };
};  // namespace dbagent
