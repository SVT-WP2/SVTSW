/*!
 * @file EpicDbAgentProducer.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Db-agent kafka service producer
 */

#include "EpicDbAgentService/EpicDbAgentProducer.h"
#include "EpicDbAgentService/EpicDbAgentCb.h"

#include <librdkafka/rdkafkacpp.h>
#include <chrono>
#include <memory>
#include <thread>

//========================================================================+
EpicDbAgentProducer::EpicDbAgentProducer(const std::string &broker)
  : m_broker(broker)
{
  CreateProducer();
}

//========================================================================+
bool EpicDbAgentProducer::CreateProducer()
{
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

  EpicDbAgentEventCb event_cb;
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
        logger.logInfo("# Global config", EpicLogger::Mode::STANDARD);
        break;
      case 1:
        dump = m_topicConf->dump();
        logger.logInfo("# Topic config", EpicLogger::Mode::STANDARD);
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
      logger.logInfo(ss.str(), EpicLogger::Mode::STANDARD);
    }
  }

  EpicDbAgentDeliveryReportCb dr_cb;

  /* Set delivery report callback */
  m_globalConf->set("dr_cb", &dr_cb, m_errStr);

  m_globalConf->set("default_topic_conf", m_topicConf.get(), m_errStr);

  /*
   * Create producer using accumulated global configuration.
   */
  m_producer = std::shared_ptr<RdKafka::Producer>(
      RdKafka::Producer::create(m_globalConf.get(), m_errStr));
  if (!m_producer)
  {
    logger.logError("Failed to create producer: " + m_errStr);
    return false;
  }

  logger.logInfo("% Created producer " + m_producer->name(),
                 EpicLogger::Mode::STANDARD);

  return true;
}

//========================================================================+
bool EpicDbAgentProducer::Push(EpicDbAgentMessage &message)
{
  RdKafka::Headers *headers = RdKafka::Headers::create();
  for (const auto &[hdr_name, hdr_value] : message.headers.items())
  {
    headers->add(hdr_name, hdr_value);
  }
  /*
   * Produce message
   */
  size_t payload_size = message.payload.dump().size();
  while (true)
  {
    RdKafka::ErrorCode resp = m_producer->produce(
        std::string(topicNames[EpicDbAgentTopicEnum::RequestReply]),
        m_partition, RdKafka::Producer::RK_MSG_COPY /*Copy payload*/,
        /* Value */
        const_cast<char *>(message.payload.dump().c_str()), payload_size,
        /* Key */
        NULL, 0,
        /* Timestamp (defaults to now) */
        0,
        /* Message headers, if any */
        headers,
        /* Per-message opaque value passed to
         * delivery report */
        NULL);
    if (resp == RdKafka::ERR__QUEUE_FULL)
    {
      m_producer->poll(100);
      continue;
    }
    else if (resp != RdKafka::ERR_NO_ERROR)
    {
      logger.logError("% Produce failed: " + RdKafka::err2str(resp));
      delete headers;
    }
    else
    {
      logger.logInfo("% Produced message (" + std::to_string(payload_size) +
                         " bytes)",
                     EpicLogger::Mode::STANDARD);
    }
    break;
  }
  m_producer->poll(0);
  std::this_thread::sleep_for(std::chrono::milliseconds(1000));
  return true;
}
