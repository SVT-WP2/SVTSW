#ifndef EPIC_DB_AGENT_PRODUCER_H
#define EPIC_DB_AGENT_PRODUCER_H

/*!
 * @file EpicDbAgentProducer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Db-agent service producer
 */

#include "EpicDbAgentService.h"
#include "EpicUtilities/EpicLogger.h"

#include <librdkafka/rdkafkacpp.h>
#include <string>

class EpicDbAgentDeliveryReportCb : public RdKafka::DeliveryReportCb
{
 public:
  void dr_cb(RdKafka::Message &message)
  {
    std::string status_name;
    switch (message.status())
    {
    case RdKafka::Message::MSG_STATUS_NOT_PERSISTED:
      status_name = "NotPersisted";
      break;
    case RdKafka::Message::MSG_STATUS_POSSIBLY_PERSISTED:
      status_name = "PossiblyPersisted";
      break;
    case RdKafka::Message::MSG_STATUS_PERSISTED:
      status_name = "Persisted";
      break;
    default:
      status_name = "Unknown?";
      break;
    }
    Singleton<EpicLogger>::instance().logInfo(
        "Message delivery for (" + std::to_string(message.len()) +
        " bytes): " + status_name + ": " + message.errstr());
    if (message.key())
      Singleton<EpicLogger>::instance().logInfo("Key: " + *(message.key()));
  }
};

class EpicDbAgentProducer
{
 public:
  EpicDbAgentProducer(const std::string &broker);
  ~EpicDbAgentProducer()
  {
    while (m_producer->outq_len() > 0)
    {
      logger.logInfo("Waiting for " + std::to_string(m_producer->outq_len()));
      m_producer->poll(1000);
    }
  };

  bool CreateProducer();

  bool Push(EpicDbAgentMessage &message);

 private:
  EpicLogger &logger = Singleton<EpicLogger>::instance();

  std::shared_ptr<RdKafka::Producer> m_producer;
  std::shared_ptr<RdKafka::Topic> m_topic;
  int m_partition = 0;

  std::string m_broker;
  std::string m_errStr;
  std::string m_debug;
  bool m_dumpConfig = false;
};

#endif  // !SVTDB_AGENT_H
