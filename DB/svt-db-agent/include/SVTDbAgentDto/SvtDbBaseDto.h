#ifndef SVT_DB_BASE_DTO_H
#define SVT_DB_BASE_DTO_H

/*!
 * @file SvtDbBaseDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base DTO class
 */

#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include <nlohmann/json.hpp>

#include <functional>
#include <map>
#include <string>
#include <string_view>
#include <vector>

namespace SvtDbAgent
{
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
    virtual void getAllEntries(const SvtDbAgentMessage &msg,
                               SvtDbAgentReplyMsg &replyMsg);
    virtual void createEntry(const SvtDbAgentMessage &msg,
                             SvtDbAgentReplyMsg &replyMsg);
    virtual void updateEntry(const SvtDbAgent::SvtDbAgentMessage &msg,
                             SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

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
                                SvtDbAgentReplyMsg &msgReply,
                                int totalCount = -1);
    virtual void createReplyMsg(const SvtDbEntry &entry,
                                SvtDbAgentReplyMsg &msgReply);

    //! Getters
    const std::string &getTableName() { return mTableName; }

    const std::vector<std::string> &getColNames() { return mColNames; }

    SvtLogger *getLogger() { return logger; }

    bool findRequestAndRun(std::string_view, const SvtDbAgentMessage &,
                           SvtDbAgentReplyMsg &);

   protected:
    void addColName(const std::string &name) { mColNames.push_back(name); }
    void setTableName(const std::string &tName) { mTableName = tName; }

    virtual void getAllEntries(const nlohmann::json &data_j,
                               SvtDbAgentReplyMsg &replyMsg);
    virtual void createEntry(const nlohmann::json &data_j,
                             SvtDbAgentReplyMsg &replyMsg);
    virtual void updateEntry(const int id, const nlohmann::json &data_j,
                             SvtDbAgentReplyMsg &replyMsg);

    virtual void parseJsonData(const nlohmann::json &j_data, SvtDbEntry &entry);
    virtual void parseJsonFilters(const nlohmann::json &j_data,
                                  SvtDbFilters &filters);
    virtual void addRequest(
        std::string_view,
        std::function<void(const SvtDbAgentMessage &, SvtDbAgentReplyMsg &)>);

    virtual void createAllRequest() = 0;

   private:
    void clear() { std::vector<std::string>().swap(mColNames); }

    std::vector<std::string> mColNames;
    std::string mTableName;

    std::map<std::string_view,
             std::function<void(const SvtDbAgentMessage &, SvtDbAgentReplyMsg &)>>
        request_map;

    SvtLogger *logger = Singleton<SvtLogger>::instance();
  };

  template <class T>
  void getLocationHistory(const SvtDbAgentMessage &msg, SvtDbAgentReplyMsg &replyMsg, const std::string &nameId, T *locDto)
  {
    try
    {
      const auto &id = msg.getPayload()["data"][nameId];
      SvtDbFilters filters;
      filters.mFilters.values.insert({nameId, id});

      std::vector<SvtDbAgent::SvtDbEntry> entries;
      if (locDto->getAllEntriesFromDB(entries, filters))
      {
        locDto->createReplyMsg(entries, replyMsg);
      }
    }
    catch (const std::exception &e)
    {
      throw e;
      return;
    }
  };

};  // namespace SvtDbAgent
#endif  //! SVT_DB_BASE_DTO_H
