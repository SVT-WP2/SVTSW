/*!
 * @file DbInterface.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Apr-2026
 * @brief DbInterface implementation
 */

#include <cstring>
#include <iostream>
#include <string>

#include "SvtLogger.h"

#include "Database/DbInterface.h"

using std::string;
using std::vector;

namespace database
{
  std::string DbInterface::mDbSchema{};
  //========================================================================+
  bool DbInterface::Init(const string &user, const string &password,
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
    //       "Multiple instances of DbInterface are not allowed!");
    // }
    return true;
  }

  //========================================================================+
  DbInterface::~DbInterface() { this->close(); }

  //========================================================================+
  bool DbInterface::close()
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

  //========================================================================+
  bool DbInterface::connect()
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

  //========================================================================+
  bool DbInterface::reconnect()
  {
    std::string errMessage;
    logWarning("DbInterface::reconnect: trying to reconnect");

    // if (!DbInterface::instance)
    // {
    //   logError("DbInterface::reconnect: myInstance = nullptr");
    //   return false;
    // }

    if (!this->mDBConnection)
    {
      logError("DbInterface::reconnect: mDBConnection = nullptr");
      return false;
    }

    if (mDBConnection->is_open())
    {
      logWarning(
          "DbInterface::reconnect: trying to terminate connection");
      this->close();
    }
    try
    {
      logWarning(
          "DbInterface::reconnect: trying to create connection");
      this->connect();
    }
    catch (pqxx::sql_error const &e)
    {
      logError(std::string("DB::reconnect SQL error: ") + e.what());
      close();
      return false;
    }

    logWarning("DbInterface::reconnect: connect done");
    return (mDBConnection != nullptr && mDBWork != nullptr);
  }

  //========================================================================+
  bool DbInterface::isConnected()
  {
    string message;
    return isConnected(message);
  }

  //========================================================================+
  bool DbInterface::isConnected(string &message)
  {
    message = "";

    // if (!DbInterface::instance)
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
  void DbInterface::executeQuery(const string &query, bool &status,
                                 string &message, rows_t &rows)
  {
    status = DbInterface::isConnected(message);
    std::string query_name("query_name");

    if (!status)
    {
      clearQueryResult(rows);
      return;
    }
    try
    {
      // check connection was opened
      // if (!DbInterface::instance)
      //   throw runtime_error(
      //       "DbInterface is uninitialized! You either forgotten to call "
      //       "DbInterface.connect() function or ignored its result.");

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
  void DbInterface::executeQuery(const string &query, bool &status,
                                 rows_t &rows)
  {
    string message;
    DbInterface::executeQuery(query, status, message, rows);
  }

  //========================================================================+
  void DbInterface::executeQuery(const string &query, rows_t &rows)
  {
    string message;
    bool status;
    DbInterface::executeQuery(query, status, message, rows);
  }

  //========================================================================+
  void DbInterface::clearQueryResult(rows_t &result)
  {
    result.clear();
  }

  //========================================================================+
  bool DbInterface::executeUpdate(const string &update, string &message)
  {
    bool status;
    rows_t rows;
    executeQuery(update, status, message, rows);
    clearQueryResult(rows);

    return status;
  }

  //========================================================================+
  bool DbInterface::executeUpdate(const string &update)
  {
    string message;
    return DbInterface::executeUpdate(update, message);
  }

  //========================================================================+
  bool DbInterface::commitUpdate(bool commit)
  {
    // if (!DbInterface::instance)
    //   throw runtime_error(
    //       "DbInterface is uninitialized! You either forgotten to call "
    //       "DbInterface.connect() function or ignored its result.");

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

}  // namespace database
