/*!
 * @file SvtDbChipDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWaferDto
 */

#include <string>

#include "SVTDbAgentDto/SvtDbBaseLocationDto.h"
#include "nlohmann/json_fwd.hpp"

#include "SVTDbAgentDto/SvtDbAsicDto.h"
#include "SVTDbAgentDto/SvtDbChipDto.h"
#include "SvtLogger.h"

using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaReplyMsg;
using bind_type = void (SvtDbAgent::SvtDbChipDto::*)(const SvtKafkaMessage &, SvtKafkaReplyMsg &);
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
             std::bind(static_cast<bind_type>(&SvtDbChipDto::updateLocation), this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbChipDto::GetChipLocationHistory
  addRequest("GetChipLocationHistory",
             std::bind(static_cast<bind_type>(&SvtDbChipDto::getLocationHistory), this,
                       std::placeholders::_1, std::placeholders::_2));
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

  if (!createEntryWithLocation(tempEntry_j, chipEntry))
  {
    return false;
  }
  //! Update Asic chipId
  SvtDbEntry asicEntry;
  asicEntry.addValue("chipId", chipEntry.getValue("id"));
  Singleton<SvtDbAsicDto>::instance()->updateEntryInDB(asicId, asicEntry);

  return false;
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

  getLogger()->logInfo("Creating reply SvtKafkaMessage");
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
  getAllEntries(filters, replyMsg);
}
