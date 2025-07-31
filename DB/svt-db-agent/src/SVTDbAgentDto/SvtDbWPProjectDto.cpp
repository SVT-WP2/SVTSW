/*!
 * @file SvtDbWPProjectDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWPProjectDto
 */

#include "SVTDbAgentDto/SvtDbWPProjectDto.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDb/sqlmapi.h"
#include "SVTDbAgentDto/SvtDbEnumDto.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include <stdexcept>

using SvtDbAgent::Singleton;

//========================================================================+
bool SvtDbWPProjectDto::getAllWPProjsFromDB(
    std::vector<dbWPProjRecords> &wpProjects,
    const std::vector<int> &id_filters)
{
  wpProjects.clear();
  SimpleQuery query;

  std::string tableName =
      SvtDbAgent::db_schema + std::string(".WaferProbeProject");
  query.setTableName(tableName);

  for (const auto &record : dbWPProjRecords::val_names)
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
      if (row.size() != dbWPProjRecords::val_names.size())
      {
        throw std::range_error("");
      }
      dbWPProjRecords wpProject;
      //! wpProject id
      wpProject.id = row.at(0) ? row.at(0)->getInt() : -1;
      //! wpProject wpMachineId
      wpProject.wpMachineId = row.at(1) ? row.at(1)->getInt() : -1;
      //! wpProject waferTypeId
      wpProject.waferTypeId = row.at(2) ? row.at(2)->getInt() : -1;
      //! wpProject asicFamilyType
      wpProject.asicFamilyType = row.at(3) ? row.at(3)->getString() : "";
      //! wpProject orientation
      wpProject.orientation = row.at(4) ? row.at(4)->getString() : "";
      //! wpProject name
      wpProject.name = row.at(5) ? row.at(5)->getString() : "";
      //! wpProject alignmentDie
      wpProject.alignmentDie = row.at(6) ? row.at(6)->getString() : "";
      //! wpProject homeDie
      wpProject.homeDie = row.at(7) ? row.at(7)->getString() : "";
      //! wpProject local2GlobalMap
      wpProject.local2GlobalMap = row.at(8) ? row.at(8)->getString() : "";

      wpProjects.push_back(wpProject);
    }
    if (id_filters.size() && wpProjects.size() != id_filters.size())
    {
      throw std::runtime_error(
          "unmatching returned elements and requested filter size");
    }
  }
  catch (const std::exception &e)
  {
    Singleton<SvtLogger>::instance().logError(e.what());
    wpProjects.clear();
    return false;
  }

  return true;
}

//========================================================================+
bool SvtDbWPProjectDto::getWPProjFromDB(dbWPProjRecords &wpProject, int id)
{
  std::vector<int> id_filters = {id};
  std::vector<dbWPProjRecords> wpProjects;
  if (!getAllWPProjsFromDB(wpProjects, id_filters))
  {
    return false;
  }
  wpProject = std::move(wpProjects.at(0));
  return true;
}

//========================================================================+
bool SvtDbWPProjectDto::createWPProjInDB(const dbWPProjRecords &wpProj)
{
  SimpleInsert insert;

  std::string tableName =
      SvtDbAgent::db_schema + std::string(".WaferProbeProject");
  insert.setTableName(tableName);

  //! checkinput values
  if ((wpProj.wpMachineId < 0) || (wpProj.waferTypeId < 0) ||
      wpProj.asicFamilyType.empty() || wpProj.orientation.empty() ||
      wpProj.name.empty() || wpProj.alignmentDie.empty() ||
      wpProj.homeDie.empty() || wpProj.local2GlobalMap.empty())
  {
    return false;
  }

  //! Add columns & values
  insert.addColumnAndValue("wpMachineId", wpProj.wpMachineId);
  insert.addColumnAndValue("waferTypeId", wpProj.waferTypeId);
  insert.addColumnAndValue("asicFamilyType", wpProj.asicFamilyType);
  insert.addColumnAndValue("orientation", wpProj.orientation);
  insert.addColumnAndValue("name", wpProj.name);
  insert.addColumnAndValue("alignmentDie", wpProj.alignmentDie);
  insert.addColumnAndValue("homeDie", wpProj.homeDie);
  insert.addColumnAndValue("local2GlobalMap", wpProj.local2GlobalMap);

  if (!insert.doInsert())
  {
    rollbackUpdate();
    return -1;
  }
  commitUpdate();
  return true;
}

//========================================================================+
void SvtDbWPProjectDto::getAllWPProjects(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  std::vector<int> id_filters;
  if (msgData.contains("filter"))
  {
    const auto filterData = msgData["filter"];
    if (filterData.contains("ids"))
    {
      id_filters = filterData["ids"].get<std::vector<int>>();
    }
  }
  std::vector<dbWPProjRecords> wpProjects;
  if (getAllWPProjsFromDB(wpProjects, id_filters))
  {
    getAllWPProjReplyMsg(wpProjects, replyMsg);
  }
}

//========================================================================+
void SvtDbWPProjectDto::getAllWPProjReplyMsg(
    const std::vector<dbWPProjRecords> &wpProjects,
    SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::ordered_json items = nlohmann::json::array();
    for (const auto &wpProj : wpProjects)
    {
      nlohmann::ordered_json wpProj_j;
      wpProj_j["id"] = wpProj.id;
      wpProj_j["wpMachineId"] = wpProj.wpMachineId;
      wpProj_j["waferTypeId"] = wpProj.waferTypeId;
      wpProj_j["asicFamilyType"] = wpProj.asicFamilyType;
      wpProj_j["orientation"] = wpProj.orientation;
      wpProj_j["name"] = wpProj.name;
      wpProj_j["alignmentDie"] = wpProj.alignmentDie;
      wpProj_j["homeDie"] = wpProj.homeDie;
      wpProj_j["local2GlobalMap"] = wpProj.local2GlobalMap;

      items.push_back(wpProj_j);
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
void SvtDbWPProjectDto::createWPProject(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    throw std::runtime_error("Object item create was found");
  }

  auto wpProj_j = msgData["create"];
  //! remove id record
  if (wpProj_j.size() < (dbWPProjRecords::val_names.size() - 1))
  {
    throw std::invalid_argument("insufficient number of parameters");
  }

  dbWPProjRecords wpProj;
  //! wpProject wpMachineId
  wpProj.wpMachineId = wpProj_j.value("wpMachineId", -1);
  //! wpProject waferTypeId
  wpProj.waferTypeId = wpProj_j.value("waferTypeId", -1);
  //! wpProject asicFamilyType
  wpProj.asicFamilyType = wpProj_j.value("asicFamilyType", "");
  //! wpProject orientation
  wpProj.orientation = wpProj_j.value("orientation", "");
  //! wpProject name
  wpProj.name = wpProj_j.value("name", "");
  //! wpProject alignmentDie
  wpProj.alignmentDie = wpProj_j.value("alignmentDie", "");
  //! wpProject homeDie
  wpProj.homeDie = wpProj_j.value("homeDie", "");
  //! wpProject local2GlobalMap
  wpProj.local2GlobalMap = wpProj_j.value("local2GlobalMap", "");

  std::string err_msg;
  //! create wafer probe projec in DB
  if (!createWPProjInDB(wpProj))
  {
    throw std::runtime_error("Wafer probe project was not created");
    return;
  }

  const auto newWPProjId = SvtDbInterface::getMaxId("WaferProbeProject");
  getWPProjFromDB(wpProj, newWPProjId);
  createWPProjReplyMsg(wpProj, replyMsg);
}

//========================================================================+
void SvtDbWPProjectDto::createWPProjReplyMsg(
    const dbWPProjRecords &wpProj, SvtDbAgent::SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    nlohmann::ordered_json data;
    nlohmann::json ret_wpProj_j;
    ret_wpProj_j["id"] = wpProj.id;
    ret_wpProj_j["wpMachineId"] = wpProj.wpMachineId;
    ret_wpProj_j["waferTypeId"] = wpProj.waferTypeId;
    ret_wpProj_j["asicFamilyType"] = wpProj.asicFamilyType;
    ret_wpProj_j["orientation"] = wpProj.orientation;
    ret_wpProj_j["name"] = wpProj.name;
    ret_wpProj_j["alignmentDie"] = wpProj.alignmentDie;
    ret_wpProj_j["homeDie"] = wpProj.homeDie;
    ret_wpProj_j["local2GlobalMap"] = wpProj.local2GlobalMap;

    data["entity"] = ret_wpProj_j;
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
