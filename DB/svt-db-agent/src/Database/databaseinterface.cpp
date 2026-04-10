/*!
 * @file databaseinterface.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief database interface
 */

#include <cstring>
#include <iostream>
#include <string>

#include "Database/DatabaseInterface.h"
#include "SvtLogger.h"

using std::string;
using std::vector;

//========================================================================+
bool DatabaseInterface::Init(const string &user, const string &password,
                             const string &host,
                             const string &port, const string &dbName, const string &dbSchema)
{
  mUser = user;
  mPassword = password;
  mHost = host;
  mPort = port;
  mDbName = dbName;
  mDbSchema = dbSchema;

  mDBConnection = nullptr;
  mDBWork = nullptr;

  // {
  //   throw runtime_error(
  //       "Multiple instances of DatabaseInterface are not allowed!");
  // }
  return true;
}

DatabaseInterface::~DatabaseInterface() { this->close(); }

bool DatabaseInterface::close()
{
  if (mDBWork)
  {
    delete mDBWork;
    mDBWork = nullptr;
  }
  if (mDBConnection)
  {
    try
    {
      mDBConnection->close();
      logInfo("Disconnected from the database");
    }
    catch (pqxx::sql_error const &e)
    {
      logError(std::string("DB::close SQL error: ") + e.what());
    }
  }

  delete mDBConnection;
  mDBConnection = nullptr;

  return true;
}

bool DatabaseInterface::connect()
{
  try
  {
    std::string connString = "host=" + this->mHost + " port=" + this->mPort +
                             " dbname=" + this->mDbName +
                             " user=" + this->mUser +
                             " password=" + this->mPassword;

    mDBConnection = new pqxx::connection(connString);
    mDBWork = new pqxx::nontransaction(*mDBConnection);
  }
  catch (pqxx::sql_error const &e)
  {
    logError(std::string("DB::connect SQL error: ") + e.what());

    close();

    return false;
  }
  catch (std::exception const &e)
  {
    logError(std::string("DB::connect Error: ") +
             e.what());
    close();

    return false;
  }

  return isConnected();
}

bool DatabaseInterface::reconnect()
{
  std::string errMessage;
  logWarning("DatabaseInterface::reconnect: trying to reconnect");

  // if (!DatabaseInterface::instance)
  // {
  //   logError("DatabaseInterface::reconnect: myInstance = nullptr");
  //   return false;
  // }

  if (!this->mDBConnection)
  {
    logError("DatabaseInterface::reconnect: mDBConnection = nullptr");
    return false;
  }

  if (mDBConnection->is_open())
  {
    logWarning(
        "DatabaseInterface::reconnect: trying to terminate connection");
    this->close();
  }
  try
  {
    logWarning(
        "DatabaseInterface::reconnect: trying to create connection");
    this->connect();
  }
  catch (pqxx::sql_error const &e)
  {
    logError(std::string("DB::reconnect SQL error: ") + e.what());
    close();
    return false;
  }

  logWarning("DatabaseInterface::reconnect: connect done");
  return (mDBConnection != nullptr && mDBWork != nullptr);
}

bool DatabaseInterface::isConnected()
{
  string message;
  return isConnected(message);
}

bool DatabaseInterface::isConnected(string &message)
{
  message = "";

  // if (!DatabaseInterface::instance)
  // {
  //   message = "database instance is null";
  //   return false;
  // }

  if (!mDBConnection)
  {
    message = "database connection not available";
    return false;
  }

  return mDBConnection->is_open();
}

//========================================================================+
void DatabaseInterface::executeQuery(const string &query, bool &status,
                                     string &message, rows_t &rows)
{
  status = DatabaseInterface::isConnected(message);
  std::string query_name("query_name");

  if (!status)
  {
    clearQueryResult(rows);
    return;
  }
  try
  {
    // check connection was opened
    // if (!DatabaseInterface::instance)
    //   throw runtime_error(
    //       "DatabaseInterface is uninitialized! You either forgotten to call "
    //       "DatabaseInterface.connect() function or ignored its result.");

    std::lock_guard<std::recursive_mutex> dbLock(mMutex);

    if (!isConnected(message))
    {
      logError("DB::executeQuery Error: Database timeout reached, trying to reconnect!");

      if (!reconnect())
      {
        close();
      }
    }

    //! prepare statement
    // logInfo(query);
    mDBConnection->prepare(query_name, query);
    pqxx::prepped prepare_name{query_name};
    pqxx::result res{mDBWork->exec(prepare_name)};

    if (!res.empty())
    {
      for (const auto &data_field : res.front())
      {
        rows.colNames.push_back(data_field.name());
      }
      for (const auto &row : res)
      {
        rowValues_t rowValues;
        for (const auto &data_field : row)
        {
          if (data_field.is_null())
          {
            rowValues.push_back(nullptr);
            continue;
          }

          switch (data_field.type())
          {
          case 16:  // bool
            rowValues.push_back(data_field.as<bool>());
            break;
          case 20:  // int8
          case 21:  // int2
          case 23:  // integer
            rowValues.push_back(data_field.as<int>());
            break;
          case 700:  // float4
          case 701:  // float8
            rowValues.push_back(data_field.as<double>());
            break;
          default:
            rowValues.push_back(data_field.as<std::string>());
            break;
          }
        }
        rows.values.push_back(rowValues);
      }
    }
    if (!rows.checkRows())
    {
      THROW_RUNTIME_ERROR("DB::executeQuery Check rows size failed.");
    }
    // remove query statement
    mDBWork->exec("DEALLOCATE PREPARE " + query_name);
    return;
  }
  catch (pqxx::sql_error const &e)
  {
    // clear prepare
    message = std::string("SQL error: ") + e.what() +
              std::string("Query was: ") + std::string(e.query()) +
              std::string(" with statement: ") + query;
    logError(message);
    message = e.what();

    mDBWork->exec("DEALLOCATE PREPARE " + query_name);
    status = false;
  }
  catch (const std::exception &e)
  {
    message = e.what();
    mDBWork->exec("DEALLOCATE PREPARE " + query_name);
    status = false;
  }
  clearQueryResult(rows);

  return;
}

//========================================================================+
void DatabaseInterface::executeQuery(const string &query, bool &status,
                                     rows_t &rows)
{
  string message;
  DatabaseInterface::executeQuery(query, status, message, rows);
}

//========================================================================+
void DatabaseInterface::executeQuery(const string &query, rows_t &rows)
{
  string message;
  bool status;
  DatabaseInterface::executeQuery(query, status, message, rows);
}

//========================================================================+
void DatabaseInterface::clearQueryResult(rows_t &result)
{
  result.clear();
}

//========================================================================+
bool DatabaseInterface::executeUpdate(const string &update, string &message)
{
  bool status;
  rows_t rows;
  executeQuery(update, status, message, rows);
  clearQueryResult(rows);

  return status;
}

bool DatabaseInterface::executeUpdate(const string &update)
{
  string message;
  return DatabaseInterface::executeUpdate(update, message);
}

//========================================================================+
bool DatabaseInterface::commitUpdate(bool commit)
{
  // if (!DatabaseInterface::instance)
  //   throw runtime_error(
  //       "DatabaseInterface is uninitialized! You either forgotten to call "
  //       "DatabaseInterface.connect() function or ignored its result.");

  std::lock_guard<std::recursive_mutex> dbLock(mMutex);

  if (!isConnected())
  {
    return false;
  }

  if (mDBWork)
  {
    if (commit)
    {
      mDBWork->exec("commit;");
    }
    else
    {
      mDBWork->abort();
    }
  }
  else
  {
    std::cout << "ERROR: null connection work." << std::endl;
    return false;
  }
  return true;
}
