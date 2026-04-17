/*!
 * @file DbBaseDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base DTO class implementation
 */

#include <memory>
#include <sstream>
#include <string>

#include "Database/DbAPI.h"
#include "DbAgentDto/DbBaseLocationDto.h"

namespace dbagent
{
  //========================================================================+
  DbBaseLocationDto::DbBaseLocationDto(const std::string &table_name,
                                       const std::string &id_name)
    : mLocTableName(table_name)
    , mLocIdName(id_name)
  {
    locDto = std::make_shared<DbLocationDto>(table_name, id_name);
  }

  //========================================================================+
  bool DbBaseLocationDto::createEntryWithLocation(
      const nlohmann::json &j_entry, DbEntry &entry)
  {
    parseJsonData(j_entry, entry);

    const auto currMaxEntryId = database::dbapi::getMaxId(getTableName());
    if (!createEntryInDB(entry))
    {
      THROW_RUNTIME_ERROR("Failed entry creation " + getTableName());
      return false;
    }

    const auto newEntryId = database::dbapi::getMaxId(getTableName());
    if (newEntryId != currMaxEntryId + 1)
    {
      std::ostringstream ss;
      ss << "unexpected new entry id: " << newEntryId << ", previous id: " << currMaxEntryId;
      logWarning(ss.str());
    }
    getEntryWithId(entry, newEntryId);

    //! Create Locations
    DbEntry locEntry;
    locEntry.addValue(mLocIdName, newEntryId);
    locEntry.addValue("generalLocation", entry.getValue("generalLocation"));
    locEntry.addValue("note", "Location at creation");
    if (!getLocDto()->createEntryInDB(locEntry))
    {
      THROW_RUNTIME_ERROR("ERROR: Could not create location entry in " + getTableName());
      return false;
    }

    return true;
  }

  //========================================================================+
  bool DbBaseLocationDto::createEntryWithLocation(
      const SvtKafka::SvtKafkaMessage &msg,
      DbEntry &entry)
  {
    const auto &msgData = msg.getPayload()["data"];
    if (!msgData.contains("create"))
    {
      THROW_RUNTIME_ERROR("Non object create was found");
    }
    return createEntryWithLocation(msgData["create"], entry);
  }

  //========================================================================+
  void DbBaseLocationDto::createEntry(
      const SvtKafka::SvtKafkaMessage &msg,
      SvtKafka::SvtKafkaReplyMsg &replyMsg)
  {
    DbEntry entry;
    createEntryWithLocation(msg, entry);
    logInfo("Creating reply SvtKafkaMessage");
    createReplyMsg(entry, replyMsg);
  }

  //========================================================================+
  void DbBaseLocationDto::updateEntry(
      const SvtKafka::SvtKafkaMessage &msg,
      SvtKafka::SvtKafkaReplyMsg &replyMsg)
  {
    if (msg.getPayload()["data"]["update"].contains("generalLocation"))
    {
      THROW_RUNTIME_ERROR(
          "Failed to update entry. update location is not "
          "allowed using generic update request");
      return;
    }
    this->DbBaseDto::updateEntry(msg, replyMsg);
  }

  //========================================================================+
  void DbBaseLocationDto::getLocationHistory(const SvtKafka::SvtKafkaMessage &msg, SvtKafka::SvtKafkaReplyMsg &replyMsg)
  {
    try
    {
      const auto &id = msg.getPayload()["data"][mLocIdName];
      DbFilters filters;
      filters.mFilters.addValue(mLocIdName, id);

      std::vector<DbEntry> entries;
      if (locDto->getAllEntriesFromDB(entries, std::string(), filters))
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

  //========================================================================+
  void DbBaseLocationDto::updateLocation(
      const SvtKafka::SvtKafkaMessage &msg,
      SvtKafka::SvtKafkaReplyMsg &replyMsg)
  {
    //! create entry in WaferLocation table
    DbEntry entry, locEntry;
    getLocDto()->parseJsonData(msg.getPayload()["data"], locEntry);
    getLocDto()->createEntryInDB(locEntry);

    //! update wafer location
    const auto id = locEntry.getValue(mLocIdName);

    std::vector<DbEntry> entries;
    DbFilters filters;
    filters.mFilters.addValue(mLocIdName, id);
    getLocDto()->getAllEntriesFromDB(entries, std::string(), filters, "date", true);

    if (entries.size())
    {
      entry.addValue(
          "generalLocation", entries.at(0).getValue("generalLocation"));
      updateEntryInDB(id, entry);
      getEntryWithId(entry, id);
      createReplyMsg(entry, replyMsg);
    }
    else
    {
      THROW_RUNTIME_ERROR("Failed to access Wafer location records");
      return;
    }
  }

}  // namespace dbagent
