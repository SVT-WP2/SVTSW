#pragma once

#include <mutex>
#include <string>

#include <nlohmann/json.hpp>
#include <pqxx/pqxx>

using rowValues_t = std::vector<nlohmann::basic_json<>>;
using colName_t = std::vector<std::string>;

using rows_t = struct rows_t
{
  std::vector<rowValues_t> values;
  colName_t colNames;

  void clear()
  {
    colName_t().swap(colNames);

    for (auto &_rowValues : values)
    {
      rowValues_t().swap(_rowValues);
    }
    std::vector<rowValues_t>().swap(values);
  }

  bool checkRows()
  {
    for (const auto &_rowValues : values)
    {
      if (_rowValues.size() != colNames.size())
        return false;
    }
    return true;
  }
};

class DatabaseInterface
{
 public:
  DatabaseInterface() = default;
  ~DatabaseInterface();

  bool Init(const std::string &user, const std::string &password,
            const std::string &host,
            const std::string &port, const std::string &dbName, const std::string &dbSchema);
  bool connect();

  bool isConnected();
  bool isConnected(std::string &message);

  bool isInitialized() { return mInitialized; }

  void executeQuery(const std::string &query, bool &status,
                    std::string &message, rows_t &rows);
  void executeQuery(const std::string &query, bool &status, rows_t &rows);
  void executeQuery(const std::string &query, rows_t &rows);

  void clearQueryResult(rows_t &result);

  bool executeUpdate(const std::string &update, std::string &message);
  bool executeUpdate(const std::string &update);

  bool commitUpdate(bool commit = true);
  std::recursive_mutex *getMutex() { return &mMutex; };

  static const std::string &getDbSchema() { return mDbSchema; }

 private:
  std::string mUser, mPassword, mHost, mPort, mDbName;
  static std::string mDbSchema;

  bool mInitialized = false;

  pqxx::connection *mDBConnection;
  pqxx::nontransaction *mDBWork;

  bool reconnect();
  bool close();

  std::recursive_mutex mMutex;
};
