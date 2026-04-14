#pragma once

#include <map>
#include <string_view>

#include <SvtLogger.h>
#include <SvtUtilities.h>

namespace SvtKafka
{
  class SvtKafkaMessage;
  class SvtKafkaReplyMsg;
}  // namespace SvtKafka

namespace SvtDbAgent
{
  class SvtDbBaseDto;
  class SvtDbAgentRequest
  {
   public:
    SvtDbAgentRequest();
    virtual ~SvtDbAgentRequest() = default;

    bool findRequestAndRun(std::string_view, const SvtKafka::SvtKafkaMessage &,
                           SvtKafka::SvtKafkaReplyMsg &);

   private:
    void createAllDtos();

    std::map<std::string_view, SvtDbAgent::SvtDbBaseDto *> dtoList;
  };
}  // namespace SvtDbAgent
