/*!
 * @file svt_db_agent.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief svt_db_agent executable
 */

#include "Database/databaseinterface.h"
#include "SVTDbAgentService/SvtDbAgentService.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include "version.h"

#include <cstdio>
#include <cstdlib>
#include <exception>
#include <iostream>
#include <string>
#include <thread>

std::string version = std::string(VERSION);

SvtLogger &logger = Singleton<SvtLogger>::instance();

std::string psqlhost = "dbod-svt-sw-pgdb.cern.ch";
std::string psqlport = "6600";
std::string psqluser = "admin";
std::string psqlpass = "svt-mosaix";
std::string psqldb = "svt_sw_db_test";

using DatabaseIF = Singleton<DatabaseInterface>;

//========================================================================+
bool connectToDB(std::string &user, std::string &pass, std::string &conn,
                 std::string &host, std::string &port)
{
  DatabaseInterface &dbInterface = DatabaseIF::instance();
  if (!dbInterface.Init(user, pass, conn, host, port))
  {
    return false;
  }

  if (dbInterface.connect())
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

//========================================================================+
int main()
{
  logger.logInfo("********************** Svt Db Agent, version:" + version,
                 SvtLogger::Mode::STANDARD);

  DatabaseInterface &dbInterface = DatabaseIF::instance();

  // take the DB connection out once integrated with FRED
  // but just in case, perhaps checking for connection first will prevent
  // problems
  if (!dbInterface.isConnected())
  {
    if (!connectToDB(psqluser, psqlpass, psqldb, psqlhost, psqlport))
    {
      logger.logError("Cannot connect to DB");
      return EXIT_FAILURE;
    }
    else
    {
      logger.logInfo("Databaseinterface is connected");
      logger.logInfo("Using Scheme: " + SvtDbAgent::db_schema);
    }
  }
  try
  {
    SvtDbAgentService &_dbAgent = Singleton<SvtDbAgentService>::instance();
    if (!_dbAgent.initEnumTypeList(SvtDbAgent::db_schema))
    {
      logger.logError("ERROR: We could not initialize enum from DB.");
      return EXIT_FAILURE;
    }
    if (!_dbAgent.configureService(false))
    {
      return EXIT_FAILURE;
    }
    while (_dbAgent.getIsConsRunnning())
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
