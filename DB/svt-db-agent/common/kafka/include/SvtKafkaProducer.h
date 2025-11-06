#pragma once

/*!
 * @file SvtDbAgentProducer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Db-agent service producer
 */

#include <memory>
#include <string>

#include <librdkafka/rdkafkacpp.h>

#include "SvtKafkaThread.h"
#include "SvtKafkaUtils.h"
#include "SvtLogger.h"
#include "SvtUtilities.h"

namespace SvtKafka
{
  class SvtKafkaMessage;

  using SvtUtils::Singleton;
  using SvtUtils::SvtLogger;

  class SvtKafkaProducer
  {
   public:
    SvtKafkaProducer(const std::string &broker);
    ~SvtKafkaProducer()
    {
      stop(false);
    }

    bool createProducer();

    bool start();
    bool stop(const bool suspend = false);

    bool send(const std::string_view &topic, const SvtKafkaMessage &message);

   private:
    SvtLogger *mLogger = Singleton<SvtLogger>::instance();
    void push();

    std::shared_ptr<RdKafka::Producer> mProducer;

    int mPartition = 0;

    std::string mBroker;
    std::string mErrStr;
    std::string mDebug;

    bool mDumpConfig = false;

    SvtKafkaThread mThread;
    std::mutex mMutex;
    std::shared_ptr<SvtKafkaDeliveryReportCb> mDrReportCb;
  };
}  // namespace SvtKafka
