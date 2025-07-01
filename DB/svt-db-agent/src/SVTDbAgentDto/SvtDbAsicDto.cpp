/*!
 * @file SvtDbWaferTypeDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWaferTypeDto
 */

#include "SVTDbAgentDto/SvtDbAsicDto.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDb/sqlmapi.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include <stdexcept>

using SvtDbAgent::Singleton;

//========================================================================+
bool SvtDbAsicDto::getAllAsicsFromDB(std::vector<dbAsicRecords> &asics,
                                     const std::vector<int> &id_filters)
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
      if (row.size() != 5)
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

      asics.push_back(asic);
    }
    if (id_filters.size() && asics.size() != id_filters.size())
    {
      throw std::runtime_error("ERROR: ");
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
  std::vector<int> id_filters = {id};
  std::vector<dbAsicRecords> asics;
  if (!getAllAsicsFromDB(asics, id_filters))
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
      asic.familyType.empty() || asic.waferMapPosition.empty())
  {
    return false;
  }

  //! Add columns & values
  insert.addColumnAndValue("waferId", asic.waferId);
  insert.addColumnAndValue("serialNumber", std::string(asic.serialNumber));
  insert.addColumnAndValue("familyType", std::string(asic.familyType));
  insert.addColumnAndValue("waferMapPosition",
                           std::string(asic.waferMapPosition));

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
  std::vector<int> id_filters;
  if (msgData.contains("filter"))
  {
    if (msgData.contains("ids"))
    {
      id_filters = msgData["filter"]["ids"].get<std::vector<int>>();
    }
  }
  std::vector<dbAsicRecords> asics;
  if (getAllAsicsFromDB(asics, id_filters))
  {
    getAllAsicsReplyMsg(asics, replyMsg);
  }
}

//========================================================================+
void SvtDbAsicDto::getAllAsicsReplyMsg(
    const std::vector<dbAsicRecords> &asics,
    SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
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
void SvtDbAsicDto::createAsic(const SvtDbAgent::SvtDbAgentMessage &msg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    throw std::runtime_error("DbAgentService: Non object create was found");
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
    throw std::runtime_error("ERROR: Asic was not created");
    return;
  }
}

//========================================================================+
void SvtDbAsicDto::createAsic(const SvtDbAgent::SvtDbAgentMessage &msg,
                              SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  createAsic(msg);

  dbAsicRecords asic;
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
