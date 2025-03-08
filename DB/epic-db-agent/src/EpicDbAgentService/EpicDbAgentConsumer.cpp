/*!
 * @file EpicDbAgentConsumer.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent Kafka service
 */

#include "EpicDbAgentService/EpicDbAgentConsumer.h"

#include <librdkafka/rdkafkacpp.h>
#include <functional>
#include <memory>
#include <thread>

//========================================================================+
EpicDbAgentConsumer::EpicDbAgentConsumer(RdKafka::Conf *globalConf,
                                         RdKafka::Conf *topicConf,
                                         bool stop_eof)
  : m_globalConf(globalConf)
  , m_topicConf(topicConf)
  , m_stop_eof(stop_eof)
{
  CreateConsumer();
}

bool EpicDbAgentConsumer::CreateConsumer()
{
  //! stop consumer
  m_running = 0;

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
                 EpicLogger::Mode::STANDARD);

  /*
   * Create topic handle.
   */
  auto &topic_name = topicNames[EpicDbAgentTopicEnum::Request];
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
  // RdKafka::ErrorCode resp = consumer->start(topic, partition, start_offset);
  RdKafka::ErrorCode resp = m_consumer->start(m_topic.get(), m_partition,
                                              RdKafka::Topic::OFFSET_BEGINNING);
  // consumer->start(topic, partition, RdKafka::Topic::OFFSET_END);
  if (resp != RdKafka::ERR_NO_ERROR)
  {
    logger.logError("Failed to start consumer: " + RdKafka::err2str(resp));
    return false;
  }

  return Start();
}

//========================================================================+
bool EpicDbAgentConsumer::Start()
{
  logger.logInfo("Starting DbAgetnConsumer " + m_consumer->name() +
                     " in toppic " + m_topic->name(),
                 EpicLogger::Mode::STANDARD);

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
  m_thread = std::thread(std::bind(&EpicDbAgentConsumer::Pull, this));

  return true;
}

//========================================================================+
void EpicDbAgentConsumer::Pull()
{
  EpicDbAgentConsumeCb ex_consume_cb;

  bool cb = true;
  while (GetIsRunning() && !GetSuspended())
  {
    m_consumer->consume_callback(m_topic.get(), m_partition, 1000,
                                 &ex_consume_cb, &cb);
    if (!cb)
    {
      Stop(false);
      // std::this_thread::sleep_for(std::chrono::milliseconds(kKafkaWaitTime_ms));
    }
    m_consumer->poll(0);
  }
}

//========================================================================+
bool EpicDbAgentConsumer::Stop(const bool suspended)
{
  if (suspended)
  {
    logger.logInfo("Suspended DbAgetnConsumer " + m_consumer->name() +
                       " in toppic " + m_topic->name(),
                   EpicLogger::Mode::STANDARD);
    SetSuspended(true);
    return true;
  }
  logger.logInfo("Stopping DbAgetnConsumer " + m_consumer->name() +
                     " in toppic " + m_topic->name(),
                 EpicLogger::Mode::STANDARD);
  SetIsRunning(false);
  m_consumer->stop(m_topic.get(), m_partition);
  m_consumer->poll(1000);
  return true;
}
