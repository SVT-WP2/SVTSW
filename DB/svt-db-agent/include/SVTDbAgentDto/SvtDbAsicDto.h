#pragma once

/*!
 * @file SvtDbAsicDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db asic DTO
 * */

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbAsicDto : public SvtDbBaseDto
  {
   public:
    SvtDbAsicDto();
    ~SvtDbAsicDto() = default;

   private:
    //! Request
    virtual bool getAllEntriesFromDB(std::vector<SvtDbEntry> &entries,
                                     const std::string &,
                                     const SvtDbFilters &filters,
                                     const std::string &orderBy = "", const bool orderDec = "") final;

    virtual void createReplyMsg(const std::vector<SvtDbEntry> &entries,
                                SvtKafka::SvtKafkaReplyMsg &msgReply,
                                int totalCount = -1) final;

    void createAllRequest() final;
  };
};  // namespace SvtDbAgent
