#pragma once

/*!
 * @file SvtDbWPProject.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db Wafer Probe Project DTO
 * */

#include <nlohmann/json.hpp>

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;

  class SvtDbWPProjectDto : public SvtDbBaseDto
  {
   public:
    SvtDbWPProjectDto();
    ~SvtDbWPProjectDto() = default;

   private:
    void createAllRequest() final;
  };
};  // namespace SvtDbAgent
