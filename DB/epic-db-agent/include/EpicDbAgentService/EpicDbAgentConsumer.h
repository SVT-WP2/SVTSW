#ifndef EPIC_DB_AGENT_CONSUMER_H
#define EPIC_DB_AGENT_CONSUMER_H

/*!
 * @file EpicDbAgentConsumer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent kafka service
 */

#include "EpicDbAgentService.h"
#include "EpicUtilities/EpicLogger.h"

#include <librdkafka/rdkafkacpp.h>

#include <atomic>
#include <memory>
#include <thread>

namespace
{
  constexpr int kKafkaWaitTime_ms = 1;
}  // namespace

class EpicDbAgentConsumeCb : public RdKafka::ConsumeCb
{
 public:
  void consume_cb(RdKafka::Message &msg, void *opaque)
  {
    EpicDbAgentService::getInstance().ProcessMsgCb(&msg, opaque);
  }
};

class EpicDbAgentConsumer
{
 public:
  enum STATES : uint8_t
  {
    START = 0,
    SUSPEND,
    STOP
  };

  EpicDbAgentConsumer(RdKafka::Conf *globalConf, RdKafka::Conf *topicConf,
                      bool stop_eof = false);
  ~EpicDbAgentConsumer() = default;

  bool CreateConsumer();

  void SetStopEof(const bool val) { m_stop_eof = val; }

  bool GetIsRunning() { return m_running; }
  bool GetSuspended() { return m_suspended; }

  void SetIsRunning(const bool running) { m_running = running; }
  void SetSuspended(const bool suspended) { m_suspended = suspended; }

 private:
  EpicLogger &logger = Singleton<EpicLogger>::instance();

  bool Start();
  bool Stop(const bool suspend = false);
  void Pull();

  std::shared_ptr<RdKafka::Conf> m_globalConf;
  std::shared_ptr<RdKafka::Conf> m_topicConf;
  std::shared_ptr<RdKafka::Consumer> m_consumer;
  std::shared_ptr<RdKafka::Topic> m_topic;
  int m_partition = 0;
  std::string m_errStr;
  bool m_stop_eof = false;

  std::atomic<bool> m_running = false;
  std::atomic<bool> m_suspended = false;
  std::thread m_thread;
};

#endif  // !SVTDB_AGENT_H
