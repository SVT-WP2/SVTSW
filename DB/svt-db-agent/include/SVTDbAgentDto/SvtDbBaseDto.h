#pragma once

/*!
 * @file SvtDbBaseDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base DTO class
 */

#include "SvtKafkaMessage.h"
#include "SvtLogger.h"
#include "SvtUtilities.h"

#include <nlohmann/json.hpp>

#include <functional>
#include <map>
#include <string>
#include <string_view>
#include <vector>

namespace SvtDbAgent
{
  using SvtUtils::Singleton;
  using SvtUtils::SvtLogger;

  struct SvtDbEntry
  {
    std::map<std::string, nlohmann::basic_json<>> values;
    SvtDbEntry() = default;
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
    virtual bool updateEntryInDB(const int id, const SvtDbEntry &entry);

    //! Reply Message
    virtual void createReplyMsg(const std::vector<SvtDbEntry> &entries,
                                SvtKafka::SvtKafkaReplyMsg &msgReply,
                                int totalCount = -1);
    virtual void createReplyMsg(const SvtDbEntry &entry,
                                SvtKafka::SvtKafkaReplyMsg &msgReply);

    //! Getters
    const std::string &getTableName() { return mTableName; }

    const std::vector<std::string> &getColNames() { return mColNames; }

    SvtLogger *getLogger() { return logger; }

    bool findRequestAndRun(std::string_view, const SvtKafka::SvtKafkaMessage &,
                           SvtKafka::SvtKafkaReplyMsg &);

   protected:
    void addColName(const std::string &name) { mColNames.push_back(name); }
    void setTableName(const std::string &tName) { mTableName = tName; }

    virtual void getAllEntries(const nlohmann::json &data_j,
                               SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void createEntryAndReply(const nlohmann::json &data_j,
                                     SvtKafka::SvtKafkaReplyMsg &replyMsg);
    virtual void updateEntryAndReply(const int id, const nlohmann::json &data_j,
                                     SvtKafka::SvtKafkaReplyMsg &replyMsg);

    virtual void parseJsonData(const nlohmann::json &j_data, SvtDbEntry &entry);
    virtual void parseJsonFilters(const nlohmann::json &j_data,
                                  SvtDbFilters &filters);
    virtual void addRequest(
        std::string_view,
        std::function<void(const SvtKafka::SvtKafkaMessage &, SvtKafka::SvtKafkaReplyMsg &)>);

    virtual void createAllRequest() = 0;

   private:
    void clear() { std::vector<std::string>().swap(mColNames); }

    std::vector<std::string> mColNames;
    std::string mTableName;

    std::map<std::string_view,
             std::function<void(const SvtKafka::SvtKafkaMessage &, SvtKafka::SvtKafkaReplyMsg &)>>
        request_map;

    SvtLogger *logger = Singleton<SvtLogger>::instance();
  };

};  // namespace SvtDbAgent
