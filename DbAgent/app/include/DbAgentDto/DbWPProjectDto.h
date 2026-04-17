#pragma once

/*!
 * @file DbWPProject.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief  Db Wafer Probe Project DTO
 * */

#include <nlohmann/json.hpp>

#include "DbBaseDto.h"

namespace dbagent
{
  class DbAgentMessage;
  class DbAgentReplyMsg;

  class DbWPProjectDto : public DbBaseDto
  {
   public:
    DbWPProjectDto();
    ~DbWPProjectDto() = default;

   private:
    void createAllRequest() final;
  };
};  // namespace dbagent
