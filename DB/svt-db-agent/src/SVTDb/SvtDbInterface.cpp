/*!
 * @file SvtDbInterface.cpp
 * @author Y. Corrales <ycmorales@bnl.gov>
 * @date Mar 2024
 * @brief Database interface for SVT test
 */

#include "SVTDb/SvtDbInterface.h"
#include "SVTDb/sqlmapi.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include <exception>
#include <string>
#include <vector>
//========================================================================+
int SvtDbInterface::getAllEnumValues(std::string type_name,
                                     std::vector<std::string> &enum_values)
{
  vector<vector<MultiBase *>> rows;
  std::string query = "SELECT enum_range(null::" + type_name + ");";

  enum_values.clear();
  try
  {
    doGenericQuery(query, rows);
    const auto str_res = rows[0][0]->getString();
    std::string_view res{str_res};
    finishQuery(rows);

    res.remove_prefix(res.find('{') + 1);
    res.remove_suffix(res.size() - res.find_last_of('}'));

    const string_view delimiter(",");
    size_t start = 0;
    size_t end = res.find(delimiter);
    while (end != std::string_view::npos)
    {
      enum_values.push_back(std::string(res.substr(start, end - start)));
      start = end + 1;
      end = res.find(delimiter, start);
    }
    enum_values.push_back(std::string(res.substr(start)));
  }
  catch (const std::exception &e)
  {
    enum_values.clear();
    throw e;
  }
  return enum_values.size();
}

//========================================================================+
bool SvtDbInterface::addEnumValue(std::string type_name, std::string value)
{
  std::string cmd =
      "ALTER TYPE " + type_name + " ADD VALUE IF NOT EXISTS '" + value + "';";

  if (!doGenericUpdate(cmd))
  {
    rollbackUpdate();
    return false;
  }
  commitUpdate();
  return true;
}

//========================================================================+
int SvtDbInterface::getAllVersions(
    std::vector<SvtDbInterface::dbVersion> &versions)
{
  versions.clear();
  SimpleQuery query;

  std::string tableName = SvtDbAgent::db_schema + std::string(".version");
  query.setTableName(tableName);

  query.addColumn("id");
  query.addColumn("name");
  query.addColumn("baseVersion");
  query.addColumn("description");

  vector<vector<MultiBase *>> rows;
  query.doQuery(rows);

  for (vector<MultiBase *> row : rows)
  {
    dbVersion version;
    version.id = row.at(0)->getInt();
    if ((row.size() > 1) && (row.at(1) != NULL))
    {
      version.name = row.at(1)->getString();
    }
    else
    {
      version.name = std::string("NONAME_ID" + std::to_string(version.id));
    }
    if ((row.size() > 2) && (row.at(2) != NULL))
    {
      version.baseVersion = row.at(2)->getInt();
    }
    else
    {
      version.baseVersion = -1;
    }
    if ((row.size() > 3) && (row.at(3) != NULL))
    {
      version.description = row.at(3)->getString();
    }
    else
    {
      version.description = "Empty";
    }
    versions.push_back(version);
  }

  return versions.size();
}

//========================================================================+
int SvtDbInterface::getMaxId(const std::string &tableName)
{
  std::string full_tableName = SvtDbAgent::db_schema + "." + tableName;
  string queryString = "SELECT MAX(ID) FROM " + full_tableName;

  vector<vector<MultiBase *>> rows;
  doGenericQuery(queryString, rows);
  int maxVersionId = -1;

  if (!rows.empty())
  {
    maxVersionId = rows.at(0).at(0)->getInt();
  }
  else
  {
    raiseError("Max Wafer ID returned nothing");
  }

  finishQuery(rows);
  return maxVersionId;
}

//========================================================================+
int SvtDbInterface::getAllWafers(std::vector<dbWaferRecords> &wafers,
                                 const std::vector<int> &id_filters)
{
  wafers.clear();
  SimpleQuery query;

  std::string tableName = SvtDbAgent::db_schema + std::string(".Wafer");
  query.setTableName(tableName);

  query.addColumn("id");
  query.addColumn("serialNumber");
  query.addColumn("batchNumber");
  query.addColumn("foundry");
  query.addColumn("technology");
  query.addColumn("engineeringRun");
  query.addColumn("waferType");
  query.addColumn("thinningDate");
  query.addColumn("dicingdate");
  query.addColumn("productionDate");

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
      if (row.size() != 10)
      {
        throw std::range_error("");
      }
      dbWaferRecords wafer;
      //! wafer id
      wafer.id = (row.at(0)) ? row.at(0)->getInt() : -1;
      //! wafer serialNumber
      wafer.serialNumber = (row.at(1)) ? row.at(1)->getString() : "";
      //! wafer batchNumber
      wafer.batchNumber = (row.at(2)) ? row.at(2)->getInt() : -1;
      //! wafer foundry
      wafer.foundry = (row.at(3)) ? row.at(3)->getString() : "";
      //! wafer technology
      wafer.technology = (row.at(4)) ? row.at(4)->getString() : "";
      //! wafer engineeringRun
      wafer.engineeringRun = (row.at(5)) ? row.at(5)->getString() : "";
      //! wafer type
      wafer.waferType = (row.at(6)) ? row.at(6)->getString() : "";
      //! wafer thiningDate
      wafer.thinningDate = (row.at(7)) ? row.at(7)->getString() : "";
      //! wafer dicingDate
      wafer.dicingDate = (row.at(8)) ? row.at(8)->getString() : "";
      //! wafer productionDate
      wafer.productionDate = (row.at(9)) ? row.at(9)->getString() : "";

      wafers.push_back(wafer);
    }
  }
  catch (const std::exception &e)
  {
    Singleton<SvtLogger>::instance().logError(e.what());
    wafers.clear();
  }

  return wafers.size();
}

//========================================================================+
bool SvtDbInterface::insertWafer(const dbWaferRecords &wafer)
{
  SimpleInsert insert;

  std::string tableName = SvtDbAgent::db_schema + std::string(".Wafer");
  insert.setTableName(tableName);

  //! Add columns & values
  if (!wafer.serialNumber.empty())
  {
    insert.addColumnAndValue("serialNumber", std::string(wafer.serialNumber));
  }
  if (wafer.batchNumber >= 0)
  {
    insert.addColumnAndValue("batchNumber", wafer.batchNumber);
  }
  if (!wafer.foundry.empty())
  {
    insert.addColumnAndValue("foundry", std::string(wafer.foundry));
  }
  if (!wafer.technology.empty())
  {
    insert.addColumnAndValue("technology", std::string(wafer.technology));
  }
  if (!wafer.engineeringRun.empty())
  {
    insert.addColumnAndValue("engineeringRun",
                             std::string(wafer.engineeringRun));
  }
  if (!wafer.waferType.empty())
  {
    insert.addColumnAndValue("waferType", std::string(wafer.waferType));
  }
  if (!wafer.thinningDate.empty())
  {
    insert.addColumnAndValue("thinningDate", std::string(wafer.thinningDate));
  }
  if (!wafer.dicingDate.empty())
  {
    insert.addColumnAndValue("dicingDate", std::string(wafer.dicingDate));
  }
  if (!wafer.productionDate.empty())
  {
    insert.addColumnAndValue("productionDate",
                             std::string(wafer.productionDate));
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
int SvtDbInterface::getAllAsics(std::vector<dbAsicRecords> &asics,
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
bool SvtDbInterface::insertAsic(const dbAsicRecords &asic)
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
int SvtDbInterface::getAllTopography(
    std::vector<dbWaferTopoRecords> &topography,
    const std::vector<int> &id_filters)
{
  topography.clear();
  SimpleQuery query;

  std::string tableName =
      SvtDbAgent::db_schema + std::string(".waferTopography");
  query.setTableName(tableName);

  query.addColumn("id");
  query.addColumn("name");
  query.addColumn("imageBase64String");
  query.addColumn("waferMap");

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
      if (row.size() != 4)
      {
        throw std::range_error("WaferTopography table:");
      }
      dbWaferTopoRecords topog;
      //! topog id
      topog.id = (row.at(0)) ? row.at(0)->getInt() : -1;
      //! topog name
      topog.name = (row.at(1)) ? row.at(1)->getString() : "";
      //! topog imageBase64String
      topog.imageBase64String = (row.at(2)) ? row.at(2)->getString() : "";
      //! topog waferMapP
      topog.waferMap = (row.at(3)) ? row.at(3)->getString() : "";

      topography.push_back(topog);
    }
  }
  catch (const std::exception &e)
  {
    Singleton<SvtLogger>::instance().logError(e.what());
    topography.clear();
  }

  return topography.size();
}

//========================================================================+
bool SvtDbInterface::insertTopography(
    const dbWaferTopoRecords &waferTopography)
{
  SimpleInsert insert;

  std::string tableName =
      SvtDbAgent::db_schema + std::string(".waferTopography");
  insert.setTableName(tableName);

  //! Add columns & values
  if (!waferTopography.name.empty())
  {
    insert.addColumnAndValue("name", std::string(waferTopography.name));
  }
  if (!waferTopography.imageBase64String.empty())
  {
    insert.addColumnAndValue("imageBase64String",
                             std::string(waferTopography.imageBase64String));
  }
  if (!waferTopography.waferMap.empty())
  {
    insert.addColumnAndValue("waferMap", std::string(waferTopography.waferMap));
  }

  if (!insert.doInsert())
  {
    rollbackUpdate();
    return -1;
  }
  commitUpdate();
  return true;
}
