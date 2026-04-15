#pragma once

/*!
 * @file SvtDbProbeCard.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Svt Db Probe Card DTO
 * */

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;

  class SvtDbProbeCardDto : public SvtDbBaseDto
  {
   public:
    SvtDbProbeCardDto();
    ~SvtDbProbeCardDto() = default;

   private:
    void createAllRequest() final;
  };
};  // namespace SvtDbAgent
