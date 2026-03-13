/*!
 * @file SvtKafkaConsumer.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Svt Kafka Consumer
 */

#include <memory>
#include <thread>

#include "SvtKafkaConsumer.h"
#include "SvtKafkaUtils.h"

using namespace SvtKafka;
//========================================================================+
SvtKafkaConsumer::SvtKafkaConsumer(const std::string &broker, const std::string &topic_name, bool stop_eof)
  : mBroker(broker)
  , mTopicName(topic_name)
  , mStopEof(stop_eof)
{
  mKafkaComsumeCb = std::shared_ptr<SvtKafkaConsumeCb>(new SvtKafkaConsumeCb());
  createConsumer();
}

//========================================================================+
void SvtKafkaConsumer::setConsumeCbFun(std::function<void(RdKafka::Message &, void *)> fun)
{
  mKafkaComsumeCb->setConsumeCbFun(fun);
}

//========================================================================+
bool SvtKafkaConsumer::createConsumer()
{
  //! stop consumer
  mThread.setIsRunning(false);

  /*
   * Set configuration properties
   */
  std::shared_ptr<RdKafka::Conf> mGlobalConf = std::shared_ptr<RdKafka::Conf>(
      RdKafka::Conf::create(RdKafka::Conf::CONF_GLOBAL));
  std::shared_ptr<RdKafka::Conf> mTopicConf = std::shared_ptr<RdKafka::Conf>(
      RdKafka::Conf::create(RdKafka::Conf::CONF_TOPIC));

  SvtKafka::setConfig(mGlobalConf.get(), "metadata.broker.list", mBroker);
  SvtKafka::setConfig(mGlobalConf.get(), "group.id", std::string("svt-db-agent"));
  SvtKafka::setConfig(mGlobalConf.get(), "allow.auto.create.topics", "true");

  if (!mDebug.empty())
  {
    SvtKafka::setConfig(mGlobalConf.get(), "debug", mDebug);
  }

  SvtKafkaEventCb event_cb(this);
  SvtKafka::setConfig(mGlobalConf.get(), "event_cb", &event_cb);

  if (mDumpConfig)
  {
    int pass;

    for (pass = 0; pass < 2; pass++)
    {
      std::list<std::string> *dump;
      switch (pass)
      {
      case 0:
        dump = mGlobalConf->dump();
        logDebug("# Global config");
        break;
      case 1:
        dump = mTopicConf->dump();
        logDebug("# Topic config");
        break;
      }

      std::ostringstream ss;
      for (std::list<std::string>::iterator it = dump->begin();
           it != dump->end();)
      {
        ss << *it << " = ";
        it++;
        ss << *it << std::endl;
        it++;
      }
      ss << std::endl;
      logDebug(ss.str());
    }
  }
  //! Emit RD_KAFKA_RESP_ERR__PARTITION_EOF event whenever
  //! the consumer reaches the end of a partition.
  SvtKafka::setConfig(mGlobalConf.get(), "enable.partition.eof", (mStopEof ? "true" : "false"));

  /*
   * Create consumer using accumulated global configuration.
   */
  mConsumer = std::shared_ptr<RdKafka::Consumer>(
      RdKafka::Consumer::create(mGlobalConf.get(), mErrStr));
  if (!mConsumer)
  {
    logError("Failed to create consumer: " + mErrStr);
    return false;
  }

  logInfo("% Created consumer " + mConsumer->name());

  /*
   * Create topic handle.
   */
  // auto &topic_name = topicNames[SvtKafkaTopicEnum::Request];
  mTopic = std::shared_ptr<RdKafka::Topic>(RdKafka::Topic::create(
      mConsumer.get(), mTopicName, mTopicConf.get(), mErrStr));
  if (!mTopic)
  {
    logError("Failed to create topic: " + mErrStr);
    return false;
  }

  /*
   * Start consumer for topic+partition at start offset
   */
  RdKafka::ErrorCode resp =
      mConsumer->start(mTopic.get(), mPartition, RdKafka::Topic::OFFSET_END);
  if (resp != RdKafka::ERR_NO_ERROR)
  {
    logError("Failed to start consumer: " + RdKafka::err2str(resp));
    return false;
  }
  return true;
}

//========================================================================+
bool SvtKafkaConsumer::start()
{
  logInfo("Starting Consumer " + mConsumer->name() +
          " in topic " + mTopic->name());
  mThread.setName(mConsumer->name());
  mThread.start(std::bind(&SvtKafkaConsumer::pull, this));
  return true;
}

//========================================================================+
void SvtKafkaConsumer::pull()
{
  bool cb = true;
  while (mThread.getIsRunning() && !mThread.getSuspended())
  {
    std::this_thread::sleep_for(std::chrono::milliseconds(kKafkaWaitTime_ms));
    mConsumer->consume_callback(mTopic.get(), mPartition, 1000, mKafkaComsumeCb.get(),
                                &cb);
    if (!cb)
    {
      stop(false);
    }
  }
}

//========================================================================+
bool SvtKafkaConsumer::stop(const bool suspended)
{
  mThread.stop(suspended);
  mConsumer->stop(mTopic.get(), mPartition);
  return true;
}
