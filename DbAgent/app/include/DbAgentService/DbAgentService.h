#pragma once

/*!
 * @file SvtDbAgentService.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent manager
 */

#include <cstdint>
#include <memory>

#include <kafka/AdminClient.h>
#include <kafka/ConsumerRecord.h>

#include <nlohmann/json.hpp>

#include "DbAgentRequest.h"
#include "SvtKafkaAdminClient.h"
#include "SvtKafkaConsumer.h"
#include "SvtKafkaMessage.h"
#include "SvtKafkaProducer.h"

enum DbAgentTopicEnum : uint8_t
{
  Request = 0,
  RequestReply,
  Heartbeat,
  NumTopicNames = 3
};

const std::array<std::string, DbAgentTopicEnum::NumTopicNames>
    topicNames = {{"svt.db-agent.request", "svt.db-agent.request.reply", "svt.db-agent.heartbeat"}};

namespace RdKafka
{
  class Message;
};

namespace dbagent
{

  class DbAgentService
  {
   public:
    explicit DbAgentService() = default;
    ~DbAgentService() = default;

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

    void createTopics();

    bool createConsumer_request();
    bool createProducer_request_reply();
    bool createProducer_heartbeat();

    std::unique_ptr<SvtKafka::SvtKafkaAdminClient> mAdminClient;
    std::unique_ptr<SvtKafka::SvtKafkaConsumer> mConsumer_request;
    std::unique_ptr<SvtKafka::SvtKafkaProducer> mProducer_request_reply;
    std::unique_ptr<SvtKafka::SvtKafkaProducer> mProducer_heartbeat;

    DbAgentRequest *mRequest = SvtUtils::Singleton<DbAgentRequest>::instance();

    std::string mBrokerName;

    bool log_messages = false;
  };
}  // namespace dbagent
