/*!
 * @file SvtKafkaProducer.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Db-agent kafka service producer
 */

#include "SvtKafkaProducer.h"
// #include "SvtKafkaMessage.h"
#include "SvtKafkaUtils.h"
#include "SvtLogger.h"

#include <kafka/Header.h>
#include <kafka/KafkaProducer.h>
#include <kafka/Types.h>

#include <memory>
#include <string>

using namespace SvtKafka;
using namespace kafka;
using namespace kafka::clients::producer;

//========================================================================+
SvtKafkaProducer::SvtKafkaProducer(const std::string& broker, const ConfigMap_t& configs)
  : mBroker(broker)
  , mConfigs(configs)
{
  assert(!broker.empty());

  createProducer();
}

//========================================================================+
bool SvtKafkaProducer::createProducer()
{
  //! stop consumer
  // mThread.setIsRunning(false);

  Properties props({{"bootstrap.servers", mBroker}});
  for (const auto& [key, value] : mConfigs)
  {
    props.put(key, value);
  }

  mProducer = std::make_shared<KafkaProducer>(props);
  if (!mProducer)
  {
    logError("Failed to create producer: ");
    return false;
  }

  logInfo("% Created producer " + mProducer->name(), SvtUtils::SvtLogger::STANDARD);

  return true;
}

//========================================================================+
bool SvtKafkaProducer::send(const std::string_view& topic,
                            const nlohmann::json& headers,
                            const std::string& data)
{
  // const std::string payload = message.getPayload().dump();

  std::map<std::string, std::string> header_map;

  for (const auto& [key, value] : headers.items())
  {
    header_map.insert({key, value.get<std::string>()});
  }

  const Partition replyPartition = std::stoi(header_map["kafka_replyPartition"]);
  ProducerRecord record({std::string(topic)},
                        replyPartition,
                        NullKey,
                        Value{data.c_str(), data.size()});

  for (const auto& [key, value] : header_map)
  {
    record.headers().emplace_back(Header::Key(key), Header::Value(value.c_str(), value.size()));
  }

  // Prepare delivery callback
  auto mDeliveryReportCb = [data](const RecordMetadata& metadata, const Error& error)
  {
    if (!error)
    {
      logInfo(
          "Message delivered with (" + std::to_string(data.size()) +
          " bytes)");
      logInfo(metadata.toString());
    }
    else
    {
      logError("Message failed to be delivered: " + error.message());
    }
  };

  //! Prepare a message
  mProducer->send(record, mDeliveryReportCb, KafkaProducer::SendOption::ToCopyRecordValue);

  // Poll events (e.g. message delivery callback)
  mProducer->pollEvents(std::chrono::milliseconds(0));
  return true;
}
