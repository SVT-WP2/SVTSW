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
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"
#include "nlohmann/json_fwd.hpp"

#include <string>

using bind_type = void (SvtDbAgent::SvtDbChipDto::*)(const SvtDbAgent::SvtDbAgentMessage &, SvtDbAgent::SvtDbAgentReplyMsg &);
//========================================================================+
SvtDbAgent::SvtDbChipDto::SvtDbChipDto()
{
  setTableName("Chip");

  addColName("id");
  addColName("serialNumber");
  addColName("generalLocation");

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbChipDto::createAllRequest()
{
  //! SvtDbChipDto::GetAllChips
  addRequest("GetAllChips",
             std::bind(static_cast<bind_type>(&SvtDbChipDto::getAllEntries), this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbChipDto::CreateChip
  addRequest("CreateChip",
             std::bind(&SvtDbChipDto::createEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
  //! SvtDbChipDto::CreateManyChips
  addRequest("CreateManyChips",
             std::bind(&SvtDbChipDto::createManyEntries, this, std::placeholders::_1,
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
    THROW_RUNTIME_ERROR("Non object create was found");
  }

  SvtDbAgent::SvtDbEntry chipEntry;
  if (!createChip(msgData["create"], chipEntry))
  {
    THROW_RUNTIME_ERROR("Error creating chip entry");
    return;
  }

  getLogger()->logInfo("Creating reply SvtDbAgentMessage");
  createReplyMsg(chipEntry, replyMsg);
}
//========================================================================+
bool SvtDbAgent::SvtDbChipDto::createChip(const nlohmann::json &chipEntry_j, SvtDbEntry &chipEntry)
{
  if (!chipEntry_j.contains("asicId"))
  {
    THROW_RUNTIME_ERROR("Failed to create chip without an asicId.");
    return false;
  }
  const int asicId = chipEntry_j["asicId"].get<int>();
  auto tempEntry_j = chipEntry_j;
  tempEntry_j.erase("asicId");

  parseJsonData(tempEntry_j, chipEntry);

  //! create entry in DB
  getLogger()->logInfo("Creating chip in DB");

  const auto currMaxEntryId = SvtDbInterface::getMaxId(getTableName());
  if (!createEntryInDB(chipEntry))
  {
    THROW_RUNTIME_ERROR("Entry was not created in " + getTableName());
    return false;
  }

  const auto newEntryId = SvtDbInterface::getMaxId(getTableName());
  if (newEntryId != currMaxEntryId + 1)
  {
    THROW_RUNTIME_ERROR("Entry was not created in " + getTableName());
    return false;
  }
  getEntryWithId(chipEntry, newEntryId);

  //! Update Asic chipId
  SvtDbEntry asicEntry;
  asicEntry.values.insert({"chipId", newEntryId});
  Singleton<SvtDbAsicDto>::instance()->updateEntryInDB(asicId, asicEntry);

  getLogger()->logInfo("Creating chip location in DB");
  //! Create waferLocations
  SvtDbEntry chipLoc;
  chipLoc.values.insert({"chipId", newEntryId});
  chipLoc.values.insert(
      {"generalLocation", chipEntry.values["generalLocation"]});
  chipLoc.values.insert({"note", "Location at creation"});
  if (!chipLocDto->createEntryInDB(chipLoc))
  {
    THROW_RUNTIME_ERROR("ERROR: Could not create chip location entry");
    return false;
  }

  return true;
};

//========================================================================+
void SvtDbAgent::SvtDbChipDto::createManyEntries(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    THROW_RUNTIME_ERROR("Non object create was found");
    return;
  }

  const auto &msgCreate = msgData["create"];

  if (!msgCreate.contains("generalLocation"))
  {
    THROW_RUNTIME_ERROR("Required field generalLocation was not found");
    return;
  }
  const auto location = msgCreate["generalLocation"].get<std::string>();

  if (!msgCreate.contains("items"))
  {
    THROW_RUNTIME_ERROR("Required field items was not found");
    return;
  }
  const auto &items = msgCreate["items"];
  nlohmann::json filters = nlohmann::json::array();
  for (auto item : items)
  {
    item["generalLocation"] = location;
    SvtDbEntry chipEntry;
    createChip(item, chipEntry);
    filters.push_back(chipEntry.values["id"]);
  }
  nlohmann::json data;
  data["filters"] = filters;
  getAllEntries(filters, replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbChipDto::updateEntry(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  if (msg.getPayload()["date"]["update"].contains("generalLocation"))
  {
    THROW_RUNTIME_ERROR(
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
    createReplyMsg(chipEntry, replyMsg);
  }
  else
  {
    THROW_RUNTIME_ERROR("Failed to access Chip location records");
    return;
  }
}

//========================================================================+
void SvtDbAgent::SvtDbChipDto::getChipLocationHistory(
    const SvtDbAgentMessage &msg, SvtDbAgentReplyMsg &replyMsg)
{
  SvtDbAgent::getLocationHistory<SvtDbAgent::SvtDbChipLocationDto>(msg, replyMsg, "chipId", chipLocDto);
}
