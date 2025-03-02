#include "Database/databaseinterface.h"
#include "EpicDbAgentService/EpicDbAgentService.h"
#include "EpicUtilities/EpicLogger.h"

#include "version.h"

#include <cstdio>
#include <cstdlib>
#include <exception>
#include <iostream>
#include <string>
#include <thread>

std::string version = std::string(VERSION);
EpicLogger &logger = EpicLogger::getInstance();

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
  logger.logInfo("********************** Epic Db Agent, version:" + version,
                 EpicLogger::Mode::STANDARD);

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
  // DIM channels must be explicitly enabled to run in reduced mode
  // (set noDB to true in constructor)
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
  try
  {
    EpicDbAgentService &_dbAgent = EpicDbAgentService::getInstance();
    if (!_dbAgent.ConfigureDbAgentConsumer(false))
    {
      return EXIT_FAILURE;
    }
    while (1)
    {
      std::this_thread::sleep_for(std::chrono::milliseconds(1000));
      //   // int time = gTimer.getTicksInSeconds();
      //   // heartbeatService->updateService(time);
    }
  }
  catch (const std::exception &e)
  {
    std::cout << std::endl
              << "### Caught exception in the main thread ###" << std::endl
              << std::endl;
    std::cout << e.what() << std::endl;
    return EXIT_FAILURE;
  }
  return EXIT_SUCCESS;
}
