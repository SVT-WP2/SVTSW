#pragma once

/*!
 * @file SvtDbAgentProducer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Db-agent service producer
 */

#include "SvtKafkaUtils.h"

#include <kafka/KafkaProducer.h>

#include <nlohmann/json.hpp>

#include <string>
// #include <mutex>

namespace SvtKafka
{
  class SvtKafkaMessage;

  class SvtKafkaProducer
  {
   public:
    SvtKafkaProducer(const std::string &broker, const ConfigMap_t &configs = {});
    ~SvtKafkaProducer() = default;
    // {
    // stop(false);
    // }

    bool createProducer();

    // void setDrReportCb(const DrReport_fun_t &_fun) { mDeliveryReportCb = _fun; }

    // bool start();
    // bool stop(const bool suspend = false);

    bool send(const std::string_view &topic,
              const nlohmann::json &headers,
              const std::string &data);
    // bool send(const std::string_view &topic, const SvtKafkaMessage &message);

   private:
    // void push();

    std::shared_ptr<kafka::clients::producer::KafkaProducer> mProducer;

    std::string mBroker;
    ConfigMap_t mConfigs;

    // DrReport_fun_t mDeliveryReportCb;
  };
}  // namespace SvtKafka
