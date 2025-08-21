/*!
 * @file SvtDbBaseDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base DTO class implementation
 */

#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include "Database/multitype.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDb/sqlmapi.h"
#include "SVTDbAgentDto/SvtDbWaferTypeDto.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include <algorithm>
#include <memory>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

//========================================================================+
bool SvtDbAgent::SvtDbBaseDto::getAllEntriesFromDB(
    std::vector<SvtDbEntry> &entries, const SvtDbFilters &filters)
{
  entries.clear();
  SimpleQuery query;

  std::string full_tableName =
      SvtDbAgent::db_schema + std::string(".") + getTableName();
  query.setTableName(full_tableName);

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
      if (filter.second->isInt())
      {
        query.addWhereEquals(filter.first, filter.second->getInt());
      }
      else if (filter.second->isString())
      {
        query.addWhereEquals(filter.first, filter.second->getString());
      }
    }
    else
    {
      Singleton<SvtLogger>::instance().logError(
          "Wrong filter: column with name " + filter.first +
          " does not exists in table " + getTableName());
      return false;
    }
  }

  if (std::find(getColNames().begin(), getColNames().end(), "id") !=
      getColNames().end())
  {
    query.setOrderById(true);
  }

  try
  {
    vector<vector<MultiBase *>> rows;
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
        rowEntry.addValue(colName, colValue);
        ++valId;
      }
      entries.push_back(rowEntry);
    }

    if (!filters.ids.empty())
    {
      if (filters.ids.size() != entries.size())
      {
        throw std::runtime_error(
            "unmatching returned elements and requested filter size");
      }
    }
  }
  catch (const std::exception &e)
  {
    Singleton<SvtLogger>::instance().logError(e.what());
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

  std::string tableName = SvtDbAgent::db_schema + "." + getTableName();
  insert.setTableName(tableName);

  //! checkinput values and Add columns & values
  for (const auto &item : entry.values)
  {
    if (item.second)
    {
      if (item.second->isInt())
      {
        insert.addColumnAndValue(item.first, item.second->getInt());
      }
      else if (item.second->isString())
      {
        insert.addColumnAndValue(item.first, item.second->getString());
      }
    }
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
bool SvtDbAgent::SvtDbBaseDto::updateEntryInDB(const int id,
                                               const SvtDbEntry &entry)
{
  SimpleUpdate update;

  std::string tableName =
      SvtDbAgent::db_schema + std::string(".") + getTableName();
  update.setTableName(tableName);

  update.addWhereEquals("id", id);

  //! checkinput values and Add columns & values
  int totUpdateParameters = 0;
  //! checkinput values and Add columns & values
  for (const auto &item : entry.values)
  {
    if (item.second)
    {
      if (item.second->isInt())
      {
        update.addColumnAndValue(item.first, item.second->getInt());
      }
      else if (item.second->isString())
      {
        update.addColumnAndValue(item.first, item.second->getString());
      }
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
void SvtDbAgent::SvtDbBaseDto::parseFilter(const nlohmann::json &msgData,
                                           SvtDbFilters &filters)
{
  if (msgData.contains("filter"))
  {
    const auto filterData = msgData["filter"];
    if (filterData.contains("ids"))
    {
      filters.ids = filterData["ids"].get<std::vector<int>>();
    }
    for (const auto &colName : getColNames())
    {
      if (filterData.contains(colName))
      {
        auto &value = filterData[colName];

        if (value.is_number())
        {
          filters.mFilters.values.insert(
              {colName, std::shared_ptr<MultiBase>(new MultiType<int>(
                            filterData[colName].get<int>()))});
        }
        else if (value.is_string())
        {
          filters.mFilters.values.insert(
              {colName, std::shared_ptr<MultiBase>(new MultiType<std::string>(
                            filterData[colName].get<std::string>()))});
        }
      }
    }
  }
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::parseData(const nlohmann::json &entry_j,
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
  if (entry_j.size() != (AdjIntColName.size()))
  {
    throw std::invalid_argument("insufficient number of parameters");
  }
  for (const auto &colName : AdjIntColName)
  {
    const auto &value = entry_j[colName];
    if (value.is_number())
    {
      entry.addValue(colName, value.get<int>());
    }
    else if (entry_j[colName].is_string())
    {
      entry.addValue(colName, value.get<std::string>());
    }
  }
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::getAllEntriesReplyMsg(
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
        const auto &colName = item.first;
        const auto &value = item.second;
        if (value->isInt())
        {
          entry_j[colName] = value->getInt();
        }
        else if (value->isString())
        {
          entry_j[colName] = value->getString();
        }
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
void SvtDbAgent::SvtDbBaseDto::getAllEntries(const SvtDbAgentMessage &msg,
                                             SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  SvtDbFilters filters;
  parseFilter(msgData, filters);

  std::vector<SvtDbAgent::SvtDbEntry> entries;
  if (getAllEntriesFromDB(entries, filters))
  {
    getAllEntriesReplyMsg(entries, replyMsg);
  }
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::createEntry(const SvtDbAgentMessage &msg,
                                           SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    throw std::runtime_error("Object item create was found");
  }

  auto &entry_j = msgData["create"];
  SvtDbEntry entry;

  parseData(entry_j, entry);

  //! create entry in DB
  if (!createEntryInDB(entry))
  {
    throw std::runtime_error("Entry was not created in " + getTableName());
    return;
  }

  const auto newEntryId = SvtDbInterface::getMaxId(getTableName());
  getEntryWithId(entry, newEntryId);
  createEntryReplyMsg(entry, replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::updateEntry(const SvtDbAgentMessage &msg,
                                           SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("id"))
  {
    throw std::runtime_error("Object item id was found");
  }
  if (!msgData.contains("update"))
  {
    throw std::runtime_error("Object item update was found");
  }

  const auto &Id = msgData["id"];
  const auto &entry_j = msgData["update"];
  SvtDbAgent::SvtDbEntry entry;

  for (const auto &[key, value] : entry_j.items())
  {
    if (value.is_null())
    {
      continue;
    }
    else if (value.is_number())
    {
      entry.values.insert(
          {key, std::shared_ptr<MultiBase>(new MultiType<int>(value))});
    }
    else if (value.is_string())
    {
      entry.values.insert(
          {key, std::shared_ptr<MultiBase>(new MultiType<string>(value))});
    }
    else
    {
      throw std::runtime_error("Only string or int values are accepted.");
      return;
    }
  }

  if (!SvtDbInterface::checkIdExist(getTableName(), Id))
  {
    std::ostringstream ss("");
    ss << "Wafer Probe Machine with id " << Id << " does not found.";
    throw std::runtime_error(ss.str());
  }

  if (!updateEntryInDB(Id, entry))
  {
    throw std::runtime_error("Entry was not updated");
  }

  getEntryWithId(entry, Id);
  createEntryReplyMsg(entry, replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::createEntryReplyMsg(
    const SvtDbEntry &entry, SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::ordered_json entry_j;
    for (const auto &item : entry.values)
    {
      const auto &colName = item.first;
      const auto &value = item.second;

      if (value)
      {
        if (value->isInt())
        {
          entry_j[colName] = value->getInt();
        }
        else if (value->isString())
        {
          entry_j[colName] = value->getString();
        }
      }
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
