#pragma once

/*!
 * @file DbModuleDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief  Db chip DTO
 * */

#include "DbBaseListDto.h"
#include "DbBaseLocationDto.h"

namespace dbagent
{
  class DbModuleDto : public DbBaseLocationDto
  {
   public:
    DbModuleDto();
    ~DbModuleDto() = default;

   private:
    std::shared_ptr<DbBaseListDto> chipIds;
    virtual void createAllRequest() final;
  };

};  // namespace dbagent
