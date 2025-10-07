#ifndef SVT_DB_BASE_DTO_H
#define SVT_DB_BASE_DTO_H

/*!
 * @file SvtDbBaseDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base DTO class
 */

#include <nlohmann/json.hpp>

#include <functional>
#include <map>
#include <string>
#include <string_view>
#include <vector>

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;

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

    //! help functions
    virtual bool getAllEntriesFromDB(std::vector<SvtDbEntry> &entries,
                                     const SvtDbFilters &filters);
    virtual bool getEntryWithId(SvtDbEntry &entry, int id);

    virtual bool createEntryInDB(const SvtDbEntry &entry);

    virtual bool updateEntryInDB(const int id, const SvtDbEntry &entry);

    virtual void getAllEntriesReplyMsg(const std::vector<SvtDbEntry> &entries,
                                       SvtDbAgentReplyMsg &msgReply,
                                       int totalCount = -1);

    virtual void parseData(const nlohmann::json &entry_j, SvtDbEntry &entry);
    virtual void parseFilter(const nlohmann::json &msgData,
                             SvtDbFilters &filters);

    virtual void createEntryReplyMsg(const SvtDbEntry &entry,
                                     SvtDbAgentReplyMsg &msgReply);

    void clear() { std::vector<std::string>().swap(mColNames); }

    const std::vector<std::string> &getColNames() { return mColNames; }

    void addColName(const std::string &name) { mColNames.push_back(name); }

    void setTableName(const std::string &tName) { mTableName = tName; }
    const std::string &getTableName() { return mTableName; }

    bool findAndRun(std::string_view, const SvtDbAgentMessage &,
                    SvtDbAgentReplyMsg &);

    void addRequest(
        std::string_view,
        std::function<void(const SvtDbAgentMessage &, SvtDbAgentReplyMsg &)>);

   protected:
    virtual void createAllRequest() = 0;

   private:
    std::vector<std::string> mColNames;
    std::string mTableName;

    std::map<std::string_view,
             std::function<void(const SvtDbAgentMessage &, SvtDbAgentReplyMsg &)>>
        request_map;
  };
};  // namespace SvtDbAgent
#endif  //! SVT_DB_BASE_DTO_H
