#ifndef SVT_DB_AGENT_CB_H
#define SVT_DB_AGENT_CB_H

/*!
 * @file SvtDbAgentCb.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Svt DbAgent CallBack
 */

#include "SvtDbAgentService.h"

#include <librdkafka/rdkafkacpp.h>

#include <sstream>

class SvtDbAgentEventCb : public RdKafka::EventCb
{
 public:
  void event_cb(RdKafka::Event &event)
  {
    SvtDbAgent::Singleton<SvtLogger>::instance().logInfo(
        "SvtDbAgentEventCb called.");
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
        SvtDbAgent::Singleton<SvtDbAgentService>::instance().stopConsumer(
            false);
      }
      msg << "ERROR (" << RdKafka::err2str(event.err()) << "): " << event.str();
      SvtDbAgent::Singleton<SvtLogger>::instance().logError(msg.str());
      break;

    case RdKafka::Event::EVENT_STATS:
      SvtDbAgent::Singleton<SvtLogger>::instance().logWarning(
          "\"STATS\": " + event.str(), SvtLogger::Mode::STANDARD);
      break;

    case RdKafka::Event::EVENT_LOG:
      msg.clear();
      msg << "LOG-" << event.severity() << "-" << event.fac() << ": "
          << event.str();
      SvtDbAgent::Singleton<SvtLogger>::instance().logWarning(
          msg.str(), SvtLogger::Mode::STANDARD);
      break;

    default:
      msg << "EVENT " << event.type() << " (" << RdKafka::err2str(event.err())
          << "): " << event.str();
      SvtDbAgent::Singleton<SvtLogger>::instance().logInfo(
          msg.str(), SvtLogger::Mode::STANDARD);
      break;
    }
  }
};

class SvtDbAgentConsumeCb : public RdKafka::ConsumeCb
{
 public:
  void consume_cb(RdKafka::Message &msg, void *opaque)
  {
    SvtDbAgent::Singleton<SvtDbAgentService>::instance().processMsgCb(&msg,
                                                                      opaque);
  }
};

class SvtDbAgentDeliveryReportCb : public RdKafka::DeliveryReportCb
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
    SvtDbAgent::Singleton<SvtLogger>::instance().logInfo(
        "Message delivery for (" + std::to_string(message.len()) +
        " bytes): " + status_name + ": " + message.errstr());
    if (message.key())
      SvtDbAgent::Singleton<SvtLogger>::instance().logInfo("Key: " +
                                                           *(message.key()));
  }
};

#endif  // SVT_DB_AGENT_CB_H
