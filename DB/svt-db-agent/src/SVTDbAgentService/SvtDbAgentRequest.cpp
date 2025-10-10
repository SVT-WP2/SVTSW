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
  dtoList["SvtDbEnumDto"] =
      SvtDbAgent::Singleton<SvtDbAgent::SvtDbEnumDto>::instance();
  dtoList["SvtDbWaferTypeDto"] =
      SvtDbAgent::Singleton<SvtDbAgent::SvtDbWaferTypeDto>::instance();
  dtoList["SvtDbWaferDto"] =
      SvtDbAgent::Singleton<SvtDbAgent::SvtDbWaferDto>::instance();
  dtoList["SvtDbWaferLocationDto"] =
      SvtDbAgent::Singleton<SvtDbAgent::SvtDbWaferLocationDto>::instance();
  dtoList["SvtDbAsicDto"] =
      SvtDbAgent::Singleton<SvtDbAgent::SvtDbAsicDto>::instance();
  dtoList["SvtDbChipDto"] =
      SvtDbAgent::Singleton<SvtDbAgent::SvtDbChipDto>::instance();
  dtoList["SvtDbProbeCardDto"] =
      SvtDbAgent::Singleton<SvtDbAgent::SvtDbProbeCardDto>::instance();
  dtoList["SvtDbWPMachineDto"] =
      SvtDbAgent::Singleton<SvtDbAgent::SvtDbWPMachineDto>::instance();
  dtoList["SvtDbWPProjectDto"] =
      SvtDbAgent::Singleton<SvtDbAgent::SvtDbWPProjectDto>::instance();
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
