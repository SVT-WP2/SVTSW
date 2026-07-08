#pragma once

/*!
 * @file DbChipDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief  Db chip DTO
 * */

#include "DbAsicDto.h"
#include "DbBaseLocationDto.h"
#include "DbBlockDto.h"
#include "SvtUtilities.h"

namespace dbagent
{
  class DbChipDto : public DbBaseLocationDto
  {
   public:
    DbChipDto();
    ~DbChipDto() = default;

   private:
    DbAsicDto *asicDto = SvtUtils::Singleton<DbAsicDto>::instance();
    DbBlockDto *blockDto = SvtUtils::Singleton<DbBlockDto>::instance();
    DbAsicFamilyTypeBlockList *asicFamilyTypeBlockListDto = SvtUtils::Singleton<DbAsicFamilyTypeBlockList>::instance();

    //! request DTO funcions
    virtual bool getAllEntriesFromDB(std::vector<DbEntry> &entries,
                                     const std::string &,
                                     const DbEntry &filters,
                                     const std::string &orderBy = "", const bool orderDec = "") final;
    virtual void createManyEntries(const SvtKafka::SvtKafkaMessage &msg,
                                   SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void createEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg) final;

    bool createChip(const nlohmann::json &, DbEntry &);
    void createAllRequest() final;
  };

};  // namespace dbagent
