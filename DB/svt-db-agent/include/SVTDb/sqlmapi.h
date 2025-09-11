#ifndef SQLMAPI_H
#define SQLMAPI_H

#include "Database/databaseinterface.h"
#include "nlohmann/json.hpp"

extern std::atomic<int> queryTime;
extern std::atomic<int> queryCount;
extern std::atomic<int> queryTrialCount;

/**************************************************************
Function signatures
**************************************************************/
// wrapper code for interfacing with mapi
std::string formatStr(const std::string &str);
void doGenericQuery(std::string queryString, rows_t &rows);
void raiseError(std::string errorMessage);
void finishQuery(rows_t rows);

class SimpleQuery
{
 public:
  void setTableName(std::string tableName)
  {
    mTableName = formatStr(tableName);
  }
  void addColumn(std::string columnName)
  {
    mColumnNames.push_back(formatStr(columnName));
  }
  void addWhereClause(std::string whereClause)
  {
    mWhereClauses.push_back(whereClause);
  }
  void doQuery(rows_t &rows);

  // overload addWhereEquals for different types
  void addWhereEquals(std::string columnName,
                      const nlohmann::basic_json<> &value);
  void addWhereEquals(std::string columnName, std::string value)
  {
    mWhereClauses.push_back(formatStr(columnName) + " = '" + value + "'");
  }
  void addWhereEquals(std::string columnName, int value)
  {
    mWhereClauses.push_back(formatStr(columnName) + " = " +
                            std::to_string(value));
  }
  void addWhereEquals(std::string columnName, float value)
  {
    mWhereClauses.push_back(formatStr(columnName) + " = " +
                            std::to_string(value));
  }
  void addWhereIn(std::string columnName, std::vector<int> values);

  void setOrderById(const bool order) { mOrderById = order; }

 protected:
  std::string mTableName;
  std::vector<std::string> mColumnNames;
  std::vector<std::string> mWhereClauses;
  bool mOrderById = false;
};

bool doGenericUpdate(std::string insertString);
void commitUpdate();
void rollbackUpdate();

class SimpleInsert
{
 public:
  void setTableName(std::string tableName)
  {
    mTableName = formatStr(tableName);
  }
  bool doInsert();

  // overload addColumnAndValue for different types
  // modify each as needed
  void addColumnAndValue(std::string columnName,
                         const nlohmann::basic_json<> &value);
  void addColumnAndValue(std::string columnName, std::string value)
  {
    mColumnNames.push_back(formatStr(columnName));
    // strings have to have '' around the value
    mValues.push_back("'" + value + "'");
  }
  void addColumnAndValue(std::string columnName, int value)
  {
    mColumnNames.push_back(formatStr(columnName));
    mValues.push_back(std::to_string(value));
  }
  void addColumnAndValue(std::string columnName, float value)
  {
    mColumnNames.push_back(formatStr(columnName));
    mValues.push_back(std::to_string(value));
  }

 protected:
  std::string mTableName;
  std::vector<std::string> mColumnNames;
  std::vector<std::string> mValues;
};

class SimpleUpdate
{
 public:
  void setTableName(std::string tableName)
  {
    mTableName = formatStr(tableName);
  }
  bool doUpdate();

  // overload addColumnAndValue for different types
  // modify each as needed
  void addColumnAndValue(std::string columnName,
                         const nlohmann::basic_json<> &value);
  void addColumnAndValue(std::string columnName, std::string value)
  {
    // strings have to have '' around the value
    mColumnNamesAndValues.push_back(formatStr(columnName) + " = '" + value +
                                    "'");
  }
  void addColumnAndValue(std::string columnName, int value)
  {
    mColumnNamesAndValues.push_back(formatStr(columnName) + " = " +
                                    std::to_string(value));
  }
  void addColumnAndValue(std::string columnName, float value)
  {
    mColumnNamesAndValues.push_back(formatStr(columnName) + " = " +
                                    std::to_string(value));
  }

  // overload addWhereEquals for different types
  void addWhereEquals(std::string columnName,
                      const nlohmann::basic_json<> &value);
  void addWhereEquals(std::string columnName, std::string value)
  {
    mWhereClauses.push_back(formatStr(columnName) + " = '" + value + "'");
  }
  void addWhereEquals(std::string columnName, int value)
  {
    mWhereClauses.push_back(formatStr(columnName) + " = " +
                            std::to_string(value));
  }
  void addWhereEquals(std::string columnName, float value)
  {
    mWhereClauses.push_back(formatStr(columnName) + " = " +
                            std::to_string(value));
  }

 protected:
  std::string mTableName;
  std::vector<std::string> mColumnNamesAndValues;
  std::vector<std::string> mWhereClauses;
};

// functions related to versioning
int getBaseVersion(int versionId);
int getMostRecentVersionId();

class VersionedQuery : public SimpleQuery
{
 public:
  void addPrimaryKey(std::string primaryKey)
  {
    mPrimaryKeys.push_back(primaryKey);
  }
  void setVersionId(int versionId) { mVersionId = versionId; }
  void doQuery(rows_t &rows);

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
    SimpleInsert::addColumnAndValue(formatStr(columnName), value);
    mQuery.addWhereEquals(formatStr(columnName), value);
  }
  void addColumnAndValue(std::string columnName, int value)
  {
    SimpleInsert::addColumnAndValue(formatStr(columnName), value);
    mQuery.addWhereEquals(formatStr(columnName), value);
  }
  void addColumnAndValue(std::string columnName, float value)
  {
    SimpleInsert::addColumnAndValue(formatStr(columnName), value);
    mQuery.addWhereEquals(formatStr(columnName), value);
  }

 protected:
  int mVersionId;
  SimpleQuery mQuery;
};

#endif
