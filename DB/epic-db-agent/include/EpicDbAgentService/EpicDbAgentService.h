#ifndef EPIC_DB_AGENT_SERVICE_H
#define EPIC_DB_AGENT_SERVICE_H

/*!
 * @file EpicDbAgentService.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent manager
 */

#include <librdkafka/rdkafkacpp.h>
#include <nlohmann/json.hpp>
#include "EpicUtilities/EpicLogger.h"

#include <memory>
#include <sstream>

enum EpicDbAgentTopicEnum : uint8_t
{
  Request = 0,
  RequestReply,
  NumTopicNames = 2
};

const std::array<std::string_view, EpicDbAgentTopicEnum::NumTopicNames>
    topicNames = {{"epic.db-agent.request", "epic.db-agent.request.reply"}};

namespace RdKafka
{
  class Message;
};

class EpicDbAgentConsumer;
class EpicDbAgentProducer;

class EpicDbAgentMessage
{
 public:
  nlohmann::json headers = {};
  nlohmann::json payload = {};
};

class EpicDbAgentService
{
 public:
  EpicDbAgentService() = default;
  ~EpicDbAgentService() = default;

  bool ConfigureService(bool stop_eof = false, bool do_conf_dump = false);
  void ProcessMsgCb(RdKafka::Message *msg, void *opaque);
  void SetDebug(std::string debug) { m_debug = debug; }

  void StopConsumer(const bool suspeneded);

 private:
  EpicLogger &logger = Singleton<EpicLogger>::instance();

  void parseMsg(EpicDbAgentMessage &msg);

  std::shared_ptr<EpicDbAgentConsumer> m_Consumer;
  std::shared_ptr<EpicDbAgentProducer> m_Producer;

  std::shared_ptr<RdKafka::Conf> m_globalConf = std::shared_ptr<RdKafka::Conf>(
      RdKafka::Conf::create(RdKafka::Conf::CONF_GLOBAL));
  std::shared_ptr<RdKafka::Conf> m_cTopicConf = std::shared_ptr<RdKafka::Conf>(
      RdKafka::Conf::create(RdKafka::Conf::CONF_TOPIC));
  std::shared_ptr<RdKafka::Conf> m_pTopicConf = std::shared_ptr<RdKafka::Conf>(
      RdKafka::Conf::create(RdKafka::Conf::CONF_TOPIC));

  std::string m_brokerName = {"localhost:9092"};
  std::string m_errStr;
  std::string m_debug;
};

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
        //! TODO
        // Stop consumer and producer thread
        Singleton<EpicDbAgentService>::instance().StopConsumer(false);
      }
      msg << "ERROR (" << RdKafka::err2str(event.err()) << "): " << event.str();
      Singleton<EpicLogger>::instance().logError(msg.str());
      break;

    case RdKafka::Event::EVENT_STATS:
      Singleton<EpicLogger>::instance().logWarning("\"STATS\": " + event.str(),
                                                   EpicLogger::Mode::STANDARD);
      break;

    case RdKafka::Event::EVENT_LOG:
      msg.clear();
      msg << "LOG-" << event.severity() << "-" << event.fac() << ": "
          << event.str();
      Singleton<EpicLogger>::instance().logWarning(msg.str(),
                                                   EpicLogger::Mode::STANDARD);
      break;

    default:
      msg << "EVENT " << event.type() << " (" << RdKafka::err2str(event.err())
          << "): " << event.str();
      Singleton<EpicLogger>::instance().logInfo(msg.str(),
                                                EpicLogger::Mode::STANDARD);
      break;
    }
  }
};

#endif  // !SVTDB_AGENT_H
