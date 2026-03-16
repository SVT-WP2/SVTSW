#pragma once

/*!
 * @file SvtDbTestSetupConfigDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief SvtDbTestSetupConfigDto
 */

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbTestSetupConfigDto : public SvtDbBaseDto
  {
   public:
    SvtDbTestSetupConfigDto();
    ~SvtDbTestSetupConfigDto() = default;

   private:
    virtual void createAllRequest() final;
  };
};  // namespace SvtDbAgent
