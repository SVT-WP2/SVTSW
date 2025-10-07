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

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbProbeCardDto::createAllRequest()
{
  //! SvtDbProbeCardDto::GetAllProbeCards
  addRequest("GetAllProbeCards",
             std::bind(&SvtDbProbeCardDto::getAllEntries, this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbProbeCardDto::CreateProbeCard
  addRequest("CreateProbeCard",
             std::bind(&SvtDbProbeCardDto::createEntry, this,
                       std::placeholders::_1, std::placeholders::_2));
}
