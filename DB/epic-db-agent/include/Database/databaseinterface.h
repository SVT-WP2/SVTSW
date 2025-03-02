#ifndef __DATABASE_INTERFACE__
#define __DATABASE_INTERFACE__

#include "EpicUtilities/EpicLogger.h"

#include <pqxx/pqxx>

#include <mutex>
#include <vector>
#include "multitype.h"

using namespace std;

class DatabaseInterface
{
 private:
  static DatabaseInterface *instance;

  string mUser, mPassword, mConnString, mHost, mPort;

  pqxx::connection *mDBConnection;
  pqxx::nontransaction *mDBWork;

  bool reconnect();
  bool close();

  static bool mUnavailable;

  static std::recursive_mutex mMutex;

  static EpicLogger &logger;

 public:
  DatabaseInterface(const string &user, const string &password,
                    const string &connString, const string &host,
                    const string &port);
  ~DatabaseInterface();

  bool connect();

  static bool isConnected();
  static bool isConnected(string &message);

  static void setUnavailable(bool unavailable)
  {
    DatabaseInterface::mUnavailable = unavailable;
  };
  static bool isUnavailable() { return mUnavailable; };

  static void executeQuery(const string &query, bool &status, string &message,
                           vector<vector<MultiBase *>> &rows);
  static void executeQuery(const string &query, bool &status,
                           vector<vector<MultiBase *>> &rows);
  static void executeQuery(const string &query,
                           vector<vector<MultiBase *>> &rows);

  static void clearQueryResult(vector<vector<MultiBase *>> &result);

  static bool executeUpdate(const string &update, string &message);
  static bool executeUpdate(const string &update);

  static bool commitUpdate(bool commit = true);
  static std::recursive_mutex *getMutex() { return &mMutex; };
};

#endif
