/*!
 * @file DbTestSetupDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief  Test Template
 */

#include "DbAgentDto/DbTestTemplateDto.h"
#include <string>
#include "DbAgentDto/DbBaseDto.h"

namespace dbagent
{
  //========================================================================+
  DbTestTemplateDto::DbTestTemplateDto()
    : DbBaseDto()
  {
    setTableName("SvtTestTemplate");

    addColName("id");
    addColName("dutType");
    addColName("testTypeConfigId");
    addColName("testTypeId", false);
    addColName("isEnabled", false);

    addValidFilter("dutTypes", "dutType");

    createAllRequest();
  }

  //========================================================================+
  bool DbTestTemplateDto::getAllEntriesFromDB(std::vector<DbEntry> &entries,
                                              const std::string &,
                                              const DbEntry &filters,
                                              const std::string &orderBy, const bool orderDec)
  {
    std::string queryString = "";
    queryString += "SELECT T0.id, T0.\"dutType\", T0.\"testTypeConfigId\", T1.\"testTypeId\", T0.\"isEnabled\"";
    queryString += " FROM main.\"SvtTestTemplate\" AS T0";
    queryString += " JOIN main.\"SvtTestTypeConfig\" AS T1 ON T0.\"testTypeConfigId\" = T1.id";

    return this->DbBaseDto::getAllEntriesFromDB(entries, queryString, filters, orderBy, orderDec);
  }

  //========================================================================+
  void DbTestTemplateDto::updateEntry(const SvtKafka::SvtKafkaMessage &,
                                      SvtKafka::SvtKafkaReplyMsg &)
  {
  }

  //========================================================================+
  void DbTestTemplateDto::createAllRequest()
  {
    // !SvtDbTestTemplateDto::GetAllSvtTestTemplate
    addRequest("GetAllSvtTestTemplates",
               std::bind(&DbTestTemplateDto::getAllEntries, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbTestTemplateDto::CreateSvtTestTemplate
    addRequest("CreateSvtTestTemplate",
               std::bind(&DbTestTemplateDto::createEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
    //! SvtDbTestTemplateDto::UpdateSvtTestTemplate
    addRequest("UpdateSvtTestTemplate",
               std::bind(&DbTestTemplateDto::updateEntry, this, std::placeholders::_1,
                         std::placeholders::_2));
  }
}  // namespace dbagent
