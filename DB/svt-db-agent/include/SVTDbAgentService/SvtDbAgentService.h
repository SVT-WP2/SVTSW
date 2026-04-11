#pragma once

/*!
 * @file SvtDbAgentService.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent manager
 */

#include <kafka/ConsumerRecord.h>
#include <cstdint>
#include <memory>

#include <librdkafka/rdkafkacpp.h>

#include <nlohmann/json.hpp>

#include "SvtDbAgentRequest.h"
#include "SvtKafkaMessage.h"

enum SvtDbAgentTopicEnum : uint8_t
{
  Request = 0,
  RequestReply,
  Heartbeat,
  NumTopicNames = 3
};

const std::array<std::string, SvtDbAgentTopicEnum::NumTopicNames>
    topicNames = {{"svt.db-agent.request", "svt.db-agent.request.reply", "svt.db-agent.heartbeat"}};

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
    ~SvtDbAgentService() = default;

    bool configureService();
    void processMsgCb(const kafka::clients::consumer::ConsumerRecord & /*record*/);
    void sendHeartbeat();

    // void stopConsumer(const bool suspeneded);
    bool getIsConsRunnning();

    void setLogMessages(const bool val) { log_messages = val; }
    bool getLogMessages() { return log_messages; }

    void setBrokerName(const std::string &name) { mBrokerName = name; }
    std::string &getBrokerName() { return mBrokerName; }

   private:
    void parseMsg(const SvtKafka::SvtKafkaMessage &msg,
                  const SvtKafka::SvtKafkaMsgStatus &status);

    bool createConsumer_request();
    bool createProducer_request_reply();
    bool createProducer_heartbeat();

    std::shared_ptr<SvtKafka::SvtKafkaConsumer> mConsumer_request;
    std::shared_ptr<SvtKafka::SvtKafkaProducer> mProducer_request_reply;
    std::shared_ptr<SvtKafka::SvtKafkaProducer> mProducer_heartbeat;

    SvtDbAgentRequest *mRequest = SvtUtils::Singleton<SvtDbAgentRequest>::instance();

    std::string mBrokerName;

    bool log_messages = false;
  };
}  // namespace SvtDbAgent
