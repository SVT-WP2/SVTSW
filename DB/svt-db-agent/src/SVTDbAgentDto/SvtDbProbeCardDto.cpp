/*!
 * @file SvtDbProbeCardDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbProbeCardDto
 */

#include "SVTDbAgentDto/SvtDbProbeCardDto.h"

//========================================================================+
SvtDbAgent::SvtDbProbeCardDto::SvtDbProbeCardDto()
{
  setTableName("ProbeCard");
  addColName("id");
  addColName("version");
  addColName("vendorCleaningInterval");
  addColName("serialNumber");
  addColName("name");
  addColName("vendor");
  addColName("model");
  addColName("arrivalDate");
  addColName("location");
  addColName("type");
}
