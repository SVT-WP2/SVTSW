#ifndef SQLMAPI_H
#define SQLMAPI_H

#include "Database/multitype.h"

#include <atomic>
#include <cstdlib>
#include <string>
#include <vector>

using namespace std;

extern std::atomic<int> queryTime;
extern std::atomic<int> queryCount;
extern std::atomic<int> queryTrialCount;

/**************************************************************
Function signatures
**************************************************************/
// wrapper code for interfacing with mapi
void doGenericQuery(string queryString, vector<vector<MultiBase *>> &rows);
void raiseError(string errorMessage);
void finishQuery(vector<vector<MultiBase *>> rows);

class SimpleQuery
{
 public:
  void setTableName(string tableName) { mTableName = tableName; }
  void addColumn(string columnName) { mColumnNames.push_back(columnName); }
  void addWhereClause(string whereClause)
  {
    mWhereClauses.push_back(whereClause);
  }
  void doQuery(vector<vector<MultiBase *>> &rows);

  // overload addWhereEquals for different types
  void addWhereEquals(string columnName, string value)
  {
    mWhereClauses.push_back(columnName + " = '" + value + "'");
  }
  void addWhereEquals(string columnName, int value)
  {
    mWhereClauses.push_back(columnName + " = " + to_string(value));
  }
  void addWhereEquals(string columnName, float value)
  {
    mWhereClauses.push_back(columnName + " = " + to_string(value));
  }
  void addWhereIn(string columnName, vector<int> values);

 protected:
  string mTableName;
  vector<string> mColumnNames;
  vector<string> mWhereClauses;
};

bool doGenericUpdate(string insertString);
void commitUpdate();
void rollbackUpdate();

class SimpleInsert
{
 public:
  void setTableName(string tableName) { mTableName = tableName; }
  bool doInsert();

  // overload addColumnAndValue for different types
  // modify each as needed
  void addColumnAndValue(string columnName, string value)
  {
    mColumnNames.push_back(columnName);
    // strings have to have '' around the value
    mValues.push_back("'" + value + "'");
  }
  void addColumnAndValue(string columnName, int value)
  {
    mColumnNames.push_back(columnName);
    mValues.push_back(to_string(value));
  }
  void addColumnAndValue(string columnName, float value)
  {
    mColumnNames.push_back(columnName);
    mValues.push_back(to_string(value));
  }

 protected:
  string mTableName;
  vector<string> mColumnNames;
  vector<string> mValues;
};

class SimpleUpdate
{
 public:
  void setTableName(string tableName) { mTableName = tableName; }
  bool doUpdate();

  // overload addColumnAndValue for different types
  // modify each as needed
  void addColumnAndValue(string columnName, string value)
  {
    // strings have to have '' around the value
    mColumnNamesAndValues.push_back(columnName + " = '" + value + "'");
  }
  void addColumnAndValue(string columnName, int value)
  {
    mColumnNamesAndValues.push_back(columnName + " = " + to_string(value));
  }
  void addColumnAndValue(string columnName, float value)
  {
    mColumnNamesAndValues.push_back(columnName + " = " + to_string(value));
  }

  // overload addWhereEquals for different types
  void addWhereEquals(string columnName, string value)
  {
    mWhereClauses.push_back(columnName + " = '" + value + "'");
  }
  void addWhereEquals(string columnName, int value)
  {
    mWhereClauses.push_back(columnName + " = " + to_string(value));
  }
  void addWhereEquals(string columnName, float value)
  {
    mWhereClauses.push_back(columnName + " = " + to_string(value));
  }

 protected:
  string mTableName;
  vector<string> mColumnNamesAndValues;
  vector<string> mWhereClauses;
};

// functions related to versioning
int getBaseVersion(int versionId);
int getMostRecentVersionId();

class VersionedQuery : public SimpleQuery
{
 public:
  void addPrimaryKey(string primaryKey) { mPrimaryKeys.push_back(primaryKey); }
  void setVersionId(int versionId) { mVersionId = versionId; }
  void doQuery(vector<vector<MultiBase *>> &rows);

 protected:
  vector<string> mPrimaryKeys;
  int mVersionId;

  string getPkString()
  {
    string pkString = "";

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
  void addColumnAndValue(string columnName, string value)
  {
    // strings have to have '' around the value
    SimpleInsert::addColumnAndValue(columnName, value);
    mQuery.addWhereEquals(columnName, value);
  }
  void addColumnAndValue(string columnName, int value)
  {
    SimpleInsert::addColumnAndValue(columnName, value);
    mQuery.addWhereEquals(columnName, value);
  }
  void addColumnAndValue(string columnName, float value)
  {
    SimpleInsert::addColumnAndValue(columnName, value);
    mQuery.addWhereEquals(columnName, value);
  }

 protected:
  int mVersionId;
  SimpleQuery mQuery;
};

#endif
