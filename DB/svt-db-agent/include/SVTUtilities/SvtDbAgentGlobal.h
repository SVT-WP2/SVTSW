#pragma once

/*!
 * @file SvtDbAgentGlobal.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Global variable definitions
 */

#include <string>

namespace SvtDbAgent
{
  extern std::string db_name;
  extern std::string db_schema;
  extern std::string kafka_server;
  extern std::string kafka_port;
};  // namespace SvtDbAgent
