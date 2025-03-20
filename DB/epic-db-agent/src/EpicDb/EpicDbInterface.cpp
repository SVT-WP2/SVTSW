/*!
 * @file EpicDbInterface.cpp
 * @author Y. Corrales <ycmorales@bnl.gov>
 * @date Mar 2024
 * @brief Database interface for SVT test
 */

#include "EpicDb/EpicDbInterface.h"
#include "EpicDb/sqlmapi.h"
#include "EpicUtilities/EpicUtilities.h"

#include <exception>
#include <string>
#include <vector>
//========================================================================+
int EpicDbInterface::getAllEnumValues(std::string type_name,
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
bool EpicDbInterface::addEnumValue(std::string type_name, std::string value)
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
int EpicDbInterface::getAllVersions(
    std::vector<EpicDbInterface::dbVersion> &versions)
{
  versions.clear();
  SimpleQuery query;

  std::string tableName = EpicDbAgent::db_schema + std::string(".version");
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
int EpicDbInterface::getMaxWaferId()
{
  std::string tableName = EpicDbAgent::db_schema + std::string(".Wafer");
  string queryString = "SELECT MAX(ID) FROM " + tableName;

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
bool EpicDbInterface::insertWaferRecords(const dbWaferRecords &waferRecords)
{
  SimpleInsert insert;

  std::string tableName = EpicDbAgent::db_schema + std::string(".Wafer");
  insert.setTableName(tableName);

  //! Add columns & values
  if (!waferRecords.serialNumber.empty())
  {
    insert.addColumnAndValue("serialNumber",
                             std::string(waferRecords.serialNumber));
  }
  if (waferRecords.batchNumber >= 0)
  {
    insert.addColumnAndValue("batchNumber", waferRecords.batchNumber);
  }
  if (!waferRecords.engineeringRun.empty())
  {
    insert.addColumnAndValue("engineeringRun",
                             std::string(waferRecords.engineeringRun));
  }
  if (!waferRecords.foundry.empty())
  {
    insert.addColumnAndValue("foundry", std::string(waferRecords.foundry));
  }
  if (!waferRecords.technology.empty())
  {
    insert.addColumnAndValue("technology",
                             std::string(waferRecords.technology));
  }
  if (!waferRecords.thinningDate.empty())
  {
    insert.addColumnAndValue("thinningDate",
                             std::string(waferRecords.thinningDate));
  }
  if (!waferRecords.dicingDate.empty())
  {
    insert.addColumnAndValue("dicingDate",
                             std::string(waferRecords.dicingDate));
  }
  if (!waferRecords.productionDate.empty())
  {
    insert.addColumnAndValue("productionDate",
                             std::string(waferRecords.dicingDate));
  }
  if (!waferRecords.waferType.empty())
  {
    insert.addColumnAndValue("waferType", std::string(waferRecords.waferType));
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
int EpicDbInterface::getAllWafers(std::vector<dbWaferRecords> &wafers,
                                  std::vector<int> &id_filters)
{
  wafers.clear();
  SimpleQuery query;

  std::string tableName = EpicDbAgent::db_schema + std::string(".Wafer");
  query.setTableName(tableName);

  query.addColumn("id");
  query.addColumn("serialNumber");
  query.addColumn("batchNumber");
  query.addColumn("engineeringRun");
  query.addColumn("foundry");
  query.addColumn("technology");
  query.addColumn("thinningDate");
  query.addColumn("dicingdate");
  query.addColumn("productionDate");
  query.addColumn("waferType");

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
      dbWaferRecords wafer;
      //! wafer id
      wafer.id = row.at(0)->getInt();
      //! wafer serialNumber
      if ((row.size() > 1) && (row.at(1) != NULL))
      {
        wafer.serialNumber = row.at(1)->getString();
      }
      else
      {
        wafer.serialNumber =
            std::string("NO_SERIAL_NUMBER_" + std::to_string(wafer.id));
      }
      //! wafer batchNumber
      if ((row.size() > 2) && (row.at(2) != NULL))
      {
        wafer.batchNumber = row.at(2)->getInt();
      }
      else
      {
        wafer.batchNumber = -1;
      }
      //! wafer engineeringRun
      if ((row.size() > 3) && (row.at(3) != NULL))
      {
        wafer.engineeringRun = row.at(3)->getString();
      }
      else
      {
        wafer.engineeringRun = "NO_ENGINEERING_" + std::to_string(wafer.id);
      }
      //! wafer foundry
      if ((row.size() > 4) && (row.at(4) != NULL))
      {
        wafer.foundry = row.at(4)->getString();
      }
      else
      {
        wafer.foundry = "NO_FOUNDRY_" + std::to_string(wafer.id);
      }
      //! wafer technology
      if ((row.size() > 5) && (row.at(5) != NULL))
      {
        wafer.technology = row.at(5)->getString();
      }
      else
      {
        wafer.technology = "NO_TECH_" + std::to_string(wafer.id);
      }
      //! wafer thiningDate
      if ((row.size() > 6) && (row.at(6) != NULL))
      {
        wafer.thinningDate = row.at(6)->getString();
      }
      else
      {
        wafer.thinningDate = "";
      }
      //! wafer dicingDate
      if ((row.size() > 7) && (row.at(7) != NULL))
      {
        wafer.dicingDate = row.at(7)->getString();
      }
      else
      {
        wafer.dicingDate = "";
      }
      //! wafer dicingDate
      if ((row.size() > 8) && (row.at(8) != NULL))
      {
        wafer.dicingDate = row.at(8)->getString();
      }
      else
      {
        wafer.dicingDate = "";
      }
      if ((row.size() > 9) && (row.at(9) != NULL))
      {
        wafer.waferType = row.at(9)->getString();
      }
      else
      {
        wafer.waferType = "";
      }

      wafers.push_back(wafer);
    }
  }
  catch (const std::exception &e)
  {
    wafers.clear();
  }

  return wafers.size();
}
