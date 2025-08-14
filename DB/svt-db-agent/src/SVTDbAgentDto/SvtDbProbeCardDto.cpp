/*!
 * @file SvtDbProbeCardDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbProbeCardDto
 */

#include "SVTDbAgentDto/SvtDbProbeCardDto.h"
// #include "SVTDb/SvtDbInterface.h"
// #include "SVTDb/sqlmapi.h"
// #include "SVTDbAgentDto/SvtDbEnumDto.h"
// #include "SVTDbAgentService/SvtDbAgentMessage.h"
// #include "SVTUtilities/SvtLogger.h"
// #include "SVTUtilities/SvtUtilities.h"

// #include <algorithm>
// #include <sstream>
// #include <stdexcept>

// using SvtDbAgent::Singleton;

//========================================================================+
SvtDbAgent::SvtDbProbeCardDto::SvtDbProbeCardDto()
{
  SetTableName("ProbeCard");
  AddIntColName("id");
  AddIntColName("version");
  AddIntColName("vendorCleaningInterval");
  AddStringColName("serialNumber");
  AddStringColName("name");
  AddStringColName("vendor");
  AddStringColName("model");
  AddStringColName("arrivalDate");
  AddStringColName("location");
  AddStringColName("type");
}
