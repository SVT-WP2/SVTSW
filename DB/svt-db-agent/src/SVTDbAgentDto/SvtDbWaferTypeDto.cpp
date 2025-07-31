/*!
 * @file SvtDbWaferTypeDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWaferTypeDto
 */

#include "SVTDbAgentDto/SvtDbWaferTypeDto.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDb/sqlmapi.h"
#include "SVTDbAgentDto/SvtDbEnumDto.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include <algorithm>
#include <sstream>
#include <stdexcept>

using SvtDbAgent::Singleton;

//========================================================================+
bool SvtDbWaferTypeDto::getAllWaferTypesFromDB(
    std::vector<dbWaferTypeRecords> &waferTypes,
    const std::vector<int> &id_filters)
{
  waferTypes.clear();
  SimpleQuery query;

  std::string tableName = SvtDbAgent::db_schema + std::string(".WaferType");
  query.setTableName(tableName);

  for (const auto &record : dbWaferTypeRecords::val_names)
  {
    query.addColumn(record);
  }

  if (!id_filters.empty())
  {
    query.addWhereIn("id", id_filters);
  }

  try
  {
    vector<vector<MultiBase *>> rows;
    query.doQuery(rows);

    for (vector<MultiBase *> row : rows)
    {
      if (row.size() != dbWaferTypeRecords::val_names.size())
      {
        throw std::range_error("");
      }
      dbWaferTypeRecords waferType;
      //! waferTyoe id
      waferType.id = (row.at(0)) ? row.at(0)->getInt() : -1;
      //! waferType serialNumber
      waferType.name = (row.at(1)) ? row.at(1)->getString() : "";
      //! waferType engineeringRun
      waferType.engineeringRun = (row.at(2)) ? row.at(2)->getString() : "";
      //! waferType foundry
      waferType.foundry = (row.at(3)) ? row.at(3)->getString() : "";
      //! waferType technology
      waferType.technology = (row.at(4)) ? row.at(4)->getString() : "";
      // //! waferType imageBase64String
      // waferType.imageBase64String = (row.at(5)) ? row.at(5)->getString() :
      // "";
      //! waferType waferMap
      waferType.waferMap = (row.at(5)) ? row.at(5)->getString() : "";

      waferTypes.push_back(waferType);
    }
    if (id_filters.size() && waferTypes.size() != id_filters.size())
    {
      throw std::runtime_error(
          "unmatching returned elements and requested filter size");
    }
  }
  catch (const std::exception &e)
  {
    Singleton<SvtLogger>::instance().logError(e.what());
    waferTypes.clear();
    return false;
  }

  return true;
}

//========================================================================+
bool SvtDbWaferTypeDto::getWaferTypeFromDB(dbWaferTypeRecords &waferType,
                                           int id)
{
  std::vector<int> id_filters = {id};
  std::vector<dbWaferTypeRecords> waferTypes;
  if (!getAllWaferTypesFromDB(waferTypes, id_filters))
  {
    return false;
  }
  waferType = std::move(waferTypes.at(0));
  return true;
}

//========================================================================+
bool SvtDbWaferTypeDto::createWaferTypeInDB(
    const dbWaferTypeRecords &waferType)
{
  SimpleInsert insert;

  std::string tableName = SvtDbAgent::db_schema + std::string(".WaferType");
  insert.setTableName(tableName);

  //! checkinput values
  if (waferType.name.empty() || waferType.foundry.empty() ||
      waferType.technology.empty() || waferType.engineeringRun.empty() ||
      waferType.waferMap.empty())
  {
    return false;
  }

  //! Add columns & values
  insert.addColumnAndValue("name", waferType.name);
  insert.addColumnAndValue("foundry", waferType.foundry);
  insert.addColumnAndValue("technology", waferType.technology);
  insert.addColumnAndValue("engineeringRun", waferType.engineeringRun);
  insert.addColumnAndValue("waferMap", waferType.waferMap);

  if (!insert.doInsert())
  {
    rollbackUpdate();
    return -1;
  }
  commitUpdate();
  return true;
}

//========================================================================+
void SvtDbWaferTypeDto::getAllWaferTypes(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  std::vector<int> id_filters;
  if (msgData.contains("filter"))
  {
    const auto filterData = msgData["filter"];
    if (filterData.contains("ids"))
    {
      id_filters = filterData["ids"].get<std::vector<int>>();
    }
  }
  std::vector<dbWaferTypeRecords> waferTypes;
  if (getAllWaferTypesFromDB(waferTypes, id_filters))
  {
    getAllWaferTypesReplyMsg(waferTypes, replyMsg);
  }
}

//========================================================================+
void SvtDbWaferTypeDto::getAllWaferTypesReplyMsg(
    const std::vector<dbWaferTypeRecords> &waferTypes,
    SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::ordered_json items = nlohmann::json::array();
    for (const auto &waferType : waferTypes)
    {
      nlohmann::ordered_json waferType_j;
      waferType_j["id"] = waferType.id;
      waferType_j["name"] = waferType.name;
      waferType_j["foundry"] = waferType.foundry;
      waferType_j["technology"] = waferType.technology;
      waferType_j["engineeringRun"] = waferType.engineeringRun;
      // waferType_j["imageBase64String"] = waferType.imageBase64String;
      waferType_j["waferMap"] = waferType.waferMap;

      items.push_back(waferType_j);
    }
    data["items"] = items;
    msgReply.setData(data);
    msgReply.setStatus(
        SvtDbAgent::msgStatus[SvtDbAgent::SvtDbAgentMsgStatus::Success]);
    msgReply.setError(0, "");
  }
  catch (const std::exception &e)
  {
    throw e;
    return;
  }
}

//========================================================================+
void SvtDbWaferTypeDto::createWaferType(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    throw std::runtime_error("Object item create was found");
  }

  auto waferType_j = msgData["create"];
  //! remove id record
  if (waferType_j.size() < (dbWaferTypeRecords::val_names.size() - 1))
  {
    throw std::invalid_argument("insufficient number of parameters");
  }

  dbWaferTypeRecords waferType;
  //! waferType.name
  waferType.name = waferType_j.value("name", "");
  //! waferType.foundry
  waferType.foundry = waferType_j.value("foundry", "");
  //! waferType.technology
  waferType.technology = waferType_j.value("technology", "");
  //! waferType.engineeringRun
  waferType.engineeringRun = waferType_j.value("engineeringRun", "");
  //! waferType.waferMap
  const std::string waferMap_s = waferType_j.value("waferMap", "");
  std::string err_msg;
  if (checkWaferMap(waferMap_s, err_msg))
  {
    waferType.waferMap = waferMap_s;
  }
  else
  {
    throw std::runtime_error(err_msg);
    return;
  }

  //! create wafer type in DB
  if (!createWaferTypeInDB(waferType))
  {
    throw std::runtime_error("Wafer type was not created");
    return;
  }

  const auto newWaferTypeId = SvtDbInterface::getMaxId("WaferType");
  getWaferTypeFromDB(waferType, newWaferTypeId);
  createWaferTypeReplyMsg(waferType, replyMsg);
}

//========================================================================+
void SvtDbWaferTypeDto::createWaferTypeReplyMsg(
    const dbWaferTypeRecords &waferType,
    SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::json ret_waferType_j;
    ret_waferType_j["id"] = waferType.id;
    ret_waferType_j["name"] = waferType.name;
    ret_waferType_j["foundry"] = waferType.foundry;
    ret_waferType_j["technology"] = waferType.technology;
    ret_waferType_j["engineeringRun"] = waferType.engineeringRun;
    // ret_waferType_j["imageBase64String"] = waferType.imageBase64String;
    ret_waferType_j["waferMap"] = waferType.waferMap;

    data["entity"] = ret_waferType_j;
    msgReply.setData(data);
    msgReply.setStatus(
        SvtDbAgent::msgStatus[SvtDbAgent::SvtDbAgentMsgStatus::Success]);
    msgReply.setError(0, "");
  }
  catch (const std::exception &e)
  {
    throw e;
    return;
  }
}

//========================================================================+
bool SvtDbWaferTypeDto::parse_range(const int g_size,
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
bool SvtDbWaferTypeDto::checkWaferMap(const std::string_view waferMap,
                                      std::string &err_msg)
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
      SvtDbEnumDto::getEnumValues("asicFamilyType");
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
      if (!parse_range(g_size, g_col["ExistingAsics"], existingAsics) ||
          !parse_range(g_size, g_col["MechanicallyDamagedASICs"],
                       mecDamagedAsics) ||
          !parse_range(g_size, g_col["ASICsCoveredByGreenLayer"],
                       coveredAsics) ||
          !parse_range(g_size, g_col["MechanicallyIntergerASICs"],
                       mecIntegerAsics))
      {
        std::ostringstream ss;
        ss << "Map Group: " << g_row << " Col: " << asic_col
           << " Wrong array found";
        err_msg = ss.str();

        return false;
      }

      //! check equal number of asics and properties
      if (existingAsics.size() !=
          (mecDamagedAsics.size() + coveredAsics.size() +
           mecIntegerAsics.size()))
      {
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
             << ", asic index " << asic_index << " has more than one property";
          err_msg = ss.str();
          return false;
        }
      }

      ++asic_col;
    }
  }

  return ret;
}
