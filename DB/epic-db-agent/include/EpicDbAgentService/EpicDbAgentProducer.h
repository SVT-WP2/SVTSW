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
#include <atomic>
#include <sstream>
#include <string>

extern std::atomic<int> producer_run;

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
    EpicLogger::getInstance().logInfo(
        "Message delivery for (" + std::to_string(message.len()) +
        " bytes): " + status_name + ": " + message.errstr());
    if (message.key())
      EpicLogger::getInstance().logInfo("Key: " + *(message.key()));
  }
};

class EpicDbAgentProducer
{
 public:
  EpicDbAgentProducer() = default;
  ~EpicDbAgentProducer() = default;

  bool Configure(bool do_conf_dump = true);
  bool isRunning() { return consumer_run; }

 private:
  EpicLogger &logger = EpicLogger::getInstance();

  RdKafka::Consumer *m_consumer = nullptr;
  RdKafka::Topic *m_topic = nullptr;
  RdKafka::Conf *m_globalConf =
      RdKafka::Conf::create(RdKafka::Conf::CONF_GLOBAL);
  RdKafka::Conf *m_topicConf = RdKafka::Conf::create(RdKafka::Conf::CONF_TOPIC);

  int m_partition = 0;

  std::string m_brokerName = {"localhost:9092"};
  std::string m_errStr;
  std::string m_debug;

  bool CreateConsumer();
  void Start();
  void Stop();
};

#endif  // !SVTDB_AGENT_H
