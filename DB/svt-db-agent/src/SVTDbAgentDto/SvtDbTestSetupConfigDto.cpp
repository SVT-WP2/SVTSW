/*!
 * @file SvtDbTestSetupConfigDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Setup
 */

#include <string>

#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include "SVTDbAgentDto/SvtDbTestSetupConfigDto.h"

//========================================================================+
SvtDbAgent::SvtDbTestSetupConfigDto::SvtDbTestSetupConfigDto()
  : SvtDbBaseDto()
{
  setTableName("SvtTestSetupConfig");

  addColName("id");
  addColName("setupId");
  addColName("name");
  addColName("note");
  addColName("configBody");
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
  //! SvtDbTestSetupConfigDto::CreateSvtTestSetup
  addRequest("CreateSvtTestSetupConfig",
             std::bind(&SvtDbTestSetupConfigDto::createEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
}
