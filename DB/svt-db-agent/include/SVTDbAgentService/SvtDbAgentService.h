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

enum SvtDbAgentMsgStatus : uint8_t
{
  // sucess
  Success = 0,
  // message data has invalid format
  BadRequest,
  // requested entity does not exist
  NotFound,
  // is not able to process the request, some unexpected error
  UnexpectedError,
  // Num of message status
  NumStatus
};

const std::array<std::string_view, SvtDbAgentMsgStatus::NumStatus> msgStatus = {
    {"Success", "BadRequest", "NotFound", "UnexpectedError"}};

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

  void parseMsg(SvtDbAgentMessage &msg, SvtDbAgentMsgStatus &status);

  //! Actions
  void getEnumReplyMsg(const SvtDbAgent::RequestType &reqType,
                       nlohmann::ordered_json &replyData);
  void getWaferReplyMsg(const std::vector<int> &id_filters,
                        nlohmann::ordered_json &replyData);
  void createWaferReplyMsg(const nlohmann::json &json_wafer,
                           nlohmann::ordered_json &replyData);

  std::shared_ptr<SvtDbAgentConsumer> m_Consumer;
  std::shared_ptr<SvtDbAgentProducer> m_Producer;

  std::string m_brokerName = {"localhost:9092"};
  std::string m_errStr;
  std::string m_debug;
};

#endif  // !SVTDB_AGENT_H
