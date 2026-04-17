#pragma once

/*!
 * @file DbTestSetupDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief  Test Setup Dto
 */

#include <memory>

#include "DbBaseDto.h"
#include "DbBaseListDto.h"

namespace dbagent
{
  class DbTestSetupDto : public DbBaseDto
  {
   public:
    DbTestSetupDto();
    ~DbTestSetupDto() = default;

   private:
    std::shared_ptr<DbBaseListDto> equipList;
    std::shared_ptr<DbBaseListDto> setupDefaultConfigId;

    virtual void createEntry(const SvtKafka::SvtKafkaMessage &,
                             SvtKafka::SvtKafkaReplyMsg &);

    virtual void updateEntry(const SvtKafka::SvtKafkaMessage &,
                             SvtKafka::SvtKafkaReplyMsg &);

    virtual void getAllEquipments(const SvtKafka::SvtKafkaMessage &,
                                  SvtKafka::SvtKafkaReplyMsg &);

    virtual void createAllRequest() final;
  };
};  // namespace dbagent
