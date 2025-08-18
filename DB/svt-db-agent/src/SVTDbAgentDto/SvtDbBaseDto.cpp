/*!
 * @file SvtDbBaseDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base DTO class implementation
 */

#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include <algorithm>
#include <stdexcept>
#include <utility>
#include <vector>
#include "SVTDb/SvtDbInterface.h"
#include "SVTDb/sqlmapi.h"
#include "SVTDbAgentDto/SvtDbWaferTypeDto.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

//========================================================================+
bool SvtDbAgent::SvtDbBaseDto::getAllEntriesFromDB(
    std::vector<SvtDbEntry> &entries, const SvtDbFilters &filters)
{
  entries.clear();
  SimpleQuery query;

  std::string full_tableName =
      SvtDbAgent::db_schema + std::string(".") + GetTableName();
  query.setTableName(full_tableName);

  std::vector<std::string> allColumns(GetIntColNames().begin(),
                                      GetIntColNames().end());
  allColumns.insert(allColumns.end(), GetStringColNames().begin(),
                    GetStringColNames().end());

  for (const auto &colName : allColumns)
  {
    query.addColumn(colName);
  }

  for (const auto &filter : filters.intFilters)
  {
    if (std::find(GetIntColNames().begin(), GetIntColNames().end(),
                  filter.first) != GetIntColNames().end())
    {
      query.addWhereIn(filter.first, filter.second);
    }
    else
    {
      {
        Singleton<SvtLogger>::instance().logError(
            "Wrong filter: column with name " + filter.first +
            " does not exists in table " + GetTableName());
        return false;
      }
    }
  }
  for (const auto &filter : filters.strFilters)
  {
    if (std::find(GetIntColNames().begin(), GetIntColNames().end(),
                  filter.first) != GetIntColNames().end())
    {
      query.addWhereEquals(filter.first, filter.second);
    }
    else
    {
      {
        Singleton<SvtLogger>::instance().logError(
            "Wrong filter: column with name " + filter.first +
            " does not exists in table " + GetTableName());
        return false;
      }
    }
  }

  try
  {
    vector<vector<MultiBase *>> rows;
    query.doQuery(rows);

    for (vector<MultiBase *> row : rows)
    {
      if (row.size() != allColumns.size())
      {
        throw std::range_error("return row size unmatches query list size");
      }
      SvtDbEntry entry;
      for (size_t colNameId{0}; colNameId < allColumns.size(); ++colNameId)
      {
        std::string &colName = allColumns.at(colNameId);
        if (std::find(GetIntColNames().begin(), GetIntColNames().end(),
                      colName) != GetIntColNames().end())
        {
          entry.int_values[colName] =
              (row.at(colNameId)) ? row.at(colNameId)->getInt() : -1;
        }
        else if (std::find(GetStringColNames().begin(),
                           GetStringColNames().end(),
                           colName) != GetStringColNames().end())
        {
          entry.string_values[colName] =
              (row.at(colNameId)) ? row.at(colNameId)->getString() : "";
        }
        else
        {
          throw std::runtime_error("Column name " + colName +
                                   " was not found in DTO");
        }
      }
      entries.push_back(entry);
    }

    if (filters.intFilters.find("id") != filters.intFilters.end())
    {
      if (filters.intFilters.at("id").size() != entries.size())
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
  filters.intFilters.insert({"id", {id}});
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

  std::string tableName = SvtDbAgent::db_schema + "." + GetTableName();
  insert.setTableName(tableName);

  //! checkinput values and Add columns & values
  for (const auto &item : entry.int_values)
  {
    if (item.second < 0)
    {
      return false;
    }
    insert.addColumnAndValue(item.first, item.second);
  }
  for (const auto &item : entry.string_values)
  {
    if (item.second.empty())
    {
      return false;
    };
    insert.addColumnAndValue(item.first, item.second);
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
      SvtDbAgent::db_schema + std::string(".") + GetTableName();
  update.setTableName(tableName);

  update.addWhereEquals("id", id);

  //! checkinput values and Add columns & values
  int totUpdateParameters = 0;
  for (const auto &item : entry.int_values)
  {
    if (item.second < 0)
    {
      return false;
    }
    update.addColumnAndValue(item.first, item.second);
    ++totUpdateParameters;
  }
  for (const auto &item : entry.string_values)
  {
    if (item.second.empty())
    {
      return false;
    };
    update.addColumnAndValue(item.first, item.second);
    ++totUpdateParameters;
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
      filters.intFilters.insert(
          {"id", filterData["ids"].get<std::vector<int>>()});
    }
  }
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::parseData(const nlohmann::json &entry_j,
                                         SvtDbEntry &entry)
{
  //! remove id record
  std::vector<std::string> AdjIntColName(GetIntColNames().begin(),
                                         GetIntColNames().end());
  std::vector<std::string>::const_iterator iter =
      std::find(AdjIntColName.begin(), AdjIntColName.end(), "id");
  if (iter != AdjIntColName.end())
  {
    AdjIntColName.erase(iter);
  }
  if (entry_j.size() != (AdjIntColName.size() + GetStringColNames().size()))
  {
    throw std::invalid_argument("insufficient number of parameters");
  }

  for (const auto &colName : AdjIntColName)
  {
    entry.int_values[colName] = entry_j.value(colName, -1);
  }
  for (const auto &colName : GetStringColNames())
  {
    entry.string_values[colName] = entry_j.value(colName, "");
  }
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::getAllEntriesReplyMsg(
    const std::vector<SvtDbEntry> &entries, SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::ordered_json items = nlohmann::json::array();
    for (const auto &entry : entries)
    {
      nlohmann::ordered_json entry_j;
      for (const auto &item : entry.int_values)
      {
        entry_j[item.first] = item.second;
      }
      for (const auto &item : entry.string_values)
      {
        entry_j[item.first] = item.second;
      }
      items.push_back(entry_j);
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
  SvtDbAgent::SvtDbEntry entry;

  parseData(entry_j, entry);

  //! create entry in DB
  if (!createEntryInDB(entry))
  {
    throw std::runtime_error("Entry was not created in " + GetTableName());
    return;
  }

  const auto newEntryId = SvtDbInterface::getMaxId(GetTableName());
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
      entry.int_values[key] = value;
    }
    else if (value.is_string())
    {
      entry.string_values[key] = value;
    }
    else
    {
      throw std::runtime_error("Only string or int values are accepted.");
      return;
    }
  }

  if (!SvtDbInterface::checkIdExist(GetTableName(), Id))
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
    for (const auto &item : entry.int_values)
    {
      entry_j[item.first] = item.second;
    }
    for (const auto &item : entry.string_values)
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
