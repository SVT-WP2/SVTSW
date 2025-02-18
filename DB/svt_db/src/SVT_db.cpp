#include "Database/databaseinterface.h"
#include "SVTUtilities/SvtLogger.h"
#include "version.h"

#include <cstdio>
#include <cstdlib>
#include <iostream>
#include <string>
#include <thread>

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
    logger.logInfo("Successfully connected to " + user + ".");
    return true;
  }
  else
  {
    logger.logError("Cannot connet to " + user + "!");
  }

  return false;
}

int main()
{
  logger.logInfo(
      "********************** Hello World  SVT_db, version:" + version +
      " ... A long way is in front of you ... be patient (for a "
      "while ;-))! **********************");
  logger.logInfo("********************** Restarting SVT_db, version:" +
                     version + " ***********************",
                 SvtLogger::Mode::STANDARD);

  // take the DB connection out once integrated with FRED
  // but just in case, perhaps checking for connection first will prevent
  // problems
  if (!DatabaseInterface::isConnected())
  {
    if (!connectToDB(psqluser, psqlpass, psqldb, psqlhost, psqlport))
    {
      logger.logError("Cannot connect to either DB");
    }
  }

  // check if DB is connected, otherwise continue in reduced mode.
  // DIM channels must be explicitly enabled to run in reduced mode (set noDB to
  // true in constructor)
  if (!DatabaseInterface::isConnected())
  {
    logger.logError(
        "WARNING: Databaseinterface is not connected! Continuing "
        "in restricted mode.");
    DatabaseInterface::setUnavailable(true);
    return EXIT_FAILURE;
  }
  else
  {
    logger.logInfo("Databaseinterface is connected");
  }

  try
  {
    while (1)
    {
      std::this_thread::sleep_for(std::chrono::milliseconds(1000));
      // int time = gTimer.getTicksInSeconds();
      // heartbeatService->updateService(time);
    }
  }
  catch (const std::exception &e)
  {
    std::cout << std::endl
              << "### Caught exception in the main thread ###" << std::endl
              << std::endl;
    std::cout << e.what();
    return EXIT_FAILURE;
  }
  return EXIT_SUCCESS;
}
