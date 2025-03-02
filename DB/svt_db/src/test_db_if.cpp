#include "Database/databaseinterface.h"
#include "SVTDb/svtdb_if.h"
#include "SVTUtilities/SvtLogger.h"

#include "version.h"

#include <array>
#include <cstdio>
#include <cstdlib>
#include <exception>
#include <iomanip>
#include <iostream>
#include <ostream>
#include <string>
#include <vector>

std::string version = std::string(VERSION);
SvtLogger &logger = SvtLogger::getInstance();

std::string psqlhost = "dbod-svt-sw-pgdb.cern.ch";
std::string psqlport = "6600";
std::string psqluser = "admin";
std::string psqlpass = "svt-mosaix";
std::string psqldb = "svt_sw_db_test";

void test_getVersions();
void test_addEnumValues();
void test_inserWafer();
void test_getWafers();

//========================================================================+
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

//========================================================================+
int main()
{
  logger.logInfo("********************** Testing SVT_db, version:" + version,
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
    logger.logError("WARNING: Databaseinterface is not connected!");
    DatabaseInterface::setUnavailable(true);
  }
  else
  {
    logger.logInfo("DatabaseInterface is connected");
  }
  test_getVersions();
  test_addEnumValues();
  // test_inserWafer();
  test_getWafers();

  return EXIT_SUCCESS;
}

//========================================================================+
void test_getVersions()
{
  std::vector<SvtDb_IF::dbVersion> dbVersion_v;

  try
  {
    int nDbVerisons = SvtDb_IF::getAllVersions(dbVersion_v);
    std::cout << "found " << nDbVerisons << " db version" << endl;
    for (const auto &dbVersion : dbVersion_v)
    {
      std::cout << "id: " << dbVersion.id << ", name: " << dbVersion.name
                << ", baseVersion " << dbVersion.baseVersion
                << ", description: " << dbVersion.description << std::endl;
    }
  }
  catch (const std::exception &e)
  {
    std::cout << std::endl
              << "### Caught exception in the main thread ###" << std::endl
              << std::endl;
    std::cout << e.what();
  }
}

//========================================================================+
void test_addEnumValues()
{
  SvtDb_IF::addEnumValue("test.enum_waferTech", "TPSCo65");
  SvtDb_IF::addEnumValue("test.enum_waferType", "MOSS");

  //! get enum values for enum_engineeringRun
  std::vector<std::string> enum_waferTech_values =
      SvtDb_IF::getAllEnumValues("test.enum_waferTech");

  for (const auto &value : enum_waferTech_values)
  {
    logger.logInfo("Enum enum_waferTech value: " + value);
  }

  std::vector<std::string> enum_waferType_values =
      SvtDb_IF::getAllEnumValues("test.enum_waferType");
  for (const auto &value : enum_waferType_values)
  {
    logger.logInfo("Enum enum_waferType value: " + value);
  }
}

//========================================================================+
void test_insertWafer()
{
  std::array<SvtDb_IF::dbWaferRecords, 2> wafers = {
      {{-1, "SN00", 0, "ER1", "TowerJazz", "TPSCo65", "", "", "MOSS"},
       {-1, "SN01", 0, "ER1", "TowerJazz", "TPSCo65", "", "", "MOSS"}}};

  for (const auto &wafer : wafers)
  {
    SvtDb_IF::insertWaferRecords(wafer);
  }
}

//========================================================================+
void test_getWafers()
{
  std::vector<SvtDb_IF::dbWaferRecords> wafers_v;
  try
  {
    int nDbWafers = SvtDb_IF::getAllWafers(wafers_v);
    std::cout << "found " << nDbWafers << " wafers in the Db." << std::endl;
    std::cout << std::left << std::setw(3) << "id" << std::setw(8) << "serialN"
              << std::setw(7) << "batchN" << std::setw(4) << "ER"
              << std::setw(10) << "Foundry" << std::setw(8) << "Tech"
              << std::setw(13) << "ThinningDate" << std::setw(13)
              << "DicingData" << std::setw(13) << "WaferTypw" << std::endl;
    for (const auto &wafer : wafers_v)
    {
      std::cout << std::left << std::setw(3) << wafer.id << std::setw(8)
                << wafer.serialNumber << std::setw(7) << wafer.batchNumber
                << std::setw(4) << wafer.engineeringRun << std::setw(10)
                << wafer.foundry << std::setw(8) << wafer.technology
                << std::setw(13) << wafer.thinningDate << std::setw(13)
                << wafer.dicingdate << std::setw(13) << wafer.waferType
                << std::endl;
    }
  }
  catch (const std::exception &e)
  {
    std::cout << e.what();
  }
}
