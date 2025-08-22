#ifndef __DATABASE_INTERFACE__
#define __DATABASE_INTERFACE__

#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include <pqxx/pqxx>

#include <mutex>

using row_t = std::vector<nlohmann::basic_json<>>;
using rows_t = std::vector<row_t>;

class DatabaseInterface
{
 private:
  // static DatabaseInterface *instance;

  std::string mUser, mPassword, mConnString, mHost, mPort;

  pqxx::connection *mDBConnection;
  pqxx::nontransaction *mDBWork;

  bool reconnect();
  bool close();

  SvtLogger &logger = SvtDbAgent::Singleton<SvtLogger>::instance();
  bool mUnavailable;
  std::recursive_mutex mMutex;

 public:
  DatabaseInterface();
  ~DatabaseInterface();

  bool Init(const std::string &user, const std::string &password,
            const std::string &connString, const std::string &host,
            const std::string &port);
  bool connect();

  bool isConnected();
  bool isConnected(std::string &message);

  void setUnavailable(bool unavailable) { mUnavailable = unavailable; };
  bool isUnavailable() { return mUnavailable; };

  void executeQuery(const std::string &query, bool &status,
                    std::string &message, rows_t &rows);
  void executeQuery(const std::string &query, bool &status, rows_t &rows);
  void executeQuery(const std::string &query, rows_t &rows);

  void clearQueryResult(rows_t &result);

  bool executeUpdate(const std::string &update, std::string &message);
  bool executeUpdate(const std::string &update);

  bool commitUpdate(bool commit = true);
  std::recursive_mutex *getMutex() { return &mMutex; };
};

#endif
