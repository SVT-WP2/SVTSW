/*!
 * @file EpicDbAgentService.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent
 */

#include "EpicDbAgentService/EpicDbAgentService.h"
#include "EpicDb/EpicDbInterface.h"
#include "EpicDbAgentService/EpicDbAgentConsumer.h"

#include "EpicUtilities/EpicLogger.h"
#include "librdkafka/rdkafkacpp.h"

#include <cstring>
#include <exception>
#include <memory>
#include <string>

bool EpicDbAgentService::ConfigureService(bool stop_eof, bool do_conf_dump)
{
  /*
   * Set configuration properties
   */
  m_globalConf->set("metadata.broker.list", m_brokerName, m_errStr);

  if (!m_debug.empty())
  {
    if (m_globalConf->set("debug", m_debug, m_errStr) !=
        RdKafka::Conf::CONF_OK)
    {
      logger.logError(m_errStr);
      return false;
    }
  }

  EpicDbAgentEventCb ex_event_cb;
  m_globalConf->set("event_cb", &ex_event_cb, m_errStr);

  if (do_conf_dump)
  {
    int pass;

    for (pass = 0; pass < 3; pass++)
    {
      std::list<std::string> *dump;
      switch (pass)
      {
      case 0:
        dump = m_globalConf->dump();
        logger.logInfo("# Global config", EpicLogger::Mode::STANDARD);
        break;
      case 1:
        dump = m_cTopicConf->dump();
        logger.logInfo("# Topic config", EpicLogger::Mode::STANDARD);
        break;
      case 2:
        dump = m_cTopicConf->dump();
        logger.logInfo("# Topic config", EpicLogger::Mode::STANDARD);
      }

      std::ostringstream ss;
      for (std::list<std::string>::iterator it = dump->begin();
           it != dump->end();)
      {
        ss << *it << " = ";
        it++;
        ss << *it << std::endl;
        it++;
      }
      ss << std::endl;
      logger.logInfo(ss.str(), EpicLogger::Mode::STANDARD);
    }
  }

  m_Consumer = std::shared_ptr<EpicDbAgentConsumer>(new EpicDbAgentConsumer(
      m_globalConf.get(), m_cTopicConf.get(), stop_eof));

  return true;
}

void EpicDbAgentService::ProcessMsgCb(RdKafka::Message *message, void *opaque)
{
  const RdKafka::Headers *headers;

  EpicDbAgentMessage svtMsg;
  switch (message->err())
  {
  case RdKafka::ERR__TIMED_OUT:
    break;

  case RdKafka::ERR_NO_ERROR:
    /* Real message */
    logger.logInfo("Read msg at offset " + std::to_string(message->offset()),
                   EpicLogger::Mode::STANDARD);
    if (message->key())
    {
      logger.logInfo("Key: " + *message->key(), EpicLogger::Mode::STANDARD);
    }
    headers = message->headers();
    if (headers)
    {
      std::vector<RdKafka::Headers::Header> hdrs = headers->get_all();
      for (size_t i = 0; i < hdrs.size(); i++)
      {
        const RdKafka::Headers::Header hdr = hdrs[i];

        std::string hdr_val;
        if (hdr.value() != NULL)
        {
          hdr_val =
              std::string((const char *) hdr.value(), (int) hdr.value_size());
        }
        else
        {
          hdr_val = "";
        }
        svtMsg.headers[hdr.key()] = hdr_val;
        // if (hdr.value() != NULL)
        // {
        //   printf(" Header: %s = \"%.*s\"\n", hdr.key().c_str(),
        //          (int) hdr.value_size(), (const char *) hdr.value());
        // }
        // else
        // {
        //   printf(" Header:  %s = NULL\n", hdr.key().c_str());
        // }
      }
    }
    {
      auto bufferPayload = static_cast<const char *>(message->payload());
      svtMsg.payload = nlohmann::json::parse(
          bufferPayload, bufferPayload + static_cast<int>(message->len()));
      // printf("%.*s\n", static_cast<int>(message->len()),
      //        static_cast<const char *>(message->payload()));
    }
    parseMsg(svtMsg);
    break;

  case RdKafka::ERR__PARTITION_EOF:
    /* Last message */
    *(static_cast<bool *>(opaque)) = false;
    break;

  case RdKafka::ERR__UNKNOWN_TOPIC:
  case RdKafka::ERR__UNKNOWN_PARTITION:
    logger.logError("Consume failed: " + message->errstr());
    *(static_cast<bool *>(opaque)) = false;
    break;

  default:
    /* Errors */
    logger.logError("Consume failed: " + message->errstr());
    *(static_cast<bool *>(opaque)) = false;
  }
}

void EpicDbAgentService::parseMsg(EpicDbAgentMessage &msg)
{
  logger.logInfo(msg.headers.dump(1));
  logger.logInfo(msg.payload.dump(1));

  nlohmann::json replyHeaders = nlohmann::json::object();
  replyHeaders["kafka_correlationId"] = msg.headers["kafka_correlationId"];

  nlohmann::ordered_json replyData;
  replyData["type"] = "GetAllWafersReply";

  auto type = msg.payload["type"].get<std::string>();
  if (type.empty())
  {
    logger.logError("Request have not type information. Skipping");
    return;
  }
  else if (!strcmp(type.c_str(), "GetAllWafers"))
  {
    try
    {
      std::vector<EpicDbInterface::dbWaferRecords> wafers;
      EpicDbInterface::getAllWafers(wafers);
      replyData["data"] = nlohmann::json::array();

      for (const auto &wafer : wafers)
      {
        nlohmann::ordered_json json_wafer;
        json_wafer["id"] = wafer.id;
        json_wafer["serialNumber"] = wafer.serialNumber;
        json_wafer["batchNumber"] = wafer.batchNumber;
        json_wafer["engineeringRun"] = wafer.engineeringRun;
        json_wafer["technology"] = wafer.technology;
        json_wafer["thinningDate"] = wafer.thinningDate;
        json_wafer["dicingDate"] = wafer.dicingDate;
        json_wafer["waferType"] = wafer.waferType;

        replyData["data"].push_back(json_wafer);
      }
    }
    catch (const std::exception &e)
    {
      logger.logError("Error getting Wafer from DB. " + std::string(e.what()));
    }
    logger.logInfo(replyHeaders.dump(1));
    logger.logInfo(replyData.dump(1));
    EpicDbAgentMessage replyMsg;
    replyMsg.headers = replyHeaders;
    replyMsg.payload = replyData;
  }
}
