/*!
 * @file SvtDbBaseDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base DTO class implementation
 */

#include "SVTDbAgentDto/SvtDbBaseLocationDto.h"
#include <memory>
#include <sstream>
#include <string>
#include "SVTDb/SvtDbInterface.h"

//========================================================================+
SvtDbAgent::SvtDbBaseLocationDto::SvtDbBaseLocationDto(const std::string &table_name,
                                                       const std::string &id_name)
  : mLocTableName(table_name)
  , mLocIdName(id_name)
{
  locDto = std::shared_ptr<SvtDbLocationDto>(new SvtDbLocationDto(table_name, id_name));
}

//========================================================================+
bool SvtDbAgent::SvtDbBaseLocationDto::createEntryWithLocation(
    const nlohmann::json &j_entry, SvtDbEntry &entry)
{
  parseJsonData(j_entry, entry);

  const auto currMaxEntryId = SvtDbInterface::getMaxId(getTableName());
  if (!createEntryInDB(entry))
  {
    THROW_RUNTIME_ERROR("Failed entry creation " + getTableName());
    return false;
  }

  const auto newEntryId = SvtDbInterface::getMaxId(getTableName());
  if (newEntryId != currMaxEntryId + 1)
  {
    std::ostringstream ss;
    ss << "unexpected new entry id: " << newEntryId << ", previous id: " << currMaxEntryId;
    getLogger()->logWarning(ss.str());
  }
  getEntryWithId(entry, newEntryId);

  //! Create Locations
  SvtDbEntry locEntry;
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
bool SvtDbAgent::SvtDbBaseLocationDto::createEntryWithLocation(
    const SvtKafka::SvtKafkaMessage &msg,
    SvtDbEntry &entry)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    THROW_RUNTIME_ERROR("Non object create was found");
  }
  return createEntryWithLocation(msgData["create"], entry);
}

//========================================================================+
void SvtDbAgent::SvtDbBaseLocationDto::createEntry(
    const SvtKafka::SvtKafkaMessage &msg,
    SvtKafka::SvtKafkaReplyMsg &replyMsg)
{
  SvtDbEntry entry;
  createEntryWithLocation(msg, entry);
  getLogger()->logInfo("Creating reply SvtKafkaMessage");
  createReplyMsg(entry, replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbBaseLocationDto::updateEntry(
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
  this->SvtDbBaseDto::updateEntry(msg, replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbBaseLocationDto::getLocationHistory(const SvtKafka::SvtKafkaMessage &msg, SvtKafka::SvtKafkaReplyMsg &replyMsg)
{
  try
  {
    const auto &id = msg.getPayload()["data"][mLocIdName];
    SvtDbFilters filters;
    filters.mFilters.addValue(mLocIdName, id);

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

//========================================================================+
void SvtDbAgent::SvtDbBaseLocationDto::updateLocation(
    const SvtKafka::SvtKafkaMessage &msg,
    SvtKafka::SvtKafkaReplyMsg &replyMsg)
{
  //! create entry in WaferLocation table
  SvtDbEntry entry, locEntry;
  getLocDto()->parseJsonData(msg.getPayload()["data"], locEntry);
  getLocDto()->createEntryInDB(locEntry);

  //! update wafer location
  const auto id = locEntry.getValue(mLocIdName);

  std::vector<SvtDbEntry> entries;
  SvtDbFilters filters;
  filters.mFilters.addValue(mLocIdName, id);
  getLocDto()->getAllEntriesFromDB(entries, filters, "date", true);

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
