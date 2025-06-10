/*!
 * @file SvtDbAgentProducer.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Db-agent kafka service producer
 */

#include "SVTDbAgentService/SvtDbAgentProducer.h"
#include "SVTDbAgentService/SvtDbAgentCb.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"

#include <librdkafka/rdkafkacpp.h>
#include <chrono>
#include <memory>
#include <thread>

//========================================================================+
SvtDbAgentProducer::SvtDbAgentProducer(const std::string &broker)
  : m_broker(broker)
{
  CreateProducer();
}

//========================================================================+
bool SvtDbAgentProducer::CreateProducer()
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

  SvtDbAgentDeliveryReportCb dr_cb;

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
                 SvtLogger::Mode::STANDARD);

  return true;
}

//========================================================================+
bool SvtDbAgentProducer::Push(const std::string_view &topic,
                              const SvtDbAgent::SvtDbAgentMessage &message)
{
  RdKafka::Headers *headers = RdKafka::Headers::create();
  for (const auto &[hdr_name, hdr_value] : message.GetHeaders().items())
  {
    headers->add(hdr_name, hdr_value);
  }
  /*
   * Produce message
   */
  const size_t payload_size = message.GetPayload().dump().size();
  while (true)
  {
    RdKafka::ErrorCode resp = m_producer->produce(
        // std::string(topicNames[SvtDbAgentTopicEnum::RequestReply]),
        // m_partition,
        std::string(topic), m_partition,
        RdKafka::Producer::RK_MSG_COPY /*Copy payload*/,
        /* Value */
        const_cast<char *>(message.GetPayload().dump().c_str()), payload_size,
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
                     SvtLogger::Mode::STANDARD);
    }
    break;
  }
  m_producer->poll(0);
  std::this_thread::sleep_for(std::chrono::milliseconds(1000));
  return true;
}
