#pragma once

/*!
 * @file DbBaseDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base Location DTO class
 */

#include <memory>
#include <string>

#include "DbBaseDto.h"

namespace dbagent
{
  class DbLocationDto : public DbBaseDto
  {
   public:
    DbLocationDto(std::string_view table_name, std::string_view id_name)
    {
      setTableName(std::string(table_name));

      addColName(std::string(id_name));
      addColName("generalLocation");
      addColName("date");
      addColName("username");
      addColName("note");

      addValidFilter(std::string(id_name));
    };
    ~DbLocationDto() = default;

    virtual void parseJsonData(const nlohmann::json &j_data,
                               DbEntry &entry) final
    {
      this->DbBaseDto::parseJsonData(j_data, entry);
    };

   private:
    virtual void createAllRequest() final {};
  };

  class DbBaseLocationDto : public DbBaseDto
  {
   public:
    DbBaseLocationDto(const std::string &table_name, const std::string &id_name);
    ~DbBaseLocationDto() = default;

    auto &getLocDto() { return locDto; }

    virtual bool createEntryWithLocation(const nlohmann::json &, DbEntry &);
    virtual bool createEntryWithLocation(
        const SvtKafka::SvtKafkaMessage &,
        DbEntry &);
    virtual void createEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void updateEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void
    updateLocation(const SvtKafka::SvtKafkaMessage &msg,
                   SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void getLocationHistory(const SvtKafka::SvtKafkaMessage &, SvtKafka::SvtKafkaReplyMsg &);

   private:
    std::shared_ptr<DbLocationDto> locDto;
    std::string mLocTableName;
    std::string mLocIdName;
  };
};  // namespace dbagent
