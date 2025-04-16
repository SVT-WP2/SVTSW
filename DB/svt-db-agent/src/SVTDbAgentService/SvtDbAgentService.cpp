/*!
 * @file SvtDbAgentService.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent
 */

#include "SVTDbAgentService/SvtDbAgentService.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDbAgentService/SvtDbAgentConsumer.h"
#include "SVTDbAgentService/SvtDbAgentProducer.h"
#include "SVTDbAgentService/SvtDbAgentRequest.h"
#include "SVTUtilities/SvtLogger.h"

#include "librdkafka/rdkafkacpp.h"

#include <cstring>
#include <exception>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>

//========================================================================+
SvtDbAgentService::~SvtDbAgentService() { RdKafka::wait_destroyed(5000); }

//========================================================================+
bool SvtDbAgentService::ConfigureService(bool stop_eof)
{
  m_Consumer = std::shared_ptr<SvtDbAgentConsumer>(
      new SvtDbAgentConsumer(m_brokerName, stop_eof));
  m_Producer =
      std::shared_ptr<SvtDbAgentProducer>(new SvtDbAgentProducer(m_brokerName));

  return true;
}

//========================================================================+
void SvtDbAgentService::StopConsumer(const bool suspended)
{
  m_Consumer->Stop(suspended);
}

//========================================================================+
bool SvtDbAgentService::GetIsConsRunnning()
{
  return m_Consumer->GetIsRunning();
}

//========================================================================+
void SvtDbAgentService::ProcessMsgCb(RdKafka::Message *message, void *opaque)
{
  const RdKafka::Headers *headers;

  SvtDbAgentMessage svtMsg;
  SvtDbAgent::SvtDbAgentMsgStatus status =
      SvtDbAgent::SvtDbAgentMsgStatus::Success;
  switch (message->err())
  {
  case RdKafka::ERR__TIMED_OUT:
    logger.logError("KafkaError: ERR__TIMED_OUT");
    status = SvtDbAgent::SvtDbAgentMsgStatus::UnexpectedError;
    break;

  case RdKafka::ERR_NO_ERROR:
    /* Real message */
    logger.logInfo("Read msg at offset " + std::to_string(message->offset()),
                   SvtLogger::Mode::STANDARD);
    if (message->key())
    {
      logger.logInfo("Key: " + *message->key(), SvtLogger::Mode::STANDARD);
    }
    headers = message->headers();
    if (headers)
    {
      const auto &hdrs = headers->get_all();
      for (size_t i = 0; i < hdrs.size(); i++)
      {
        const auto &hdr = hdrs[i];

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
    status = SvtDbAgent::SvtDbAgentMsgStatus::Success;
    break;

  case RdKafka::ERR__PARTITION_EOF:
    /* Last message */
    logger.logError("KafkaError: ERR__PARTITION_EOF");
    *(static_cast<bool *>(opaque)) = false;
    status = SvtDbAgent::SvtDbAgentMsgStatus::UnexpectedError;
    break;

  case RdKafka::ERR__UNKNOWN_TOPIC:
  case RdKafka::ERR__UNKNOWN_PARTITION:
    logger.logError("KafkaError: Consume failed, " + message->errstr());
    *(static_cast<bool *>(opaque)) = false;
    status = SvtDbAgent::SvtDbAgentMsgStatus::UnexpectedError;
    break;

  default:
    /* Errors */
    logger.logError("KafkaError: Consume failed, " + message->errstr());
    *(static_cast<bool *>(opaque)) = false;
    status = SvtDbAgent::SvtDbAgentMsgStatus::UnexpectedError;
  }
  parseMsg(svtMsg, status);
}

//========================================================================+
void SvtDbAgentService::parseMsg(SvtDbAgentMessage &msg,
                                 SvtDbAgent::SvtDbAgentMsgStatus &status)
{
  //! fill headers for reply message
  nlohmann::json replyHeaders = nlohmann::json::object();
  replyHeaders["kafka_correlationId"] = msg.headers["kafka_correlationId"];
  replyHeaders["kafka_replyPartition"] = msg.headers["kafka_replyPartition"];
  replyHeaders["kafka_nest-is-disposed"] = std::string("00");

  //! reply message data field
  nlohmann::ordered_json replyData;

  if (status != SvtDbAgent::SvtDbAgentMsgStatus::Success)
  {
    replyData["status"] = status;
    replyData["data"] = std::string();
  }
  else
  {
    auto type = msg.payload["type"].get<std::string>();
    replyData["type"] = type + std::string("Reply");
    if (type.empty())
    {
      logger.logError("Request have not type information. Skipping");
      replyData["status"] =
          SvtDbAgent::msgStatus[SvtDbAgent::SvtDbAgentMsgStatus::BadRequest];
    }
    else
    {
      SvtDbAgent::RequestType reqType =
          SvtDbAgent::GetRequestType(std::string_view(type.c_str()));
      try
      {
        switch (reqType)
        {
          //! enumValues
        case SvtDbAgent::RequestType::GetAllWaferFoundries:
        case SvtDbAgent::RequestType::GetAllEngineeringRuns:
        case SvtDbAgent::RequestType::GetAllWaferTechnologies:
        case SvtDbAgent::RequestType::GetAllWaferSubMapOrientations:
        case SvtDbAgent::RequestType::GetAllAsicFamilyTypes:
        {
          getAllEnumValuesReplyMsg(reqType, replyData);
        }
        break;
          //! Get all wafer types
        case SvtDbAgent::RequestType::GetAllWaferTypes:
        {
          std::vector<int> id_filters;
          if (msg.payload.contains(std::string("filter")))
          {
            id_filters = msg.payload["filter"].get<std::vector<int>>();
          }
          SvtDbAgent::getAllWaferTypesReplyMsg(id_filters, replyData);
        }
        break;
          //! Create wafer type
        case SvtDbAgent::RequestType::CreateWaferType:
        {
          const auto &msgData = msg.payload["data"];
          if (!msgData.contains(std::string("create")))
          {
            throw std::runtime_error(
                "DbAgentService: Non object create was found");
          }
          SvtDbAgent::createWaferTypeReplyMsg(msgData["create"], replyData);
        }
        break;
          //! Get all wafers
        case SvtDbAgent::RequestType::GetAllWafers:
        {
          std::vector<int> id_filters;
          if (msg.payload.contains(std::string("filter")))
          {
            id_filters = msg.payload["filter"].get<std::vector<int>>();
          }
          SvtDbAgent::getAllWafersReplyMsg(id_filters, replyData);
        }
        break;
          //! Create wafer
        case SvtDbAgent::RequestType::CreateWafer:
        {
          const auto &msgData = msg.payload["data"];
          if (!msgData.contains(std::string("create")))
          {
            throw std::runtime_error(
                "DbAgentService: Non object create was found");
          }
          SvtDbAgent::createWaferReplyMsg(msgData["create"], replyData);
        }
        break;
          //! Not Found
        case SvtDbAgent::RequestType::NotFound:
        default:
          logger.logError("");
          replyData["status"] = SvtDbAgent::msgStatus
              [SvtDbAgent::SvtDbAgentMsgStatus::BadRequest];
        }
      }
      catch (const std::exception &e)
      {
        logger.logError("Error requesting " +
                        std::string(SvtDbAgent::m_requestType[reqType]) +
                        std::string(e.what()));
        replyData["data"]["items"] = std::string();
        replyData["status"] =
            SvtDbAgent::msgStatus[SvtDbAgent::SvtDbAgentMsgStatus::BadRequest];
        replyData["errMsg"] = e.what();
      }
    }  //!<! request type is not empty
  }
  SvtDbAgentMessage replyMsg;
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
