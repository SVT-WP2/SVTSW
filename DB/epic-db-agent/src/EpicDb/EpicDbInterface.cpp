/*!
 * @file EpicDbInterface.cpp
 * @author Y. Corrales <ycmorales@bnl.gov>
 * @date Mar 2024
 * @brief Database interface for SVT test
 */

#include "EpicDb/EpicDbInterface.h"
#include "EpicDb/sqlmapi.h"

#include <string>
#include <vector>

//========================================================================+
std::vector<std::string>
EpicDbInterface::getAllEnumValues(std::string enum_value)
{
  vector<vector<MultiBase *>> rows;
  std::string query = "SELECT enum_range(null::" + enum_value + ");";
  doGenericQuery(query, rows);
  const auto str_res = rows[0][0]->getString();
  std::string_view res{str_res};
  finishQuery(rows);

  res.remove_prefix(res.find('{') + 1);
  res.remove_suffix(res.size() - res.find_last_of('}'));

  std::vector<std::string> result;

  const string_view delimiter(",");
  size_t start = 0;
  size_t end = res.find(delimiter);
  while (end != std::string_view::npos)
  {
    result.push_back(std::string(res.substr(start, end - start)));
    start = end + 1;
    end = res.find(delimiter, start);
  }
  result.push_back(std::string(res.substr(start)));

  return result;
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

  query.setTableName("test.version");

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
bool EpicDbInterface::insertWaferRecords(const dbWaferRecords &waferRecords)
{
  SimpleInsert insert;

  insert.setTableName("test.wafer");

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
  if (!waferRecords.waferType.empty())
  {
    insert.addColumnAndValue("waferType", std::string(waferRecords.waferType));
  }

  if (!insert.doInsert())
  {
    rollbackUpdate();
    return false;
  }
  commitUpdate();
  return true;
}

//========================================================================+
int EpicDbInterface::getAllWafers(std::vector<dbWaferRecords> &wafers)
{
  wafers.clear();
  SimpleQuery query;

  query.setTableName("test.wafer");

  query.addColumn("id");
  query.addColumn("serialNumber");
  query.addColumn("batchNumber");
  query.addColumn("engineeringRun");
  query.addColumn("foundry");
  query.addColumn("technology");
  query.addColumn("thinningDate");
  query.addColumn("dicingdate");
  query.addColumn("waferType");

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
      wafer.thinningDate = "N/A_" + std::to_string(wafer.id);
    }
    //! wafer dicingDate
    if ((row.size() > 7) && (row.at(7) != NULL))
    {
      wafer.dicingDate = row.at(7)->getString();
    }
    else
    {
      wafer.dicingDate = "N/A_" + std::to_string(wafer.id);
    }
    if ((row.size() > 8) && (row.at(8) != NULL))
    {
      wafer.waferType = row.at(8)->getString();
    }
    else
    {
      wafer.waferType = "N/A_" + std::to_string(wafer.id);
    }

    wafers.push_back(wafer);
  }

  return wafers.size();
}
