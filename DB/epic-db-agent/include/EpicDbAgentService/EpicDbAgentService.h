#ifndef EPIC_DB_AGENT_SERVICE_H
#define EPIC_DB_AGENT_SERVICE_H

/*!
 * @file EpicDbAgentService.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent manager
 */

#include "EpicDb/EpicDbInterface.h"
#include "EpicDbAgentService/EpicDbAgentRequest.h"
#include "EpicUtilities/EpicLogger.h"

#include <librdkafka/rdkafkacpp.h>
#include <nlohmann/json.hpp>

#include <cstdint>
#include <memory>
#include <string_view>
#include <vector>

namespace EpicDbInterface
{
  struct dbWaferRecords;
}

enum EpicDbAgentTopicEnum : uint8_t
{
  Request = 0,
  RequestReply,
  NumTopicNames = 2
};

const std::array<std::string_view, EpicDbAgentTopicEnum::NumTopicNames>
    topicNames = {{"epic.db-agent.request", "epic.db-agent.request.reply"}};

enum EpicDbAgentMsgStatus : uint8_t
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

const std::array<std::string_view, EpicDbAgentMsgStatus::NumStatus> msgStatus =
    {{"Success", "BadRequest", "NotFound", "UnexpectedError"}};

namespace RdKafka
{
  class Message;
};

class EpicDbAgentConsumer;
class EpicDbAgentProducer;

class EpicDbAgentMessage
{
 public:
  nlohmann::json headers = {};
  nlohmann::json payload = {};
};

class EpicDbAgentService
{
 public:
  EpicDbAgentService() = default;
  ~EpicDbAgentService();

  bool ConfigureService(bool stop_eof = false);
  void ProcessMsgCb(RdKafka::Message *msg, void *opaque);
  void SetDebug(std::string debug) { m_debug = debug; }

  void StopConsumer(const bool suspeneded);
  bool GetIsConsRunnning();

 private:
  EpicLogger &logger = Singleton<EpicLogger>::instance();

  void parseMsg(EpicDbAgentMessage &msg, EpicDbAgentMsgStatus &status);

  //! Actions
  void getEnumReplyMsg(const EpicDbAgent::RequestType &reqType,
                       nlohmann::ordered_json &replyData);

  void getWaferReplyMsg(nlohmann::ordered_json &replyData,
                        std::vector<EpicDbInterface::dbWaferRecords> &wafers);
  void createWaferReplyMsg();

  std::shared_ptr<EpicDbAgentConsumer> m_Consumer;
  std::shared_ptr<EpicDbAgentProducer> m_Producer;

  std::string m_brokerName = {"localhost:9092"};
  std::string m_errStr;
  std::string m_debug;
};

#endif  // !SVTDB_AGENT_H
