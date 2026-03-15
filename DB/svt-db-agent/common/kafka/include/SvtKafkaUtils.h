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

namespace SvtKafka
{
  void setConfig(RdKafka::Conf *conf, const std::string &name, const std::string &value);
  void setConfig(RdKafka::Conf *conf, const std::string &name, RdKafka::EventCb *event_cb);
  void setConfig(RdKafka::Conf *conf, const std::string &name, RdKafka::DeliveryReportCb *dr_cb);

  bool checkKafkaConnection(const RdKafka::Conf *conf, RdKafka::Metadata *&metadata);

  void metadata_print(const std::string &topic,
                      const RdKafka::Metadata *metadata);

  class SvtKafkaEventCb : public RdKafka::EventCb
  {
   public:
    explicit SvtKafkaEventCb(SvtKafkaConsumer *consumer)
      : mConsumer(consumer)
    {
    }
    void event_cb(RdKafka::Event &event)
    {
      logInfo("SvtKafkaEventCb called.");
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
        logError(msg.str());
        break;

      case RdKafka::Event::EVENT_STATS:
        logWarning("\"STATS\": " + event.str());
        break;

      case RdKafka::Event::EVENT_LOG:
        msg.clear();
        msg << "LOG-" << event.severity() << "-" << event.fac() << ": "
            << event.str();
        logWarning(msg.str());
        break;

      default:
        msg << "EVENT " << event.type() << " (" << RdKafka::err2str(event.err())
            << "): " << event.str();
        logInfo(msg.str());
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
      logInfo(
          "Message delivery for (" + std::to_string(message.len()) +
          " bytes): " + status_name + ": " + message.errstr());
      if (message.key())
        logInfo("Key: " + *(message.key()));
    }
  };

  inline bool checkKafkaConnection(const RdKafka::Conf *conf, const bool &print_metadata)
  {
    std::string errstr;
    /*
     * Create dummy producer using accumulated global configuration.
     */
    std::unique_ptr<RdKafka::Producer> producer(RdKafka::Producer::create(conf, errstr));
    if (!producer)
    {
      logError("Failed to create producer: " + errstr);
      return false;
    }

    /*
     * Create topic handle.
     */
    // RdKafka::Topic *topic = NULL;
    // if (!topic_str.empty())
    // {
    //   topic = RdKafka::Topic::create(producer, topic_str, tconf, errstr);
    //   if (!topic)
    //   {
    //     std::cerr << "Failed to create topic: " << errstr << std::endl;
    //     exit(1);
    //   }
    // }

    class RdKafka::Metadata *metadata;

    /* Fetch metadata */
    RdKafka::ErrorCode err =
        producer->metadata(1, NULL, &metadata, 5000);
    if (err != RdKafka::ERR_NO_ERROR)
    {
      logError("%% Failed to acquire metadata: " + RdKafka::err2str(err));
      return false;
    }

    if (print_metadata)
      metadata_print("", metadata);

    delete metadata;
    return true;
  }

  inline void metadata_print(const std::string &topic,
                             const RdKafka::Metadata *metadata)
  {
    std::cout << "Metadata for " << (topic.empty() ? "" : "all topics")
              << "(from broker " << metadata->orig_broker_id() << ":"
              << metadata->orig_broker_name() << std::endl;

    /* Iterate brokers */
    std::cout << " " << metadata->brokers()->size() << " brokers:" << std::endl;
    RdKafka::Metadata::BrokerMetadataIterator ib;
    for (ib = metadata->brokers()->begin(); ib != metadata->brokers()->end();
         ++ib)
    {
      std::cout << "  broker " << (*ib)->id() << " at " << (*ib)->host() << ":"
                << (*ib)->port() << std::endl;
    }
    /* Iterate topics */
    std::cout << metadata->topics()->size() << " topics:" << std::endl;
    RdKafka::Metadata::TopicMetadataIterator it;
    for (it = metadata->topics()->begin(); it != metadata->topics()->end();
         ++it)
    {
      std::cout << "  topic \"" << (*it)->topic() << "\" with "
                << (*it)->partitions()->size() << " partitions:";

      if ((*it)->err() != RdKafka::ERR_NO_ERROR)
      {
        std::cout << " " << err2str((*it)->err());
        if ((*it)->err() == RdKafka::ERR_LEADER_NOT_AVAILABLE)
          std::cout << " (try again)";
      }
      std::cout << std::endl;

      /* Iterate topic's partitions */
      RdKafka::TopicMetadata::PartitionMetadataIterator ip;
      for (ip = (*it)->partitions()->begin(); ip != (*it)->partitions()->end();
           ++ip)
      {
        std::cout << "    partition " << (*ip)->id() << ", leader "
                  << (*ip)->leader() << ", replicas: ";

        /* Iterate partition's replicas */
        RdKafka::PartitionMetadata::ReplicasIterator ir;
        for (ir = (*ip)->replicas()->begin(); ir != (*ip)->replicas()->end();
             ++ir)
        {
          std::cout << (ir == (*ip)->replicas()->begin() ? "" : ",") << *ir;
        }

        /* Iterate partition's ISRs */
        std::cout << ", isrs: ";
        RdKafka::PartitionMetadata::ISRSIterator iis;
        for (iis = (*ip)->isrs()->begin(); iis != (*ip)->isrs()->end(); ++iis)
          std::cout << (iis == (*ip)->isrs()->begin() ? "" : ",") << *iis;

        if ((*ip)->err() != RdKafka::ERR_NO_ERROR)
          std::cout << ", " << RdKafka::err2str((*ip)->err()) << std::endl;
        else
          std::cout << std::endl;
      }
    }
  }

  //! RdKafka::Conf set
  inline void setConfig(RdKafka::Conf *conf, const std::string &name, const std::string &value)
  {
    std::string err_str;
    if (conf->set(name, value, err_str) != RdKafka::Conf::CONF_OK)
    {
      logError("Failed to set " + name + ": " + err_str);
    }
  }
  inline void setConfig(RdKafka::Conf *conf, const std::string &name, RdKafka::EventCb *event_cb)
  {
    std::string err_str;
    if (conf->set(name, event_cb, err_str) != RdKafka::Conf::CONF_OK)
    {
      logError("Failed to set " + name + ": " + err_str);
    }
  }
  inline void setConfig(RdKafka::Conf *conf, const std::string &name, RdKafka::DeliveryReportCb *dr_cb)
  {
    std::string err_str;
    if (conf->set(name, dr_cb, err_str) != RdKafka::Conf::CONF_OK)
    {
      logError("Failed to set " + name + ": " + err_str);
    }
  }
}  // namespace SvtKafka
