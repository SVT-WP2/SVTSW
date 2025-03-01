#include "SVTDb/svtdb_if.h"
#include "SVTDb/sqlmapi.h"
// #include "SVTUtilities/SvtLogger.h"

int SvtDb_IF::getAllVersions(std::vector<SvtDb_IF::dbVersion> &versions)
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
