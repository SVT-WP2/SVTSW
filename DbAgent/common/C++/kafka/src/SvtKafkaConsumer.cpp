/*!
 * @file SvtKafkaConsumer.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Svt Kafka Consumer
 */

#include "SvtKafkaConsumer.h"
#include "SvtLogger.h"

#include <kafka/KafkaConsumer.h>
#include <kafka/Properties.h>

#include <chrono>
#include <memory>
#include <string_view>

using namespace SvtKafka;
using namespace kafka;
using namespace kafka::clients::consumer;

//========================================================================+
SvtKafkaConsumer::SvtKafkaConsumer(std::string_view broker, std::string_view topicName, const ConfigMap_t &configs)
  : mBroker(broker)
  , mTopicName(topicName)
  , mConfigs(configs)
{
  mKafkaComsumeCb = [](const ConsumerRecord &)
  { logWarning("Dummy consumer callback"); };
  createConsumer();
}

//========================================================================+
bool SvtKafkaConsumer::createConsumer()
{
  //! stop consumer
  mThread.setIsRunning(false);

  /*
   * Set configuration properties
   */
  Properties props({{"bootstrap.servers", mBroker}});
  props.put("enable.auto.commit", "false");
  for (const auto &[key, value] : mConfigs)
  {
    props.put(key, value);
  }
  mConsumer = std::make_unique<KafkaConsumer>(props);
  if (!mConsumer)
  {
    logError("Failed creating kafka consumer");
    return false;
  }
  logInfo("% Created consumer " + mConsumer->name(), SvtUtils::SvtLogger::STANDARD);

  mConsumer->subscribe({mTopicName});
  mConsumer->seekToEnd();

  return true;
}

//========================================================================+
bool SvtKafkaConsumer::start()
{
  logInfo("Starting Consumer " + mConsumer->name() +
          " in topic " + mTopicName);
  mThread.setName(mConsumer->name());
  mThread.start(std::bind(&SvtKafkaConsumer::pull, this));
  return true;
}

//========================================================================+
void SvtKafkaConsumer::pull()
{
  while (mThread.getIsRunning() && !mThread.getSuspended())
  {
    auto records = mConsumer->poll(std::chrono::milliseconds(kKafkaWaitTime_ms));
    for (const auto &record : records)
    {
      if (record.error().isFatal())
      {
        stop(false);
      }
      mKafkaComsumeCb(record);
    }
    //! commit asynchronous if there are records
    if (!records.empty())
    {
      mConsumer->commitAsync();
    }
  }
}

//========================================================================+
bool SvtKafkaConsumer::stop(const bool suspended)
{
  logWarning(std::string((suspended) ? "Suspending" : "Stoping") + " consumer " + mConsumer->name());
  mThread.stop(suspended);
  if (mConsumer)
  {
    mConsumer->commitSync();
    mConsumer->close();
  }
  return true;
}
