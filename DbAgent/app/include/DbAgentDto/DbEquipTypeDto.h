#pragma once

/*!
 * @file DbWaferTypeDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief  Db Wafer type DTO
 * */

#include "DbBaseDto.h"

namespace dbagent
{
  class DbEquipTypeDto : public DbBaseDto
  {
   public:
    DbEquipTypeDto();
    ~DbEquipTypeDto() = default;

   private:
    virtual void createAllRequest() final;
  };

};  // namespace dbagent
