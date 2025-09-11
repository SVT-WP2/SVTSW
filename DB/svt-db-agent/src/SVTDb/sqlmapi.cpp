#include "SVTDb/sqlmapi.h"
#include "Database/databaseinterface.h"
#include "SVTUtilities/SvtLogger.h"
#include "nlohmann/json.hpp"

#include <atomic>
#include <stdexcept>
#include <string>

using std::string;
using std::vector;
using SvtDbAgent::Singleton;
using DatabaseIF = SvtDbAgent::Singleton<DatabaseInterface>;

std::atomic<int> queryTime;
std::atomic<int> queryCount;
std::atomic<int> queryTrialCount;

/*!
 * Helper functions
 */

//! helper function quate string
std::string formatStr(const std::string &str) { return "\"" + str + "\""; }
std::string addSchema(const std::string &str)
{
  std::string schema(SvtDbAgent::db_schema);
  return schema + "." + str;
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
void doGenericQuery(string queryString, rows_t &rows)
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
    DatabaseIF::instance().executeQuery(queryString, successful, errorMessage,
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
      connected = DatabaseIF::instance().isConnected();
      if (!connected)
      {
        Singleton<SvtLogger>::instance().logError("reconnect failed");
      }
    }
  }
  if (!successful)
  {
    raiseError(errorMessage);
    rows.clear();
  }
}

//========================================================================+
void raiseError(string errorMessage)
{
  // std::cout << errorMessage << std::endl;
  Singleton<SvtLogger>::instance().logError(errorMessage);
  throw std::runtime_error(errorMessage);
}

//========================================================================+
void finishQuery(rows_t rows) { DatabaseIF::instance().clearQueryResult(rows); }

//========================================================================+
void SimpleQuery::doQuery(rows_t &rows)
{
  string queryString = "";
  queryString += "SELECT " + stringJoin(mColumnNames, ", ");
  queryString += " FROM " + addSchema(mTableName);
  if (!mWhereClauses.empty())
  {
    queryString += " WHERE " + stringJoin(mWhereClauses, " AND ");
  }
  if (mOrderById)
  {
    queryString += " ORDER BY id ";
  }
  return doGenericQuery(queryString, rows);
}

//========================================================================+
void SimpleQuery::addWhereEquals(string columnName,
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
void SimpleQuery::addWhereIn(string columnName, vector<int> values)
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
bool doGenericUpdate(string insertString)
{
  bool successful;
  string errorMessage;

  successful = DatabaseIF::instance().executeUpdate(insertString, errorMessage);

  if (!successful)
  {
    raiseError(errorMessage);
  }

  return successful;
}

//========================================================================+
void commitUpdate() { DatabaseIF::instance().commitUpdate(true); }

//========================================================================+
void rollbackUpdate() { DatabaseIF::instance().commitUpdate(false); }

//========================================================================+
bool SimpleInsert::doInsert()
{
  string insertString = "";
  insertString += "INSERT INTO " + addSchema(mTableName);
  insertString += " (" + stringJoin(mColumnNames, ", ") + ")";
  insertString += " VALUES(" + stringJoin(mValues, ", ") + ")";

  return doGenericUpdate(insertString);
}

//========================================================================+
void SimpleInsert::addColumnAndValue(string columnName,
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
bool SimpleUpdate::doUpdate()
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
void SimpleUpdate::addColumnAndValue(string columnName,
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
void SimpleUpdate::addWhereEquals(string columnName,
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
void VersionedQuery::doQuery(rows_t &rows)
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
bool VersionedInsert::doInsert()
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
int getBaseVersion(int versionId)
{
  string queryString = "SELECT baseVersion";
  queryString += " FROM " + SvtDbAgent::db_schema + ".\"Version\"";
  queryString += " WHERE id=" + std::to_string(versionId);

  rows_t rows;
  doGenericQuery(queryString, rows);
  int baseVersion = -1;

  if (!rows.empty())
  {
    baseVersion = rows.at(0).at(0).get<int>();
  }
  else
  {
    raiseError("Version ID " + std::to_string(versionId) +
               " not found when retrieving base version");
  }

  finishQuery(rows);
  return baseVersion;
}

//========================================================================+
int getMostRecentVersionId()
{
  string queryString =
      "SELECT MAX(ID) FROM " + SvtDbAgent::db_schema + ".\"Version\"";

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
