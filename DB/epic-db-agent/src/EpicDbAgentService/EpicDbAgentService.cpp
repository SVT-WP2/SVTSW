/*!
 * @file EpicDbAgentService.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent
 */

#include "EpicDbAgentService/EpicDbAgentService.h"
#include "EpicDb/EpicDbInterface.h"
#include "EpicDbAgentService/EpicDbAgentConsumer.h"
#include "EpicDbAgentService/EpicDbAgentProducer.h"

#include "EpicUtilities/EpicLogger.h"
#include "librdkafka/rdkafkacpp.h"

#include <cstring>
#include <exception>
#include <memory>
#include <string>

//========================================================================+
EpicDbAgentService::~EpicDbAgentService() { RdKafka::wait_destroyed(5000); }

//========================================================================+
bool EpicDbAgentService::ConfigureService(bool stop_eof)
{
  m_Consumer = std::shared_ptr<EpicDbAgentConsumer>(
      new EpicDbAgentConsumer(m_brokerName, stop_eof));
  m_Producer = std::shared_ptr<EpicDbAgentProducer>(
      new EpicDbAgentProducer(m_brokerName));

  return true;
}

//========================================================================+
void EpicDbAgentService::StopConsumer(const bool suspended)
{
  m_Consumer->Stop(suspended);
}

//========================================================================+
bool EpicDbAgentService::GetIsConsRunnning()
{
  return m_Consumer->GetIsRunning();
}

//========================================================================+
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

//========================================================================+
void EpicDbAgentService::parseMsg(EpicDbAgentMessage &msg)
{
  nlohmann::json replyHeaders = nlohmann::json::object();
  replyHeaders["kafka_correlationId"] = msg.headers["kafka_correlationId"];
  replyHeaders["kafka_replyPartition"] = msg.headers["kafka_replyPartition"];
  replyHeaders["kafka_nest-is-disposed"] = std::string("00");

  auto type = msg.payload["type"].get<std::string>();

  nlohmann::ordered_json replyData;
  replyData["type"] = msg.payload["type"];

  if (type.empty())
  {
    logger.logError("Request have not type information. Skipping");
    replyData["status"] = msgStatus[EpicDbAgentMessageStatus::NotFound];
  }
  else if (!strcmp(type.c_str(), "GetAllWafers"))
  {
    try
    {
      std::vector<EpicDbInterface::dbWaferRecords> wafers;
      EpicDbInterface::getAllWafers(wafers);
      nlohmann::ordered_json items = nlohmann::json::array();

      for (const auto &wafer : wafers)
      {
        nlohmann::ordered_json json_wafer;
        json_wafer["id"] = wafer.id;
        json_wafer["serialNumber"] = wafer.serialNumber;
        json_wafer["batchNumber"] = wafer.batchNumber;
        json_wafer["engineeringRun"] = wafer.engineeringRun;
        json_wafer["foundry"] = wafer.foundry;
        json_wafer["technology"] = wafer.technology;
        json_wafer["thinningDate"] = wafer.thinningDate;
        json_wafer["dicingDate"] = wafer.dicingDate;
        json_wafer["waferType"] = wafer.waferType;

        items.push_back(json_wafer);
      }
      replyData["data"]["items"] = items;
      replyData["status"] = msgStatus[EpicDbAgentMessageStatus::Success];
    }
    catch (const std::exception &e)
    {
      logger.logError("Error getting Wafer from DB. " + std::string(e.what()));
    }
  }
  else
  {
    logger.logError("");
    replyData["status"] = msgStatus[EpicDbAgentMessageStatus::NotFound];
  }
  EpicDbAgentMessage replyMsg;
  replyMsg.headers = replyHeaders;
  replyMsg.payload = replyData;

  if (true)
  {
    logger.logInfo("Request messages: \n" + std::string("Header = ") +
                   msg.headers.dump() + std::string("\nPayload = ") +
                   msg.payload.dump());
    logger.logInfo("Reply messages: \n" + std::string("Header = ") +
                   replyMsg.headers.dump() + std::string("\nPayload = ") +
                   replyMsg.payload.dump());
  }

  m_Producer->Push(replyMsg);
}
