/*!
 * @file DbAgentService.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent
 */

#include <librdkafka/rdkafka.h>
#include <librdkafka/rdkafkacpp.h>
#include <cstring>
#include <exception>
#include <functional>
#include <memory>
#include <string>
#include <vector>

#include "DbAgentService/DbAgentService.h"
#include "SvtLogger.h"

// #include "librdkafka/rdkafkacpp.h"

using namespace kafka::clients::consumer;

using SvtKafka::SvtKafkaConsumer;
using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaProducer;
using SvtKafka::SvtKafkaReplyMsg;

namespace dbagent
{
  //========================================================================+
  bool DbAgentService::configureService()
  {
    return (createConsumer_request() && createProducer_request_reply() && createProducer_heartbeat());
  }

  //========================================================================+
  bool DbAgentService::createConsumer_request()
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

      mConsumer_request = std::make_shared<SvtKafkaConsumer>(mBrokerName, topicNames[Request], configs);
      mConsumer_request->setConsumeCbFun(std::bind(&DbAgentService::processMsgCb, this, std::placeholders::_1));
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
  bool DbAgentService::createProducer_request_reply()
  {
    try
    {
      SvtKafka::ConfigMap_t configs;
      configs["log_level"] = "4";
      mProducer_request_reply =
          std::make_shared<SvtKafkaProducer>(mBrokerName, configs);
    }
    catch (const std::exception &e)
    {
      logError(e.what());
      return false;
    }

    return true;
  }

  //========================================================================+
  bool DbAgentService::createProducer_heartbeat()
  {
    try
    {
      // Create admin clien, conf, errbuf, sizeof(errbuf));
      const kafka::Properties props({{"bootstrap.servers", mBrokerName}});
      kafka::clients::admin::AdminClient AdminClient(props);

      const auto &topics = AdminClient.listTopics().topics;

      const std::string &topicName = topicNames[DbAgentTopicEnum::Heartbeat];
      if (topics.count(topicName))
      {
        std::string errstr;
        // 1. Create configuration object
        RdKafka::Conf *conf = RdKafka::Conf::create(RdKafka::Conf::CONF_GLOBAL);

        // 2. Set bootstrap brokers
        if (conf->set("bootstrap.servers", mBrokerName, errstr) != RdKafka::Conf::CONF_OK)
        {
          THROW_RUNTIME_ERROR("Error: " + errstr);
          return false;
        }

        /*
         * Create producer using accumulated global configuration.
         */
        RdKafka::Producer *producer = RdKafka::Producer::create(conf, errstr);
        if (!producer)
        {
          std::cerr << "Failed to create producer: " << errstr << std::endl;
          return false;
        }

        rd_kafka_AdminOptions_t *options;

        // 1. Define the Config Resource (Topic)
        rd_kafka_ConfigResource_t *resources[2];
        resources[0] = rd_kafka_ConfigResource_new(RD_KAFKA_RESOURCE_TOPIC, topicName.c_str());
        resources[1] = rd_kafka_ConfigResource_new(RD_KAFKA_RESOURCE_TOPIC, topicName.c_str());
        // 2. Set the Config Update (retention.ms = 1 day)
        rd_kafka_ConfigResource_set_config(resources[0], "retention.ms", "60000");
        rd_kafka_ConfigResource_set_config(resources[1], "segment.ms", "120000");

        // 3. Create Admin Options
        options = rd_kafka_AdminOptions_new(producer->c_ptr(), RD_KAFKA_ADMIN_OP_ALTERCONFIGS);

        // 4. Call AlterConfigs
        rd_kafka_AlterConfigs(producer->c_ptr(), resources, 2, options,
                              rd_kafka_queue_get_main(producer->c_ptr()));

        // 5. Clean up
        rd_kafka_AdminOptions_destroy(options);
        rd_kafka_ConfigResource_destroy(resources[0]);
        rd_kafka_ConfigResource_destroy(resources[1]);
      }
      else
      {
        kafka::Properties topicProps;
        topicProps.put("retention.ms", "60000");
        topicProps.put("segment.ms", "120000");
        AdminClient.createTopics({topicNames[DbAgentTopicEnum::Heartbeat]}, 1, 1, topicProps);
      }

      SvtKafka::ConfigMap_t configs;
      configs["log_level"] = "4";

      mProducer_heartbeat =
          std::make_shared<SvtKafkaProducer>(mBrokerName, configs);
      mProducer_heartbeat->setEnableDrReportCb(false);

      // Create admin clien, conf, errbuf, sizeof(errbuf));
      mAdminClient = std::make_shared<SvtKafkaAdminClient>(mBrokerName);
      const auto &topics = mAdminClient->getAdmin()->listTopics().topics;

      const std::string &topicName = topicNames[DbAgentTopicEnum::Heartbeat];
      if (topics.count(topicName))
      {
        std::string errstr;
        // 1. Create configuration object
        RdKafka::Conf *conf = RdKafka::Conf::create(RdKafka::Conf::CONF_GLOBAL);

        // 2. Set bootstrap brokers
        if (conf->set("bootstrap.servers", mBrokerName, errstr) != RdKafka::Conf::CONF_OK)
        {
          THROW_RUNTIME_ERROR("Error: " + errstr);
          return false;
        }

        /*
         * Create producer using accumulated global configuration.
         */
        RdKafka::Producer *producer = RdKafka::Producer::create(conf, errstr);
        if (!producer)
        {
          std::cerr << "Failed to create producer: " << errstr << std::endl;
          return false;
        }

        rd_kafka_AdminOptions_t *options;

        // 1. Define the Config Resource (Topic)
        rd_kafka_ConfigResource_t *resources[2];
        resources[0] = rd_kafka_ConfigResource_new(RD_KAFKA_RESOURCE_TOPIC, topicName.c_str());
        resources[1] = rd_kafka_ConfigResource_new(RD_KAFKA_RESOURCE_TOPIC, topicName.c_str());
        // 2. Set the Config Update (retention.ms = 1 day)
        rd_kafka_ConfigResource_set_config(resources[0], "retention.ms", "60000");
        rd_kafka_ConfigResource_set_config(resources[1], "segment.ms", "120000");

        // 3. Create Admin Options
        options = rd_kafka_AdminOptions_new(producer->c_ptr(), RD_KAFKA_ADMIN_OP_ALTERCONFIGS);

        // 4. Call AlterConfigs
        rd_kafka_AlterConfigs(producer->c_ptr(), resources, 2, options,
                              rd_kafka_queue_get_main(producer->c_ptr()));

        // 5. Clean up
        rd_kafka_AdminOptions_destroy(options);
        rd_kafka_ConfigResource_destroy(resources[0]);
        rd_kafka_ConfigResource_destroy(resources[1]);
      }
      else
      {
        kafka::Properties topicProps;
        topicProps.put("retention.ms", "60000");
        topicProps.put("segment.ms", "120000");
        mAdminClient->getAdmin()->createTopics({topicNames[DbAgentTopicEnum::Heartbeat]}, 1, 1, topicProps);
      }
    }
    catch (const std::exception &e)
    {
      logError(e.what());
      return false;
    }

    return true;
  }

  //========================================================================+
  bool DbAgentService::getIsConsRunnning()
  {
    return mConsumer_request->getIsRunning();
  }

  //========================================================================+
  void DbAgentService::processMsgCb(const ConsumerRecord &record)
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
  void DbAgentService::parseMsg(
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

    mProducer_request_reply->send(topicNames[DbAgentTopicEnum::RequestReply], replyMsg.getHeaders(), replyMsg.getPayload().dump());
  }

  //========================================================================+
  void DbAgentService::sendHeartbeat()
  {
    nlohmann::json data = {{"timestamp", SvtUtils::getCurrentTime()}};
    if (mProducer_heartbeat)
    {
      mProducer_heartbeat->send(topicNames[DbAgentTopicEnum::Heartbeat], {}, data.dump());
    }
  }
}  // namespace dbagent
