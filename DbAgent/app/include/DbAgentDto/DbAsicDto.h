#pragma once

/*!
 * @file DbAsicDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief  Db asic DTO
 * */

#include "DbBaseDto.h"

namespace dbagent
{
  class DbAsicDto : public DbBaseDto
  {
   public:
    DbAsicDto();
    ~DbAsicDto() = default;

   private:
    //! Request
    virtual bool getAllEntriesFromDB(std::vector<DbEntry> &entries,
                                     const std::string &,
                                     const DbFilters &filters,
                                     const std::string &orderBy = "", const bool orderDec = "") final;

    virtual void createReplyMsg(const std::vector<DbEntry> &entries,
                                SvtKafka::SvtKafkaReplyMsg &msgReply,
                                int totalCount = -1) final;

    void createAllRequest() final;
  };
};  // namespace dbagent
