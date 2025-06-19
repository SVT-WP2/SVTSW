/*!
 * @file SvtDbAgentService.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent
 */

#include "SVTDbAgentService/SvtDbAgentService.h"
#include "SVTDbAgentDto/SvtDbAsicDto.h"
#include "SVTDbAgentDto/SvtDbEnumDto.h"
#include "SVTDbAgentDto/SvtDbWaferDto.h"
#include "SVTDbAgentDto/SvtDbWaferTypeDto.h"
#include "SVTDbAgentService/SvtDbAgentConsumer.h"
#include "SVTDbAgentService/SvtDbAgentProducer.h"
#include "SVTDbAgentService/SvtDbAgentRequest.h"
#include "SVTUtilities/SvtLogger.h"

#include "librdkafka/rdkafkacpp.h"

#include <cstring>
#include <exception>
#include <memory>
#include <ostream>
#include <sstream>
#include <string>
#include <vector>

//========================================================================+
SvtDbAgentService::~SvtDbAgentService() { RdKafka::wait_destroyed(5000); }

//========================================================================+
bool SvtDbAgentService::initEnumTypeList(const std::string &schema)
{
  logger.logInfo("Initialize enum type list");
  std::vector<std::string> enum_types;
  if (!SvtDbEnumDto::getAllEnumTypesInDB(schema, enum_types))
  {
    return false;
  }
  for (auto &enum_type : enum_types)
  {
    std::string enum_name(SvtDbAgent::db_schema);
    enum_name += std::string(".");
    enum_name += "\"" + enum_type + "\"";

    std::vector<std::string> enum_values;
    if (!SvtDbEnumDto::getAllEnumValuesInDB(enum_name, enum_values))
    {
      return false;
    }
    for (auto &value : enum_values)
    {
      SvtDbEnumDto::addValue(enum_type, value);
    }
  }

  if (log_messages)
  {
    SvtDbEnumDto::print();
  }
  return true;
}

//========================================================================+
bool SvtDbAgentService::configureService(bool stop_eof)
{
  m_Consumer = std::shared_ptr<SvtDbAgentConsumer>(
      new SvtDbAgentConsumer(m_brokerName, stop_eof));
  m_Producer =
      std::shared_ptr<SvtDbAgentProducer>(new SvtDbAgentProducer(m_brokerName));

  return true;
}

//========================================================================+
void SvtDbAgentService::stopConsumer(const bool suspended)
{
  m_Consumer->stop(suspended);
}

//========================================================================+
bool SvtDbAgentService::getIsConsRunnning()
{
  return m_Consumer->getIsRunning();
}

//========================================================================+
void SvtDbAgentService::processMsgCb(RdKafka::Message *message, void *opaque)
{
  const RdKafka::Headers *headers;

  SvtDbAgent::SvtDbAgentReplyMsg svtMsg;
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
        svtMsg.AddHeader(hdr.key().data(), hdr_val.data());
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
      svtMsg.setPayload(nlohmann::json::parse(
          bufferPayload, bufferPayload + static_cast<int>(message->len())));
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
void SvtDbAgentService::parseMsg(
    const SvtDbAgent::SvtDbAgentMessage &msg,
    const SvtDbAgent::SvtDbAgentMsgStatus &status)
{
  std::initializer_list<std::string_view> hdr_name_list = {
      "kafka_correlationId", "kafka_replyPartition"};
  //! fill headers for reply message
  SvtDbAgent::SvtDbAgentReplyMsg replyMsg;
  for (const auto &header : hdr_name_list)
  {
    replyMsg.AddHeader(header,
                       msg.getHeaders()[header].get<std::string>().data());
  }
  replyMsg.AddHeader("kafka_nest-is-disposed", "00");

  if (status != SvtDbAgent::SvtDbAgentMsgStatus::Success)
  {
    replyMsg.setType("");
    replyMsg.setStatus(SvtDbAgent::msgStatus[status]);
    replyMsg.setData(nlohmann::ordered_json());
    replyMsg.setError(-1, "");
  }
  else
  {
    auto type = msg.getPayload()["type"].get<std::string>();
    logger.logInfo("Received message with request type: " + type);
    if (type.empty())
    {
      logger.logError("Request have not type information. Skipping");
      replyMsg.setType("");
      replyMsg.setStatus(
          SvtDbAgent::msgStatus[SvtDbAgent::SvtDbAgentMsgStatus::BadRequest]);
      replyMsg.setData(nlohmann::ordered_json());
      replyMsg.setError(-1, "Empty type");
    }
    else
    {
      replyMsg.setType(type + std::string("Reply"));
      SvtDbAgent::RequestType reqType =
          SvtDbAgent::getRequestType(std::string_view(type.c_str()));
      try
      {
        switch (reqType)
        {
          //! enumValues
        case SvtDbAgent::RequestType::GetAllEnums:
          SvtDbEnumDto::getAllEnumValues(msg, replyMsg);
          break;
          //! Get all wafer types
        case SvtDbAgent::RequestType::GetAllWaferTypes:
          SvtDbWaferTypeDto::getAllWaferTypes(msg, replyMsg);
          break;
        //! Create wafer type
        case SvtDbAgent::RequestType::CreateWaferType:
          SvtDbWaferTypeDto::createWaferType(msg, replyMsg);
          break;
        //! Get all wafers
        case SvtDbAgent::RequestType::GetAllWafers:
          SvtDbWaferDto::getAllWafers(msg, replyMsg);
          break;
        //! Create wafer
        case SvtDbAgent::RequestType::CreateWafer:
          SvtDbWaferDto::createWafer(msg, replyMsg);
          break;
        //! Update wafer
        case SvtDbAgent::RequestType::UpdateWafer:
          SvtDbWaferDto::updateWafer(msg, replyMsg);
          break;
        //! UpdateWaferLocation
        case SvtDbAgent::RequestType::UpdateWaferLocation:
          SvtDbWaferDto::updateWaferLocation(msg, replyMsg);
          break;
        //! getAllAsics
        case SvtDbAgent::RequestType::GetAllAsics:
          SvtDbAsicDto::getAllAsics(msg, replyMsg);
          break;
        case SvtDbAgent::RequestType::CreateAsic:
          SvtDbAsicDto::createAsic(msg, replyMsg);
          break;
        //! Not Found
        case SvtDbAgent::RequestType::NotFound:
        default:
          std::ostringstream ss;
          ss << "Error: Request " << type << " not Found";
          logger.logError(ss.str());
          replyMsg.setData(nlohmann::ordered_json());
          replyMsg.setStatus(SvtDbAgent::msgStatus
                                 [SvtDbAgent::SvtDbAgentMsgStatus::BadRequest]);
          replyMsg.setError(-1, ss.str());
        }
      }
      catch (const std::exception &e)
      {
        logger.logError("Error: requesting " +
                        std::string(SvtDbAgent::m_requestType[reqType]) +
                        std::string(". ") + std::string(e.what()));
        replyMsg.setData(nlohmann::ordered_json());
        replyMsg.setStatus(
            SvtDbAgent::msgStatus[SvtDbAgent::SvtDbAgentMsgStatus::BadRequest]);
        replyMsg.setError(-1, e.what());
      }
    }  //!<! request type is not empty
  }
  replyMsg.parsePayload();

  if (log_messages)
  {
    logger.logInfo("Request messages: \n" + std::string("Header = ") +
                   msg.getHeaders().dump() + std::string("\nPayload = ") +
                   msg.getPayload().dump());
    logger.logInfo("Reply messages: \n" + std::string("Header = ") +
                   replyMsg.getHeaders().dump() + std::string("\nPayload = ") +
                   replyMsg.getPayload().dump());
  }

  m_Producer->push(topicNames[SvtDbAgentTopicEnum::RequestReply], replyMsg);
}
