/*!
 * @file EpicDbAgentService.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent Kafka service
 */

#include "EpicDbAgentService/EpicDbAgentConsumer.h"

#include <librdkafka/rdkafkacpp.h>
#include <atomic>
#include <functional>
#include <thread>

std::atomic<int> consumer_run = 1;

//========================================================================+
bool EpicDbAgentConsumer::Configure(bool do_conf_dump)
{
  /*
   * Set configuration properties
   */
  m_globalConf->set("metadata.broker.list", m_brokerName, m_errStr);

  if (!m_debug.empty())
  {
    if (m_globalConf->set("debug", m_debug, m_errStr) !=
        RdKafka::Conf::CONF_OK)
    {
      logger.logError(m_errStr);
      return false;
    }
  }

  //========================================================================+
  EpicDbAgentEventCb ex_event_cb;
  m_globalConf->set("event_cb", &ex_event_cb, m_errStr);

  if (do_conf_dump)
  {
    int pass;

    for (pass = 0; pass < 2; pass++)
    {
      std::list<std::string> *dump;
      if (pass == 0)
      {
        dump = m_globalConf->dump();
        logger.logInfo("# Global config", EpicLogger::Mode::STANDARD);
      }
      else
      {
        dump = m_topicConf->dump();
        logger.logInfo("# Topic config", EpicLogger::Mode::STANDARD);
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
      logger.logInfo(ss.str(), EpicLogger::Mode::STANDARD);
    }
  }

  return CreateConsumer();
}

//========================================================================+
bool EpicDbAgentConsumer::CreateConsumer()
{
  //! stop consumer
  consumer_run = 0;

  //! Emit RD_KAFKA_RESP_ERR__PARTITION_EOF event whenever
  //! the consumer reaches the end of a partition.
  m_globalConf->set("enable.partition.eof", "true", m_errStr);

  /*
   * Create consumer using accumulated global configuration.
   */
  m_consumer = RdKafka::Consumer::create(m_globalConf, m_errStr);
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
  m_topic = RdKafka::Topic::create(m_consumer, std::string(topic_name),
                                   m_topicConf, m_errStr);
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
  RdKafka::ErrorCode resp =
      m_consumer->start(m_topic, m_partition, RdKafka::Topic::OFFSET_BEGINNING);
  // consumer->start(topic, partition, RdKafka::Topic::OFFSET_END);
  if (resp != RdKafka::ERR_NO_ERROR)
  {
    logger.logError("Failed to start consumer: " + RdKafka::err2str(resp));
    return false;
  }

  consumer_run = 1;
  logger.logInfo("Starting DbAgetnConsumer " + m_consumer->name() +
                     " in toppic " + m_topic->name(),
                 EpicLogger::Mode::STANDARD);
  std::thread consumerThread(std::bind(&EpicDbAgentConsumer::Start, this));
  if (consumerThread.joinable())
  {
    consumerThread.join();
  }
  return true;
}

//========================================================================+
void EpicDbAgentConsumer::Start()
{
  EpicDbAgentConsumeCb ex_consume_cb;

  bool cb = true;
  while (isRunning())
  {
    m_consumer->consume_callback(m_topic, m_partition, 1000, &ex_consume_cb,
                                 &cb);
    if (!cb)
    {
      // std::this_thread::sleep_for(std::chrono::milliseconds(kKafkaWaitTime_ms));
      consumer_run = 0;
    }
    m_consumer->poll(0);
  }
  /*
   * Stop consumer
   */
  this->Stop();
}

//========================================================================+
void EpicDbAgentConsumer::Stop()
{
  EpicLogger::getInstance().logInfo("Stopping DbAgetnConsumer " +
                                        m_consumer->name() + " in toppic " +
                                        m_topic->name(),
                                    EpicLogger::Mode::STANDARD);
  m_consumer->stop(m_topic, m_partition);
  m_consumer->poll(1000);
  delete m_topic;
  delete m_consumer;
}
