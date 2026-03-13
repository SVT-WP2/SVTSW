#pragma once

/*!
 * @file SvtDbAgentConsumer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent kafka service
 */

#include <memory>
#include <string>

#include <librdkafka/rdkafkacpp.h>

#include "SvtKafkaThread.h"

namespace
{
  constexpr int kKafkaWaitTime_ms = 1;
}  // namespace

namespace RdKafka
{
  class Consumer;
  class Topic;
}  // namespace RdKafka

namespace SvtKafka
{
  class SvtKafkaConsumeCb;

  class SvtKafkaConsumer
  {
   public:
    SvtKafkaConsumer(const std::string &, const std::string &, bool stop_eof = false);
    ~SvtKafkaConsumer()
    {
      stop(false);
    }

    bool createConsumer();

    void setStopEof(const bool val) { mStopEof = val; }
    void setConsumeCbFun(std::function<void(RdKafka::Message &, void *)>);

    bool start();
    bool stop(const bool suspend = false);
    bool getIsRunning() { return mThread.getIsRunning(); }

   private:
    void pull();

    std::shared_ptr<RdKafka::Consumer> mConsumer;
    std::shared_ptr<RdKafka::Topic> mTopic;
    int mPartition = 0;

    static constexpr uint8_t kKafkaWaitTime_ms = 1;

    std::shared_ptr<SvtKafkaConsumeCb> mKafkaComsumeCb;

    std::string mBroker;
    std::string mTopicName;
    std::string mErrStr;
    std::string mDebug;

    bool mDumpConfig = false;
    bool mStopEof = false;

    SvtKafkaThread mThread;
  };
}  // namespace SvtKafka
