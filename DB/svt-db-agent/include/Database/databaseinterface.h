#ifndef __DATABASE_INTERFACE__
#define __DATABASE_INTERFACE__

#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include <pqxx/pqxx>

#include <mutex>
#include <vector>
#include "multitype.h"

using namespace std;

class DatabaseInterface
{
 private:
  // static DatabaseInterface *instance;

  string mUser, mPassword, mConnString, mHost, mPort;

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

  bool Init(const string &user, const string &password,
            const string &connString, const string &host, const string &port);
  bool connect();

  bool isConnected();
  bool isConnected(string &message);

  void setUnavailable(bool unavailable) { mUnavailable = unavailable; };
  bool isUnavailable() { return mUnavailable; };

  void executeQuery(const string &query, bool &status, string &message,
                    vector<vector<MultiBase *>> &rows);
  void executeQuery(const string &query, bool &status,
                    vector<vector<MultiBase *>> &rows);
  void executeQuery(const string &query, vector<vector<MultiBase *>> &rows);

  void clearQueryResult(vector<vector<MultiBase *>> &result);

  bool executeUpdate(const string &update, string &message);
  bool executeUpdate(const string &update);

  bool commitUpdate(bool commit = true);
  std::recursive_mutex *getMutex() { return &mMutex; };
};

#endif
