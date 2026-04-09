#pragma once

/*!
 * @file SvtDbAgentCb.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Svt DbAgent CallBack
 */

#include <kafka/KafkaConsumer.h>

#include <functional>
#include <string>

namespace SvtKafka
{
  using ConfigMap_t = std::map<std::string, std::string>;
  using ConsumerCbFun_t = std::function<void(const kafka::clients::consumer::ConsumerRecord &)>;
}  // namespace SvtKafka
