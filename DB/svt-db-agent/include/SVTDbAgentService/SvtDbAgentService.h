#pragma once

/*!
 * @file SvtDbAgentService.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent manager
 */

#include <cstdint>
#include <memory>

#include <librdkafka/rdkafkacpp.h>

#include <nlohmann/json.hpp>

#include "SvtDbAgentRequest.h"
#include "SvtKafkaMessage.h"
#include "SvtLogger.h"

enum SvtDbAgentTopicEnum : uint8_t
{
  Request = 0,
  RequestReply,
  NumTopicNames = 2
};

const std::array<std::string, SvtDbAgentTopicEnum::NumTopicNames>
    topicNames = {{"svt.db-agent.request", "svt.db-agent.request.reply"}};

namespace RdKafka
{
  class Message;
};

namespace SvtKafka
{
  class SvtKafkaConsumer;
  class SvtKafkaProducer;
}  // namespace SvtKafka

namespace SvtDbAgent
{

  class SvtDbAgentService
  {
   public:
    SvtDbAgentService();
    ~SvtDbAgentService();

    bool configureService(bool stop_eof = false);
    void processMsgCb(RdKafka::Message &msg, void *opaque);
    void setDebug(std::string debug) { mDebug = debug; }

    void stopConsumer(const bool suspeneded);
    bool getIsConsRunnning();

    void setLogMessages(const bool val) { log_messages = val; }
    bool getLogMessages() { return log_messages; }

    void setBrokerName(const std::string &name) { mBrokerName = name; }
    std::string &getBrokerName() { return mBrokerName; }

   private:
    SvtUtils::SvtLogger *mLogger = SvtUtils::Singleton<SvtUtils::SvtLogger>::instance();

    void parseMsg(const SvtKafka::SvtKafkaMessage &msg,
                  const SvtKafka::SvtKafkaMsgStatus &status);

    std::shared_ptr<SvtKafka::SvtKafkaConsumer> mConsumer;

    std::shared_ptr<SvtKafka::SvtKafkaProducer> mProducer;

    SvtDbAgentRequest *mRequest = SvtUtils::Singleton<SvtDbAgentRequest>::instance();

    std::string mBrokerName;
    std::string mErrStr;
    std::string mDebug;

    bool log_messages = false;
  };
}  // namespace SvtDbAgent
