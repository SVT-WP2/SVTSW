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
  static std::string db_name;
  static std::string db_schema;
  static std::string kafka_server;
  static std::string kafka_port;
};  // namespace SvtDbAgent
