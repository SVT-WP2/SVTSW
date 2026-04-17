#pragma once

/*!
 * @file DbTestTypeConfigDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief DbTestTypeConfigDto
 */

#include "DbBaseDto.h"

namespace dbagent
{
  class DbTestTypeConfigBodyDto : public DbBaseDto
  {
   public:
    DbTestTypeConfigBodyDto();
    ~DbTestTypeConfigBodyDto() = default;

    void getConfigBody(const SvtKafka::SvtKafkaMessage &,
                       SvtKafka::SvtKafkaReplyMsg &);

   private:
    virtual void createAllRequest() final {};
  };

  class DbTestTypeConfigDto : public DbBaseDto
  {
   public:
    DbTestTypeConfigDto();
    ~DbTestTypeConfigDto() = default;

   private:
    std::shared_ptr<DbTestTypeConfigBodyDto> testTypeConfigBody;

    virtual void createAllRequest() final;
  };
};  // namespace dbagent
