#pragma once

/*!
 * @file DbBaseDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base DTO class
 */

#include <functional>
#include <map>
#include <set>
// #include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

#include <nlohmann/json.hpp>

#include "DbTableDto.h"
#include "SvtKafkaMessage.h"
#include "SvtLogger.h"

namespace dbagent
{
  using jsonMap_t = std::map<std::string, nlohmann::basic_json<>>;
  using strStrMap_t = std::map<std::string, std::string>;
  using reqMap_t = std::map<std::string_view, std::function<void(const SvtKafka::SvtKafkaMessage &, SvtKafka::SvtKafkaReplyMsg &)>>;
  using strSet_t = std::set<std::string>;

  class DbBaseListDto;

  class DbEntry
  {
   public:
    explicit DbEntry() = default;
    ~DbEntry() = default;

    void addValue(const std::string &_key, const nlohmann::basic_json<> &_val)
    {
      mValues[_key] = _val;
    }

    void eraseVal(const std::string &_key)
    {
      mValues.erase(_key);
    }

    nlohmann::basic_json<> getValue(const std::string &_key) const
    {
      if (mValues.find(_key) != mValues.end())
      {
        return mValues.at(_key);
      }
      return {};
    }

    void clear() { mValues.clear(); }

    const jsonMap_t &getValues() const { return mValues; }

    void dump() const
    {
      logInfo("Dumping entry");
      for (auto &[key, value] : mValues)
      {
        logDebug("Key: " + key + ", value: " + value.dump());
      }
    }

   private:
    jsonMap_t mValues;
  };

  class DbBaseDto
  {
   public:
    DbBaseDto() = default;
    virtual ~DbBaseDto() { mainTable.clear(); }

    //! request DTO funcions
    virtual void getAllEntries(const SvtKafka::SvtKafkaMessage &msg,
                               SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void createEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void updateEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void updateEntryInRelationTable(DbBaseListDto *relationDto,
                                            const SvtKafka::SvtKafkaMessage &msg,
                                            SvtKafka::SvtKafkaReplyMsg &replyMsg);

    //! database function
    virtual bool getAllEntriesFromDB(std::vector<DbEntry> &entries,
                                     const std::string &queryString = "",
                                     const DbEntry &filters = DbEntry(),
                                     const std::string &orderBy = "",
                                     const bool orderDec = false);
    virtual bool getEntryWithId(DbEntry &entry, int id);

    virtual bool createEntryInDB(const DbEntry & /*entry*/) { return true; };
    virtual bool updateEntryInDB(const int id, const DbEntry &entry, bool allowNull = false);

    //! Reply Message
    virtual void createReplyMsg(const std::vector<DbEntry> &entries,
                                SvtKafka::SvtKafkaReplyMsg &msgReply,
                                int totalCount = -1);
    virtual void createReplyMsg(const DbEntry &entry,
                                SvtKafka::SvtKafkaReplyMsg &msgReply);
    virtual bool createAndReturnNewEntry(const nlohmann::json &data_j, DbEntry &entry);

    bool findRequestAndRun(std::string_view, const SvtKafka::SvtKafkaMessage &,
                           SvtKafka::SvtKafkaReplyMsg &);

    void addColName(const std::string &name, const bool _isReq = true)
    {
      mainTable.addColName(name, _isReq);
    }

    void addColNameInJson(const std::string &name)
    {
      colNameInJson.insert(name);
    }

    void addItemToExclude(const std::string &name)
    {
      excludeItemsInReply.insert(name);
    }

    void addRelationDto(DbBaseListDto *dto)
    {
      relationDtos.push_back(dto);
    }

    void addValidFilter(const std::string &filterName)
    {
      addValidFilter(filterName, filterName);
    }

    void addValidFilter(const std::string &filterName, const std::string &colName)
    {
      validFilters.insert({filterName, colName});
    }

    void setTableName(const std::string &tName) { mainTable.setTableName(tName); }

    //! Getters
    const auto &getTableName() const { return mainTable.getTableName(); }
    const auto &getColNames() const { return mainTable.getColNames(); }
    const auto &getValidFilterNames() const { return validFilters; }

    // const auto getFilterValue(const std::string &name) { return mFilters.getValue(name); }

   protected:
    virtual void getAllEntriesAndReply(const nlohmann::json &data_j,
                                       SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void createEntryAndReply(const nlohmann::json &data_j,
                                     SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void updateEntryAndReply(const int id, const nlohmann::json &data_j,
                                     SvtKafka::SvtKafkaReplyMsg &replyMsg, bool allowNull = false);

    virtual void addItemFromRelationDto(DbEntry &entry);

    virtual void parseJsonData(const nlohmann::json &j_data, DbEntry &entry);
    virtual void parseJsonFilters(const nlohmann::json &j_data,
                                  DbEntry &filters);
    virtual void addRequest(
        std::string_view,
        std::function<void(const SvtKafka::SvtKafkaMessage &, SvtKafka::SvtKafkaReplyMsg &)>);

    virtual void createAllRequest() = 0;

    // void addFilter(const std::string &_name, const nlohmann::basic_json<> &_val)
    // {
    //   mFilters.addValue(_name, _val);
    // }

   private:
    std::string mName;

    DbTableDto mainTable;
    strSet_t colNameInJson;
    strSet_t excludeItemsInReply;

    std::vector<DbBaseListDto *> relationDtos;

    strStrMap_t validFilters;
    // DbEntry mFilters;

    reqMap_t requestMap;
  };

};  // namespace dbagent
