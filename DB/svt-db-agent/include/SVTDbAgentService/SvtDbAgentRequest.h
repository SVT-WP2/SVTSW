#pragma once

#include <SVTUtilities/SvtLogger.h>
#include <SVTUtilities/SvtUtilities.h>

#include <map>
#include <string_view>

namespace SvtDbAgent
{
  class SvtDbBaseDto;
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;

  class SvtDbAgentRequest
  {
   public:
    SvtDbAgentRequest();
    virtual ~SvtDbAgentRequest() = default;

    SvtDbBaseDto *getDto(std::string_view);

    bool findRequestAndRun(std::string_view, const SvtDbAgentMessage &,
                           SvtDbAgentReplyMsg &);

   private:
    void createAllDtos();

    std::map<std::string_view, SvtDbAgent::SvtDbBaseDto *> dtoList;
  };
}  // namespace SvtDbAgent
