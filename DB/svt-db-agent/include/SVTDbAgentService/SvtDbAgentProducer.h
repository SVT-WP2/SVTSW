#ifndef SVT_DB_AGENT_PRODUCER_H
#define SVT_DB_AGENT_PRODUCER_H

/*!
 * @file SvtDbAgentProducer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Db-agent service producer
 */

#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

#include <librdkafka/rdkafkacpp.h>

#include <memory>
#include <string>

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
};

class SvtDbAgentProducer
{
 public:
  SvtDbAgentProducer(const std::string &broker);
  ~SvtDbAgentProducer()
  {
    while (m_producer->outq_len() > 0)
    {
      logger.logInfo("Waiting for " + std::to_string(m_producer->outq_len()));
      m_producer->poll(1000);
    }
  };

  bool createProducer();

  bool push(const std::string_view &topic,
            const SvtDbAgent::SvtDbAgentMessage &message);

 private:
  SvtLogger &logger = Singleton<SvtLogger>::instance();

  std::shared_ptr<RdKafka::Producer> m_producer;
  std::shared_ptr<RdKafka::Topic> m_topic;
  int m_partition = 0;

  std::string m_broker;
  std::string m_errStr;
  std::string m_debug;
  bool m_dumpConfig = false;
};

#endif  // !SVTDB_AGENT_H
