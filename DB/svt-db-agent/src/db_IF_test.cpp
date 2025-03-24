/*!
 * @file svt_db_agent.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief svt_db_agent executable
 */

#include "SVTDb/SvtDbInterface.h"
#include "SVTUtilities/SvtLogger.h"

#include "Database/databaseinterface.h"

#include "version.h"

#include <array>
#include <cstdlib>
#include <iostream>
#include <string_view>
#include <vector>

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
  logger.logInfo("********************** Svt Db Interface Test, version:" +
                     version,
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
    std::array<std::string_view, 5> a_enumTypeNames = {
        {"enum_engineeringRun", "enum_waferType", "enum_waferTech",
         "enum_foundry", "enum_familyType"}};

    for (const auto &type : a_enumTypeNames)
    {
      std::string type_name = SvtDbAgent::db_schema + "." + std::string(type);
      std::vector<std::string> v_enumVal;
      SvtDbInterface::getAllEnumValues(type_name, v_enumVal);
      for (auto &val : v_enumVal)
      {
        logger.logInfo(val);
      }
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
