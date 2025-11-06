/*!
 * @file SvtDbWaferDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWaferDto
 */

#include <sstream>
#include <string>

#include "SVTDbAgentDto/SvtDbWaferDto.h"
#include "SVTDbAgentDto/SvtDbWaferTypeDto.h"

using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaReplyMsg;
using bind_type = void (SvtDbAgent::SvtDbWaferDto::*)(const SvtKafkaMessage &, SvtKafkaReplyMsg &);
//========================================================================+
SvtDbAgent::SvtDbWaferDto::SvtDbWaferDto()
  : SvtDbBaseLocationDto("WaferLocation", "waferId")
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
             std::bind(static_cast<bind_type>(&SvtDbWaferDto::getAllEntries), this,
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
             std::bind(static_cast<bind_type>(&SvtDbWaferDto::updateLocation), this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbWaferDto::GetWaferLocationHistory
  addRequest("GetWaferLocationHistory",
             std::bind(static_cast<bind_type>(&SvtDbWaferDto::getLocationHistory), this,
                       std::placeholders::_1, std::placeholders::_2));
}

//========================================================================+
void SvtDbAgent::SvtDbWaferDto::createEntry(
    const SvtKafkaMessage &msg,
    SvtKafkaReplyMsg &replyMsg)
{
  SvtDbEntry waferEntry;
  if (!createEntryWithLocation(msg, waferEntry))
  {
    getLogger()->logError("Failed wafer and location creation in DB.");
    return;
  }

  getLogger()->logInfo("Creating all Asics in DB");
  createAllAsics(waferEntry);

  getLogger()->logInfo("Creating reply SvtKafkaMessage");
  createReplyMsg(waferEntry, replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbWaferDto::createAllAsics(const SvtDbEntry &wafer)
{
  int waferId = wafer.getValue("id").get<int>();
  int waferTypeId = wafer.getValue("waferTypeId").get<int>();

  SvtDbWaferTypeDto *waferType = Singleton<SvtDbWaferTypeDto>::instance();

  const auto waferTypeMap = waferType->getWaferTypeMap(waferTypeId);
  nlohmann::json waferMap_j = nlohmann::json::parse(waferTypeMap);

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
        asic_SN << wafer.getValue("serialNumber").get<std::string>() << "_"
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
        SvtUtils::readStringVariable(waferMap_j["Groups"][g_name][asic_index],
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
        asic.addValue("waferId", waferId);
        asic.addValue("serialNumber", asic_SN.str());
        asic.addValue("waferMapPosition", asic_waferMapPos.str());
        asic.addValue("familyType", asic_familytype);
        asic.addValue("quality", asic_quality);

        Singleton<SvtDbAsicDto>::instance()->createEntryInDB(asic);
        ++asic_col;
      }
      ++mapG_col_index;
    }
  }

  return;
}
