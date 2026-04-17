#pragma once

/*!
 * @file DbProbeCard.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief  Db Probe Card DTO
 * */

#include "DbBaseDto.h"

namespace dbagent
{
  class DbAgentMessage;
  class DbAgentReplyMsg;

  class DbProbeCardDto : public DbBaseDto
  {
   public:
    DbProbeCardDto();
    ~DbProbeCardDto() = default;

   private:
    void createAllRequest() final;
  };
};  // namespace dbagent
