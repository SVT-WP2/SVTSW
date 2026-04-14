#pragma once

/*!
 * @file SvtDbWafer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db wafer DTO
 * */

#include "nlohmann/json_fwd.hpp"

#include "SvtDbBaseLocationDto.h"

namespace SvtDbAgent
{
  class SvtDbWaferDto : public SvtDbBaseLocationDto
  {
   public:
    SvtDbWaferDto();
    ~SvtDbWaferDto() = default;

   private:
    //! request DTO funcions
    virtual void createEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg) final;

    virtual void createAllRequest() final;

    //! Create asics for wafer
    void createAllAsics(const SvtDbAgent::SvtDbEntry &wafer);

   public:
    void createAllAsics(const int waferId, const std::string &waferSN, const nlohmann::json &waferTypeMap_j, const bool check_only = false);
  };
};  // namespace SvtDbAgent
