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
  AddStringColName("serialNumber");
  AddStringColName("name");
  AddStringColName("vendor");
  AddStringColName("model");
  AddStringColName("arrivalDate");
  AddStringColName("location");
  AddStringColName("type");
}
