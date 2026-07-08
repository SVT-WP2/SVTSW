/*!
 * @file DbBlockDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief DbWaferDto
 */

#include "DbAgentDto/DbBlockDto.h"

namespace dbagent
{
  //========================================================================+
  DbBlockDto::DbBlockDto()
  {
    setTableName("Block");

    addColName("id");
    addColName("chipId");
    addColName("blockType");
    addColName("serialNumber");

    addValidFilter("chipId");
    addValidFilter("blockTypes", "blockType");
  }
}  // namespace dbagent
