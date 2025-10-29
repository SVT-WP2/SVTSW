/*!
 * @file SvtDbWaferTypeDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWaferTypeDto
 */

#include "SVTDbAgentDto/SvtDbWaferTypeDto.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDbAgentDto/SvtDbEnumDto.h"
#include "SvtKafkaMessage.h"
#include "SvtLogger.h"
#include "nlohmann/json_fwd.hpp"

#include <algorithm>
#include <list>
#include <sstream>
// #include <stdexcept>
#include <string>
#include <string_view>

using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaReplyMsg;
using bind_type = void (SvtDbAgent::SvtDbWaferTypeDto::*)(const SvtKafkaMessage &, SvtKafkaReplyMsg &);
//========================================================================+
SvtDbAgent::SvtDbWaferTypeDto::SvtDbWaferTypeDto()
{
  setTableName("WaferType");

  addColName("id");
  addColName("name");
  addColName("engineeringRun");
  addColName("foundry");
  addColName("technology");

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbWaferTypeDto::createAllRequest()
{
  //! SvtDbWaferTypeDto::GetAllWaferTypes
  addRequest("GetAllWaferTypes",
             std::bind(static_cast<bind_type>(&SvtDbWaferTypeDto::getAllEntries), this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbWaferTypeDto::CreateWaferType
  addRequest("CreateWaferType",
             std::bind(&SvtDbWaferTypeDto::createEntry, this,
                       std::placeholders::_1, std::placeholders::_2));
  addRequest("getWaferMap",
             std::bind(static_cast<bind_type>(&SvtDbWaferTypeDto::getWaferMap), this, std::placeholders::_1, std::placeholders::_2));
}

//========================================================================+
void SvtDbAgent::SvtDbWaferTypeDto::createEntry(const SvtKafkaMessage &msg, SvtKafkaReplyMsg &replyMsg)
{
  std::string_view waferMap_field = "waferMap";
  auto newMsg = msg;
  const auto &msgData = newMsg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    THROW_RUNTIME_ERROR("Object item create was not found");
    return;
  }

  if (!msgData["create"].contains(waferMap_field) || msgData["create"][waferMap_field].is_null())
  {
    THROW_RUNTIME_ERROR("Error, field not null waferMap required");
    return;
  }

  //! check and save waferMap
  const auto &waferMap = msgData["create"][waferMap_field];
  std::string waferMap_s = waferMap.get<std::string>();
  std::string err_msg;
  if (!checkWaferMap(waferMap_s, err_msg))
  {
    THROW_RUNTIME_ERROR(err_msg);
    return;
  }

  //! Creating waferType Dto
  newMsg.eraseFromPayload("waferMap");
  this->SvtDbBaseDto::createEntry(newMsg, replyMsg);

  auto waferTypeId = SvtDbInterface::getMaxId("WaferType");
  if (!createWaferMap(waferTypeId, waferMap_s))
  {
    THROW_RUNTIME_ERROR("Failed creating the wafer map in the DB");
    return;
  }
}

//========================================================================+
void SvtDbAgent::SvtDbWaferTypeDto::getWaferMapEntry(const int waferTypeId, SvtDbEntry &entry)
{
  std::vector<SvtDbEntry> entries;
  SvtDbFilters filters;
  filters.mFilters.values.insert({"waferTypeId", waferTypeId});
  waferTypeMapDto->getAllEntriesFromDB(entries, filters);

  if (entries.size())
  {
    if (entries.size() != 1)
    {
      getLogger()->logWarning("More than one wafer type map found for wafertypeId: " + std::to_string(waferTypeId));
      getLogger()->logWarning("Returning the first only");
    }
    entry = entries.at(0);
  }
  else
  {
    THROW_RUNTIME_ERROR("Failed to access Wafer location records");
    return;
  }
}

//========================================================================+
void SvtDbAgent::SvtDbWaferTypeDto::getWaferMap(const SvtKafkaMessage &msg, SvtKafkaReplyMsg &replyMsg)
{
  const auto &waferTypeId = msg.getPayload()["data"].value("waferTypeId", -1);
  if (waferTypeId < 0)
  {
    THROW_RUNTIME_ERROR("Error. waferTypeId item was not found in request message");
    return;
  }

  SvtDbEntry waferMap;
  getWaferMapEntry(waferTypeId, waferMap);
  createReplyMsg(waferMap, replyMsg);
}

//========================================================================+
const std::string SvtDbAgent::SvtDbWaferTypeDto::getWaferMap(const int waferTypeId)
{
  if (waferTypeId < 0)
  {
    THROW_RUNTIME_ERROR("Error. waferTypeId item was not found in request message");
    return "";
  }

  SvtDbEntry waferMap;
  getWaferMapEntry(waferTypeId, waferMap);
  return waferMap.values["waferMap"];
}

//========================================================================+
bool SvtDbAgent::SvtDbWaferTypeDto::createWaferMap(const int waferTypeId, const std::string &waferMap_s)
{
  SvtDbEntry waferMap;
  waferMap.values.insert({"waferTypeId", waferTypeId});
  waferMap.values.insert({"waferMap", waferMap_s});
  return waferTypeMapDto->createEntryInDB(waferMap);
}

//========================================================================+
bool SvtDbAgent::SvtDbWaferTypeDto::extractRange(const int g_size,
                                                 const nlohmann::json &array_j,
                                                 std::vector<int> &range)
{
  if (!array_j.is_null() && array_j.size())
  {
    if (array_j.begin()->is_string() && array_j.begin().value() == "All")
    {
      range.resize(g_size);
      std::iota(range.begin(), range.end(), 0);
    }
    else if (std::all_of(
                 array_j.begin(), array_j.end(),
                 [](const nlohmann::json &el)
                 { return el.is_number(); }))
    {
      range = array_j.get<std::vector<int>>();
    }
    else
    {
      return false;
    }
  }
  return true;
}

//========================================================================+
bool SvtDbAgent::SvtDbWaferTypeDto::checkWaferMap(
    const std::string_view &waferMap, std::string &err_msg)
{
  bool ret = true;
  if (!nlohmann::json::accept(waferMap))
  {
    err_msg += "WaferMap don't follow json format.\n";
    ret = false;
  }
  nlohmann::json waferMap_j = nlohmann::json::parse(waferMap);
  if (!waferMap_j.contains("Groups") || !waferMap_j.contains("MapGroups"))
  {
    err_msg += "Wrong json format. Missing Groups or MapGroups objects.\n";
    ret = false;
  }

  //! check Groups
  //! get all defined asic family types
  std::vector<std::string> enum_familyTypes =
      Singleton<SvtDbEnumDto>::instance()->getEnumValues("asicFamilyType");
  for (const auto &[g_name, g_asics] : waferMap_j["Groups"].items())
  {
    int expected_index = 0;
    for (const auto &asic : g_asics)
    {
      int posInGroup = asic.value("PosInGroup", -1);
      if (posInGroup != expected_index)
      {
        std::ostringstream ss;
        ss << "Unmatching PosInGroup index: " << posInGroup << " from expected "
           << expected_index << " in group " << g_name << std::endl;
        err_msg += ss.str();
        ret = false;
      }
      std::string asicFamilyType = asic.value("FamilyType", "");
      if (asicFamilyType.empty() ||
          std::find(enum_familyTypes.begin(), enum_familyTypes.end(),
                    asicFamilyType) == enum_familyTypes.end())
      {
        std::ostringstream ss;
        ss << "Asic Family type: " << asicFamilyType
           << " is not part of enum value in the DB" << std::endl;
        err_msg += ss.str();
        ret = false;
      }
      ++expected_index;
    }
  }

  //! Check MapGroups
  //! loop group rows
  for (auto &[g_row, g_cols] : waferMap_j["MapGroups"].items())
  {
    int asic_col = 0;
    // int g_col_index = 0;
    for (auto &g_col : g_cols["MapGroupsColumns"])
    {
      //! check group in MapGroupsColumns exist
      std::string g_name = g_col["GroupName"];
      auto g_size = waferMap_j["Groups"][g_name].size();
      if (!waferMap_j["Groups"].contains(g_name))
      {
        std::ostringstream ss;
        ss << "Map Group: " << g_row << " Col: " << asic_col << " group name "
           << g_name << "was not found";
        err_msg = ss.str();
        return false;
      }

      //! check array format
      std::vector<int> existingAsics;
      std::vector<int> mecDamagedAsics;
      std::vector<int> coveredAsics;
      std::vector<int> mecIntegerAsics;
      if (!extractRange(g_size, g_col["ExistingAsics"], existingAsics) ||
          !extractRange(g_size, g_col["MechanicallyDamagedASICs"],
                        mecDamagedAsics) ||
          !extractRange(g_size, g_col["ASICsCoveredByGreenLayer"],
                        coveredAsics) ||
          !extractRange(g_size, g_col["MechanicallyIntegerASICs"],
                        mecIntegerAsics))
      {
        std::ostringstream ss;
        ss << "Map Group: " << g_row << " Col: " << asic_col
           << " Wrong array found";
        err_msg = ss.str();

        return false;
      }

      //! check equal number of asics and properties
      if ((existingAsics.size() > g_size) ||
          (existingAsics.size() !=
           (mecDamagedAsics.size() + coveredAsics.size() +
            mecIntegerAsics.size())))
      {
        Singleton<SvtLogger>::instance()->logError(
            "Total number of asics in the group: " + std::to_string(g_size) +
            ", existing asics: " + std::to_string(existingAsics.size()) +
            ", damaged asics: " + std::to_string(mecDamagedAsics.size()) +
            ", covered asics: " + std::to_string(coveredAsics.size()) +
            ", integer asics: " + std::to_string(mecIntegerAsics.size()));
        std::ostringstream ss;
        ss << "Map Group: " << g_row << " Col: " << asic_col
           << ", unmaching number of asics and properties size";
        err_msg = ss.str();

        return false;
      }

      //! check unique property per asic
      std::list<std::vector<int> *> listOfVectors = {
          &mecDamagedAsics, &coveredAsics, &mecIntegerAsics};
      //! loop for existing asics
      for (const auto &asic_index : existingAsics)
      {
        int n_found = 0;
        for (const auto &vec : listOfVectors)
        {
          if (std::find(vec->begin(), vec->end(), asic_index) != vec->end())
          {
            ++n_found;
          }
        }
        if (n_found != 1)
        {
          std::ostringstream ss;
          ss << "Map Group: " << g_row << " Col: " << asic_col
             << ", asic index " << asic_index << " has more than one property ";
          err_msg = ss.str();
          return false;
        }
      }

      ++asic_col;
    }
  }

  return ret;
}
