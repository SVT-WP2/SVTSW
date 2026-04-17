#pragma once

/*!
 * @file DbAPI.h
 * @author Y. Corrales <ycmorales@bnl.gov>
 * @date Mar 2024
 * @brief Database api functions
 */

#include <atomic>
#include <cstddef>
#include <string>
#include <string_view>
#include <vector>

#include "DbInterface.h"

extern std::atomic<int> queryTime;
extern std::atomic<int> queryCount;
extern std::atomic<int> queryTrialCount;

namespace database
{
  namespace dbapi
  {
    namespace helper
    {
      /**************************************************************
      Function signatures
      **************************************************************/
      // wrapper code for interfacing with mapi
      std::string formatStr(const std::string_view &str);
      std::string addSchema(const std::string &str);

    }  // namespace helper

    void doGenericQuery(const std::string &queryString, rows_t &rows);
    bool doGenericUpdate(const std::string &insertString);
    void commitUpdate();
    void rollbackUpdate();
    void raiseError(const std::string &errorMessage);
    void finishQuery(rows_t rows);

    class GenericQuery
    {
     public:
      void setTableName(const std::string_view &tableName)
      {
        mTableName = helper::formatStr(tableName);
      }
      void addColumn(const std::string_view &columnName)
      {
        mColumnNames.push_back(helper::formatStr(columnName));
      }
      void addWhereClause(const std::string &whereClause)
      {
        mWhereClauses.push_back(whereClause);
      }

      // overload addWhereEquals for different types
      void addWhereEquals(const std::string_view &columnName,
                          const nlohmann::basic_json<> &value);
      void addWhereEquals(const std::string_view &columnName, const std::string &value)
      {
        mWhereClauses.push_back(helper::formatStr(columnName) + " = '" + value + "'");
      }
      void addWhereEquals(const std::string_view &columnName, int value)
      {
        mWhereClauses.push_back(helper::formatStr(columnName) + " = " +
                                std::to_string(value));
      }
      void addWhereEquals(const std::string_view &columnName, float value)
      {
        mWhereClauses.push_back(helper::formatStr(columnName) + " = " +
                                std::to_string(value));
      }

      void addWhereIn(const std::string_view &columnName, std::vector<int> values);

     protected:
      std::string mTableName;
      std::vector<std::string> mColumnNames;
      std::vector<std::string> mWhereClauses;
    };

    class SimpleQuery : public GenericQuery
    {
     public:
      virtual void doQuery(rows_t &rows, const std::string &query = "");

      void setOrderById(const std::string_view &orderBy, const bool dec = false)
      {
        mOrderBy = orderBy;
        mOrderDec = dec;
      }

     protected:
      std::string mOrderBy;
      bool mOrderDec = false;
    };

    class SimpleInsert : public GenericQuery
    {
     public:
      bool doInsert();

      // overload addColumnAndValue for different types
      // modify each as needed
      void addColumnAndValue(const std::string_view &columnName,
                             const nlohmann::basic_json<> &value);
      void addColumnAndValue(const std::string_view &columnName, std::string value)
      {
        mColumnNames.push_back(helper::formatStr(columnName));
        // strings have to have '' around the value
        mValues.push_back("'" + value + "'");
      }
      void addColumnAndValue(const std::string_view &columnName, int value)
      {
        mColumnNames.push_back(helper::formatStr(columnName));
        mValues.push_back(std::to_string(value));
      }
      void addColumnAndValue(const std::string_view &columnName, float value)
      {
        mColumnNames.push_back(helper::formatStr(columnName));
        mValues.push_back(std::to_string(value));
      }

     protected:
      std::vector<std::string> mValues;
    };

    class SimpleUpdate : public SimpleInsert
    {
     public:
      bool doUpdate();

      // overload addColumnAndValue for different types
      // modify each as needed
      void addColumnAndValue(const std::string_view &columnName,
                             const nlohmann::basic_json<> &value);
      void addColumnAndValue(const std::string_view &columnName, std::string value)
      {
        if (value == "NULL")
        {
          // strings have to have '' around the value
          mColumnNamesAndValues.push_back(helper::formatStr(columnName) + " = " + value);
        }
        else
        {
          // strings have to have '' around the value
          mColumnNamesAndValues.push_back(helper::formatStr(columnName) + " = '" + value +
                                          "'");
        }
      }
      void addColumnAndValue(const std::string_view &columnName, int value)
      {
        mColumnNamesAndValues.push_back(helper::formatStr(columnName) + " = " +
                                        std::to_string(value));
      }
      void addColumnAndValue(const std::string_view &columnName, float value)
      {
        mColumnNamesAndValues.push_back(helper::formatStr(columnName) + " = " +
                                        std::to_string(value));
      }

     protected:
      std::vector<std::string> mColumnNamesAndValues;
    };

    class VersionedQuery : public SimpleQuery
    {
     public:
      void addPrimaryKey(std::string primaryKey)
      {
        mPrimaryKeys.push_back(primaryKey);
      }
      void setVersionId(int versionId) { mVersionId = versionId; }
      void doQuery(rows_t &rows, const std::string &);

     protected:
      std::vector<std::string> mPrimaryKeys;
      int mVersionId;

      std::string getPkString()
      {
        std::string pkString = "";

        for (auto it = mPrimaryKeys.begin(); it != mPrimaryKeys.end(); ++it)
        {
          pkString += "T1." + *it + " = T2." + *it;
          if (it != mPrimaryKeys.end() - 1)
          {
            pkString += " AND ";
          }
        }

        return pkString;
      }
    };

    class VersionedInsert : public SimpleInsert
    {
     public:
      void setVersionId(int versionId)
      {
        mVersionId = versionId;
        SimpleInsert::addColumnAndValue("VERSION_ID", versionId);
      }
      bool doInsert();

      // addColumnAndValue also needs to add WHERE clauses to the query
      // if I was better at C++, I'd know how to collapse these into a single
      // function
      void addColumnAndValue(std::string columnName, std::string value)
      {
        // strings have to have '' around the value
        SimpleInsert::addColumnAndValue(helper::formatStr(columnName), value);
        mQuery.addWhereEquals(helper::formatStr(columnName), value);
      }
      void addColumnAndValue(std::string columnName, int value)
      {
        SimpleInsert::addColumnAndValue(helper::formatStr(columnName), value);
        mQuery.addWhereEquals(helper::formatStr(columnName), value);
      }
      void addColumnAndValue(std::string columnName, float value)
      {
        SimpleInsert::addColumnAndValue(helper::formatStr(columnName), value);
        mQuery.addWhereEquals(helper::formatStr(columnName), value);
      }

     protected:
      int mVersionId;
      SimpleQuery mQuery;
    };

    //!
    //! Structure type definitions
    //!

    //! Version
    using dbVersion = struct dbVersion_s
    {
      int id;
      int baseVersion;
      std::string name;
      std::string note;
    };

    // functions related to versioning
    int getBaseVersion(int versionId);
    int getMostRecentVersionId();
    size_t getAllVersions(std::vector<dbVersion> &versions);

    size_t getMaxId(const std::string &tableName);
    bool checkIdExist(const std::string &tableName, int id);

  }  // namespace dbapi
}  // namespace database
