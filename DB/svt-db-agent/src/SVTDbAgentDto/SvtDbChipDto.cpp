/*!
 * @file SvtDbChipDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWaferDto
 */

#include "SVTDbAgentDto/SvtDbChipDto.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDbAgentDto/SvtDbAsicDto.h"
#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include "SVTDbAgentDto/SvtDbWaferTypeDto.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

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

  parseData(entry_j, chipEntry);

  //! create entry in DB
  Singleton<SvtLogger>::instance()->logInfo("Creating chip in DB");
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

  Singleton<SvtLogger>::instance()->logInfo("Creating chip location in DB");
  //! Create waferLocations
  SvtDbEntry chipLoc;
  chipLoc.values.insert({"chipId", newEntryId});
  chipLoc.values.insert(
      {"generalLocation", chipEntry.values["generalLocation"]});
  chipLoc.values.insert({"note", "Location at creation"});
  if (!createEntryInDB(chipLoc))
  {
    throw std::runtime_error("ERROR: Could not create chip location entry");
    return;
  }

  Singleton<SvtLogger>::instance()->logInfo("Creating reply SvtDbAgentMessage");
  createEntryReplyMsg(chipEntry, replyMsg);
}

//========================================================================+
SvtDbAgent::SvtDbChipLocationDto::SvtDbChipLocationDto()
{
  setTableName("ChipLocation");

  addColName("chipId");
  addColName("generalLocation");
  addColName("creationTime");
  addColName("username");
  addColName("note");

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbChipLocationDto::createAllRequest()
{
  //! SvtDbChipLocationDto::UpdateChipLocation
  addRequest("UpdateChipLocation",
             std::bind(&SvtDbChipLocationDto::updateEntry, this,
                       std::placeholders::_1, std::placeholders::_2));
  addRequest("GetChipLocationHistory",
             std::bind(&SvtDbChipLocationDto::getAllEntries, this,
                       std::placeholders::_1, std::placeholders::_2));
}

//========================================================================+
void SvtDbAgent::SvtDbChipLocationDto::getAllEntries(
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
