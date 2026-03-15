#pragma once

/*!
 * @file SvtDbBaseDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base Location DTO class
 */

#include <memory>
#include <string>

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbLocationDto : public SvtDbBaseDto
  {
   public:
    SvtDbLocationDto(std::string_view table_name, std::string_view id_name)
    {
      setTableName(std::string(table_name));

      addColName(std::string(id_name));
      addColName("generalLocation");
      addColName("date");
      addColName("username");
      addColName("note");
    };
    ~SvtDbLocationDto() = default;

    virtual void parseJsonData(const nlohmann::json &j_data,
                               SvtDbEntry &entry) final
    {
      this->SvtDbBaseDto::parseJsonData(j_data, entry);
    };

   private:
    virtual void createAllRequest() final {};
  };

  class SvtDbBaseLocationDto : public SvtDbBaseDto
  {
   public:
    SvtDbBaseLocationDto(const std::string &table_name, const std::string &id_name);
    ~SvtDbBaseLocationDto() = default;

    auto &getLocDto() { return locDto; }

    virtual bool createEntryWithLocation(const nlohmann::json &, SvtDbEntry &);
    virtual bool createEntryWithLocation(
        const SvtKafka::SvtKafkaMessage &,
        SvtDbEntry &);
    virtual void createEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void updateEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void
    updateLocation(const SvtKafka::SvtKafkaMessage &msg,
                   SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void getLocationHistory(const SvtKafka::SvtKafkaMessage &, SvtKafka::SvtKafkaReplyMsg &);

   private:
    std::shared_ptr<SvtDbLocationDto> locDto;
    std::string mLocTableName;
    std::string mLocIdName;
  };
};  // namespace SvtDbAgent
