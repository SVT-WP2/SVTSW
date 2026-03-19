/*!
 * @file SvtDbTestSetupConfigDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Setup
 */

#include "SVTDbAgentDto/SvtDbTestSetupConfigDto.h"
#include "SVTDbAgentDto/SvtDbBaseDto.h"

//========================================================================+
SvtDbAgent::SvtDbTestSetupConfigDto::SvtDbTestSetupConfigDto()
  : SvtDbBaseDto()
{
  setTableName("SvtTestSetupConfig");

  addColName("id");
  addColName("setupId");
  addColName("name");
  addColName("note");
  addColName("createdAt", false);

  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbTestSetupConfigDto::createAllRequest()
{
  //! SvtDbTestSetupConfigDto::GetAllSvtTestSetup
  addRequest("GetAllSvtTestSetupConfigs",
             std::bind(&SvtDbTestSetupConfigDto::getAllEntries, this,
                       std::placeholders::_1, std::placeholders::_2));
}
