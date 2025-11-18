/*!
 * @file SvtDbBaseDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base DTO class implementation
 */

#include <algorithm>
#include <functional>
#include <iterator>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

#include "nlohmann/json_fwd.hpp"

#include "SVTDb/SvtDbInterface.h"
#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include "SvtKafkaMessage.h"
#include "SvtLogger.h"

using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaReplyMsg;

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::getAllEntries(const SvtKafkaMessage &msg,
                                             SvtKafkaReplyMsg &replyMsg)
{
  getAllEntries(msg.getPayload()["data"], replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::getAllEntries(const nlohmann::json &data_j,
                                             SvtKafkaReplyMsg &replyMsg)
{
  SvtDbFilters filters;
  parseJsonFilters(data_j, filters);

  std::vector<SvtDbAgent::SvtDbEntry> entries;
  bool result = getColNames().find("id") != getColNames().end() ? getAllEntriesFromDB(entries, filters, "id", false)
                                                                : getAllEntriesFromDB(entries, filters);

  if (result)
  {
    createReplyMsg(entries, replyMsg);
  }
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::createEntry(const SvtKafkaMessage &msg,
                                           SvtKafkaReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    THROW_RUNTIME_ERROR("Object item create was found");
  }
  createEntryAndReply(msgData["create"], replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::createEntryAndReply(const nlohmann::json &data_j,
                                                   SvtKafkaReplyMsg &replyMsg)
{
  SvtDbEntry entry;
  parseJsonData(data_j, entry);

  //! create entry in DB
  if (!createEntryInDB(entry))
  {
    THROW_RUNTIME_ERROR("Entry was not created in " + getTableName());
    return;
  }

  const auto newEntryId = SvtDbInterface::getMaxId(getTableName());
  getEntryWithId(entry, newEntryId);
  createReplyMsg(entry, replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::updateEntry(const SvtKafkaMessage &msg,
                                           SvtKafkaReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("id"))
  {
    THROW_RUNTIME_ERROR("Object item id was found");
  }
  if (!msgData.contains("update"))
  {
    THROW_RUNTIME_ERROR("Object item update was found");
  }

  updateEntryAndReply(msgData["id"], msgData["update"], replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::updateEntryAndReply(const int id, const nlohmann::json &data_j,
                                                   SvtKafkaReplyMsg &replyMsg, bool allowNull)
{
  SvtDbAgent::SvtDbEntry entry;
  for (const auto &[key, value] : data_j.items())
  {
    entry.addValue(key, value);
  }

  if (!SvtDbInterface::checkIdExist(getTableName(), id))
  {
    std::ostringstream ss("");
    ss << "Object with id " << id << " does not found.";
    THROW_RUNTIME_ERROR(ss.str());
  }

  if (!updateEntryInDB(id, entry, allowNull))
  {
    THROW_RUNTIME_ERROR("Entry was not updated");
  }

  getEntryWithId(entry, id);
  createReplyMsg(entry, replyMsg);
}

//========================================================================+
bool SvtDbAgent::SvtDbBaseDto::getAllEntriesFromDB(
    std::vector<SvtDbEntry> &entries, const SvtDbFilters &filters,
    const std::string &orderBy, const bool orderDec)
{
  entries.clear();
  SvtDbInterface::SimpleQuery query;

  query.setTableName(getTableName());

  for (const auto &colName : getColNames())
  {
    query.addColumn(colName.first);
  }

  if (!filters.ids.empty())
  {
    query.addWhereIn("id", filters.ids);
  }

  for (const auto &filter : filters.mFilters.getValues())
  {
    if (getColNames().find(filter.first) !=
        getColNames().end())
    {
      query.addWhereEquals(filter.first, filter.second);
    }
    else
    {
      getLogger()->logError("Wrong filter: column with name " + filter.first +
                            " does not exists in table " + getTableName());
      return false;
    }
  }

  if (!orderBy.empty())
  {
    query.setOrderById(orderBy, orderDec);
  }

  try
  {
    rows_t rows;
    query.doQuery(rows);

    for (const auto &row : rows)
    {
      if (row.size() != getColNames().size())
      {
        throw std::range_error("return row size unmatches query list size");
      }
      SvtDbEntry rowEntry;
      int valId = 0;
      for (const auto &colValue : row)
      {
        const std::string &colName = std::next(getColNames().begin(), valId)->first;
        rowEntry.addValue(colName, colValue);
        ++valId;
      }
      entries.push_back(rowEntry);
    }

    if (!filters.ids.empty())
    {
      if (filters.ids.size() != entries.size())
      {
        THROW_RUNTIME_ERROR(
            "unmatching returned elements and requested filter size");
      }
    }
  }
  catch (const std::exception &e)
  {
    getLogger()->logError(e.what());
    entries.clear();
    return false;
  }

  return true;
}

//========================================================================+
bool SvtDbAgent::SvtDbBaseDto::getEntryWithId(SvtDbEntry &entry, int id)
{
  SvtDbFilters filters;
  filters.ids.push_back(id);

  std::vector<SvtDbEntry> entries;
  if (!getAllEntriesFromDB(entries, filters))
  {
    return false;
  }
  entry = std::move(entries.at(0));
  return true;
}

//========================================================================+
bool SvtDbAgent::SvtDbBaseDto::createEntryInDB(const SvtDbEntry &entry)
{
  SvtDbInterface::SimpleInsert insert;

  insert.setTableName(getTableName());

  //! checkinput values and Add columns & values
  for (const auto &item : entry.getValues())
  {
    insert.addColumnAndValue(item.first, item.second);
  }

  if (!insert.doInsert())
  {
    SvtDbInterface::rollbackUpdate();
    return -1;
  }
  SvtDbInterface::commitUpdate();
  return true;
}

//========================================================================+
bool SvtDbAgent::SvtDbBaseDto::updateEntryInDB(const int id,
                                               const SvtDbEntry &entry, bool allowNull)
{
  SvtDbInterface::SimpleUpdate update;

  update.setTableName(getTableName());

  update.addWhereEquals("id", id);

  //! checkinput values and Add columns & values
  int totUpdateParameters = 0;
  //! checkinput values and Add columns & values
  for (const auto &item : entry.getValues())
  {
    if (!allowNull && item.second.is_null())
    {
      continue;
    }
    update.addColumnAndValue(item.first, item.second);
    ++totUpdateParameters;
  }

  if (!totUpdateParameters)
  {
    return true;
  }

  if (!update.doUpdate())
  {
    SvtDbInterface::rollbackUpdate();
    return false;
  }
  SvtDbInterface::commitUpdate();

  return true;
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::createReplyMsg(
    const std::vector<SvtDbEntry> &entries, SvtKafkaReplyMsg &msgReply,
    int totalCount)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::ordered_json items = nlohmann::json::array();
    for (const auto &entry : entries)
    {
      nlohmann::ordered_json entry_j;
      for (const auto &item : entry.getValues())
      {
        entry_j[item.first] = item.second;
      }
      items.push_back(entry_j);
    }
    data["items"] = items;
    if (totalCount >= 0)
    {
      data["totalCount"] = totalCount;
    }
    msgReply.setData(data);
    msgReply.setStatus(
        SvtKafka::msgStatus[SvtKafka::SvtKafkaMsgStatus::Success]);
    msgReply.setError(0, "");
  }
  catch (const std::exception &e)
  {
    throw e;
    return;
  }
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::createReplyMsg(
    const SvtDbEntry &entry, SvtKafkaReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::ordered_json entry_j;
    for (const auto &item : entry.getValues())
    {
      entry_j[item.first] = item.second;
    }

    data["entity"] = entry_j;
    msgReply.setData(data);
    msgReply.setStatus(
        SvtKafka::msgStatus[SvtKafka::SvtKafkaMsgStatus::Success]);
    msgReply.setError(0, "");
  }
  catch (const std::exception &e)
  {
    throw e;
    return;
  }
}

//========================================================================+
bool SvtDbAgent::SvtDbBaseDto::findRequestAndRun(std::string_view reqName,
                                                 const SvtKafkaMessage &msg,
                                                 SvtKafkaReplyMsg &replyMsg)
{
  if (request_map.find(reqName) != request_map.end())
  {
    request_map[reqName](msg, replyMsg);
    return true;
  }
  return false;
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::parseJsonData(const nlohmann::json &j_data,
                                             SvtDbEntry &entry)
{
  //! remove id record
  size_t count_required = std::count_if(getColNames().cbegin(), getColNames().cend(), [](const auto &p)
                                        { return ((p.first != "id") && (p.second)); });
  if (j_data.size() < count_required)
  {
    std::ostringstream ss;
    ss << "Incorrect number of paramenters. Required: ";
    ss << count_required << " and entry size is: " << j_data.size();
    throw std::invalid_argument(ss.str());
  }
  for (auto it = j_data.begin(); it != j_data.end(); ++it)
  {
    entry.addValue(it.key(), it.value());
  }
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::parseJsonFilters(const nlohmann::json &j_data,
                                                SvtDbFilters &filters)
{
  if (j_data.contains("filter"))
  {
    const auto filterData = j_data["filter"];
    for (auto it = filterData.cbegin(); it != filterData.cend(); ++it)
    {
      if (it.key() == "ids")
      {
        filters.ids = it->get<std::vector<int>>();
      }
      else if (getColNames().find(it.key()) != getColNames().end())
      {
        filters.mFilters.addValue(it.key(), it.value());
      }
      else
      {
        THROW_RUNTIME_ERROR("Error: " + it.key() + " is not an allowed filter.");
      }
    }
  }
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::addRequest(
    std::string_view reqName,
    std::function<void(const SvtKafkaMessage &, SvtKafkaReplyMsg &)> fun)
{
  if (request_map.find(reqName) == request_map.end())
  {
    request_map[reqName] = fun;
  }
  else
  {
    getLogger()->logError("Request " + std::string(reqName) +
                          " already exist in request list.");
  }
}
