/*!
 * @file SvtDbTestSetupConfigDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Setup
 */

#include "SVTDbAgentDto/SvtDbTestSetupConfigCreateDto.h"
#include "SVTDbAgentDto/SvtDbBaseDto.h"

//========================================================================+
SvtDbAgent::SvtDbTestSetupConfigCreateDto::SvtDbTestSetupConfigCreateDto()
  : SvtDbBaseDto()
{
  setTableName("SvtTestSetupConfig");

  addColName("id");
  addColName("setupId");
  addColName("name");
  addColName("note");
  addColName("configBody");
  addColName("createdAt", false);

  addColNameInJson("configBody");
  createAllRequest();
}

//========================================================================+
void SvtDbAgent::SvtDbTestSetupConfigCreateDto::createAllRequest()
{
  //! SvtDbTestSetupConfigDto::CreateSvtTestSetup
  addRequest("CreateSvtTestSetupConfig",
             std::bind(&SvtDbTestSetupConfigCreateDto::createEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
}
