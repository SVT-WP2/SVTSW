#pragma once

/*!
 * @file SvtDbAgentCb.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Svt DbAgent CallBack
 */

#include <kafka/AdminClient.h>
#include <kafka/KafkaConsumer.h>
#include <kafka/KafkaProducer.h>

#include <functional>
#include <string>

namespace SvtKafka
{
  using ConfigMap_t = std::map<std::string, std::string>;
  using ConsumerCbFun_t = std::function<void(const kafka::clients::consumer::ConsumerRecord &)>;
  using DrReport_fun_t = std::function<void(const kafka::clients::producer::RecordMetadata &metadata, const kafka::Error &error)>;
}  // namespace SvtKafka
