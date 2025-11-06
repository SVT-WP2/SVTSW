/*!
 * @file SvtKafkaProducer.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Db-agent kafka service producer
 */

#include <memory>
#include <mutex>
#include <string>
#include <thread>

#include <librdkafka/rdkafkacpp.h>

#include "SvtKafkaMessage.h"
#include "SvtKafkaProducer.h"
#include "SvtKafkaUtils.h"

using namespace SvtKafka;
//========================================================================+
SvtKafkaProducer::SvtKafkaProducer(const std::string &broker)
  : mBroker(broker)
{
  mDrReportCb = std::shared_ptr<SvtKafkaDeliveryReportCb>(new SvtKafkaDeliveryReportCb());
  createProducer();
}

//========================================================================+
bool SvtKafkaProducer::createProducer()
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

  if (!mDebug.empty())
  {
    SvtKafka::setConfig(mGlobalConf.get(), "debug", mDebug);
  }

  SvtKafkaEventCb event_cb(NULL);
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
        mLogger->logInfo("# Global config");
        break;
      case 1:
        dump = mTopicConf->dump();
        mLogger->logInfo("# Topic config");
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
      mLogger->logInfo(ss.str());
    }
  }

  // /* Set delivery report callback */
  SvtKafka::setConfig(mGlobalConf.get(), "dr_cb", mDrReportCb.get());

  mGlobalConf->set("default_topic_conf", mTopicConf.get(), mErrStr);

  /*
   * Create producer using accumulated global configuration.
   */
  mProducer = std::shared_ptr<RdKafka::Producer>(
      RdKafka::Producer::create(mGlobalConf.get(), mErrStr));
  if (!mProducer)
  {
    mLogger->logError("Failed to create producer: " + mErrStr);
    return false;
  }

  mLogger->logInfo("% Created producer " + mProducer->name());

  return true;
}

//========================================================================+
bool SvtKafkaProducer::start()
{
  mLogger->logInfo("Starting Producer " + mProducer->name());
  mThread.setName(mProducer->name());
  mThread.start(std::bind(static_cast<void (SvtKafkaProducer::*)()>(&SvtKafkaProducer::push), this));
  return true;
}

//========================================================================+
void SvtKafkaProducer::push()
{
  while (mThread.getIsRunning() && !mThread.getSuspended())
  {
    std::this_thread::sleep_for(std::chrono::milliseconds(500));
    std::lock_guard<std::mutex> lk(mMutex);
    mProducer->poll(10);
  }
}

//========================================================================+
bool SvtKafkaProducer::stop(const bool suspended)
{
  mThread.stop(suspended);
  mProducer->flush(500);
  return true;
}

//========================================================================+
bool SvtKafkaProducer::send(const std::string_view &topic,
                            const SvtKafka::SvtKafkaMessage &message)
{
  std::lock_guard<std::mutex> lk(mMutex);
  if (!mThread.getIsRunning())
  {
    mLogger->logWarning("Producer " + ((mProducer) ? mProducer->name() : "") + " is not running. Message will not be sent.");
    return false;
  }
  RdKafka::Headers *headers = RdKafka::Headers::create();
  for (const auto &[hdr_name, hdr_value] : message.getHeaders().items())
  {
    headers->add(hdr_name, hdr_value);
  }
  /*
   * Produce message
   */
  const size_t payload_size = message.getPayload().dump().size();
  while (true)
  {
    RdKafka::ErrorCode resp = mProducer->produce(
        // std::string(topicNames[SvtKafkaTopicEnum::RequestReply]),
        // m_partition,
        std::string(topic), mPartition,
        RdKafka::Producer::RK_MSG_COPY /*Copy payload*/,
        /* Value */
        const_cast<char *>(message.getPayload().dump().c_str()), payload_size,
        /* Key */
        NULL, 0,
        /* Timestamp (defaults to now) */
        0,
        /* Message headers, if any */
        headers,
        /* Per-message opaque value passed to
         * delivery report */
        NULL);
    if (resp == RdKafka::ERR__QUEUE_FULL)
    {
      mProducer->poll(100);
      continue;
    }
    else if (resp != RdKafka::ERR_NO_ERROR)
    {
      mLogger->logError("% Produce failed: " + RdKafka::err2str(resp));
      delete headers;
    }
    else
    {
      mLogger->logInfo("% Produced message (" + std::to_string(payload_size) +
                       " bytes)");
      mProducer->poll(100);
    }
    break;
  }
  return true;
}
