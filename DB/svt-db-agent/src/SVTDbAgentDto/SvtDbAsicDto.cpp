/*!
 * @file SvtDbAsicDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbAsicDto
 */

#include "SVTDbAgentDto/SvtDbAsicDto.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDb/sqlmapi.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include <sstream>
#include <stdexcept>
#include <string>

using SvtDbAgent::Singleton;

//========================================================================+
bool SvtDbAsicDto::getAllAsicsFromDB(std::vector<dbAsicRecords> &asics,
                                     const asic_filters_type &filters)
{
  asics.clear();
  SimpleQuery query;

  std::string tableName = SvtDbAgent::db_schema + std::string(".Asic");
  query.setTableName(tableName);

  query.addColumn("id");
  query.addColumn("waferId");
  query.addColumn("serialNumber");
  query.addColumn("familyType");
  query.addColumn("waferMapPosition");
  query.addColumn("quality");

  if (!filters.ids.empty())
  {
    query.addWhereIn("id", filters.ids);
  }
  if (filters.waferId >= 0)
  {
    query.addWhereEquals("waferId", filters.waferId);
  }
  if (!filters.familyType.empty())
  {
    query.addWhereEquals("familyType", filters.familyType);
  }
  if (!filters.quality.empty())
  {
    query.addWhereEquals("quality", filters.quality);
  }

  try
  {
    vector<vector<MultiBase *>> rows;
    query.doQuery(rows);

    for (vector<MultiBase *> row : rows)
    {
      if (row.size() != 6)
      {
        throw std::range_error("Asic table: ");
      }
      dbAsicRecords asic;
      //! asic id
      asic.id = (row.at(0)) ? row.at(0)->getInt() : -1;
      //! waferId
      asic.waferId = (row.at(1)) ? row.at(1)->getInt() : -1;
      //! asic serialNumber
      asic.serialNumber = (row.at(2)) ? row.at(2)->getString() : "";
      //! asic family type
      asic.familyType = (row.at(3)) ? row.at(3)->getString() : "";
      //! asic waferMapPosition
      asic.waferMapPosition = (row.at(4)) ? row.at(4)->getString() : "";
      //! asic quality
      asic.quality = (row.at(5)) ? row.at(5)->getString() : "";

      asics.push_back(asic);
    }
    if (filters.ids.size() && asics.size() != filters.ids.size())
    {
      throw std::runtime_error(
          "unmatching returned elements and requested filter size");
    }
  }
  catch (const std::exception &e)
  {
    Singleton<SvtLogger>::instance().logError(e.what());
    asics.clear();
    return false;
  }

  return true;
}

//========================================================================+
bool SvtDbAsicDto::getAsicFromDB(dbAsicRecords &asic, int id)
{
  asic_filters_type asic_filters;
  asic_filters.ids.push_back(id);
  std::vector<dbAsicRecords> asics;
  if (!getAllAsicsFromDB(asics, asic_filters))
  {
    return false;
  }
  asic = std::move(asics.at(0));

  return true;
}

//========================================================================+
bool SvtDbAsicDto::createAsicInDB(const dbAsicRecords &asic)
{
  SimpleInsert insert;

  std::string tableName = SvtDbAgent::db_schema + std::string(".Asic");
  insert.setTableName(tableName);

  //! check input values
  if ((asic.waferId < 0) || asic.serialNumber.empty() ||
      asic.familyType.empty() || asic.waferMapPosition.empty() ||
      asic.quality.empty())
  {
    return false;
  }

  //! Add columns & values
  insert.addColumnAndValue("waferId", asic.waferId);
  insert.addColumnAndValue("serialNumber", asic.serialNumber);
  insert.addColumnAndValue("familyType", asic.familyType);
  insert.addColumnAndValue("waferMapPosition", asic.waferMapPosition);
  insert.addColumnAndValue("quality", asic.quality);

  if (!insert.doInsert())
  {
    rollbackUpdate();
    return -1;
  }
  commitUpdate();

  return true;
}

//========================================================================+
void SvtDbAsicDto::getAllAsics(const SvtDbAgent::SvtDbAgentMessage &msg,
                               SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  asic_filters_type asic_filters;
  if (msgData.contains("filter"))
  {
    const auto filterData = msgData["filter"];
    if (filterData.contains("ids"))
    {
      asic_filters.ids = filterData["ids"].get<std::vector<int>>();
    }
    if (filterData.contains("waferId"))
    {
      asic_filters.waferId = filterData["waferId"].get<int>();
    }
    if (filterData.contains("familyType"))
    {
      asic_filters.familyType = filterData["familyType"].get<std::string>();
    }
    if (filterData.contains("quality"))
    {
      asic_filters.quality = filterData["quality"].get<std::string>();
    }
  }

  std::vector<dbAsicRecords> all_asics;
  if (getAllAsicsFromDB(all_asics, asic_filters))
  {
    Singleton<SvtLogger>::instance().logInfo("Number of asics: " +
                                             std::to_string(all_asics.size()));

    if (!msgData.contains("pager"))
    {
      auto empty_list = std::vector<dbAsicRecords>();
      auto &asics = all_asics.size() <= 5000 ? all_asics : empty_list;
      getAllAsicsReplyMsg(asics, all_asics.size(), replyMsg);
    }
    else
    {
      size_t pager_limit = msgData["pager"]["limit"];
      size_t pager_offset = msgData["pager"]["offset"];

      if (all_asics.size() < pager_offset)
      {
        std::ostringstream err_msg;
        err_msg << "Pager offset out of range, filtered asic size: "
                << all_asics.size();

        throw std::runtime_error(err_msg.str());
        return;
      }
      size_t tail_size = all_asics.size() - pager_offset;
      std::vector<dbAsicRecords>::const_iterator first =
          all_asics.begin() + pager_offset;
      std::vector<dbAsicRecords>::const_iterator last =
          all_asics.begin() + pager_offset +
          ((tail_size < pager_limit) ? tail_size : pager_limit);
      std::vector<dbAsicRecords> asics(first, last);
      getAllAsicsReplyMsg(asics, all_asics.size(), replyMsg);
    }
  }
  return;
}

//========================================================================+
void SvtDbAsicDto::getAllAsicsReplyMsg(
    const std::vector<dbAsicRecords> &asics, size_t totalCount,
    SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  Singleton<SvtLogger>::instance().logInfo(
      "Creating message with " + std::to_string(asics.size()) + " out of " +
      std::to_string(totalCount));
  try
  {
    nlohmann::ordered_json data;
    nlohmann::ordered_json items = nlohmann::json::array();
    for (const auto &asic : asics)
    {
      nlohmann::ordered_json asic_j;
      asic_j["id"] = asic.id;
      asic_j["waferId"] = asic.waferId;
      asic_j["serialNumber"] = asic.serialNumber;
      asic_j["familyType"] = asic.familyType;
      asic_j["waferMapPosition"] = asic.waferMapPosition;
      // asic_j["imageBase64String"] = asic.imageBase64String;
      asic_j["quality"] = asic.quality;

      items.push_back(asic_j);
    }
    data["items"] = items;
    data["totalCount"] = totalCount;
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
void SvtDbAsicDto::createAsic(const SvtDbAgent::SvtDbAgentMessage &msg,
                              SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    throw std::runtime_error("Object item create was found");
  }
  auto json_asic = msgData["create"];
  //! remove id record
  if (json_asic.size() < (dbAsicRecords::val_names.size() - 1))
  {
    throw std::invalid_argument("insufficient number of parameters");
  }

  dbAsicRecords asic;
  asic.waferId = json_asic.value("waferId", -1);
  asic.serialNumber = json_asic.value("serialNumber", "");
  asic.familyType = json_asic.value("familyType", "");
  asic.waferMapPosition = json_asic.value("waferMapPosition", "");
  asic.quality = json_asic.value("quality", "");

  //! create Asic
  if (!createAsicInDB(asic))
  {
    throw std::runtime_error("Asic was not created");
    return;
  }

  const auto newAsicId = SvtDbInterface::getMaxId("Asic");
  getAsicFromDB(asic, newAsicId);

  createAsicReplyMsg(asic, replyMsg);
}

//========================================================================+
void SvtDbAsicDto::createAsicReplyMsg(
    const dbAsicRecords &asic, SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::json ret_json_asic;
    ret_json_asic["id"] = asic.id;
    ret_json_asic["waferId"] = asic.waferId;
    ret_json_asic["serialNumber"] = asic.serialNumber;
    ret_json_asic["familyType"] = asic.familyType;
    ret_json_asic["waferMapPosition"] = asic.waferMapPosition;
    ret_json_asic["quality"] = asic.quality;

    data["entity"] = ret_json_asic;
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
