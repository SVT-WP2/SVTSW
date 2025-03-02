#ifndef EPIC_DB_AGENT_CONSUMER_H
#define EPIC_DB_AGENT_CONSUMER_H

/*!
 * @file EpicDbAgentService.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent kafka service
 */

#include "EpicDbAgentService.h"
#include "EpicUtilities/EpicLogger.h"

#include <librdkafka/rdkafkacpp.h>
#include <atomic>
#include <csignal>
#include <sstream>
#include <string>

extern std::atomic<int> consumer_run;

class SvtThread;

namespace
{
  constexpr int kKafkaWaitTime_ms = 1;

  enum EpicDbAgentTopicEnum : uint8_t
  {
    Request = 0,
    RequestReply,
    NumTopicNames = 2
  };

  const std::array<std::string_view, EpicDbAgentTopicEnum::NumTopicNames>
      topicNames = {{"epic.db-agent.request", "epic.db-agent.request.reply"}};
}  // namespace

class EpicDbAgentEventCb : public RdKafka::EventCb
{
 public:
  void event_cb(RdKafka::Event &event)
  {
    std::ostringstream msg;
    switch (event.type())
    {
    case RdKafka::Event::EVENT_ERROR:
      msg.clear();
      if (event.fatal())
      {
        msg << "FATAL ";
        consumer_run = 0;
      }
      msg << "ERROR (" << RdKafka::err2str(event.err()) << "): " << event.str();
      EpicLogger::getInstance().logError(msg.str());
      break;

    case RdKafka::Event::EVENT_STATS:
      EpicLogger::getInstance().logInfo("\"STATS\": " + event.str(),
                                        EpicLogger::Mode::STANDARD);
      break;

    case RdKafka::Event::EVENT_LOG:
      msg.clear();
      msg << "LOG-" << event.severity() << "-" << event.fac() << ": "
          << event.str();
      EpicLogger::getInstance().logInfo(msg.str(), EpicLogger::Mode::STANDARD);
      break;

    default:
      msg << "EVENT " << event.type() << " (" << RdKafka::err2str(event.err())
          << "): " << event.str();
      EpicLogger::getInstance().logInfo(msg.str(), EpicLogger::Mode::STANDARD);
      break;
    }
  }
};

class EpicDbAgentConsumeCb : public RdKafka::ConsumeCb
{
 public:
  void consume_cb(RdKafka::Message &msg, void *opaque)
  {
    EpicDbAgentService::getInstance().processMsgCb(&msg, opaque);
  }
};

class EpicDbAgentConsumer
{
 public:
  EpicDbAgentConsumer() = default;
  ~EpicDbAgentConsumer() = default;

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
