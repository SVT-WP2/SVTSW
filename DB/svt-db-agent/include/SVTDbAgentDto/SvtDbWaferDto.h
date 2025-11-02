#pragma once

/*!
 * @file SvtDbWafer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db wafer DTO
 * */

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
  };
};  // namespace SvtDbAgent
