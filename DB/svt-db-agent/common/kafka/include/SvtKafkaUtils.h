#pragma once

/*!
 * @file SvtDbAgentCb.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Svt DbAgent CallBack
 */

#include <functional>
#include <sstream>

#include <librdkafka/rdkafkacpp.h>
#include <string>

#include "SvtKafkaConsumer.h"
#include "SvtLogger.h"
#include "SvtUtilities.h"

namespace SvtKafka
{
  using SvtUtils::Singleton;
  using SvtUtils::SvtLogger;

  void setConfig(RdKafka::Conf *conf, const std::string &name, const std::string &value);
  void setConfig(RdKafka::Conf *conf, const std::string &name, RdKafka::EventCb *event_cb);
  void setConfig(RdKafka::Conf *conf, const std::string &name, RdKafka::DeliveryReportCb *dr_cb);

  static SvtLogger *logger = Singleton<SvtLogger>::instance();

  class SvtKafkaEventCb : public RdKafka::EventCb
  {
   public:
    explicit SvtKafkaEventCb(SvtKafkaConsumer *consumer)
      : mConsumer(consumer)
    {
    }
    void event_cb(RdKafka::Event &event)
    {
      logger->logInfo("SvtKafkaEventCb called.");
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
          if (mConsumer)
          {
            mConsumer->stop(false);
          }
        }
        msg << "ERROR (" << RdKafka::err2str(event.err()) << "): " << event.str();
        logger->logError(msg.str());
        break;

      case RdKafka::Event::EVENT_STATS:
        logger->logWarning("\"STATS\": " + event.str());
        break;

      case RdKafka::Event::EVENT_LOG:
        msg.clear();
        msg << "LOG-" << event.severity() << "-" << event.fac() << ": "
            << event.str();
        logger->logWarning(msg.str());
        break;

      default:
        msg << "EVENT " << event.type() << " (" << RdKafka::err2str(event.err())
            << "): " << event.str();
        logger->logInfo(msg.str());
        break;
      }
    }

   private:
    SvtKafkaConsumer *mConsumer;
  };

  class SvtKafkaConsumeCb : public RdKafka::ConsumeCb
  {
    using fun_type = std::function<void(RdKafka::Message &, void *)>;

   public:
    void setConsumeCbFun(const fun_type fun)
    {
      mFunConsumeCb = fun;
    }
    void consume_cb(RdKafka::Message &msg, void *opaque)
    {
      mFunConsumeCb(msg, opaque);
    }

   private:
    fun_type mFunConsumeCb;
  };

  class SvtKafkaDeliveryReportCb : public RdKafka::DeliveryReportCb
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
      logger->logInfo(
          "Message delivery for (" + std::to_string(message.len()) +
          " bytes): " + status_name + ": " + message.errstr());
      if (message.key())
        logger->logInfo("Key: " + *(message.key()));
    }
  };

  //! RdKafka::Conf set
  inline void setConfig(RdKafka::Conf *conf, const std::string &name, const std::string &value)
  {
    std::string err_str;
    if (conf->set(name, value, err_str) != RdKafka::Conf::CONF_OK)
    {
      logger->logError("Failed to set " + name + ": " + err_str);
    }
  }
  inline void setConfig(RdKafka::Conf *conf, const std::string &name, RdKafka::EventCb *event_cb)
  {
    std::string err_str;
    if (conf->set(name, event_cb, err_str) != RdKafka::Conf::CONF_OK)
    {
      logger->logError("Failed to set " + name + ": " + err_str);
    }
  }
  inline void setConfig(RdKafka::Conf *conf, const std::string &name, RdKafka::DeliveryReportCb *dr_cb)
  {
    std::string err_str;
    if (conf->set(name, dr_cb, err_str) != RdKafka::Conf::CONF_OK)
    {
      logger->logError("Failed to set " + name + ": " + err_str);
    }
  }
}  // namespace SvtKafka
