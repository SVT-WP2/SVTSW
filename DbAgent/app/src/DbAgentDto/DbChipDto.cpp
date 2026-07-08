/*!
 * @file DbChipDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief DbWaferDto
 */

#include <string>

#include "nlohmann/json_fwd.hpp"

#include "DbAgentDto/DbBaseDto.h"
#include "DbAgentDto/DbChipDto.h"
#include "SvtLogger.h"

using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaReplyMsg;

namespace dbagent
{
  //========================================================================+
  DbChipDto::DbChipDto()
    : DbBaseLocationDto("ChipLocation", "chipId")
  {
    setTableName("Chip");

    addColName("id");
    addColName("asicId");
    addColName("asicFamilyType", false);
    addColName("serialNumber");
    addColName("generalLocation");

    addValidFilter("generalLocation");
    addValidFilter("serialNumber");
    addValidFilter("familyTypes", "familyType");

    createAllRequest();
  }

  //========================================================================+
  void DbChipDto::createAllRequest()
  {
    //! SvtDbChipDto::GetAllChips
    addRequest("GetAllChips",
               std::bind(&DbChipDto::getAllEntries, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbChipDto::CreateChip
    addRequest("CreateChip",
               std::bind(&DbChipDto::createEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
    //! SvtDbChipDto::CreateManyChips
    addRequest("CreateManyChips",
               std::bind(&DbChipDto::createManyEntries, this, std::placeholders::_1,
                         std::placeholders::_2));
    //! SvtDbChipDto::UpdateChip
    addRequest("UpdateChip",
               std::bind(&DbChipDto::updateEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
    //! SvtDbChipDto::UpdateChipLocation
    addRequest("UpdateChipLocation",
               std::bind(&DbChipDto::updateLocation, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbChipDto::GetChipLocationHistory
    addRequest("GetChipLocationHistory",
               std::bind(&DbChipDto::getLocationHistory, this,
                         std::placeholders::_1, std::placeholders::_2));
  }

  //========================================================================+
  bool DbChipDto::getAllEntriesFromDB(std::vector<DbEntry> &entries,
                                      const std::string &,
                                      const DbEntry &filters,
                                      const std::string &orderBy, const bool orderDec)
  {
    std::string queryString = "";
    queryString += "SELECT T0.*, T1.\"familyType\" AS \"familyType\"";
    queryString += " FROM main.\"Chip\" AS T0";
    queryString += " LEFT JOIN main.\"Asic\" AS T1 ON T0.\"asicId\" = T1.\"id\"";

    return this->DbBaseDto::getAllEntriesFromDB(entries, queryString, filters, orderBy, orderDec);
  }

  //========================================================================+
  bool DbChipDto::createChip(const nlohmann::json &chipData_j, DbEntry &chipEntry)
  {
    // if (!chipData_j.contains("asicId"))
    // {
    //   THROW_RUNTIME_ERROR("Failed to create chip without an asicId.");
    //   return false;
    // }
    // const int asicId = chipData_j["asicId"].get<int>();
    // auto newChipData_j = chipData_j;
    // newChipData_j.erase("asicId");

    // CreateChip
    if (!createEntryWithLocation(chipData_j, chipEntry))
    {
      return false;
    }
    const auto &chipId = chipEntry.getValue("id");
    const auto &chipSN = chipEntry.getValue("serialNumber");

    // get Acic with id = asicId and extract Asic familyType
    DbEntry asicEntry;
    asicDto->getEntryWithId(asicEntry, chipData_j["asicId"]);
    const auto &asicFamilyType = asicEntry.getValue("familyType");

    // Check if asic family has any block
    std::vector<DbEntry> blockEntries;

    DbEntry filters;
    filters.addValue("asicFamilyType", asicFamilyType);

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

    return true;
  };

  //========================================================================+
  void DbChipDto::createEntry(
      const SvtKafkaMessage &msg,
      SvtKafkaReplyMsg &replyMsg)
  {
    const auto &msgData = msg.getPayload()["data"];
    if (!msgData.contains("create"))
    {
      THROW_RUNTIME_ERROR("Non object create was found");
    }

    DbEntry chipEntry;
    if (!createChip(msgData["create"], chipEntry))
    {
      THROW_RUNTIME_ERROR("Error creating chip entry");
      return;
    }

    logInfo("Creating reply SvtKafkaMessage");
    createReplyMsg(chipEntry, replyMsg);
  }

  //========================================================================+
  void DbChipDto::createManyEntries(
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
      DbEntry chipEntry;
      createChip(item, chipEntry);
      filters.push_back(chipEntry.getValue("id"));
    }
    nlohmann::json data;
    data["filters"] = filters;
    getAllEntriesAndReply(filters, replyMsg);
  }
}  // namespace dbagent
