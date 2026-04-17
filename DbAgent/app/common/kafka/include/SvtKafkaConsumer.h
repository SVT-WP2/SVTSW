#pragma once

/*!
 * @file SvtDbAgentConsumer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent kafka service
 */

#include "SvtKafkaThread.h"
#include "SvtKafkaUtils.h"

#include <memory>
#include <string>

// #include <librdkafka/rdkafkacpp.h>

namespace
{
  constexpr int kKafkaWaitTime_ms = 100;
}  // namespace

namespace RdKafka
{
  class Consumer;
  class Topic;
}  // namespace RdKafka

namespace SvtKafka
{
  class SvtKafkaConsumer
  {
   public:
    SvtKafkaConsumer(std::string_view broker, std::string_view topicName, const ConfigMap_t &configs = {});
    ~SvtKafkaConsumer()
    {
      stop(false);
    }

    bool createConsumer();

    void setConsumeCbFun(ConsumerCbFun_t _fun) { mKafkaComsumeCb = _fun; }

    bool start();
    bool stop(const bool suspend = false);
    bool getIsRunning() { return mThread.getIsRunning(); }

   private:
    void pull();

    std::shared_ptr<kafka::clients::consumer::KafkaConsumer> mConsumer;

    ConsumerCbFun_t mKafkaComsumeCb;

    std::string mBroker;
    std::string mTopicName;
    ConfigMap_t mConfigs;

    SvtKafkaThread mThread;
  };
}  // namespace SvtKafka
