#pragma once

/*!
 * @file SvtDbBaseListDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base list DTO class
 */

#include <string>

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbBaseListDto : public SvtDbBaseDto
  {
   public:
    SvtDbBaseListDto(const std::string &tableName, const std::string &_idName, const std::string &_colName)
      : idName(_idName)
      , colName(_colName)
    {
      setTableName(tableName);

      addColName(idName);
      addColName(colName);
    };
    ~SvtDbBaseListDto() = default;

    virtual void getAllEntries(const SvtKafka::SvtKafkaMessage &msg,
                               SvtKafka::SvtKafkaReplyMsg &replyMsg) final
    {
      auto msgData = msg.getPayload()["data"];
      if (!msgData.contains(idName))
      {
        THROW_RUNTIME_ERROR("Missing field " + idName);
      }
      int id = msgData[idName];
      SvtUtils::recursive_erase_key(msgData, idName);
      msgData["filter"] = nlohmann::json::object({{idName, id}});

      this->SvtDbBaseDto::getAllEntriesAndReply(msgData, replyMsg);
    }
    virtual void addEntry(const nlohmann::json &idVal, const nlohmann::json &colVal)
    {
      SvtDbEntry entry;
      std::string json_s = (colVal.is_object()) ? colVal.dump() : colVal.get<std::string>();
      entry.addValue(idName, idVal);
      entry.addValue(colName, json_s);
      createEntryInDB(entry);
    }

   private:
    std::string idName;
    std::string colName;
    virtual void createAllRequest() final {};
  };
};  // namespace SvtDbAgent
