#pragma once

/*!
 * @file SvtDbAgentService.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent manager
 */

#include <cstdint>
#include <memory>
#include <string_view>

#include <librdkafka/rdkafkacpp.h>

#include <nlohmann/json.hpp>

#include "SVTUtilities/SvtDbAgentGlobal.h"
#include "SVTUtilities/SvtLogger.h"
#include "SvtDbAgentMessage.h"
#include "SvtDbAgentRequest.h"

enum SvtDbAgentTopicEnum : uint8_t
{
  Request = 0,
  RequestReply,
  NumTopicNames = 2
};

const std::array<std::string_view, SvtDbAgentTopicEnum::NumTopicNames>
    topicNames = {{"svt.db-agent.request", "svt.db-agent.request.reply"}};

namespace RdKafka
{
  class Message;
};

namespace SvtDbAgent
{
  class SvtDbAgentConsumer;
  class SvtDbAgentProducer;

  class SvtDbAgentService
  {
   public:
    SvtDbAgentService();
    ~SvtDbAgentService();

    bool initEnumTypeList(const std::string &schema);
    bool configureService(bool stop_eof = false);
    void processMsgCb(RdKafka::Message *msg, void *opaque);
    void setDebug(std::string debug) { m_debug = debug; }

    void stopConsumer(const bool suspeneded);
    bool getIsConsRunnning();

    void setLogMessages(const bool val) { log_messages = val; }
    bool getLogMessages() { return log_messages; }

    std::string &getBrokerName() { return m_brokerName; }

   private:
    SvtLogger *logger = Singleton<SvtLogger>::instance();

    void parseMsg(const SvtDbAgentMessage &msg,
                  const SvtDbAgentMsgStatus &status);

    std::shared_ptr<SvtDbAgentConsumer> m_Consumer;
    std::shared_ptr<SvtDbAgentProducer> m_Producer;

    SvtDbAgentRequest *m_Request = Singleton<SvtDbAgentRequest>::instance();

    std::string m_brokerName =
        SvtDbAgent::kafka_server + std::string(":") + SvtDbAgent::kafka_port;
    std::string m_errStr;
    std::string m_debug;

    bool log_messages = false;
  };
}  // namespace SvtDbAgent
