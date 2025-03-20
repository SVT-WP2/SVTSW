/*!
 * @file EpicUtilities.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Utilities sources
 */

#include "EpicUtilities/EpicUtilities.h"

#include <cstdlib>

std::string EpicDbAgent::db_schema = (getenv("EPIC_DB_AGENT_SCHEMA") != nullptr)
                                         ? getenv("EPIC_DB_AGENT_SCHEMA")
                                         : "prod";
