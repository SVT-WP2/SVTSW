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

namespace dbagent
{
  class DbBaseDto;
  class DbAgentRequest
  {
   public:
    DbAgentRequest();
    virtual ~DbAgentRequest() = default;

    bool findRequestAndRun(std::string_view, const SvtKafka::SvtKafkaMessage &,
                           SvtKafka::SvtKafkaReplyMsg &);

   private:
    void createAllDtos();

    std::map<std::string_view, DbBaseDto *> dtoList;
  };
}  // namespace dbagent
