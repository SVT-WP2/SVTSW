/*!
 * @file SvtDbProbeCardDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbProbeCardDto
 */

#include "SVTDbAgentDto/SvtDbProbeCardDto.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDb/sqlmapi.h"
#include "SVTDbAgentDto/SvtDbEnumDto.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

// #include <algorithm>
// #include <sstream>
// #include <stdexcept>

using SvtDbAgent::Singleton;

//========================================================================+
bool SvtDbProbeCardDto::getAllProbeCardsFromDB(
    std::vector<dbProbeCardRecords> &pCards,
    const std::vector<int> &id_filters)
{
  pCards.clear();
  SimpleQuery query;

  std::string tableName = SvtDbAgent::db_schema + std::string(".ProbeCard");
  query.setTableName(tableName);

  for (const auto &record : dbProbeCardRecords::val_names)
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
      if (row.size() != dbProbeCardRecords::val_names.size())
      {
        throw std::range_error("");
      }
      dbProbeCardRecords pCard;
      //! pCard id
      pCard.id = (row.at(0)) ? row.at(0)->getInt() : -1;
      //! pCard serialNumber
      pCard.serialNumber = (row.at(1)) ? row.at(1)->getString() : "";
      //! pCard vendor
      pCard.vendor = (row.at(2)) ? row.at(2)->getString() : "";
      //! pCard name
      pCard.name = (row.at(3)) ? row.at(3)->getString() : "";
      //! pCard model
      pCard.model = (row.at(4)) ? row.at(4)->getString() : "";
      //! pCard vendor
      pCard.version = (row.at(5)) ? row.at(5)->getInt() : -1;
      //! pCard arrivalDate
      pCard.arrivalDate = (row.at(6)) ? row.at(6)->getString() : "";
      //! pCard location
      pCard.location = (row.at(7)) ? row.at(7)->getString() : "";
      //! pCard type
      pCard.type = (row.at(8)) ? row.at(8)->getString() : "";
      //! pCard vendorCleaningInterval
      pCard.vendorCleaningInterval = (row.at(9)) ? row.at(9)->getInt() : -1;

      pCards.push_back(pCard);
    }
    if (id_filters.size() && pCards.size() != id_filters.size())
    {
      throw std::runtime_error(
          "unmatching returned elements and requested filter size");
    }
  }
  catch (const std::exception &e)
  {
    Singleton<SvtLogger>::instance().logError(e.what());
    pCards.clear();
    return false;
  }

  return true;
}

//========================================================================+
bool SvtDbProbeCardDto::getProbeCardFromDB(dbProbeCardRecords &pCard, int id)
{
  std::vector<int> id_filters = {id};
  std::vector<dbProbeCardRecords> pCards;
  if (!getAllProbeCardsFromDB(pCards, id_filters))
  {
    return false;
  }
  pCard = std::move(pCards.at(0));

  return true;
}

//========================================================================+
bool SvtDbProbeCardDto::createProbeCardInDB(const dbProbeCardRecords &pCard)
{
  SimpleInsert insert;

  std::string tableName = SvtDbAgent::db_schema + std::string(".ProbeCard");
  insert.setTableName(tableName);

  //! checkinput values
  if (pCard.serialNumber.empty() || pCard.vendor.empty() ||
      pCard.name.empty() || pCard.model.empty() || (pCard.version < 0) ||
      pCard.arrivalDate.empty() || pCard.location.empty() ||
      pCard.type.empty() || (pCard.vendorCleaningInterval < 0))
  {
    return false;
  }

  //! Add columns & values
  insert.addColumnAndValue("serialNumber", pCard.serialNumber);
  insert.addColumnAndValue("vendor", pCard.vendor);
  insert.addColumnAndValue("name", pCard.name);
  insert.addColumnAndValue("model", pCard.model);
  insert.addColumnAndValue("version", pCard.version);
  insert.addColumnAndValue("arrivalDate", pCard.arrivalDate);
  insert.addColumnAndValue("location", pCard.location);
  insert.addColumnAndValue("type", pCard.type);
  insert.addColumnAndValue("vendorCleaningInterval",
                           pCard.vendorCleaningInterval);

  if (!insert.doInsert())
  {
    rollbackUpdate();
    return -1;
  }
  commitUpdate();
  return true;
}

//========================================================================+
void SvtDbProbeCardDto::getAllProbeCards(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  std::vector<int> id_filters;
  if (msgData.contains("filter"))
  {
    const auto filterData = msgData["filter"];
    if (msgData.contains("ids"))
    {
      id_filters = filterData["ids"].get<std::vector<int>>();
    }
  }
  std::vector<dbProbeCardRecords> pCards;
  if (getAllProbeCardsFromDB(pCards, id_filters))
  {
    getAllProbeCardsReplyMsg(pCards, replyMsg);
  }
}

//========================================================================+
void SvtDbProbeCardDto::getAllProbeCardsReplyMsg(
    const std::vector<dbProbeCardRecords> &pCards,
    SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::ordered_json items = nlohmann::json::array();
    for (const auto &pCard : pCards)
    {
      nlohmann::ordered_json pCard_j;
      pCard_j["id"] = pCard.id;
      pCard_j["serialNumber"] = pCard.serialNumber;
      pCard_j["vendor"] = pCard.vendor;
      pCard_j["name"] = pCard.name;
      pCard_j["model"] = pCard.model;
      pCard_j["version"] = pCard.version;
      pCard_j["arrivalDate"] = pCard.arrivalDate;
      pCard_j["location"] = pCard.location;
      pCard_j["type"] = pCard.type;
      pCard_j["vendorCleaningInterval"] = pCard.vendorCleaningInterval;

      items.push_back(pCard_j);
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
void SvtDbProbeCardDto::createProbeCard(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    throw std::runtime_error("Object item create was found");
  }

  auto pCard_j = msgData["create"];
  //! remove id record
  if (pCard_j.size() < (dbProbeCardRecords::val_names.size() - 1))
  {
    throw std::invalid_argument("insufficient number of parameters");
  }

  dbProbeCardRecords pCard;
  //! pCard.serialNumber
  pCard.serialNumber = pCard_j.value("serialNumber", "");
  //! pCard.vendor
  pCard.vendor = pCard_j.value("vendor", "");
  //! pCard.name
  pCard.name = pCard_j.value("name", "");
  //! pCard.model
  pCard.model = pCard_j.value("model", "");
  //! pCard.version
  pCard.version = pCard_j.value("version", -1);
  //! pCard.arrivalDate
  pCard.arrivalDate = pCard_j.value("arrivalDate", "");
  //! pCard.location
  pCard.location = pCard_j.value("location", "");
  //! pCard.type
  pCard.type = pCard_j.value("type", "");
  //! pCard.vendorCleaningInterval
  pCard.vendorCleaningInterval = pCard_j.value("vendorCleaningInterval", -1);

  //! create probe card in DB
  if (!createProbeCardInDB(pCard))
  {
    throw std::runtime_error("Wafer type was not created");
    return;
  }

  const auto newProbeCardId = SvtDbInterface::getMaxId("ProbeCard");
  getProbeCardFromDB(pCard, newProbeCardId);
  createProbeCardReplyMsg(pCard, replyMsg);
}

//========================================================================+
void SvtDbProbeCardDto::createProbeCardReplyMsg(
    const dbProbeCardRecords &pCard, SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::json ret_pCard_j;
    ret_pCard_j["id"] = pCard.id;
    ret_pCard_j["serialNumber"] = pCard.serialNumber;
    ret_pCard_j["vendor"] = pCard.vendor;
    ret_pCard_j["name"] = pCard.name;
    ret_pCard_j["model"] = pCard.model;
    ret_pCard_j["version"] = pCard.version;
    ret_pCard_j["arrivalDate"] = pCard.arrivalDate;
    ret_pCard_j["location"] = pCard.location;
    ret_pCard_j["type"] = pCard.type;
    ret_pCard_j["vendorCleaningInterval"] = pCard.vendorCleaningInterval;

    data["entity"] = ret_pCard_j;
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
