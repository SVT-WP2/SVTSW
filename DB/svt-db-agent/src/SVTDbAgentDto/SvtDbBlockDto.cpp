/*!
 * @file SvtDbBlockDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWaferDto
 */

#include "SVTDbAgentDto/SvtDbBlockDto.h"

//========================================================================+
SvtDbAgent::SvtDbBlockDto::SvtDbBlockDto()
{
  setTableName("Block");

  addColName("id");
  addColName("chipId");
  addColName("blockType");
  addColName("serialNumber");
}
