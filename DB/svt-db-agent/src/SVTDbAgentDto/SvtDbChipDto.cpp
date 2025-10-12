/*!
 * @file SvtDbChipDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWaferDto
 */

#include "SVTDbAgentDto/SvtDbChipDto.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"

#include <stdexcept>

//========================================================================+
SvtDbAgent::SvtDbChipDto::SvtDbChipDto()
{
  setTableName("Chip");

  addColName("id");
  addColName("asicId");
  addColName("serialNumber");
  addColName("generalLocation");

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbChipDto::createAllRequest()
{
  //! SvtDbChipDto::GetAllChips
  addRequest("GetAllChips",
             std::bind(&SvtDbChipDto::getAllEntries, this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbChipDto::CreateChip
  addRequest("CreateChip",
             std::bind(&SvtDbChipDto::createEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
  //! SvtDbChipDto::UpdateChip
  addRequest("UpdateChip",
             std::bind(&SvtDbChipDto::updateEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
  //! SvtDbChipDto::UpdateChipLocation
  addRequest("UpdateChipLocation",
             std::bind(&SvtDbChipDto::updateChipLocation, this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbChipDto::GetChipLocationHistory
  addRequest("GetChipLocationHistory",
             std::bind(&SvtDbChipDto::getChipLocationHistory, this,
                       std::placeholders::_1, std::placeholders::_2));
}

//========================================================================+
void SvtDbAgent::SvtDbChipDto::createEntry(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    throw std::runtime_error("Non object create was found");
  }

  auto &entry_j = msgData["create"];
  SvtDbAgent::SvtDbEntry chipEntry;

  parseJsonData(entry_j, chipEntry);

  //! create entry in DB
  getLogger()->logInfo("Creating chip in DB");
  const auto currMaxEntryId = SvtDbInterface::getMaxId(getTableName());

  if (!createEntryInDB(chipEntry))
  {
    throw std::runtime_error("Entry was not created in " + getTableName());
    return;
  }

  const auto newEntryId = SvtDbInterface::getMaxId(getTableName());
  if (newEntryId != currMaxEntryId + 1)
  {
    throw std::runtime_error("Entry was not created in " + getTableName());
    return;
  }
  getEntryWithId(chipEntry, newEntryId);

  getLogger()->logInfo("Creating chip location in DB");
  //! Create waferLocations
  SvtDbEntry chipLoc;
  chipLoc.values.insert({"chipId", newEntryId});
  chipLoc.values.insert(
      {"generalLocation", chipEntry.values["generalLocation"]});
  chipLoc.values.insert({"note", "Location at creation"});
  if (!chipLocDto->createEntryInDB(chipLoc))
  {
    throw std::runtime_error("ERROR: Could not create chip location entry");
    return;
  }

  getLogger()->logInfo("Creating reply SvtDbAgentMessage");
  createEntryReplyMsg(chipEntry, replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbChipDto::updateEntry(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  if (msg.getPayload()["date"]["update"].contains("generalLocation"))
  {
    throw std::runtime_error(
        "Failed to update entry. update location is not "
        "allowed using generic update request");
    return;
  }
  this->SvtDbBaseDto::updateEntry(msg, replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbChipDto::updateChipLocation(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  //! create entry in WaferLocation table
  SvtDbEntry chipEntry, chipLocEntry;
  chipLocDto->parseJsonData(msg.getPayload()["data"], chipLocEntry);
  chipLocDto->createEntryInDB(chipLocEntry);

  //! update wafer location
  const auto chipId = chipLocEntry.values["chipId"];

  std::vector<SvtDbEntry> entries;
  SvtDbFilters filters;
  filters.mFilters.values.insert({"chipId", chipId});
  chipLocDto->getAllEntriesFromDB(entries, filters, "date", true);

  if (entries.size())
  {
    chipEntry.values.insert(
        {"generalLocation", entries.at(0).values["generalLocation"]});
    updateEntryInDB(chipId, chipEntry);
    getEntryWithId(chipEntry, chipId);
    createEntryReplyMsg(chipEntry, replyMsg);
  }
  else
  {
    throw std::runtime_error("Failed to access Chip location records");
    return;
  }
}

//========================================================================+
void SvtDbAgent::SvtDbChipDto::getChipLocationHistory(
    const SvtDbAgentMessage &msg, SvtDbAgentReplyMsg &replyMsg)
{
  try
  {
    const auto &chipId = msg.getPayload()["data"]["chipId"];
    SvtDbFilters filters;
    filters.mFilters.values.insert({"chipId", chipId});

    std::vector<SvtDbAgent::SvtDbEntry> entries;
    if (getAllEntriesFromDB(entries, filters))
    {
      getAllEntriesReplyMsg(entries, replyMsg);
    }
  }
  catch (const std::exception &e)
  {
    throw e;
    return;
  }
}
