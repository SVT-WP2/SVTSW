/*!
 * @file SvtDbAgentRequest.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Apr-2025
 * @brief implementation of request
 */

#include "SVTDbAgentService/SvtDbAgentRequest.h"
#include <string_view>
#include "SVTDbAgentDto/SvtDbAsicDto.h"
#include "SVTDbAgentDto/SvtDbChipDto.h"
#include "SVTDbAgentDto/SvtDbEnumDto.h"
#include "SVTDbAgentDto/SvtDbProbeCardDto.h"
#include "SVTDbAgentDto/SvtDbWPMachineDto.h"
#include "SVTDbAgentDto/SvtDbWPProjectDto.h"
#include "SVTDbAgentDto/SvtDbWaferDto.h"
#include "SVTDbAgentDto/SvtDbWaferTypeDto.h"

using namespace SvtDbAgent;
//========================================================================+
SvtDbAgentRequest::SvtDbAgentRequest() { createAllDtos(); }

//========================================================================+
void SvtDbAgentRequest::createAllDtos()
{
  dtoList["SvtDbEnumDto"] = Singleton<SvtDbAgent::SvtDbEnumDto>::instance();
  dtoList["SvtDbWaferTypeDto"] =
      Singleton<SvtDbAgent::SvtDbWaferTypeDto>::instance();
  dtoList["SvtDbWaferDto"] = Singleton<SvtDbAgent::SvtDbWaferDto>::instance();
  dtoList["SvtDbWaferLocationDto"] =
      Singleton<SvtDbAgent::SvtDbWaferLocationDto>::instance();
  dtoList["SvtDbAsicDto"] = Singleton<SvtDbAgent::SvtDbAsicDto>::instance();
  dtoList["SvtDbChipDto"] = Singleton<SvtDbAgent::SvtDbChipDto>::instance();
  dtoList["SvtDbProbeCardDto"] =
      Singleton<SvtDbAgent::SvtDbProbeCardDto>::instance();
  dtoList["SvtDbWPMachineDto"] =
      Singleton<SvtDbAgent::SvtDbWPMachineDto>::instance();
  dtoList["SvtDbWPProjectDto"] =
      Singleton<SvtDbAgent::SvtDbWPProjectDto>::instance();
}

//========================================================================+
SvtDbBaseDto *SvtDbAgentRequest::getDto(std::string_view dtoName)
{
  if (dtoList.find(dtoName) != dtoList.end())
    return dtoList[dtoName];
  else
    return nullptr;
}

//===========================================================================+
bool SvtDbAgentRequest::findRequestAndRun(std::string_view reqName,
                                          const SvtDbAgentMessage &msg,
                                          SvtDbAgentReplyMsg &replyMsg)
{
  bool req_found = false;
  for (auto &[dtoName, dto] : dtoList)
  {
    if (dto->findRequestAndRun(reqName, msg, replyMsg))
    {
      req_found = true;
      break;
    }
  }
  return req_found;
}
