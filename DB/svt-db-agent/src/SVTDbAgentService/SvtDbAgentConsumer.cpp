/*!
 * @file EpicDbAgentConsumer.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent Kafka service
 */

#include "SVTDbAgentService/SvtDbAgentConsumer.h"
#include "SVTDbAgentService/SvtDbAgentCb.h"

#include <librdkafka/rdkafkacpp.h>
#include <chrono>
#include <functional>
#include <memory>
#include <thread>

//========================================================================+
SvtDbAgentConsumer::SvtDbAgentConsumer(const std::string &broker, bool stop_eof)
  : m_broker(broker)
  , m_stop_eof(stop_eof)
{
  CreateConsumer();
}

bool SvtDbAgentConsumer::CreateConsumer()
{
  //! stop consumer
  m_running = 0;

  /*
   * Set configuration properties
   */
  std::shared_ptr<RdKafka::Conf> m_globalConf = std::shared_ptr<RdKafka::Conf>(
      RdKafka::Conf::create(RdKafka::Conf::CONF_GLOBAL));

  std::shared_ptr<RdKafka::Conf> m_topicConf = std::shared_ptr<RdKafka::Conf>(
      RdKafka::Conf::create(RdKafka::Conf::CONF_TOPIC));

  m_globalConf->set("metadata.broker.list", m_broker, m_errStr);

  if (!m_debug.empty())
  {
    if (m_globalConf->set("debug", m_debug, m_errStr) !=
        RdKafka::Conf::CONF_OK)
    {
      logger.logError(m_errStr);
      return false;
    }
  }

  SvtDbAgentEventCb event_cb;
  m_globalConf->set("event_cb", &event_cb, m_errStr);

  if (m_dumpConfig)
  {
    int pass;

    for (pass = 0; pass < 2; pass++)
    {
      std::list<std::string> *dump;
      switch (pass)
      {
      case 0:
        dump = m_globalConf->dump();
        logger.logInfo("# Global config", SvtLogger::Mode::STANDARD);
        break;
      case 1:
        dump = m_topicConf->dump();
        logger.logInfo("# Topic config", SvtLogger::Mode::STANDARD);
        break;
      }

      std::ostringstream ss;
      for (std::list<std::string>::iterator it = dump->begin();
           it != dump->end();)
      {
        ss << *it << " = ";
        it++;
        ss << *it << std::endl;
        it++;
      }
      ss << std::endl;
      logger.logInfo(ss.str(), SvtLogger::Mode::STANDARD);
    }
  }
  //! Emit RD_KAFKA_RESP_ERR__PARTITION_EOF event whenever
  //! the consumer reaches the end of a partition.
  m_globalConf->set("enable.partition.eof", (m_stop_eof ? "true" : "false"),
                    m_errStr);

  /*
   * Create consumer using accumulated global configuration.
   */
  m_consumer = std::shared_ptr<RdKafka::Consumer>(
      RdKafka::Consumer::create(m_globalConf.get(), m_errStr));
  if (!m_consumer)
  {
    logger.logError("Failed to create consumer: " + m_errStr);
    return false;
  }

  logger.logInfo("% Created consumer " + m_consumer->name(),
                 SvtLogger::Mode::STANDARD);

  /*
   * Create topic handle.
   */
  auto &topic_name = topicNames[SvtDbAgentTopicEnum::Request];
  m_topic = std::shared_ptr<RdKafka::Topic>(RdKafka::Topic::create(
      m_consumer.get(), std::string(topic_name), m_topicConf.get(), m_errStr));
  if (!m_topic)
  {
    logger.logError("Failed to create topic: " + m_errStr);
    return false;
  }

  m_partition = 0;
  // int start_offset = 0;
  /*
   * Start consumer for topic+partition at start offset
   */
  // RdKafka::ErrorCode resp = consumer->start(topic, partition,
  // start_offset);
  RdKafka::ErrorCode resp =
      m_consumer->start(m_topic.get(), m_partition, RdKafka::Topic::OFFSET_END);
  // m_consumer->start(m_topic.get(), m_partition, 94);
  // consumer->start(topic, partition, RdKafka::Topic::OFFSET_END);
  if (resp != RdKafka::ERR_NO_ERROR)
  {
    logger.logError("Failed to start consumer: " + RdKafka::err2str(resp));
    return false;
  }

  return Start();
}

//========================================================================+
bool SvtDbAgentConsumer::Start()
{
  logger.logInfo("Starting DbAgetnConsumer " + m_consumer->name() +
                     " in toppic " + m_topic->name(),
                 SvtLogger::Mode::STANDARD);

  if (m_running)
  {
    if (GetSuspended())
    {
      SetSuspended(false);
      return true;
    }
    else
    {
      logger.logError("Error, start requested for already running thread");
      return false;  // start thread only once
    }
  }

  if (m_thread.joinable())
  {
    m_thread.join();
  }
  SetSuspended(false);
  m_running = true;
  m_thread = std::thread(std::bind(&SvtDbAgentConsumer::Pull, this));

  return true;
}

//========================================================================+
void SvtDbAgentConsumer::Pull()
{
  SvtDbAgentConsumeCb consume_cb;

  bool cb = true;
  while (GetIsRunning() && !GetSuspended())
  {
    std::this_thread::sleep_for(std::chrono::milliseconds(kKafkaWaitTime_ms));
    m_consumer->consume_callback(m_topic.get(), m_partition, 1000, &consume_cb,
                                 &cb);
    if (!cb)
    {
      Stop(false);
    }
    m_consumer->poll(0);
  }
}

//========================================================================+
bool SvtDbAgentConsumer::Stop(const bool suspended)
{
  if (suspended)
  {
    logger.logInfo("Suspended DbAgetnConsumer " + m_consumer->name() +
                       " in toppic " + m_topic->name(),
                   SvtLogger::Mode::STANDARD);
    SetSuspended(true);
    return true;
  }
  logger.logInfo("Stopping DbAgetnConsumer " + m_consumer->name() +
                     " in toppic " + m_topic->name(),
                 SvtLogger::Mode::STANDARD);
  SetIsRunning(false);
  m_consumer->stop(m_topic.get(), m_partition);
  m_consumer->poll(1000);
  return true;
}
