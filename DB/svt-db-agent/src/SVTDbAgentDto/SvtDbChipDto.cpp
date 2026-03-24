/*!
 * @file SvtDbChipDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWaferDto
 */

#include <string>

#include "nlohmann/json_fwd.hpp"

#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include "SVTDbAgentDto/SvtDbChipDto.h"
#include "SvtLogger.h"

using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaReplyMsg;

//========================================================================+
SvtDbAgent::SvtDbChipDto::SvtDbChipDto()
  : SvtDbBaseLocationDto("ChipLocation", "chipId")
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
             std::bind(&SvtDbChipDto::getAllEntries, this,
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
             std::bind(&SvtDbChipDto::updateLocation, this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbChipDto::GetChipLocationHistory
  addRequest("GetChipLocationHistory",
             std::bind(&SvtDbChipDto::getLocationHistory, this,
                       std::placeholders::_1, std::placeholders::_2));
}

//========================================================================+
bool SvtDbAgent::SvtDbChipDto::createChip(const nlohmann::json &chipData_j, SvtDbEntry &chipEntry)
{
  if (!chipData_j.contains("asicId"))
  {
    THROW_RUNTIME_ERROR("Failed to create chip without an asicId.");
    return false;
  }
  const int asicId = chipData_j["asicId"].get<int>();
  auto newChipData_j = chipData_j;
  newChipData_j.erase("asicId");

  // CreateChip
  if (!createEntryWithLocation(newChipData_j, chipEntry))
  {
    return false;
  }
  const auto &chipId = chipEntry.getValue("id");
  const auto &chipSN = chipEntry.getValue("serialNumber");

  // get Acic with id = asicId and extract Asic familyType
  SvtDbEntry asicEntry;
  asicDto->getEntryWithId(asicEntry, asicId);
  const auto &asicFamilyType = asicEntry.getValue("familyType");

  // Check if asic family has any block
  std::vector<SvtDbEntry> blockEntries;
  SvtDbFilters filters;

  filters.mFilters.addValue("asicFamilyType", asicFamilyType);

  asicFamilyTypeBlockListDto->getAllEntriesFromDB(blockEntries, "", filters);

  for (auto &blockEntry : blockEntries)
  {
    blockEntry.eraseVal("asicFamilyType");
    blockEntry.addValue("chipId", chipId);
    const auto &blockType = blockEntry.getValue("blockType");
    blockEntry.addValue("blockType", blockType);
    std::string blockSN = blockType.get<std::string>() + "_" + std::string(chipSN);
    blockEntry.addValue("serialNumber", blockSN);

    blockDto->createEntryInDB(blockEntry);
  }

  //! Update Asic chipId
  asicEntry.addValue("chipId", chipId);
  SvtUtils::Singleton<SvtDbAsicDto>::instance()->updateEntryInDB(asicId, asicEntry);

  return true;
};

//========================================================================+
void SvtDbAgent::SvtDbChipDto::createEntry(
    const SvtKafkaMessage &msg,
    SvtKafkaReplyMsg &replyMsg)
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

  logInfo("Creating reply SvtKafkaMessage");
  createReplyMsg(chipEntry, replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbChipDto::createManyEntries(
    const SvtKafkaMessage &msg,
    SvtKafkaReplyMsg &replyMsg)
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
    filters.push_back(chipEntry.getValue("id"));
  }
  nlohmann::json data;
  data["filters"] = filters;
  getAllEntriesAndReply(filters, replyMsg);
}
