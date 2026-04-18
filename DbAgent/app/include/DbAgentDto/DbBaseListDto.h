#pragma once

/*!
 * @file SvtDbBaseListDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base list DTO class
 */

#include <string>

#include "Database/DbAPI.h"
#include "DbBaseDto.h"
#include "SvtLogger.h"

namespace dbagent
{
  class DbBaseListDto : public DbBaseDto
  {
   public:
    using props_t = struct props_s
    {
      std::string pkName;
      std::string colName;
      std::string inDtoName;
      bool isArray;
    };

    explicit DbBaseListDto(const std::string &tableName, const std::string &pkName, const std::string &colName, const std::string &inDtoName = {}, const bool &isArray = false)
      : mProps({pkName, colName, inDtoName.empty() ? colName : inDtoName, isArray})
    {
      setTableName(tableName);

      addColName(mProps.pkName);
      addColName(mProps.colName);
    };
    ~DbBaseListDto() = default;

    virtual void getAllEntries(const SvtKafka::SvtKafkaMessage &msg,
                               SvtKafka::SvtKafkaReplyMsg &replyMsg) final
    {
      auto msgData = msg.getPayload()["data"];
      if (!msgData.contains(mProps.pkName))
      {
        THROW_RUNTIME_ERROR("Missing field " + mProps.pkName);
      }
      int id = msgData[mProps.pkName];
      SvtUtils::recursive_erase_key(msgData, mProps.pkName);
      msgData["filter"] = nlohmann::json::object({{mProps.pkName, id}});

      this->DbBaseDto::getAllEntriesAndReply(msgData, replyMsg);
    }

    virtual bool updateRelationEntryInDB(const int id, const nlohmann::json &val) final
    {
      database::dbapi::SimpleUpdate update;

      update.setTableName(std::string(getTableName()));

      update.addWhereEquals(mProps.pkName, id);

      update.addColumnAndValue(mProps.colName, val);

      if (!update.doUpdate())
      {
        database::dbapi::rollbackUpdate();
        return false;
      }
      database::dbapi::commitUpdate();

      return true;
    }

    virtual bool getEntriesWithId(const int &id, std::vector<DbEntry> &entries)
    {
      DbEntry filters;
      filters.addValue(mProps.pkName, id);

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
        std::vector<DbEntry> entries;
        getEntriesWithId(id, entries);
        bool isFound = false;
        for (auto &entry : entries)
        {
          if (entry.getValue(mProps.colName) == it.value())
          {
            isFound = true;
            break;
          }
        }

        if (!isFound)
        {
          DbEntry entry;
          entry.addValue(mProps.pkName, id);
          entry.addValue(mProps.colName, it.value());
          createEntryInDB(entry);
        }
      }
    }

    const auto &getProps() { return mProps; }

   private:
    props_t mProps;
    virtual void createAllRequest() final {};
  };
};  // namespace dbagent
