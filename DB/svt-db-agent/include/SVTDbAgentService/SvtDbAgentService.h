#ifndef SVT_DB_AGENT_SERVICE_H
#define SVT_DB_AGENT_SERVICE_H

/*!
 * @file SvtDbAgentService.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent manager
 */

#include "SVTDbAgentService/SvtDbAgentEnum.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"
#include "SvtDbAgentMessage.h"
#include "SvtDbAgentProducer.h"

#include <librdkafka/rdkafkacpp.h>
#include <cmath>
#include <nlohmann/json.hpp>

#include <cstdint>
#include <memory>
#include <string_view>

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

class SvtDbAgentService
{
 public:
  SvtDbAgentService() = default;
  ~SvtDbAgentService();

  bool initEnumTypeList(const std::string &schema = "prod");
  bool configureService(bool stop_eof = false);
  void processMsgCb(RdKafka::Message *msg, void *opaque);
  void setDebug(std::string debug) { m_debug = debug; }

  void stopConsumer(const bool suspeneded);
  bool getIsConsRunnning();

  void setLogMessages(const bool val) { log_messages = val; }
  bool getLogMessages() { return log_messages; }

  SvtDbAgentEnum &getEnumList() { return dbAgentEnumList; }

 private:
  SvtLogger &logger = Singleton<SvtLogger>::instance();

  void parseMsg(const SvtDbAgent::SvtDbAgentMessage &msg,
                const SvtDbAgent::SvtDbAgentMsgStatus &status);

  SvtDbAgentEnum dbAgentEnumList;

  std::shared_ptr<SvtDbAgentConsumer> m_Consumer;
  std::shared_ptr<SvtDbAgentProducer> m_Producer;

  std::string m_brokerName = {"localhost:9092"};
  std::string m_errStr;
  std::string m_debug;

  bool log_messages = false;
};

#endif  // !SVTDB_AGENT_H
