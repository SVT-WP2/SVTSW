#include "Database/databaseinterface.h"
#include "SVTUtilities/SvtLogger.h"

#include <cstdio>
#include <cstring>
#include <iostream>
#include <stdexcept>
#include <vector>

DatabaseInterface *DatabaseInterface::instance = nullptr;
bool DatabaseInterface::mUnavailable = false;
std::recursive_mutex DatabaseInterface::mMutex;

DatabaseInterface::DatabaseInterface(const string &user, const string &password,
                                     const string &connString,
                                     const string &host, const string &port)
{
  if (DatabaseInterface::instance == nullptr)
  {
    this->mUser = user;
    this->mPassword = password;
    this->mConnString = connString;
    this->mHost = host;
    this->mPort = port;

    this->mDBConnection = nullptr;
    this->mDBWork = nullptr;

    DatabaseInterface::instance = this;
  }
  else
  {
    throw runtime_error(
        "Multiple instances of DatabaseInterface are not allowed!");
  }
}

DatabaseInterface::~DatabaseInterface()
{
  this->close();
  DatabaseInterface::instance = nullptr;
}

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
      std::cout << "Disconnected from the database" << std::endl;
    }
    catch (pqxx::sql_error const &e)
    {
      SvtLogger::getInstance().logError(std::string("SQL error: ") + e.what());
      SvtLogger::getInstance().logError(std::string("Query was: ") + e.query());
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
    std::string connstring = "host=" + this->mHost + " port=" + this->mPort +
                             " dbname=" + this->mConnString +
                             " user=" + this->mUser +
                             " password=" + this->mPassword;

    mDBConnection = new pqxx::connection(connstring);
    mDBWork = new pqxx::work(*mDBConnection);
  }
  catch (pqxx::sql_error const &e)
  {
    SvtLogger::getInstance().logError(std::string("SQL error: ") + e.what());
    SvtLogger::getInstance().logError(std::string("Query was: ") + e.query());

    DatabaseInterface::instance = nullptr;

    return false;
  }
  catch (std::exception const &e)
  {
    SvtLogger::getInstance().logError(std::string("Error: ") + e.what());

    DatabaseInterface::instance = nullptr;

    return false;
  }

  return isConnected();
}

bool DatabaseInterface::reconnect()
{
  std::string errMessage;
  SvtLogger::getInstance().logInfo(
      "DatabaseInterface::reconnect: trying to reconnect");

  if (!DatabaseInterface::instance)
  {
    SvtLogger::getInstance().logError(
        "DatabaseInterface::reconnect: myInstance = nullptr");
    return false;
  }

  if (!this->mDBConnection)
  {
    SvtLogger::getInstance().logError(
        "DatabaseInterface::reconnect: mDBConnection = nullptr");
    return false;
  }

  if (mDBConnection->is_open())
  {
    SvtLogger::getInstance().logInfo(
        "DatabaseInterface::reconnect: trying to terminate connection");
    this->close();
  }
  try
  {
    SvtLogger::getInstance().logInfo(
        "DatabaseInterface::reconnect: trying to create connection");
    this->connect();
  }
  catch (pqxx::sql_error const &e)
  {
    SvtLogger::getInstance().logError(std::string("SQL error: ") + e.what());
    SvtLogger::getInstance().logError(std::string("Query was: ") + e.query());
    DatabaseInterface::instance->close();
    return false;
  }

  SvtLogger::getInstance().logInfo(
      "DatabaseInterface::reconnect: connect done");
  return (DatabaseInterface::instance->mDBConnection != nullptr &&
          DatabaseInterface::instance->mDBWork != nullptr);
}

bool DatabaseInterface::isConnected()
{
  string message;
  return DatabaseInterface::isConnected(message);
}

bool DatabaseInterface::isConnected(string &message)
{
  message = "";

  if (!DatabaseInterface::instance)
  {
    message = "database instance is null";
    return false;
  }

  if (!DatabaseInterface::instance->mDBConnection)
  {
    message = "database connection not available";
    return false;
  }

  return DatabaseInterface::instance->mDBConnection->is_open();
}

//========================================================================+
void DatabaseInterface::executeQuery(const string &query, bool &status,
                                     string &message,
                                     vector<vector<MultiBase *>> &rows)
{
  status = DatabaseInterface::isConnected(message);

  if (!status)
  {
    clearQueryResult(rows);
    return;
  }
  try
  {
    // check connection was opened
    if (!DatabaseInterface::instance)
      throw runtime_error(
          "DatabaseInterface is uninitialized! You either forgotten to call "
          "DatabaseInterface.connect() function or ignored its result.");

    lock_guard<recursive_mutex> dbLock(DatabaseInterface::instance->mMutex);

    if (!DatabaseInterface::isConnected(message))
    {
      std::cout << "Database timeout reached, trying to reconnect!"
                << std::endl;
      if (!DatabaseInterface::instance->reconnect())
      {
        DatabaseInterface::instance->close();
      }
    }

    //! prepare statement
    DatabaseInterface::instance->mDBConnection->prepare("query", query);
    pqxx::prepped prepare_name{"query"};
    pqxx::result res{DatabaseInterface::instance->mDBWork->exec(prepare_name)};
    for (const auto &row : res)
    {
      vector<MultiBase *> rowResult;
      for (uint8_t i{0}; i < row.size(); ++i)
      {
        const auto &data_field = row[1];
        if (data_field.is_null())
        {
          rowResult.push_back(nullptr);
          continue;
        }
        switch (data_field.type())
        {
        case 16:  // bool
        case 20:  // int8
        case 21:  // int2
        case 23:  // integer
          rowResult.push_back(new MultiType<int>(data_field.as<int>()));
          break;
        case 700:  // float4
        case 701:  // float8
          rowResult.push_back(new MultiType<double>(data_field.as<double>()));
          break;
        default:
          rowResult.push_back(
              new MultiType<std::string>(data_field.as<std::string>()));
          break;
        }
      }
      rows.push_back(rowResult);
    }
    return;
  }
  catch (pqxx::sql_error const &e)
  {
    std::cerr << "SQL error: " << e.what() << std::endl;
    std::cerr << "Query was: " << e.query() << std::endl;
  }
  clearQueryResult(rows);

  return;
}

//========================================================================+
void DatabaseInterface::executeQuery(const string &query, bool &status,
                                     vector<vector<MultiBase *>> &rows)
{
  string message;
  DatabaseInterface::executeQuery(query, status, message, rows);
}

//========================================================================+
void DatabaseInterface::executeQuery(const string &query,
                                     vector<vector<MultiBase *>> &rows)
{
  string message;
  bool status;
  DatabaseInterface::executeQuery(query, status, message, rows);
}

//========================================================================+
void DatabaseInterface::clearQueryResult(vector<vector<MultiBase *>> &result)
{
  for (auto &row : result)
  {
    for (auto &cell : row)
    {
      delete cell;
    }
  }
  result.clear();
}

//========================================================================+
bool DatabaseInterface::executeUpdate(const string &update, string &message)
{
  bool status;
  vector<vector<MultiBase *>> rows;
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
  if (!DatabaseInterface::instance)
    throw runtime_error(
        "DatabaseInterface is uninitialized! You either forgotten to call "
        "DatabaseInterface.connect() function or ignored its result.");

  lock_guard<recursive_mutex> dbLock(DatabaseInterface::instance->mMutex);

  if (!DatabaseInterface::isConnected())
  {
    return false;
  }

  if (DatabaseInterface::instance->mDBWork)
  {
    if (commit)
    {
      DatabaseInterface::instance->mDBWork->commit();
    }
    else
    {
      DatabaseInterface::instance->mDBWork->abort();
    }
  }
  else
  {
    std::cout << "ERROR: null connection work." << std::endl;
    return false;
  }
  return true;
}
