/*!
 * @file SvtDbBaseDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Base DTO class implementation
 */

#include <algorithm>
#include <functional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "SvtLogger.h"
#include "nlohmann/json_fwd.hpp"

#include "SVTDb/SvtDbInterface.h"
#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include "SVTDbAgentDto/SvtDbBaseListDto.h"

using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaReplyMsg;

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::getAllEntries(const SvtKafkaMessage &msg,
                                             SvtKafkaReplyMsg &replyMsg)
{
  getAllEntriesAndReply(msg.getPayload()["data"], replyMsg);
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::addItemFromRelationDto(SvtDbAgent::SvtDbEntry &entry)
{
  if (relationDtos.size())
  {
    for (const auto &rel : relationDtos)
    {
      SvtDbFilters relFilter;
      relFilter.mFilters.addValue(rel->getIdName(), entry.getValue("id"));

      std::vector<SvtDbAgent::SvtDbEntry> relEntries;
      rel->getAllEntriesFromDB(relEntries, std::string(), relFilter);
      const auto &colName = rel->getColName();
      if (relEntries.size())
      {
        if (relEntries.size() > 1)
        {
          nlohmann::json relEntries_array = nlohmann::json::array();

          for (const auto &relEntry : relEntries)
          {
            relEntries_array.push_back(relEntry.getValue(colName));
          }
          std::string colNameArray = colName + "s";
          entry.addValue(colNameArray, relEntries_array);
        }
        else
        {
          entry.addValue(colName, relEntries.at(0).getValue(colName));
        }
      }
      else
      {
        entry.addValue(colName, nlohmann::json::array());
      }
    }
  }
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::getAllEntriesAndReply(const nlohmann::json &data_j,
                                                     SvtKafkaReplyMsg &replyMsg)
{
  SvtDbFilters filters;
  parseJsonFilters(data_j, filters);

  std::vector<SvtDbAgent::SvtDbEntry> entries;
  bool result = mainTable.getColNames().find("id") != mainTable.getColNames().end()
                    ? getAllEntriesFromDB(entries, std::string(), filters, "id", false)
                    : getAllEntriesFromDB(entries, std::string(), filters);

  if (!result)
  {
    THROW_RUNTIME_ERROR("Error: getting entries");
    return;
  }

  if (relationDtos.size())
  {
    for (auto &entry : entries)
    {
      addItemFromRelationDto(entry);
    }
  }

  if (!data_j.contains("pager"))
  {
    auto empty_list = std::vector<SvtDbEntry>();
    auto &asics = entries.size() <= 5000 ? entries : empty_list;
    createReplyMsg(asics, replyMsg, asics.size());
  }
  else
  {
    size_t pager_limit = data_j["pager"]["limit"];
    size_t pager_offset = data_j["pager"]["offset"];

    if (entries.size() < pager_offset)
    {
      std::ostringstream err_msg;
      err_msg << "Pager offset out of "
                 "range, filtered asic "
                 "size: "
              << entries.size();

      THROW_RUNTIME_ERROR(err_msg.str());
      return;
    }
    size_t tail_size = entries.size() - pager_offset;
    std::vector<SvtDbEntry>::const_iterator first =
        entries.begin() + pager_offset;
    std::vector<SvtDbEntry>::const_iterator last =
        entries.begin() + pager_offset +
        ((tail_size < pager_limit) ? tail_size : pager_limit);
    std::vector<SvtDbEntry> asics(first, last);
    createReplyMsg(asics, replyMsg, entries.size());
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
bool SvtDbAgent::SvtDbBaseDto::createAndReturnNewEntry(const nlohmann::json &data_j, SvtDbEntry &entry)
{
  auto modifiedData_j = data_j;
  if (relationDtos.size())
  {
    for (const auto &rel : relationDtos)
    {
      if (modifiedData_j.contains(rel->getColName()))
      {
        SvtUtils::recursive_erase_key(modifiedData_j, rel->getColName());
      }
    }
  }
  parseJsonData(modifiedData_j, entry);

  //! create entry in DB
  if (!createEntryInDB(entry))
  {
    THROW_RUNTIME_ERROR("Entry was not created in " + std::string(mainTable.getTableName()));
    return false;
  }

  const auto newEntryId = SvtDbInterface::getMaxId(std::string(mainTable.getTableName()));
  if (relationDtos.size())
  {
    for (const auto &rel : relationDtos)
    {
      if (data_j.contains(rel->getColName()))
      {
        rel->addEntries(newEntryId, data_j[rel->getColName()]);
      }
    }
  }

  getEntryWithId(entry, newEntryId);
  return true;
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::createEntryAndReply(const nlohmann::json &data_j,
                                                   SvtKafkaReplyMsg &replyMsg)
{
  SvtDbEntry entry;
  createAndReturnNewEntry(data_j, entry);
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

  if (!SvtDbInterface::checkIdExist(std::string(mainTable.getTableName()), id))
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
void SvtDbAgent::SvtDbBaseDto::updateEntryInRelationTable(SvtDbAgent::SvtDbBaseListDto *relationDto,
                                                          const SvtKafkaMessage &msg,
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

  int id = msgData["id"];
  if (!relationDto->updateRelationEntryInDB(id, msgData["update"][relationDto->getColName()]))
  {
    THROW_RUNTIME_ERROR("");
    return;
  }
  SvtDbEntry entry;
  getEntryWithId(entry, id);
  createReplyMsg(entry, replyMsg);
}

//========================================================================+
bool SvtDbAgent::SvtDbBaseDto::getAllEntriesFromDB(
    std::vector<SvtDbEntry> &entries,
    const std::string &queryString,
    const SvtDbFilters &filters,
    const std::string &orderBy,
    const bool orderDec)
{
  entries.clear();
  SvtDbInterface::SimpleQuery query;

  if (queryString.empty())
  {
    query.setTableName(getTableName());
    for (const auto &colName : getColNames())
    {
      query.addColumn(colName.first);
    }
  }

  if (!filters.ids.empty())
  {
    const auto &filterName = queryString.empty() ? "id" : "T0.id";
    query.addWhereIn(filterName, filters.ids);
  }

  for (const auto &filter : filters.mFilters.getValues())
  {
    if (getColNames().find(filter.first) !=
        getColNames().end())
    {
      const auto &filterName = queryString.empty() ? filter.first : "T0." + filter.first;
      query.addWhereEquals(filter.first, filter.second);
    }
    else
    {
      logError("Wrong filter: column with name " + std::string(filter.first) +
               " does not exists in table " + std::string(getTableName()));
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
    query.doQuery(rows, queryString);
    entries.reserve(rows.values.size());

    if (!rows.values.empty())
    {
      for (const auto &fieldValues : rows.values)
      {
        if (fieldValues.size() != getColNames().size())
        {
          throw std::range_error("return row size unmatches query list size");
        }
        SvtDbEntry rowEntry;
        int valId = 0;
        for (const auto &fieldVal : fieldValues)
        {
          const std::string_view &colName = rows.colNames[valId];
          rowEntry.addValue(std::string(colName), fieldVal);
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
  }
  catch (const std::exception &e)
  {
    logError(e.what());
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
  if (!getAllEntriesFromDB(entries, std::string(), filters))
  {
    return false;
  }
  entry = std::move(entries.at(0));
  addItemFromRelationDto(entry);

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
  nlohmann::ordered_json data;
  nlohmann::ordered_json items = nlohmann::ordered_json::array();
  if (auto *itemsPtr = items.get_ptr<nlohmann::ordered_json::array_t *>())
  {
    itemsPtr->reserve(entries.size());
  }
  for (const auto &entry : entries)
  {
    nlohmann::ordered_json entry_j;
    for (const auto &item : entry.getValues())
    {
      if (excludeItemsInReply.count(std::string(item.first)))
        continue;
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

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::createReplyMsg(
    const SvtDbEntry &entry, SvtKafkaReplyMsg &msgReply)
{
  nlohmann::ordered_json data;
  nlohmann::ordered_json entry_j;
  for (const auto &item : entry.getValues())
  {
    if (excludeItemsInReply.count(std::string(item.first)))
      continue;
    entry_j[item.first] = item.second;
  }

  data["entity"] = entry_j;
  msgReply.setData(data);
  msgReply.setStatus(
      SvtKafka::msgStatus[SvtKafka::SvtKafkaMsgStatus::Success]);
  msgReply.setError(0, "");
}

//========================================================================+
bool SvtDbAgent::SvtDbBaseDto::findRequestAndRun(std::string_view reqName,
                                                 const SvtKafkaMessage &msg,
                                                 SvtKafkaReplyMsg &replyMsg)
{
  if (requestMap.find(reqName) != requestMap.end())
  {
    requestMap[reqName](msg, replyMsg);
    return true;
  }
  return false;
}

//========================================================================+
void SvtDbAgent::SvtDbBaseDto::parseJsonData(const nlohmann::json &j_data,
                                             SvtDbEntry &entry)
{
  //! remove id record
  size_t count_required = std::count_if(mainTable.getColNames().cbegin(), mainTable.getColNames().cend(), [](const auto &p)
                                        { return ((p.first != "id") && (p.second)); });
  if (j_data.size() < count_required)
  {
    std::ostringstream ss;
    ss << "Incorrect number of paramenters. Required: ";
    ss << count_required << " and entry size is: " << j_data.size();
    throw std::invalid_argument(ss.str());
  }
  nlohmann::json val;
  for (auto it = j_data.begin(); it != j_data.end(); ++it)
  {
    if (it->is_object() && colNameInJson.count(it.key()))
    {
      val = static_cast<nlohmann::json>(it->dump(1));
    }
    else
    {
      val = it.value();
    }
    entry.addValue(it.key(), val);
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
      else if (mainTable.getColNames().find(it.key()) != mainTable.getColNames().end())
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
  if (requestMap.find(reqName) == requestMap.end())
  {
    requestMap[reqName] = fun;
  }
  else
  {
    logError("Request " + std::string(reqName) +
             " already exist in request list.");
  }
}
