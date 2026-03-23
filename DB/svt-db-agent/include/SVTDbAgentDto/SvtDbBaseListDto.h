#pragma once

/*!
 * @file SvtDbBaseListDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base list DTO class
 */

#include <string>

#include "SVTDb/SvtDbInterface.h"
#include "SvtDbBaseDto.h"
#include "SvtLogger.h"

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

    virtual bool updateRelationEntryInDB(const int id, const nlohmann::json &val) final
    {
      SvtDbInterface::SimpleUpdate update;

      update.setTableName(std::string(getTableName()));

      update.addWhereEquals(idName, id);

      update.addColumnAndValue(colName, val);

      if (!update.doUpdate())
      {
        SvtDbInterface::rollbackUpdate();
        return false;
      }
      SvtDbInterface::commitUpdate();

      return true;
    }

    virtual bool getEntriesWithId(const int &id, std::vector<SvtDbEntry> &entries)
    {
      SvtDbFilters filters;
      filters.mFilters.addValue(idName, id);

      if (!getAllEntriesFromDB(entries, std::string(), filters))
      {
        return false;
      }
      // addItemFromRelationDto(entry);

      return true;
    }

    virtual void addEntries(const int &id, const nlohmann::json &colVal)
    {
      for (auto it = colVal.begin(); it != colVal.end(); ++it)
      {
        std::vector<SvtDbEntry> entries;
        getEntriesWithId(id, entries);
        bool isFound = false;
        for (auto &entry : entries)
        {
          if (entry.getValue(colName) == it.value())
          {
            isFound = true;
            break;
          }
        }

        if (!isFound)
        {
          SvtDbEntry entry;
          entry.addValue(idName, id);
          entry.addValue(colName, it.value());
          createEntryInDB(entry);
        }
      }
    }

    const std::string &getIdName() { return idName; }
    const std::string &getColName() { return colName; }

   private:
    std::string idName;
    std::string colName;
    virtual void createAllRequest() final {};
  };
};  // namespace SvtDbAgent
