/*!
 * @file SvtDbWaferDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWaferDto
 */

#include "SVTDbAgentDto/SvtDbWaferDto.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDbAgentDto/SvtDbAsicDto.h"
#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include "SVTDbAgentDto/SvtDbWaferTypeDto.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtJsonUtils.h"

#include <sstream>
#include <stdexcept>

//========================================================================+
SvtDbAgent::SvtDbWaferDto::SvtDbWaferDto()
{
  setTableName("Wafer");

  addColName("id");
  addColName("batchNumber");
  addColName("waferTypeId");
  addColName("serialNumber");
  addColName("generalLocation");
  addColName("thinningDate");
  addColName("dicingDate");
  addColName("productionDate");

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbWaferDto::createAllRequest()
{
  //! SvtDbWaferDto::GetAllWafers
  addRequest("GetAllWafers",
             std::bind(&SvtDbWaferDto::getAllEntries, this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbWaferDto::CreateWafer
  addRequest("CreateWafer",
             std::bind(&SvtDbWaferDto::createEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
  //! SvtDbWaferDto::UpdateWafer
  addRequest("UpdateWafer",
             std::bind(&SvtDbWaferDto::updateEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
  //! SvtDbWaferDto::UpdateWaferLocation
  addRequest("UpdateWaferLocation",
             std::bind(&SvtDbWaferDto::updateWaferLocation, this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbWaferDto::GetWaferLocationHistory
  addRequest("GetWaferLocationHistory",
             std::bind(&SvtDbWaferDto::getWaferLocationHistory, this,
                       std::placeholders::_1, std::placeholders::_2));
}

//========================================================================+
void SvtDbAgent::SvtDbWaferDto::createEntry(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    THROW_RUNTIME_ERROR("Non object create was found");
  }

  auto &entry_j = msgData["create"];
  SvtDbEntry waferEntry;

  parseJsonData(entry_j, waferEntry);

  //! create entry in DB
  getLogger()->logInfo("Creating Wafer in DB");
  const auto currMaxEntryId = SvtDbInterface::getMaxId(getTableName());

  if (!createEntryInDB(waferEntry))
  {
    THROW_RUNTIME_ERROR("Entry was not created in " + getTableName());
    return;
  }

  const auto newEntryId = SvtDbInterface::getMaxId(getTableName());
  if (newEntryId != currMaxEntryId + 1)
  {
    THROW_RUNTIME_ERROR("Entry was not created in " + getTableName());
    return;
  }
  getEntryWithId(waferEntry, newEntryId);

  getLogger()->logInfo("Creating wafer location in DB");
  //! Create waferLocations
  SvtDbEntry waferLoc;
  waferLoc.values.insert({"waferId", newEntryId});
  waferLoc.values.insert(
      {"generalLocation", waferEntry.values["generalLocation"]});
  waferLoc.values.insert({"note", "Location at creation"});
  if (!waferLocDto->createEntryInDB(waferLoc))
  {
    THROW_RUNTIME_ERROR("ERROR: Could not create wafer location entry");
    return;
  }

  getLogger()->logInfo("Creating all Asics in DB");
  createAllAsics(waferEntry);
  getLogger()->logInfo("Creating reply SvtDbAgentMessage");
  createReplyMsg(waferEntry, replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbWaferDto::createAllAsics(const SvtDbEntry &wafer)
{
  int waferId = wafer.values.at("id").get<int>();
  int waferTypeId = wafer.values.at("waferTypeId").get<int>();

  SvtDbWaferTypeDto *waferType = Singleton<SvtDbWaferTypeDto>::instance();
  SvtDbEntry waferTypeEntry;
  waferType->getEntryWithId(waferTypeEntry, waferTypeId);

  std::string waferMap = waferTypeEntry.values["waferMap"].get<std::string>();
  nlohmann::json waferMap_j = nlohmann::json::parse(waferMap);

  std::map<int, std::string> g_map_ordered;

  for (auto &[mapG_row_name, mapG_cols] : waferMap_j["MapGroups"].items())
  {
    int asic_row = std::stoi(std::string(mapG_row_name).erase(0, 12));
    g_map_ordered[asic_row] = mapG_row_name;
  }

  //! loop group rows
  for (const auto &g_row_item : g_map_ordered)
  {
    size_t mapG_col_index = 0;
    int asic_row = g_row_item.first;
    int asic_col = 0;
    for (auto &mapG_col :
         waferMap_j["MapGroups"][g_row_item.second]["MapGroupsColumns"])
    {
      std::string g_name = mapG_col["GroupName"];
      auto g_size = waferMap_j["Groups"][g_name].size();

      std::vector<int> existingAsics;
      std::vector<int> mecDamagedAsics;
      std::vector<int> coveredAsics;
      std::vector<int> mecIntegerAsics;
      if (!waferType->extractRange(g_size, mapG_col["ExistingAsics"],
                                   existingAsics) ||
          !waferType->extractRange(g_size, mapG_col["MechanicallyDamagedASICs"],
                                   mecDamagedAsics) ||
          !waferType->extractRange(g_size, mapG_col["ASICsCoveredByGreenLayer"],
                                   coveredAsics) ||
          !waferType->extractRange(g_size, mapG_col["MechanicallyIntegerASICs"],
                                   mecIntegerAsics))
      {
        std::ostringstream ss;
        ss << "Error creating Asic. MapGroups: " << g_row_item.second
           << ", group col: " << mapG_col_index;
        getLogger()->logError(ss.str());

        THROW_RUNTIME_ERROR("Wrong array found");
      }
      //! create asics from existingAsics
      for (const auto &asic_index : existingAsics)
      {
        std::ostringstream asic_waferMapPos;
        asic_waferMapPos << asic_row << "_" << asic_col;
        std::ostringstream asic_SN;
        asic_SN << wafer.values.at("serialNumber").get<std::string>() << "_"
                << asic_waferMapPos.str();

        std::string asic_quality;
        if (std::find(mecDamagedAsics.begin(), mecDamagedAsics.end(),
                      asic_index) != mecDamagedAsics.end())
        {
          asic_quality = "MechanicallyDamaged";
        }
        else if (std::find(coveredAsics.begin(), coveredAsics.end(),
                           asic_index) != coveredAsics.end())
        {
          asic_quality = "CoveredByGreenLayer";
        }
        else if (std::find(mecIntegerAsics.begin(), mecIntegerAsics.end(),
                           asic_index) != mecIntegerAsics.end())
        {
          asic_quality = "MechanicallyInteger";
        }
        else
        {
          std::ostringstream ss;
          ss << "Error creating Asic. MapGroups: " << g_row_item.second
             << ", group col: " << mapG_col_index;
          getLogger()->logError(ss.str());
          ss.str("");
          ss.clear();
          ss << "Wrong Asic quality property for asic  " << asic_index;
          THROW_RUNTIME_ERROR(ss.str());
        }

        std::string asic_familytype;
        SvtDbAgent::readStringVariable(waferMap_j["Groups"][g_name][asic_index],
                                       "FamilyType", asic_familytype);

        if (asic_familytype.empty())
        {
          std::ostringstream ss;
          ss << "Error creating Asic. MapGroups: " << g_row_item.second
             << ", group col: " << mapG_col_index << std::endl;
          getLogger()->logError(ss.str());
          THROW_RUNTIME_ERROR("invalid familyType");
        }

        SvtDbEntry asic;
        asic.values.insert({"waferId", waferId});
        asic.values.insert({"serialNumber", asic_SN.str()});
        asic.values.insert({"waferMapPosition", asic_waferMapPos.str()});
        asic.values.insert({"familyType", asic_familytype});
        asic.values.insert({"quality", asic_quality});

        Singleton<SvtDbAsicDto>::instance()->createEntryInDB(asic);
        ++asic_col;
      }
      ++mapG_col_index;
    }
  }

  return;
}

//========================================================================+
void SvtDbAgent::SvtDbWaferDto::updateEntry(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
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
void SvtDbAgent::SvtDbWaferDto::updateWaferLocation(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  //! create entry in WaferLocation table
  SvtDbEntry waferEntry, waferLocEntry;
  waferLocDto->parseJsonData(msg.getPayload()["data"], waferLocEntry);
  waferLocDto->createEntryInDB(waferLocEntry);

  //! update wafer location
  const auto waferId = waferLocEntry.values["waferId"];

  std::vector<SvtDbEntry> entries;
  SvtDbFilters filters;
  filters.mFilters.values.insert({"waferId", waferId});
  waferLocDto->getAllEntriesFromDB(entries, filters, "date", true);

  if (entries.size())
  {
    waferEntry.values.insert(
        {"generalLocation", entries.at(0).values["generalLocation"]});
    updateEntryInDB(waferId, waferEntry);
    getEntryWithId(waferEntry, waferId);
    createReplyMsg(waferEntry, replyMsg);
  }
  else
  {
    THROW_RUNTIME_ERROR("Failed to access Wafer location records");
    return;
  }
}

//========================================================================+
void SvtDbAgent::SvtDbWaferDto::getWaferLocationHistory(
    const SvtDbAgentMessage &msg, SvtDbAgentReplyMsg &replyMsg)
{
  getLocationHistory<SvtDbAgent::SvtDbWaferLocationDto>(msg, replyMsg, "waferId", waferLocDto);
}
