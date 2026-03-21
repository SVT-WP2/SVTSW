#pragma once

#include <mutex>
#include <string>

#include <nlohmann/json.hpp>
#include <pqxx/pqxx>

using row_t = std::vector<nlohmann::basic_json<>>;
using rows_t = std::vector<row_t>;

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
