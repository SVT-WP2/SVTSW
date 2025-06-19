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

//========================================================================+
size_t SvtDbAsicDto::getAllAsicsInDB(std::vector<dbAsicRecords> &asics,
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
  }
  catch (const std::exception &e)
  {
    Singleton<SvtLogger>::instance().logError(e.what());
    asics.clear();
  }

  return asics.size();
}

//========================================================================+
bool SvtDbAsicDto::createAsicInDB(const dbAsicRecords &asic)
{
  SimpleInsert insert;

  std::string tableName = SvtDbAgent::db_schema + std::string(".Asic");
  insert.setTableName(tableName);

  //! Add columns & values
  if (asic.waferId >= 0)
  {
    insert.addColumnAndValue("waferId", asic.waferId);
  }
  if (!asic.serialNumber.empty())
  {
    insert.addColumnAndValue("serialNumber", std::string(asic.serialNumber));
  }
  if (!asic.familyType.empty())
  {
    insert.addColumnAndValue("familyType", std::string(asic.familyType));
  }
  if (!asic.waferMapPosition.empty())
  {
    insert.addColumnAndValue("waferMapPosition",
                             std::string(asic.waferMapPosition));
  }

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
  const auto n_asics = getAllAsicsInDB(asics, id_filters);
  if (id_filters.size() && n_asics != id_filters.size())
  {
    throw std::runtime_error("ERROR: ");
  }
  getAllAsicsReplyMsg(asics, replyMsg);
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
      nlohmann::ordered_json json_asic;
      json_asic["id"] = asic.id;
      json_asic["waferId"] = asic.waferId;
      json_asic["serialNumber"] = asic.serialNumber;
      json_asic["familyType"] = asic.familyType;
      json_asic["waferMapPosition"] = asic.waferMapPosition;
      // json_asic["imageBase64String"] = asic.imageBase64String;
      json_asic["quality"] = asic.quality;

      items.push_back(json_asic);
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
  }
  return;
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
  return;
}

//========================================================================+
void SvtDbAsicDto::createAsic(const SvtDbAgent::SvtDbAgentMessage &msg,
                              SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  createAsic(msg);

  const auto newAsicId = SvtDbInterface::getMaxId("Asic");
  std::vector<int> id_filters = {static_cast<int>(newAsicId)};

  std::vector<dbAsicRecords> asics;
  const auto n_asics = getAllAsicsInDB(asics, id_filters);
  if (id_filters.size() && n_asics != id_filters.size())
  {
    throw std::runtime_error(
        "ERROR: incomplete number of returned wafer types");
    return;
  }
  createAsicReplyMsg(asics.at(0), replyMsg);
  return;
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
  }
}
