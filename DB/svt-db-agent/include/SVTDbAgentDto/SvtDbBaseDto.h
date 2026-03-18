#pragma once

/*!
 * @file SvtDbBaseDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base DTO class
 */

#include <functional>
#include <map>
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

  struct SvtDbEntry
  {
   public:
    explicit SvtDbEntry() = default;
    ~SvtDbEntry() = default;

    void addValue(const std::string &_key, const nlohmann::basic_json<> &_val)
    {
      mValues[_key] = _val;
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

    void dump()
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

    // virtual void getEntityList(const int id, SvtDbAgent::SvtDbEntry &entry);

    //! database function
    virtual bool getAllEntriesFromDB(std::vector<SvtDbEntry> &entries,
                                     const SvtDbFilters &filters,
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

    bool findRequestAndRun(std::string_view, const SvtKafka::SvtKafkaMessage &,
                           SvtKafka::SvtKafkaReplyMsg &);

    void addColName(const std::string &name, const bool _isReq = true)
    {
      mainTable.addColName(name, _isReq);
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

    virtual void parseJsonData(const nlohmann::json &j_data, SvtDbEntry &entry);
    virtual void parseJsonFilters(const nlohmann::json &j_data,
                                  SvtDbFilters &filters);
    virtual void addRequest(
        std::string_view,
        std::function<void(const SvtKafka::SvtKafkaMessage &, SvtKafka::SvtKafkaReplyMsg &)>);

    virtual void createAllRequest() = 0;

   private:
    SvtDbTableDto mainTable;
    reqMap requestMap;
  };

};  // namespace SvtDbAgent
