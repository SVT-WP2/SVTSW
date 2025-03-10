/*!
 * @file EpicDbAgentProducer.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Db-agent kafka service producer
 */

#include "EpicDbAgentService/EpicDbAgentProducer.h"

#include <librdkafka/rdkafkacpp.h>
#include <memory>

//========================================================================+
EpicDbAgentProducer::EpicDbAgentProducer(RdKafka::Conf *globalConf,
                                         RdKafka::Conf *topicConf)
  : m_globalConf(globalConf)
  , m_topicConf(topicConf)
{
  CreateProducer();
}

//========================================================================+
bool EpicDbAgentProducer::CreateProducer()
{
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
  RdKafka::ErrorCode resp = m_producer->produce(
      std::string(topicNames[EpicDbAgentTopicEnum::RequestReply]), m_partition,
      RdKafka::Producer::RK_MSG_COPY /*Copy payload*/,
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
  if (resp != RdKafka::ERR_NO_ERROR)
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

  m_producer->poll(0);

  return true;
}
