#pragma once

/*!
 * @file DbWafer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief  Db wafer DTO
 * */

#include "nlohmann/json_fwd.hpp"

#include "DbBaseLocationDto.h"

namespace dbagent
{
  class DbWaferDto : public DbBaseLocationDto
  {
   public:
    DbWaferDto();
    ~DbWaferDto() = default;

   private:
    //! request DTO funcions
    virtual void createEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg) final;

    virtual void createAllRequest() final;

    //! Create asics for wafer
    void createAllAsics(const DbEntry &wafer);

   public:
    void createAllAsics(const int waferId, const std::string &waferSN, const nlohmann::json &waferTypeMap_j, const bool check_only = false);
  };
};  // namespace dbagent
