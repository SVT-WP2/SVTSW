/*!
 * @file SvtDbInterface.cpp
 * @author Y. Corrales <ycmorales@bnl.gov>
 * @date Mar 2024
 * @brief Database interface for SVT test
 */

#include "SVTDb/SvtDbInterface.h"
#include "SVTDb/sqlmapi.h"
#include "SVTUtilities/SvtUtilities.h"

#include <string>
#include <vector>

//========================================================================+
size_t SvtDbInterface::getAllVersions(
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

  rows_t rows;
  query.doQuery(rows);

  for (const auto &row : rows)
  {
    dbVersion version;
    version.id = row.at(0).get<int>();
    if ((row.size() > 1) && (row.at(1) != NULL))
    {
      version.name = row.at(1).get<std::string>();
    }
    else
    {
      version.name = std::string("NONAME_ID" + std::to_string(version.id));
    }
    if ((row.size() > 2) && (row.at(2) != NULL))
    {
      version.baseVersion = row.at(2).get<int>();
    }
    else
    {
      version.baseVersion = -1;
    }
    if ((row.size() > 3) && (row.at(3) != NULL))
    {
      version.description = row.at(3).get<std::string>();
    }
    else
    {
      version.description = "Empty";
    }
    versions.push_back(version);
  }
  finishQuery(rows);

  return versions.size();
}

//========================================================================+
size_t SvtDbInterface::getMaxId(const std::string &tableName)
{
  std::string full_tableName = SvtDbAgent::db_schema + "." + tableName;
  std::string queryString = "SELECT MAX(ID) FROM " + full_tableName;

  rows_t rows;
  doGenericQuery(queryString, rows);
  int maxId = -1;

  if (!rows.empty())
  {
    maxId = rows.at(0).at(0).get<int>();
  }
  else
  {
    raiseError("Max Wafer ID returned nothing");
  }

  finishQuery(rows);
  return maxId;
}

//========================================================================+
bool SvtDbInterface::checkIdExist(const std::string &tableName, int id)
{
  SimpleQuery query;

  std::string full_tableName = SvtDbAgent::db_schema + "." + tableName;
  query.setTableName(full_tableName);
  query.addWhereEquals("id", id);
  // string queryString = "SELECT 1 FROM " + full_tableName;

  rows_t rows;
  query.doQuery(rows);
  return !rows.empty();
}
