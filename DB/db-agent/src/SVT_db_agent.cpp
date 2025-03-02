#include "Database/databaseinterface.h"
#include "SVTUtilities/SvtLogger.h"

#include "version.h"

#include <cstdio>
#include <cstdlib>
#include <string>

std::string version = std::string(VERSION);
SvtLogger &logger = SvtLogger::getInstance();

std::string psqlhost = "dbod-svt-sw-pgdb.cern.ch";
std::string psqlport = "6600";
std::string psqluser = "admin";
std::string psqlpass = "svt-mosaix";
std::string psqldb = "svt_sw_db_test";

bool connectToDB(std::string &user, std::string &pass, std::string &conn,
                 std::string &host, std::string &port)
{
  DatabaseInterface *dbInterface =
      new DatabaseInterface(user, pass, conn, host, port);

  if (dbInterface->connect())
  {
    logger.logInfo("Successfully connected to " + conn + ".");
    return true;
  }
  else
  {
    logger.logError("Cannot connet to " + conn + "!");
  }

  return false;
}

int main()
{
  logger.logInfo("********************** SVT_db, version:" + version,
                 SvtLogger::Mode::STANDARD);

  // take the DB connection out once integrated with FRED
  // but just in case, perhaps checking for connection first will prevent
  // problems
  if (!DatabaseInterface::isConnected())
  {
    if (!connectToDB(psqluser, psqlpass, psqldb, psqlhost, psqlport))
    {
      logger.logError("Cannot connect to DB");
    }
  }

  // check if DB is connected, otherwise continue in reduced mode.
  // DIM channels must be explicitly enabled to run in reduced mode (set noDB to
  // true in constructor)
  if (!DatabaseInterface::isConnected())
  {
    logger.logError("WARNING: Databaseinterface is not connected");
    DatabaseInterface::setUnavailable(true);
    return EXIT_FAILURE;
  }
  else
  {
    logger.logInfo("Databaseinterface is connected");
  }

  // while (1)
  // {
  //   std::this_thread::sleep_for(std::chrono::milliseconds(1000));
  //   // int time = gTimer.getTicksInSeconds();
  //   // heartbeatService->updateService(time);
  // }
  return EXIT_SUCCESS;
}
