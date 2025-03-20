#ifndef EPIC_DB_AGENT_PRODUCER_H
#define EPIC_DB_AGENT_PRODUCER_H

/*!
 * @file EpicDbAgentProducer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Db-agent service producer
 */

#include "EpicUtilities/EpicLogger.h"

#include <librdkafka/rdkafkacpp.h>

#include <memory>
#include <string>

class EpicDbAgentMessage;

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
