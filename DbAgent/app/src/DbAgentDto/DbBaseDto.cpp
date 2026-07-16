/*!
 * @file DbBaseDto.cpp
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

#include "SvtJsonUtils.h"
#include "SvtLogger.h"
#include "nlohmann/json_fwd.hpp"

#include "Database/DbAPI.h"
#include "DbAgentDto/DbBaseDto.h"
#include "DbAgentDto/DbBaseListDto.h"

using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaReplyMsg;

namespace dbagent
{
  //========================================================================+
  void DbBaseDto::getAllEntries(const SvtKafkaMessage &msg,
                                SvtKafkaReplyMsg &replyMsg)
  {
    getAllEntriesAndReply(msg.getPayload()["data"], replyMsg);
  }

  //========================================================================+
  void DbBaseDto::addItemFromRelationDto(DbEntry &entry)
  {
    if (relationDtos.size())
    {
      for (const auto &rel : relationDtos)
      {
        DbEntry relFilter;
        relFilter.addValue(rel->getProps().pkName, entry.getValue("id"));

        std::vector<DbEntry> relEntries;
        rel->getAllEntriesFromDB(relEntries, std::string(), relFilter);
        const auto &colName = rel->getProps().colName;
        if (rel->getProps().isArray)  // array
        {
          if (relEntries.size())
          {
            nlohmann::json relEntries_array = nlohmann::json::array();

            for (const auto &relEntry : relEntries)
            {
              relEntries_array.push_back(relEntry.getValue(colName));
            }
            entry.addValue(rel->getProps().inDtoName, relEntries_array);
          }
          else
          {
            entry.addValue(colName, nlohmann::json::array());
          }
        }
        else  // single value
        {
          entry.addValue(colName, relEntries.at(0).getValue(colName));
        }
      }
    }
  }

  //========================================================================+
  void DbBaseDto::getAllEntriesAndReply(const nlohmann::json &data_j,
                                        SvtKafkaReplyMsg &replyMsg)
  {
    DbEntry filters;
    parseJsonFilters(data_j, filters);

    std::vector<DbEntry> entries;
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
      auto empty_list = std::vector<DbEntry>();
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
      std::vector<DbEntry>::const_iterator first =
          entries.begin() + pager_offset;
      std::vector<DbEntry>::const_iterator last =
          entries.begin() + pager_offset +
          ((tail_size < pager_limit) ? tail_size : pager_limit);
      std::vector<DbEntry> asics(first, last);
      createReplyMsg(asics, replyMsg, entries.size());
    }
  }

  //========================================================================+
  void DbBaseDto::createEntry(const SvtKafkaMessage &msg,
                              SvtKafkaReplyMsg &replyMsg)
  {
    const auto &msgData = msg.getPayload()["data"];
    if (!SvtUtils::keyExists(msgData, "create"))
      return;
    createEntryAndReply(msgData["create"], replyMsg);
  }

  //========================================================================+
  bool DbBaseDto::createAndReturnNewEntry(const nlohmann::json &data_j, DbEntry &entry)
  {
    auto modifiedData_j = data_j;
    if (relationDtos.size())
    {
      for (const auto &rel : relationDtos)
      {
        if (modifiedData_j.contains(rel->getProps().colName))
        {
          SvtUtils::recursive_erase_key(modifiedData_j, rel->getProps().colName);
        }
      }
    }
    parseJsonData(modifiedData_j, entry);

    entry.dump();
    //! create entry in DB
    if (!createEntryInDB(entry))
    {
      THROW_RUNTIME_ERROR("Entry was not created in " + std::string(mainTable.getTableName()));
      return false;
    }

    const auto newEntryId = database::dbapi::getMaxId(std::string(mainTable.getTableName()));
    if (relationDtos.size())
    {
      for (const auto &rel : relationDtos)
      {
        if (data_j.contains(rel->getProps().colName))
        {
          rel->addEntries(newEntryId, data_j[rel->getProps().colName]);
        }
      }
    }

    getEntryWithId(entry, newEntryId);
    return true;
  }

  //========================================================================+
  void DbBaseDto::createEntryAndReply(const nlohmann::json &data_j,
                                      SvtKafkaReplyMsg &replyMsg)
  {
    DbEntry entry;
    createAndReturnNewEntry(data_j, entry);
    createReplyMsg(entry, replyMsg);
  }

  //========================================================================+
  void DbBaseDto::updateEntry(const SvtKafkaMessage &msg,
                              SvtKafkaReplyMsg &replyMsg)
  {
    const auto &msgData = msg.getPayload()["data"];
    if (!SvtUtils::keyExists(msgData, "id"))
      return;
    if (!SvtUtils::keyExists(msgData, "update"))
      return;

    updateEntryAndReply(msgData["id"], msgData["update"], replyMsg);
  }

  //========================================================================+
  void DbBaseDto::updateEntryAndReply(const int id, const nlohmann::json &data_j,
                                      SvtKafkaReplyMsg &replyMsg, bool allowNull)
  {
    DbEntry entry;
    for (const auto &[key, value] : data_j.items())
    {
      entry.addValue(key, value);
    }

    if (!database::dbapi::checkIdExist(std::string(mainTable.getTableName()), id))
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
  void DbBaseDto::updateEntryInRelationTable(DbBaseListDto *relationDto,
                                             const SvtKafkaMessage &msg,
                                             SvtKafkaReplyMsg &replyMsg)
  {
    const auto &msgData = msg.getPayload()["data"];
    if (!SvtUtils::keyExists(msgData, "id"))
      return;
    if (!SvtUtils::keyExists(msgData, "update"))
      return;

    int id = msgData["id"];
    if (!relationDto->updateRelationEntryInDB(id, msgData["update"][relationDto->getProps().colName]))
    {
      THROW_RUNTIME_ERROR("");
      return;
    }
    DbEntry entry;
    getEntryWithId(entry, id);
    createReplyMsg(entry, replyMsg);
  }

  //========================================================================+
  bool DbBaseDto::getAllEntriesFromDB(
      std::vector<DbEntry> &entries,
      const std::string &queryString,
      const DbEntry &filters,
      const std::string &orderBy,
      const bool orderDec)
  {
    entries.clear();
    database::dbapi::SimpleQuery query;

    if (queryString.empty())
    {
      query.setTableName(getTableName());
      for (const auto &colName : getColNames())
      {
        query.addColumn(colName.first);
      }
    }

    for (const auto &[name, value] : filters.getValues())
    {
      if (validFilters.count(name))
      {
        const std::string &colName = validFilters[name];
        //! check if filter name is a colName in the table
        if (!getColNames().count(colName))
        {
          THROW_RUNTIME_ERROR("Invalid filter " + name + ", col " + colName + " non found in Table " + getTableName());
          return false;
        }

        const auto &whereColName = queryString.empty() ? colName : "T0." + colName;

        if (value.is_array())
        {
          // if empty array skip
          if (value.empty())
            continue;
          if (std::all_of(value.begin(), value.end(), [](const json &el)
                          { return el.is_number_integer(); }))
          {
            query.addWhereIn(whereColName, value.get<std::vector<int>>());
          }
          else if (std::all_of(value.begin(), value.end(), [](const json &el)
                               { return el.is_string(); }))
          {
            query.addWhereIn(whereColName, value.get<std::vector<std::string>>());
          }
          else
          {
            THROW_RUNTIME_ERROR("Invalid filter type, only array of integer or string is allowed");
            return false;
          }
        }
        else
        {
          query.addWhereEquals(whereColName, value);
        }
      }
      else
      {
        logError("Invalid filter: " + name);
        return false;
      }
    }

    if (!orderBy.empty())
    {
      query.setOrderById(orderBy, orderDec);
    }

    try
    {
      database::rows_t rows;
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
          DbEntry rowEntry;
          int valId = 0;
          for (const auto &fieldVal : fieldValues)
          {
            const std::string_view &colName = rows.colNames[valId];
            rowEntry.addValue(std::string(colName), fieldVal);
            ++valId;
          }
          entries.push_back(rowEntry);
        }

        // if (!ids.empty() && (filters.getValues().size() == 1))
        // {
        //   if (ids.size() != entries.size())
        //   {
        //     THROW_RUNTIME_ERROR(
        //         "unmatching returned elements and requested filter size");
        //   }
        // }
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
  bool DbBaseDto::getEntryWithId(DbEntry &entry, int id)
  {
    DbEntry filters;
    filters.addValue("ids", nlohmann::json::array({id}));

    std::vector<DbEntry> entries;
    if (!getAllEntriesFromDB(entries, std::string(), filters))
    {
      return false;
    }
    if (!entries.empty())
    {
      entry = std::move(entries.at(0));
      addItemFromRelationDto(entry);
    }
    else
    {
      entry = std::move(DbEntry());
    }

    return true;
  }

  //========================================================================+
  bool DbBaseDto::createEntryInDB(const DbEntry &entry)
  {
    database::dbapi::SimpleInsert insert;

    insert.setTableName(getTableName());

    //! checkinput values and Add columns & values
    for (const auto &item : entry.getValues())
    {
      insert.addColumnAndValue(item.first, item.second);
    }

    if (!insert.doInsert())
    {
      database::dbapi::rollbackUpdate();
      return -1;
    }
    database::dbapi::commitUpdate();
    return true;
  }

  //========================================================================+
  bool DbBaseDto::updateEntryInDB(const int id,
                                  const DbEntry &entry, bool allowNull)
  {
    database::dbapi::SimpleUpdate update;

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
      database::dbapi::rollbackUpdate();
      return false;
    }
    database::dbapi::commitUpdate();

    return true;
  }

  //========================================================================+
  void DbBaseDto::createReplyMsg(
      const std::vector<DbEntry> &entries, SvtKafkaReplyMsg &msgReply,
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
  void DbBaseDto::createReplyMsg(
      const DbEntry &entry, SvtKafkaReplyMsg &msgReply)
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
  bool DbBaseDto::findRequestAndRun(std::string_view reqName,
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
  void DbBaseDto::parseJsonData(const nlohmann::json &j_data,
                                DbEntry &entry)
  {
    //! remove id record
    size_t count_required = std::count_if(mainTable.getColNames().cbegin(), mainTable.getColNames().cend(), [](const auto &p)
                                          { return ((p.first != "id") && (p.second)); });
    entry.clear();
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
  void DbBaseDto::parseJsonFilters(const nlohmann::json &j_data,
                                   DbEntry &filters)
  {
    filters.clear();

    if (j_data.contains("filter"))
    {
      const auto filterData = j_data["filter"];
      for (auto it = filterData.cbegin(); it != filterData.cend(); ++it)
      {
        if ((it.key() != "ids") && !validFilters.count(it.key()))
        {
          THROW_RUNTIME_ERROR("Error: " + it.key() + " is not an allowed filter.");
          filters.clear();
          return;
        }
        filters.addValue(it.key(), it.value());
      }
    }
  }

  //========================================================================+
  void DbBaseDto::addRequest(
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

}  // namespace dbagent
