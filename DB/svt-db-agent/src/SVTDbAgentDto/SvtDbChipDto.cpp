/*!
 * @file SvtDbChipDto.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbWaferDto
 */

#include "SVTDbAgentDto/SvtDbChipDto.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDbAgentDto/SvtDbAsicDto.h"
#include "SVTDbAgentDto/SvtDbBaseDto.h"
#include "SVTDbAgentDto/SvtDbWaferTypeDto.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

//========================================================================+
SvtDbAgent::SvtDbChipDto::SvtDbChipDto()
{
  setTableName("Chip");

  addColName("id");
  addColName("asicId");
  addColName("serialNumber");
  addColName("generalLocation");
}

//========================================================================+
SvtDbAgent::SvtDbChipLocationDto::SvtDbChipLocationDto()
{
  setTableName("ChipLocation");

  addColName("chipId");
  addColName("generalLocation");
  addColName("creationTime");
  addColName("username");
  addColName("note");
}

//========================================================================+
void SvtDbAgent::SvtDbChipDto::createEntry(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg)
{
  const auto &msgData = msg.getPayload()["data"];
  if (!msgData.contains("create"))
  {
    throw std::runtime_error("Non object create was found");
  }

  auto &entry_j = msgData["create"];
  SvtDbAgent::SvtDbEntry chipEntry;

  parseData(entry_j, chipEntry);

  //! create entry in DB
  Singleton<SvtLogger>::instance().logInfo("Creating chip in DB");
  const auto currMaxEntryId = SvtDbInterface::getMaxId(getTableName());

  if (!createEntryInDB(chipEntry))
  {
    throw std::runtime_error("Entry was not created in " + getTableName());
    return;
  }

  const auto newEntryId = SvtDbInterface::getMaxId(getTableName());
  if (newEntryId != currMaxEntryId + 1)
  {
    throw std::runtime_error("Entry was not created in " + getTableName());
    return;
  }
  getEntryWithId(chipEntry, newEntryId);

  Singleton<SvtLogger>::instance().logInfo("Creating chip location in DB");
  //! Create waferLocations
  SvtDbEntry chipLoc;
  chipLoc.values.insert({"chipId", newEntryId});
  chipLoc.values.insert(
      {"generalLocation", chipEntry.values["generalLocation"]});
  chipLoc.values.insert({"note", "Location at creation"});
  if (!Singleton<SvtDbChipLocationDto>::instance().createEntryInDB(chipLoc))
  {
    throw std::runtime_error("ERROR: Could not create chip location entry");
    return;
  }

  Singleton<SvtLogger>::instance().logInfo("Creating reply SvtDbAgentMessage");
  createEntryReplyMsg(chipEntry, replyMsg);
}
