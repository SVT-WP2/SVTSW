#pragma once

/*!
 * @file SvtDbAgentProducer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Db-agent service producer
 */

#include "SvtKafkaUtils.h"

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

    bool createProducer();

    void setDrReportCb(const DrReport_fun_t &_fun) { mDeliveryReportCb = _fun; }
    void setEnableDrReportCb(const bool &_en) { mEnableDrReportCb = _en; }

    bool send(const std::string_view &topic,
              const nlohmann::json &headers,
              const std::string &data);

   private:
    std::shared_ptr<kafka::clients::producer::KafkaProducer> mProducer;

    std::string mBroker;
    ConfigMap_t mConfigs;

    bool mEnableDrReportCb = true;
    DrReport_fun_t mDeliveryReportCb;
  };
}  // namespace SvtKafka
