#pragma once

/*!
 * @file SvtDbBaseDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base DTO class
 */

#include <functional>
#include <map>
#include <set>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

#include <nlohmann/json.hpp>

#include "SvtDbTableDto.h"
#include "SvtKafkaMessage.h"
#include "SvtLogger.h"

namespace SvtDbAgent
{
  using jsonMap = std::map<std::string, nlohmann::basic_json<>>;
  using reqMap = std::map<std::string_view, std::function<void(const SvtKafka::SvtKafkaMessage &, SvtKafka::SvtKafkaReplyMsg &)>>;

  class SvtDbBaseListDto;

  struct SvtDbEntry
  {
   public:
    explicit SvtDbEntry() = default;
    ~SvtDbEntry() = default;

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
      try
      {
        return mValues.at(_key);
      }
      catch (const std::out_of_range &ex)
      {
        THROW_RUNTIME_ERROR("ERROR: Out of range " + ex.what());
        return {};
      }
    }

    const jsonMap &getValues() const { return mValues; }

    void dump() const
    {
      logInfo("Dumping entry");
      for (auto &[key, value] : mValues)
      {
        logDebug("Key: " + key + ", value: " + value.dump());
      }
    }

   private:
    std::string mName;
    jsonMap mValues;
  };

  struct SvtDbFilters
  {
    std::vector<int> ids;
    SvtDbEntry mFilters;
  };

  class SvtDbBaseDto
  {
   public:
    SvtDbBaseDto() = default;
    virtual ~SvtDbBaseDto() { mainTable.clear(); }

    //! request DTO funcions
    virtual void getAllEntries(const SvtKafka::SvtKafkaMessage &msg,
                               SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void createEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void updateEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void updateEntryInRelationTable(SvtDbBaseListDto *relationDto,
                                            const SvtKafka::SvtKafkaMessage &msg,
                                            SvtKafka::SvtKafkaReplyMsg &replyMsg);

    //! database function
    virtual bool getAllEntriesFromDB(std::vector<SvtDbEntry> &entries,
                                     const std::string &queryString = "",
                                     const SvtDbFilters &filters = SvtDbFilters(),
                                     const std::string &orderBy = "",
                                     const bool orderDec = false);
    virtual bool getEntryWithId(SvtDbEntry &entry, int id);

    virtual bool createEntryInDB(const SvtDbEntry &entry);
    virtual bool updateEntryInDB(const int id, const SvtDbEntry &entry, bool allowNull = false);

    //! Reply Message
    virtual void createReplyMsg(const std::vector<SvtDbEntry> &entries,
                                SvtKafka::SvtKafkaReplyMsg &msgReply,
                                int totalCount = -1);
    virtual void createReplyMsg(const SvtDbEntry &entry,
                                SvtKafka::SvtKafkaReplyMsg &msgReply);
    virtual bool createAndReturnNewEntry(const nlohmann::json &data_j, SvtDbEntry &entry);

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

    void addRelationDto(SvtDbBaseListDto *dto)
    {
      relationDtos.push_back(dto);
    }

    void setTableName(const std::string &tName) { mainTable.setTableName(tName); }

    //! Getters
    const std::string &getTableName() { return mainTable.getTableName(); }
    const colMap &getColNames() { return mainTable.getColNames(); }

   protected:
    virtual void getAllEntriesAndReply(const nlohmann::json &data_j,
                                       SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void createEntryAndReply(const nlohmann::json &data_j,
                                     SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void updateEntryAndReply(const int id, const nlohmann::json &data_j,
                                     SvtKafka::SvtKafkaReplyMsg &replyMsg, bool allowNull = false);

    virtual void addItemFromRelationDto(SvtDbEntry &entry);

    virtual void parseJsonData(const nlohmann::json &j_data, SvtDbEntry &entry);
    virtual void parseJsonFilters(const nlohmann::json &j_data,
                                  SvtDbFilters &filters);
    virtual void addRequest(
        std::string_view,
        std::function<void(const SvtKafka::SvtKafkaMessage &, SvtKafka::SvtKafkaReplyMsg &)>);

    virtual void createAllRequest() = 0;

   private:
    SvtDbTableDto mainTable;
    std::set<std::string> colNameInJson;
    std::set<std::string> excludeItemsInReply;

    std::vector<SvtDbBaseListDto *> relationDtos;
    reqMap requestMap;
  };

};  // namespace SvtDbAgent
