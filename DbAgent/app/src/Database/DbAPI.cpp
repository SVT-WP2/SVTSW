/*!
 * @file dbapi.cpp
 * @author Y. Corrales <ycmorales@bnl.gov>
 * @date Mar 2024
 * @brief dbapi implementation
 */

#include <chrono>
#include <string_view>

#include "Database/DbInterface.h"
#include "SvtLogger.h"
#include "SvtUtilities.h"

#include "Database/DbAPI.h"

using std::string;
using std::vector;
using SvtUtils::Singleton;
using DatabaseIF = Singleton<database::DbInterface>;

std::atomic<int> queryTime;
std::atomic<int> queryCount;
std::atomic<int> queryTrialCount;

namespace
{
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

}  // namespace

namespace database
{
  namespace dbapi
  {
    namespace helper
    {
      /*!
       * helper functions
       */

      //! helper function quote string
      //========================================================================+
      std::string formatStr(const std::string_view &str) { return "\"" + std::string(str) + "\""; }

      //! helper function prepend schema name
      //========================================================================+
      std::string addSchema(const std::string &str)
      {
        return DbInterface::getDbSchema() + "." + str;
      }
    }  // namespace helper

    /*!
     * Interfacing with MAPI
     */
    //========================================================================+
    void doGenericQuery(const string &queryString, rows_t &rows)
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
        raiseError(errorMessage);
        rows.clear();
      }
    }

    //========================================================================+
    bool doGenericUpdate(const string &insertString)
    {
      bool successful;
      string errorMessage;

      successful =
          DatabaseIF::instance()->executeUpdate(insertString, errorMessage);

      if (!successful)
      {
        raiseError(errorMessage);
      }

      return successful;
    }

    //========================================================================+
    void commitUpdate() { DatabaseIF::instance()->commitUpdate(true); }

    //========================================================================+
    void rollbackUpdate() { DatabaseIF::instance()->commitUpdate(false); }

    //========================================================================+
    void raiseError(const string &errorMessage)
    {
      THROW_RUNTIME_ERROR(errorMessage);
    }

    //========================================================================+
    void finishQuery(rows_t rows)
    {
      DatabaseIF::instance()->clearQueryResult(rows);
    }

    //========================================================================+
    void GenericQuery::addWhereEquals(const std::string_view &columnName,
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
    void GenericQuery::addWhereIn(const std::string_view &columnName, vector<int> values)
    {
      if (values.size() == 0)
        return;
      string clause = std::string(columnName) + " IN (";
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
    void SimpleQuery::doQuery(rows_t &rows, const std::string &query)
    {
      string queryString = query;
      if (queryString.empty())
      {
        queryString += "SELECT " + stringJoin(mColumnNames, ", ");
        queryString += " FROM " + helper::addSchema(mTableName);
      }

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
    bool SimpleInsert::doInsert()
    {
      string insertString = "";
      insertString += "INSERT INTO " + helper::addSchema(mTableName);
      insertString += " (" + stringJoin(mColumnNames, ", ") + ")";
      insertString += " VALUES(" + stringJoin(mValues, ", ") + ")";

      return doGenericUpdate(insertString);
    }

    //========================================================================+
    void SimpleInsert::addColumnAndValue(const std::string_view &columnName,
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
      queryString += "UPDATE " + helper::addSchema(mTableName);
      queryString += " SET " + stringJoin(mColumnNamesAndValues, ", ");
      if (!mWhereClauses.empty())
      {
        queryString += " WHERE " + stringJoin(mWhereClauses, " AND ");
      }
      return doGenericUpdate(queryString);
    }

    //========================================================================+
    void SimpleUpdate::addColumnAndValue(const std::string_view &columnName,
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

    /*!
     * Versioning
     */

    //========================================================================+
    void VersionedQuery::doQuery(rows_t &rows, const string &)
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
      queryString += " FROM " + helper::addSchema(mTableName);
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
      int rowCount = rows.values.at(0).at(0).get<int>();
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
      queryString += " FROM " + helper::addSchema(helper::formatStr("Version"));
      queryString += " WHERE id=" + std::to_string(versionId);

      rows_t rows;
      doGenericQuery(queryString, rows);
      int baseVersion = -1;

      if (!rows.values.empty())
      {
        baseVersion = rows.values.at(0).at(0).get<int>();
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
          "SELECT MAX(ID) FROM " + helper::addSchema(helper::formatStr("Version"));

      rows_t rows;
      doGenericQuery(queryString, rows);
      int maxVersionId = -1;

      if (!rows.values.empty())
      {
        maxVersionId = rows.values.at(0).at(0).get<int>();
      }
      else
      {
        raiseError("Max version ID returned nothing");
      }

      finishQuery(rows);
      return maxVersionId;
    }

    //========================================================================+
    size_t getAllVersions(
        std::vector<dbVersion> &versions)
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

      for (const auto &rowValues : rows.values)
      {
        dbVersion version;
        version.id = rowValues.at(0).get<int>();
        if ((rowValues.size() > 1) && (rowValues.at(1) != NULL))
        {
          version.name = rowValues.at(1).get<std::string>();
        }
        else
        {
          version.name = std::string("NONAME_ID" + std::to_string(version.id));
        }
        if ((rowValues.size() > 2) && (rowValues.at(2) != NULL))
        {
          version.baseVersion = rowValues.at(2).get<int>();
        }
        else
        {
          version.baseVersion = -1;
        }
        if ((rowValues.size() > 3) && (rowValues.at(3) != NULL))
        {
          version.note = rowValues.at(3).get<std::string>();
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
    size_t getMaxId(const std::string &tableName)
    {
      std::string queryString = "SELECT MAX(ID) FROM " + helper::addSchema(helper::formatStr(tableName));

      rows_t rows;
      doGenericQuery(queryString, rows);
      int maxId = -1;

      if (!rows.values.empty() && !rows.values.at(0).empty())
      {
        const auto &data_field = rows.values.at(0).at(0);
        if (!data_field.is_null())
        {
          maxId = data_field.get<int>();
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
    bool checkIdExist(const std::string &tableName, int id)
    {
      SimpleQuery query;

      query.setTableName(tableName);
      query.addWhereEquals("id", id);
      // string queryString = "SELECT 1 FROM " + full_tableName;

      rows_t rows;
      query.doQuery(rows);
      return !rows.values.empty();
    }
  }  // namespace dbapi
}  // namespace database
