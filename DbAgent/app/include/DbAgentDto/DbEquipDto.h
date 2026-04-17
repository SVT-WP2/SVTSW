#pragma once

/*!
 * @file DbEquipDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Equipment type dto
 */

#include "DbBaseLocationDto.h"

namespace dbagent
{
  class DbEquipDto : public DbBaseLocationDto
  {
   public:
    DbEquipDto();
    ~DbEquipDto() = default;

   private:
    virtual void createAllRequest() final;
  };
};  // namespace dbagent
