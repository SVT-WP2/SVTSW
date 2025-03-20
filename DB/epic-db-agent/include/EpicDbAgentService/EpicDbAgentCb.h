#ifndef EPIC_DB_AGENT_CB_H
#define EPIC_DB_AGENT_CB_H

/*!
 * @file EpicDbAgentCb.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Epic DbAgent CallBack
 */

#include "EpicDbAgentService.h"

#include <librdkafka/rdkafkacpp.h>

#include <sstream>

class EpicDbAgentEventCb : public RdKafka::EventCb
{
 public:
  void event_cb(RdKafka::Event &event)
  {
    Singleton<EpicLogger>::instance().logInfo("EpicDbAgentEventCb called.");
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

class EpicDbAgentConsumeCb : public RdKafka::ConsumeCb
{
 public:
  void consume_cb(RdKafka::Message &msg, void *opaque)
  {
    Singleton<EpicDbAgentService>::instance().ProcessMsgCb(&msg, opaque);
  }
};

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

#endif  // EPIC_DB_AGENT_CB_H
