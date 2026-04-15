/*!
 * @file SvtDbTestSetupDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Template
 */

#include "SVTDbAgentDto/SvtDbTestTemplateDto.h"
#include <string>

//========================================================================+
SvtDbAgent::SvtDbTestTemplateDto::SvtDbTestTemplateDto()
  : SvtDbBaseDto()
{
  setTableName("SvtTestTemplate");

  addColName("id");
  addColName("asicFamilyType");
  addColName("testTypeConfigId");
  addColName("testTypeId", false);
  addColName("isEnabled", false);

  createAllRequest();
}

//========================================================================+
bool SvtDbAgent::SvtDbTestTemplateDto::getAllEntriesFromDB(std::vector<SvtDbEntry> &entries,
                                                           const std::string &,
                                                           const SvtDbFilters &filters,
                                                           const std::string &orderBy, const bool orderDec)
{
  std::string queryString = "";
  queryString += "SELECT T0.id, T0.\"asicFamilyType\", T0.\"testTypeConfigId\", T1.\"testTypeId\", T0.\"isEnabled\"";
  queryString += " FROM main.\"SvtTestTemplate\" AS T0";
  queryString += " JOIN main.\"SvtTestTypeConfig\" AS T1 ON T0.\"testTypeConfigId\" = T1.id";

  return this->SvtDbBaseDto::getAllEntriesFromDB(entries, queryString, filters, orderBy, orderDec);
}

//========================================================================+
void SvtDbAgent::SvtDbTestTemplateDto::updateEntry(const SvtKafka::SvtKafkaMessage &,
                                                   SvtKafka::SvtKafkaReplyMsg &)
{
}

//========================================================================+
void SvtDbAgent::SvtDbTestTemplateDto::createAllRequest()
{
  // !SvtDbTestTemplateDto::GetAllSvtTestTemplate
  addRequest("GetAllSvtTestTemplates",
             std::bind(&SvtDbTestTemplateDto::getAllEntries, this,
                       std::placeholders::_1, std::placeholders::_2));
  //! SvtDbTestTemplateDto::CreateSvtTestTemplate
  addRequest("CreateSvtTestTemplate",
             std::bind(&SvtDbTestTemplateDto::createEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
  //! SvtDbTestTemplateDto::UpdateSvtTestTemplate
  addRequest("UpdateSvtTestTemplate",
             std::bind(&SvtDbTestTemplateDto::updateEntry, this, std::placeholders::_1,
                       std::placeholders::_2));
}
