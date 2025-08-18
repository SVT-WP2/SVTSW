#ifndef SVT_DB_BASE_DTO_H
#define SVT_DB_BASE_DTO_H

/*!
 * @file SvtDbBaseDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base DTO class
 */

#include <nlohmann/json.hpp>

#include <map>
#include <string>
#include <vector>

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;

  struct SvtDbEntry
  {
    std::map<const std::string, int> int_values;
    std::map<const std::string, std::string> string_values;
  };

  struct SvtDbFilters
  {
    std::vector<int> ids;
    std::map<std::string, int> intFilters;
    std::map<std::string, std::string> strFilters;
  };

  class SvtDbBaseDto
  {
   public:
    SvtDbBaseDto() = default;
    ~SvtDbBaseDto() { Clear(); }

    virtual bool getAllEntriesFromDB(std::vector<SvtDbEntry> &entries,
                                     const SvtDbFilters &filters);
    virtual bool getEntryWithId(SvtDbEntry &entry, int id);

    virtual bool createEntryInDB(const SvtDbEntry &entry);

    virtual bool updateEntryInDB(const int id, const SvtDbEntry &entry);

    virtual void getAllEntries(const SvtDbAgentMessage &msg,
                               SvtDbAgentReplyMsg &replyMsg);

    virtual void getAllEntriesReplyMsg(const std::vector<SvtDbEntry> &entries,
                                       SvtDbAgentReplyMsg &msgReply,
                                       int totalCount = -1);

    virtual void parseData(const nlohmann::json &entry_j, SvtDbEntry &entry);
    virtual void parseFilter(const nlohmann::json &msgData,
                             SvtDbFilters &filters);

    virtual void createEntry(const SvtDbAgentMessage &msg,
                             SvtDbAgentReplyMsg &replyMsg);

    virtual void updateEntry(const SvtDbAgent::SvtDbAgentMessage &msg,
                             SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

    virtual void createEntryReplyMsg(const SvtDbEntry &entry,
                                     SvtDbAgentReplyMsg &msgReply);

    void Clear()
    {
      std::vector<std::string>().swap(m_IntColNames);
      std::vector<std::string>().swap(m_StrColNames);
    }

    const std::vector<std::string> &GetIntColNames() { return m_IntColNames; }
    const std::vector<std::string> &GetStrColNames() { return m_StrColNames; }

    void AddIntColName(const std::string &name) { m_IntColNames.push_back(name); }
    void AddStrColName(const std::string &name) { m_StrColNames.push_back(name); }

    void SetTableName(const std::string &tName) { m_TableName = tName; }
    const std::string &GetTableName() { return m_TableName; }

   private:
    std::vector<std::string> m_IntColNames;
    std::vector<std::string> m_StrColNames;

    std::string m_TableName;
  };
};  // namespace SvtDbAgent
#endif  //! SVT_DB_BASE_DTO_H
