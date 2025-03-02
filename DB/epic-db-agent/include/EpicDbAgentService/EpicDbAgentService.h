#ifndef EPIC_DB_AGENT_SERVICE_H
#define EPIC_DB_AGENT_SERVICE_H

/*!
 * @file EpicDbAgent.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent manager
 */

// #include "EpicDb/EpicDbInterface.h"
#include "EpicUtilities/EpicLogger.h"

#include <librdkafka/rdkafkacpp.h>
#include <nlohmann/json.hpp>

#include <atomic>

class EpicDbAgentConsumer;

namespace RdKafka
{
  class Message;
};

extern std::atomic<int> consumer_run;

class EpicDbAgentMessage
{
 public:
  nlohmann::json headers = {};
  nlohmann::json payload = {};
};

class EpicDbAgentService
{
 public:
  ~EpicDbAgentService();

  static EpicDbAgentService &getInstance()
  {
    static EpicDbAgentService pinstance;
    return pinstance;
  }

  bool ConfigureDbAgentConsumer(bool do_conf_dump = false);
  void processMsgCb(RdKafka::Message *msg, void *opaque);

  // SvtDbAgentService *getAgentService() { return m_service; }

 private:
  EpicDbAgentService();
  EpicLogger &logger = EpicLogger::getInstance();
  EpicDbAgentConsumer *m_Consumer = nullptr;

  void parseMsg(EpicDbAgentMessage &msg);

  //! DB interface
  // nlohmann::ordered_json
  // GetAllWafers(std::vector<EpicDbInterface::dbWaferRecords> &wafers,
  //              const nlohmann::json &filters);
};

#endif  // !SVTDB_AGENT_H
