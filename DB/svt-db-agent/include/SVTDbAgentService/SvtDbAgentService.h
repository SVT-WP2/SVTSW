#ifndef SVT_DB_AGENT_SERVICE_H
#define SVT_DB_AGENT_SERVICE_H

/*!
 * @file SvtDbAgentService.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent manager
 */

#include "SVTDbAgentService/SvtDbAgentRequest.h"
#include "SVTUtilities/SvtLogger.h"

#include <librdkafka/rdkafkacpp.h>
#include <nlohmann/json.hpp>

#include <cstdint>
#include <memory>
#include <string_view>
#include <vector>

namespace SvtDbInterface
{
  struct dbWaferRecords;
}

enum SvtDbAgentTopicEnum : uint8_t
{
  Request = 0,
  RequestReply,
  NumTopicNames = 2
};

const std::array<std::string_view, SvtDbAgentTopicEnum::NumTopicNames>
    topicNames = {{"svt.db-agent.request", "svt.db-agent.request.reply"}};

namespace RdKafka
{
  class Message;
};

class SvtDbAgentConsumer;
class SvtDbAgentProducer;

class SvtDbAgentMessage
{
 public:
  nlohmann::json headers = {};
  nlohmann::json payload = {};
};

class SvtDbAgentService
{
 public:
  SvtDbAgentService() = default;
  ~SvtDbAgentService();

  bool ConfigureService(bool stop_eof = false);
  void ProcessMsgCb(RdKafka::Message *msg, void *opaque);
  void SetDebug(std::string debug) { m_debug = debug; }

  void StopConsumer(const bool suspeneded);
  bool GetIsConsRunnning();

 private:
  SvtLogger &logger = Singleton<SvtLogger>::instance();

  void parseMsg(SvtDbAgentMessage &msg,
                SvtDbAgent::SvtDbAgentMsgStatus &status);

  std::shared_ptr<SvtDbAgentConsumer> m_Consumer;
  std::shared_ptr<SvtDbAgentProducer> m_Producer;

  std::string m_brokerName = {"localhost:9092"};
  std::string m_errStr;
  std::string m_debug;
};

#endif  // !SVTDB_AGENT_H
