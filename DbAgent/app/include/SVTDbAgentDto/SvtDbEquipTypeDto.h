#pragma once

/*!
 * @file SvtDbWaferTypeDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db Wafer type DTO
 * */

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbEquipTypeDto : public SvtDbBaseDto
  {
   public:
    SvtDbEquipTypeDto();
    ~SvtDbEquipTypeDto() = default;

   private:
    virtual void createAllRequest() final;
  };

};  // namespace SvtDbAgent
