#pragma once

/*!
 * @file SvtDbBaseDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base DTO class
 */

#include "SvtKafkaMessage.h"
#include "SvtLogger.h"

#include <nlohmann/json.hpp>

#include <functional>
#include <map>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

namespace SvtDbAgent
{
  using Map = std::map<std::string, bool>;

  struct SvtDbEntry
  {
   public:
    explicit SvtDbEntry() = default;
    ~SvtDbEntry() = default;

    void addValue(const std::string &_key, const nlohmann::basic_json<> &_val)
    {
      if (mValues.find(_key) != mValues.end())
      {
        mValues[_key] = _val;
      }
      else
      {
        mValues.insert({_key, _val});
      }
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

    const std::map<std::string, nlohmann::basic_json<>> getValues() const { return mValues; }

   private:
    std::string mName;
    std::map<std::string, nlohmann::basic_json<>> mValues;
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
    virtual ~SvtDbBaseDto() { clear(); }

    //! request DTO funcions
    virtual void getAllEntries(const SvtKafka::SvtKafkaMessage &msg,
                               SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void createEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void updateEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg);

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

    //! Getters
    const std::string &getTableName() { return mTableName; }

    const Map &getColNames() { return mColNames; }

    bool findRequestAndRun(std::string_view, const SvtKafka::SvtKafkaMessage &,
                           SvtKafka::SvtKafkaReplyMsg &);

   protected:
    void addColName(const std::string &name, const bool _req = true)
    {
      mColNames[name] = _req;
    }
    void setTableName(const std::string &tName) { mTableName = tName; }

    virtual void getAllEntries(const nlohmann::json &data_j,
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
    void clear()
    {
      mColNames.clear();
    }

    Map mColNames;
    std::string mTableName;

    std::map<std::string_view,
             std::function<void(const SvtKafka::SvtKafkaMessage &, SvtKafka::SvtKafkaReplyMsg &)>>
        request_map;
  };

};  // namespace SvtDbAgent
