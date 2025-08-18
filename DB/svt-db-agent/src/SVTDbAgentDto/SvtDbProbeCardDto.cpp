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
  SetTableName("ProbeCard");
  AddIntColName("id");
  AddIntColName("version");
  AddIntColName("vendorCleaningInterval");
  AddStrColName("serialNumber");
  AddStrColName("name");
  AddStrColName("vendor");
  AddStrColName("model");
  AddStrColName("arrivalDate");
  AddStrColName("location");
  AddStrColName("type");
}
