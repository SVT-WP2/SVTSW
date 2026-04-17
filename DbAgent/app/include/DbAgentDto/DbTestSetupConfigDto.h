#pragma once

/*!
 * @file DbTestSetupConfigDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief DbTestSetupConfigDto
 */

#include "DbBaseDto.h"

namespace dbagent
{
  class DbTestSetupConfigBodyDto : public DbBaseDto
  {
   public:
    DbTestSetupConfigBodyDto();
    ~DbTestSetupConfigBodyDto() = default;

    void getConfigBody(const SvtKafka::SvtKafkaMessage &,
                       SvtKafka::SvtKafkaReplyMsg &);

   private:
    virtual void createAllRequest() final {};
  };

  class DbTestSetupConfigDto : public DbBaseDto
  {
   public:
    DbTestSetupConfigDto();
    ~DbTestSetupConfigDto() = default;

   private:
    std::shared_ptr<DbTestSetupConfigBodyDto> testSetupConfigBody;

    virtual void createAllRequest() final;
  };
};  // namespace dbagent
