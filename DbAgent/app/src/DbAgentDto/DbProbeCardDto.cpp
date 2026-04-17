/*!
 * @file DbProbeCardDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief DbProbeCardDto
 */

#include "DbAgentDto/DbProbeCardDto.h"

namespace dbagent
{
  //========================================================================+
  DbProbeCardDto::DbProbeCardDto()
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

    addValidFilter("ids", "id");

    createAllRequest();
  }

  //========================================================================+
  void DbProbeCardDto::createAllRequest()
  {
    //! SvtDbProbeCardDto::GetAllProbeCards
    addRequest("GetAllProbeCards",
               std::bind(&DbProbeCardDto::getAllEntries, this,
                         std::placeholders::_1, std::placeholders::_2));
    //! SvtDbProbeCardDto::CreateProbeCard
    addRequest("CreateProbeCard",
               std::bind(&DbProbeCardDto::createEntry, this,
                         std::placeholders::_1, std::placeholders::_2));
  }
}  // namespace dbagent
