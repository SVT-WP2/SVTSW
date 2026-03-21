/*!
 * @file SvtDbInterface.cpp
 * @author Y. Corrales <ycmorales@bnl.gov>
 * @date Mar 2024
 * @brief Database interface for SVT test
 */

#include "SVTDb/SvtDbInterface.h"
#include "Database/DatabaseInterface.h"
#include "SvtLogger.h"
#include "SvtUtilities.h"

using std::string;
using std::vector;
using SvtUtils::Singleton;
using DatabaseIF = Singleton<DatabaseInterface>;

std::atomic<int> queryTime;
std::atomic<int> queryCount;
std::atomic<int> queryTrialCount;

std::string DatabaseInterface::mDbSchema;

/*!
 * Helper functions
 */

//! helper function quate string
//========================================================================+
std::string SvtDbInterface::formatStr(const std::string &str) { return "\"" + str + "\""; }

//========================================================================+
std::string addSchema(const std::string &str)
{
  return DatabaseInterface::getDbSchema() + "." + str;
}

//! helper function for joining strings on a delimiter
//========================================================================+
string stringJoin(vector<string> strings, string delimiter)
{
  string joinedString = "";

  for (auto it = strings.begin(); it != strings.end(); ++it)
  {
    joinedString += *it;
    if (it != strings.end() - 1)
    {
      joinedString += delimiter;
    }
  }

  return joinedString;
}

//! helper function for joining strings with a prepend
//! on each string and a delimiter
//========================================================================+
string stringJoinPrefix(vector<string> strings, string prefix,
                        string delimiter)
{
  string joinedString = "";

  for (auto it = strings.begin(); it != strings.end(); ++it)
  {
    joinedString += prefix;
    joinedString += *it;
    if (it != strings.end() - 1)
    {
      joinedString += delimiter;
    }
  }

  return joinedString;
}

/*!
 * Interfacing with MAPI
 */
//========================================================================+
void SvtDbInterface::doGenericQuery(string queryString, rows_t &rows)
{
  bool successful = false;
  int maxRetries = 1;
  int nTrials = 0;
  bool connected = true;
  string errorMessage;
  // vector<vector<MultiBase*>> rows;

  queryCount++;

  while (connected && (!successful) && (nTrials <= maxRetries))
  {
    std::chrono::high_resolution_clock::time_point t1 =
        std::chrono::high_resolution_clock::now();
    DatabaseIF::instance()->executeQuery(queryString, successful, errorMessage,
                                         rows);

    std::chrono::high_resolution_clock::time_point t2 =
        std::chrono::high_resolution_clock::now();
    std::chrono::milliseconds ms =
        std::chrono::duration_cast<std::chrono::milliseconds>(t2 - t1);
    queryTime += ms.count();
    queryTrialCount++;
    nTrials++;
    if ((!successful) && (nTrials <= maxRetries))
    {
      connected = DatabaseIF::instance()->isConnected();
      if (!connected)
      {
        logError("reconnect failed");
      }
    }
  }
  if (!successful)
  {
    SvtDbInterface::raiseError(errorMessage);
    rows.clear();
  }
}

//========================================================================+
bool SvtDbInterface::doGenericUpdate(string insertString)
{
  bool successful;
  string errorMessage;

  successful =
      DatabaseIF::instance()->executeUpdate(insertString, errorMessage);

  if (!successful)
  {
    SvtDbInterface::raiseError(errorMessage);
  }

  return successful;
}

//========================================================================+
void SvtDbInterface::commitUpdate() { DatabaseIF::instance()->commitUpdate(true); }

//========================================================================+
void SvtDbInterface::rollbackUpdate() { DatabaseIF::instance()->commitUpdate(false); }

//========================================================================+
void SvtDbInterface::raiseError(string errorMessage)
{
  THROW_RUNTIME_ERROR(errorMessage);
}

//========================================================================+
void SvtDbInterface::finishQuery(rows_t rows)
{
  DatabaseIF::instance()->clearQueryResult(rows);
}

//========================================================================+
void SvtDbInterface::SimpleQuery::doQuery(rows_t &rows)
{
  string queryString = "";
  queryString += "SELECT " + stringJoin(mColumnNames, ", ");
  queryString += " FROM " + addSchema(mTableName);
  if (!mWhereClauses.empty())
  {
    queryString += " WHERE " + stringJoin(mWhereClauses, " AND ");
  }
  if (!mOrderBy.empty())
  {
    queryString += " ORDER BY ";
    queryString += mOrderBy;
    queryString += mOrderDec ? " DESC" : "";
  }
  doGenericQuery(queryString, rows);

  return;
}

//========================================================================+
void SvtDbInterface::SimpleQuery::addWhereEquals(string columnName,
                                                 const nlohmann::basic_json<> &value)
{
  if (!value.is_null())
  {
    if (value.is_number_integer())
    {
      addWhereEquals(columnName, value.get<int>());
    }
    else if (value.is_string())
    {
      addWhereEquals(columnName, value.get<std::string>());
    }
    else if (value.is_number_float())
    {
      addWhereEquals(columnName, value.get<float>());
    }
  }
}

//========================================================================+
void SvtDbInterface::SimpleQuery::addWhereIn(string columnName, vector<int> values)
{
  if (values.size() == 0)
    return;
  string clause = columnName + " IN (";
  for (unsigned int i = 0; i < values.size(); i++)
  {
    clause += std::to_string(values.at(i));
    if (i < values.size() - 1)
      clause += ",";
  }
  clause += ")";
  mWhereClauses.push_back(clause);
}

//========================================================================+
bool SvtDbInterface::SimpleInsert::doInsert()
{
  string insertString = "";
  insertString += "INSERT INTO " + addSchema(mTableName);
  insertString += " (" + stringJoin(mColumnNames, ", ") + ")";
  insertString += " VALUES(" + stringJoin(mValues, ", ") + ")";

  return doGenericUpdate(insertString);
}

//========================================================================+
void SvtDbInterface::SimpleInsert::addColumnAndValue(string columnName,
                                                     const nlohmann::basic_json<> &value)
{
  if (!value.is_null())
  {
    if (value.is_number_integer())
    {
      addColumnAndValue(columnName, value.get<int>());
    }
    else if (value.is_string())
    {
      addColumnAndValue(columnName, value.get<std::string>());
    }
    else if (value.is_number_float())
    {
      addColumnAndValue(columnName, value.get<float>());
    }
  }
}

//========================================================================+
bool SvtDbInterface::SimpleUpdate::doUpdate()
{
  string queryString = "";
  queryString += "UPDATE " + addSchema(mTableName);
  queryString += " SET " + stringJoin(mColumnNamesAndValues, ", ");
  if (!mWhereClauses.empty())
  {
    queryString += " WHERE " + stringJoin(mWhereClauses, " AND ");
  }
  return doGenericUpdate(queryString);
}

//========================================================================+
void SvtDbInterface::SimpleUpdate::addColumnAndValue(string columnName,
                                                     const nlohmann::basic_json<> &value)
{
  if (!value.is_null())
  {
    if (value.is_number_integer())
    {
      addColumnAndValue(columnName, value.get<int>());
    }
    else if (value.is_string())
    {
      addColumnAndValue(columnName, value.get<std::string>());
    }
    else if (value.is_number_float())
    {
      addColumnAndValue(columnName, value.get<float>());
    }
  }
  else
  {
    addColumnAndValue(columnName, std::string("NULL"));
  }
}

//========================================================================+
void SvtDbInterface::SimpleUpdate::addWhereEquals(string columnName,
                                                  const nlohmann::basic_json<> &value)
{
  if (!value.is_null())
  {
    if (value.is_number_integer())
    {
      addWhereEquals(columnName, value.get<int>());
    }
    else if (value.is_string())
    {
      addWhereEquals(columnName, value.get<std::string>());
    }
    else if (value.is_number_float())
    {
      addWhereEquals(columnName, value.get<float>());
    }
  }
}

/*!
 * Versioning
 */

//========================================================================+
void SvtDbInterface::VersionedQuery::doQuery(rows_t &rows)
{
  // perhaps this should be folded into the main query?
  int baseVersionId = getBaseVersion(mVersionId);

  // the goal of this is to generalize the ability to query a table for a
  // particular version and to return the combination of the base and diff
  // versions that correspond to the given version see docs/versioning.md for a
  // more detailed explanation
  string queryString = "";
  // subquery on version first
  queryString += "WITH T0 AS (SELECT *";
  queryString += " FROM " + addSchema(mTableName);
  queryString += " WHERE versionId IN (" + std::to_string(baseVersionId) + "," +
                 std::to_string(mVersionId) + ")";
  if (!mWhereClauses.empty())
  {
    queryString += " AND " + stringJoin(mWhereClauses, " AND ");
  }
  queryString += ")";
  // select rows with the diff version if it exists and the base version if it
  // doesn't
  queryString += " SELECT " + stringJoinPrefix(mColumnNames, "T1.", ", ");
  queryString += " FROM T0 T1";
  queryString += " LEFT OUTER JOIN T0 T2";
  queryString += " ON T1.versionId < T2.versionId";
  queryString += " AND " + getPkString();
  queryString += " WHERE T2." + mPrimaryKeys.at(0) + " IS NULL";

  return doGenericQuery(queryString, rows);
}

//========================================================================+
bool SvtDbInterface::VersionedInsert::doInsert()
{
  // perhaps this should be folded into the main query?
  int baseVersionId = getBaseVersion(mVersionId);

  // look for the exact row to insert but with the base version ID instead
  mQuery.setTableName(mTableName);
  mQuery.addColumn("COUNT(*)");
  // the rest of the where clauses are added when calling addColumnAndValue
  mQuery.addWhereEquals("versionId", baseVersionId);

  rows_t rows;
  mQuery.doQuery(rows);
  int rowCount = rows.at(0).at(0).get<int>();
  finishQuery(rows);

  bool insertSuccessful = true;
  // if no such row exists, do the insert
  if (rowCount == 0)
  {
    // call parent method
    insertSuccessful = SimpleInsert::doInsert();
  }
  return insertSuccessful;
}

//========================================================================+
int SvtDbInterface::getBaseVersion(int versionId)
{
  string queryString = "SELECT baseVersion";
  queryString += " FROM " + DatabaseInterface::getDbSchema() + ".\"Version\"";
  queryString += " WHERE id=" + std::to_string(versionId);

  rows_t rows;
  SvtDbInterface::doGenericQuery(queryString, rows);
  int baseVersion = -1;

  if (!rows.empty())
  {
    baseVersion = rows.at(0).at(0).get<int>();
  }
  else
  {
    SvtDbInterface::raiseError("Version ID " + std::to_string(versionId) +
                               " not found when retrieving base version");
  }

  SvtDbInterface::finishQuery(rows);
  return baseVersion;
}

//========================================================================+
int SvtDbInterface::getMostRecentVersionId()
{
  string queryString =
      "SELECT MAX(ID) FROM " + DatabaseInterface::getDbSchema() + ".\"Version\"";

  rows_t rows;
  doGenericQuery(queryString, rows);
  int maxVersionId = -1;

  if (!rows.empty())
  {
    maxVersionId = rows.at(0).at(0).get<int>();
  }
  else
  {
    raiseError("Max version ID returned nothing");
  }

  finishQuery(rows);
  return maxVersionId;
}

//========================================================================+
size_t SvtDbInterface::getAllVersions(
    std::vector<SvtDbInterface::dbVersion> &versions)
{
  versions.clear();
  SimpleQuery query;

  query.setTableName("Version");

  query.addColumn("id");
  query.addColumn("name");
  query.addColumn("baseVersion");
  query.addColumn("note");

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
      version.note = row.at(3).get<std::string>();
    }
    else
    {
      version.note = "Empty";
    }
    versions.push_back(version);
  }
  finishQuery(rows);

  return versions.size();
}

//========================================================================+
size_t SvtDbInterface::getMaxId(const std::string &tableName)
{
  std::string queryString = "SELECT MAX(ID) FROM " + addSchema(formatStr(tableName));

  rows_t rows;
  doGenericQuery(queryString, rows);
  int maxId = -1;

  if (!rows.empty() && !rows.at(0).empty())
  {
    const auto &row = rows.at(0).at(0);
    if (!row.is_null())
    {
      maxId = row.get<int>();
    }
    else
    {
      maxId = 0;
    }
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

  query.setTableName(tableName);
  query.addWhereEquals("id", id);
  // string queryString = "SELECT 1 FROM " + full_tableName;

  rows_t rows;
  query.doQuery(rows);
  return !rows.empty();
}
