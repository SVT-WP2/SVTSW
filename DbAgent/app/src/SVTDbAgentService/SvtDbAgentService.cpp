/*!
 * @file SvtDbAgentService.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent
 */

#include "SVTDbAgentService/SvtDbAgentService.h"
#include "SvtKafkaConsumer.h"
#include "SvtKafkaMessage.h"
#include "SvtKafkaProducer.h"
#include "SvtLogger.h"
#include "magic_enum/magic_enum.hpp"

#include <kafka/AdminClient.h>
#include <kafka/ConsumerRecord.h>

#include <kafka/Properties.h>
#include <cstring>
#include <exception>
#include <functional>
#include <memory>
#include <sstream>
#include <string>
#include <vector>

// #include "librdkafka/rdkafkacpp.h"

using namespace SvtDbAgent;
using namespace kafka::clients::consumer;

using SvtKafka::SvtKafkaConsumer;
using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaProducer;
using SvtKafka::SvtKafkaReplyMsg;

//========================================================================+
bool SvtDbAgentService::configureService()
{
  createTopics();
  return (createConsumer_request() && createProducer_request_reply() && createProducer_heartbeat());
}

//========================================================================+
void SvtDbAgentService::createTopics()
{
  // Create adminClient
  kafka::Properties adminProps;
  adminProps.put("bootstrap.servers", mBrokerName);
  auto admin = kafka::clients::admin::AdminClient(adminProps);

  // get list of topics
  const auto &topics = admin.listTopics().topics;
  for (const auto &topicName : topicNames)
  {
    //! if topic exists check force delete else dont do nothing
    if (topics.find(topicName) != topics.end())
    {
      auto index = magic_enum::enum_cast<SvtDbAgentTopicEnum>(topicName);
      if (index.has_value() && forceTopicDelete[index.value()])
      {
        logInfo("Deleting topic " + topicName);
        const auto &deleteTopic = admin.deleteTopics({topicName});
      }
      else
      {
        continue;
      }
    }

    kafka::Properties topicProps;
    //! if Heartbeat topic use special configuration
    if (topicName == topicNames[SvtDbAgentTopicEnum::Heartbeat])
    {
      topicProps.put("retention.ms", "60000");
      topicProps.put("segment.ms", "120000");
    }
    logInfo("Creating topic " + topicName);
    admin.createTopics({topicName}, 1, 1, topicProps);
  }
}

//========================================================================+
bool SvtDbAgentService::createConsumer_request()
{
  try
  {
    SvtKafka::ConfigMap_t configs;
    configs["log_level"] = "4";
    configs["auto.offset.reset"] = "latest";
    configs["group.id"] = "svt.db-agent.request";
    configs["allow.auto.create.topics"] = "true";
    //! Emit RD_KAFKA_RESP_ERR__PARTITION_EOF event whenever
    //! the consumer reaches the end of a partition.
    configs["enable.partition.eof"] = "false";

    mConsumer_request = std::shared_ptr<SvtKafkaConsumer>(
        new SvtKafkaConsumer({mBrokerName, topicNames[Request]}, configs));
    mConsumer_request->setConsumeCbFun(std::bind(&SvtDbAgentService::processMsgCb, this, std::placeholders::_1));
    mConsumer_request->start();
  }
  catch (const std::exception &e)
  {
    logError(e.what());
    return false;
  }

  return true;
}

//========================================================================+
bool SvtDbAgentService::createProducer_request_reply()
{
  try
  {
    SvtKafka::ConfigMap_t configs;
    configs["log_level"] = "4";
    mProducer_request_reply =
        std::shared_ptr<SvtKafkaProducer>(new SvtKafkaProducer(mBrokerName, configs));
  }
  catch (const std::exception &e)
  {
    logError(e.what());
    return false;
  }

  return true;
}

//========================================================================+
bool SvtDbAgentService::createProducer_heartbeat()
{
  try
  {
    SvtKafka::ConfigMap_t configs;
    configs["log_level"] = "4";

    mProducer_heartbeat =
        std::shared_ptr<SvtKafkaProducer>(new SvtKafkaProducer(mBrokerName, configs));
    mProducer_heartbeat->setEnableDrReportCb(false);
  }
  catch (const std::exception &e)
  {
    logError(e.what());
    return false;
  }

  return true;
}

//========================================================================+
bool SvtDbAgentService::getIsConsRunnning()
{
  return mConsumer_request->getIsRunning();
}

//========================================================================+
void SvtDbAgentService::processMsgCb(const ConsumerRecord &record)
{
  SvtKafkaReplyMsg svtMsg;
  SvtKafka::SvtKafkaMsgStatus status =
      SvtKafka::SvtKafkaMsgStatus::Success;

  if (record.error())
  {
    logError(record.toString());
    status = SvtKafka::SvtKafkaMsgStatus::UnexpectedError;
  }

  try
  {
    /* Real message */
    logInfo("Read msg at offset " + std::to_string(record.offset()));
    if (record.key().size())
    {
      logInfo("Key: " + record.key().toString());
    }
    const auto &headers = record.headers();
    if (!headers.empty())
    {
      for (const auto &header : headers)
      {
        svtMsg.AddHeader(header.key, std::string(static_cast<const char *>(header.value.data()), header.value.size()));
      }
    }
    {
      svtMsg.setPayload(nlohmann::json::parse(record.value().toString()));
    }
    status = SvtKafka::SvtKafkaMsgStatus::Success;
  }
  catch (const std::exception &e)
  {
    status = SvtKafka::SvtKafkaMsgStatus::UnexpectedError;
    THROW_RUNTIME_ERROR("Failed to parse kafka message: " + e.what());
  }
  parseMsg(svtMsg, status);
}

//========================================================================+
void SvtDbAgentService::parseMsg(
    const SvtKafkaMessage &msg,
    const SvtKafka::SvtKafkaMsgStatus &_status)
{
  SvtKafka::SvtKafkaMsgStatus status = _status;
  std::string msgError;

  std::initializer_list<std::string_view> hdr_name_list = {
      "kafka_correlationId", "kafka_replyPartition"};
  const auto &msgHeader = msg.getHeaders();
  //! fill headers for reply message
  SvtKafkaReplyMsg replyMsg;
  for (const auto &header : hdr_name_list)
  {
    if (!msgHeader.contains(header))
    {
      msgError = "Failed to retrieve " + std::string(header) + " from message headers:\n";
      msgError += "Headers: " + msgHeader.dump();
      status = SvtKafka::SvtKafkaMsgStatus::BadRequest;
      break;
    }
    replyMsg.AddHeader(header,
                       msg.getHeaders()[header].get<std::string>().data());
  }
  replyMsg.AddHeader("kafka_nest-is-disposed", "00");

  if (status != SvtKafka::SvtKafkaMsgStatus::Success)
  {
    replyMsg.setType("");
    replyMsg.setStatus(SvtKafka::msgStatus[status]);
    replyMsg.setData(nlohmann::ordered_json());
    replyMsg.setError(-1, msgError);
    logError(msgError);
  }
  else
  {
    auto type = msg.getPayload()["type"].get<std::string>();
    logInfo("Received message with request type: " + type);
    if (type.empty())
    {
      logError("Request have not type information. Skipping");
      replyMsg.setType("");
      replyMsg.setStatus(
          SvtKafka::msgStatus[SvtKafka::SvtKafkaMsgStatus::BadRequest]);
      replyMsg.setData(nlohmann::ordered_json());
      replyMsg.setError(-1, "Empty type");
    }
    else
    {
      replyMsg.setType(type + std::string("Reply"));
      try
      {
        if (!mRequest->findRequestAndRun(type, msg, replyMsg))
        {
          std::ostringstream ss;
          ss << "Error: Request " << type << " not Found";
          logError(ss.str());
          replyMsg.setData(nlohmann::ordered_json());
          replyMsg.setStatus(SvtKafka::msgStatus
                                 [SvtKafka::SvtKafkaMsgStatus::BadRequest]);
          replyMsg.setError(-1, ss.str());
        }
      }
      catch (const std::exception &e)
      {
        logError("Error: requesting " + type + ". " +
                 std::string(e.what()));
        replyMsg.setData(nlohmann::ordered_json());
        replyMsg.setStatus(
            SvtKafka::msgStatus[SvtKafka::SvtKafkaMsgStatus::BadRequest]);
        replyMsg.setError(-1, e.what());
      }
    }  //!<! request type is not empty
  }
  replyMsg.parsePayload();

  if (log_messages)
  {
    logInfo("Request messages: \n" + std::string("Header = ") +
            msg.getHeaders().dump() + std::string("\nPayload = ") +
            msg.getPayload().dump());
    logInfo("Reply messages: \n" + std::string("Header = ") +
            replyMsg.getHeaders().dump() + std::string("\nPayload = ") +
            replyMsg.getPayload().dump());
  }

  mProducer_request_reply->send(topicNames[SvtDbAgentTopicEnum::RequestReply], replyMsg.getHeaders(), replyMsg.getPayload().dump());
}

//========================================================================+
void SvtDbAgentService::sendHeartbeat()
{
  nlohmann::json data = {{"timestamp", kafka::utility::getCurrentTime()}};
  if (mProducer_heartbeat)
  {
    mProducer_heartbeat->send(topicNames[SvtDbAgentTopicEnum::Heartbeat], {}, data.dump());
  }
}
