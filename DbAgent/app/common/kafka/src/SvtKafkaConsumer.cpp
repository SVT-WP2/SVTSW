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

using namespace SvtKafka;
using namespace kafka;
using namespace kafka::clients::consumer;

//========================================================================+
SvtKafkaConsumer::SvtKafkaConsumer(const Settings &_settings, const ConfigMap_t &configs)
  : mSettings(_settings)
  , mConfigs(configs)
{
  assert(!mSettings.broker.empty() && !mSettings.topicName.empty() && !mSettings.group_id.empty());
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
  Properties props({{"bootstrap.servers", mSettings.broker}});
  for (const auto &[key, value] : mConfigs)
  {
    props.put(key, value);
  }
  mConsumer = std::make_shared<KafkaConsumer>(props);
  if (!mConsumer)
  {
    logError("Failed creating kafka consumer");
    return false;
  }
  logInfo("% Created consumer " + mConsumer->name(), SvtUtils::SvtLogger::STANDARD);

  mConsumer->subscribe({mSettings.topicName});
  mConsumer->seekToEnd();

  return true;
}

//========================================================================+
bool SvtKafkaConsumer::start()
{
  logInfo("Starting Consumer " + mConsumer->name() +
          " in topic " + mSettings.topicName);
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
  }
}

//========================================================================+
bool SvtKafkaConsumer::stop(const bool suspended)
{
  logWarning(std::string((suspended) ? "Suspending" : "Stoping") + " consumer " + mConsumer->name());
  mThread.stop(suspended);
  if (mConsumer)
    mConsumer->close();
  return true;
}
