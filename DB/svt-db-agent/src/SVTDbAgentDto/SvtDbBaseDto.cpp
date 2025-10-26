/*!
 * @file SvtDbBaseDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base DTO class implementation
 */

#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDb/sqlmapi.h"
#include "SVTDbAgentDto/SvtDbWaferTypeDto.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"

#include <algorithm>
#include <functional>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::getAllEntries(const SvtDbAgentMessage &msg,
                                             SvtDbAgentReplyMsg &replyMsg)
{
  const auto &j_data = msg.getPayload()["data"];
  SvtDbFilters filters;
  parseJsonFilters(j_data, filters);

  std::vector<SvtDbAgent::SvtDbEntry> entries;
  bool tableWithId = std::find(getColNames().begin(), getColNames().end(),
                               "id") != getColNames().end();
  bool result = tableWithId ? getAllEntriesFromDB(entries, filters, "id", false)
                            : getAllEntriesFromDB(entries, filters);

  if (result)
  {
    createReplyMsg(entries, replyMsg);
  }
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::createEntry(const SvtDbAgentMessage &msg,
                                           SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    THROW_RUNTIME_ERROR("Object item create was found");
  }

  auto &entry_j = msgData["create"];
  SvtDbEntry entry;

  parseJsonData(entry_j, entry);

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
void SvtDbAgent::SvtDbBaseDto::updateEntry(const SvtDbAgentMessage &msg,
                                           SvtDbAgentReplyMsg &replyMsg)
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

  const auto &Id = msgData["id"];
  const auto &entry_j = msgData["update"];
  SvtDbAgent::SvtDbEntry entry;

  for (const auto &[key, value] : entry_j.items())
  {
    entry.values.insert({key, value});
  }

  if (!SvtDbInterface::checkIdExist(getTableName(), Id))
  {
    std::ostringstream ss("");
    ss << "Object with id " << Id << " does not found.";
    THROW_RUNTIME_ERROR(ss.str());
  }

  if (!updateEntryInDB(Id, entry))
  {
    THROW_RUNTIME_ERROR("Entry was not updated");
  }

  getEntryWithId(entry, Id);
  createReplyMsg(entry, replyMsg);
}

//========================================================================+
bool SvtDbAgent::SvtDbBaseDto::getAllEntriesFromDB(
    std::vector<SvtDbEntry> &entries, const SvtDbFilters &filters,
    const std::string &orderBy, const bool orderDec)
{
  entries.clear();
  SimpleQuery query;

  query.setTableName(getTableName());

  for (const auto &colName : getColNames())
  {
    query.addColumn(colName);
  }

  if (!filters.ids.empty())
  {
    query.addWhereIn("id", filters.ids);
  }

  for (const auto &filter : filters.mFilters.values)
  {
    if (std::find(getColNames().begin(), getColNames().end(), filter.first) !=
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
        const std::string &colName = getColNames().at(valId);
        rowEntry.values.insert({colName, colValue});
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
  SimpleInsert insert;

  insert.setTableName(getTableName());

  //! checkinput values and Add columns & values
  for (const auto &item : entry.values)
  {
    insert.addColumnAndValue(item.first, item.second);
  }

  if (!insert.doInsert())
  {
    rollbackUpdate();
    return -1;
  }
  // commitUpdate();
  return true;
}

//========================================================================+
bool SvtDbAgent::SvtDbBaseDto::updateEntryInDB(const int id,
                                               const SvtDbEntry &entry)
{
  SimpleUpdate update;

  update.setTableName(getTableName());

  update.addWhereEquals("id", id);

  //! checkinput values and Add columns & values
  int totUpdateParameters = 0;
  //! checkinput values and Add columns & values
  for (const auto &item : entry.values)
  {
    if (!item.second.is_null())
    {
      update.addColumnAndValue(item.first, item.second);
      ++totUpdateParameters;
    }
  }

  if (!totUpdateParameters)
  {
    return true;
  }

  if (!update.doUpdate())
  {
    rollbackUpdate();
    return false;
  }
  commitUpdate();

  return true;
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::createReplyMsg(
    const std::vector<SvtDbEntry> &entries, SvtDbAgentReplyMsg &msgReply,
    int totalCount)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::ordered_json items = nlohmann::json::array();
    for (const auto &entry : entries)
    {
      nlohmann::ordered_json entry_j;
      for (const auto &item : entry.values)
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
void SvtDbAgent::SvtDbBaseDto::createReplyMsg(
    const SvtDbEntry &entry, SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::ordered_json entry_j;
    for (const auto &item : entry.values)
    {
      entry_j[item.first] = item.second;
    }

    data["entity"] = entry_j;
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
bool SvtDbAgent::SvtDbBaseDto::findRequestAndRun(std::string_view reqName,
                                                 const SvtDbAgentMessage &msg,
                                                 SvtDbAgentReplyMsg &replyMsg)
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
  std::vector<std::string> AdjIntColName(getColNames().begin(),
                                         getColNames().end());
  std::vector<std::string>::const_iterator iter =
      std::find(AdjIntColName.begin(), AdjIntColName.end(), "id");
  if (iter != AdjIntColName.end())
  {
    AdjIntColName.erase(iter);
  }
  if (j_data.size() != (AdjIntColName.size()))
  {
    throw std::invalid_argument("insufficient number of parameters");
  }
  for (const auto &colName : AdjIntColName)
  {
    const auto &value = j_data[colName];
    entry.values.insert({colName, value});
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
      else if (std::find(getColNames().begin(), getColNames().cend(), it.key()) != getColNames().end())
      {
        filters.mFilters.values.insert({it.key(), it.value()});
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
    std::function<void(const SvtDbAgentMessage &, SvtDbAgentReplyMsg &)> fun)
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
