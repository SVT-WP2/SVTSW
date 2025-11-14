/*!
 * @file SvtDbAgentService.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @data Mar-2025
 * @brief Db agent
 */

#include <cstring>
#include <exception>
#include <functional>
#include <memory>
#include <sstream>
#include <string>
#include <vector>

#include "Database/DatabaseInterface.h"
#include "SvtKafkaMessage.h"
#include "SvtLogger.h"
#include "librdkafka/rdkafkacpp.h"

#include "SVTDbAgentDto/SvtDbEnumDto.h"
#include "SVTDbAgentService/SvtDbAgentService.h"
#include "SvtKafkaConsumer.h"
#include "SvtKafkaProducer.h"

using namespace SvtDbAgent;
using SvtKafka::SvtKafkaConsumer;
using SvtKafka::SvtKafkaMessage;
using SvtKafka::SvtKafkaProducer;
using SvtKafka::SvtKafkaReplyMsg;
//========================================================================+
SvtDbAgentService::SvtDbAgentService()
{
}

//===============================================~~=========================+
SvtDbAgentService::~SvtDbAgentService() { RdKafka::wait_destroyed(1000); }

//========================================================================+
bool SvtDbAgentService::initEnumTypeList()
{
  mLogger->logInfo("Initialize enum type list");
  std::vector<std::string> enum_types;

  auto *enumDto = Singleton<SvtDbEnumDto>::instance();

  if (!enumDto->getAllEnumTypesInDB(DatabaseInterface::getDbSchema(), enum_types))
  {
    return false;
  }
  for (auto &enum_type : enum_types)
  {
    std::string enum_name(DatabaseInterface::getDbSchema());
    enum_name += std::string(".");
    enum_name += "\"" + enum_type + "\"";

    std::vector<std::string> enum_values;
    if (!enumDto->getAllEnumValuesInDB(enum_name, enum_values))
    {
      return false;
    }
    for (auto &value : enum_values)
    {
      enumDto->addValue(enum_type, value);
    }
  }

  if (log_messages)
  {
    enumDto->print();
  }
  return true;
}

//========================================================================+
bool SvtDbAgentService::configureService(bool stop_eof)
{
  mConsumer = std::shared_ptr<SvtKafkaConsumer>(
      new SvtKafkaConsumer(mBrokerName, topicNames[Request], stop_eof));
  mConsumer->setConsumeCbFun(std::bind(&SvtDbAgentService::processMsgCb, this, std::placeholders::_1, std::placeholders::_2));
  mConsumer->start();
  mProducer =
      std::shared_ptr<SvtKafkaProducer>(new SvtKafkaProducer(mBrokerName));
  mProducer->start();

  return true;
}

//========================================================================+
void SvtDbAgentService::stopConsumer(const bool suspended)
{
  mConsumer->stop(suspended);
}

//========================================================================+
bool SvtDbAgentService::getIsConsRunnning()
{
  return mConsumer->getIsRunning();
}

//========================================================================+
void SvtDbAgentService::processMsgCb(RdKafka::Message &message, void *opaque)
{
  const RdKafka::Headers *headers;

  SvtKafkaReplyMsg svtMsg;
  SvtKafka::SvtKafkaMsgStatus status =
      SvtKafka::SvtKafkaMsgStatus::Success;
  switch (message.err())
  {
  case RdKafka::ERR__TIMED_OUT:
    mLogger->logError("KafkaError: ERR__TIMED_OUT");
    status = SvtKafka::SvtKafkaMsgStatus::UnexpectedError;
    break;

  case RdKafka::ERR_NO_ERROR:
    try
    {
      /* Real message */
      mLogger->logInfo("Read msg at offset " + std::to_string(message.offset()));
      if (message.key())
      {
        mLogger->logInfo("Key: " + *message.key());
      }
      headers = message.headers();
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
        auto bufferPayload = static_cast<const char *>(message.payload());
        svtMsg.setPayload(nlohmann::json::parse(
            bufferPayload, bufferPayload + static_cast<int>(message.len())));
        // printf("%.*s\n", static_cast<int>(message->len()),
        //        static_cast<const char *>(message->payload()));
      }
      status = SvtKafka::SvtKafkaMsgStatus::Success;
    }
    catch (const std::exception &e)
    {
      status = SvtKafka::SvtKafkaMsgStatus::UnexpectedError;
      THROW_RUNTIME_ERROR("Failed to parse kafka message: " + e.what());
    }
    break;

  case RdKafka::ERR__PARTITION_EOF:
    /* Last message */
    mLogger->logError("KafkaError: ERR__PARTITION_EOF");
    *(static_cast<bool *>(opaque)) = false;
    status = SvtKafka::SvtKafkaMsgStatus::UnexpectedError;
    break;

  case RdKafka::ERR__UNKNOWN_TOPIC:
  case RdKafka::ERR__UNKNOWN_PARTITION:
    mLogger->logError("KafkaError: Consume failed, " + message.errstr());
    *(static_cast<bool *>(opaque)) = false;
    status = SvtKafka::SvtKafkaMsgStatus::UnexpectedError;
    break;

  default:
    /* Errors */
    mLogger->logError("KafkaError: Consume failed, " + message.errstr());
    *(static_cast<bool *>(opaque)) = false;
    status = SvtKafka::SvtKafkaMsgStatus::UnexpectedError;
  }
  parseMsg(svtMsg, status);
}

//========================================================================+
void SvtDbAgentService::parseMsg(
    const SvtKafkaMessage &msg,
    const SvtKafka::SvtKafkaMsgStatus &_status)
{
  SvtKafka::SvtKafkaMsgStatus status = _status;
  std::string msgError;

  std::initializer_list<std::string_view> hdr_name_list = {
      "kafka_correlationId", "kafka_replyPartition"};
  const auto &msgHeader = msg.getHeaders();
  //! fill headers for reply message
  SvtKafkaReplyMsg replyMsg;
  for (const auto &header : hdr_name_list)
  {
    if (!msgHeader.contains(header))
    {
      msgError = "Failed to retrieve " + std::string(header) + " from message headers:\n";
      msgError += "Headers: " + msgHeader.dump();
      status = SvtKafka::SvtKafkaMsgStatus::BadRequest;
      break;
    }
    replyMsg.AddHeader(header,
                       msg.getHeaders()[header].get<std::string>().data());
  }
  replyMsg.AddHeader("kafka_nest-is-disposed", "00");

  if (status != SvtKafka::SvtKafkaMsgStatus::Success)
  {
    replyMsg.setType("");
    replyMsg.setStatus(SvtKafka::msgStatus[status]);
    replyMsg.setData(nlohmann::ordered_json());
    replyMsg.setError(-1, msgError);
    mLogger->logError(msgError);
  }
  else
  {
    auto type = msg.getPayload()["type"].get<std::string>();
    mLogger->logInfo("Received message with request type: " + type);
    if (type.empty())
    {
      mLogger->logError("Request have not type information. Skipping");
      replyMsg.setType("");
      replyMsg.setStatus(
          SvtKafka::msgStatus[SvtKafka::SvtKafkaMsgStatus::BadRequest]);
      replyMsg.setData(nlohmann::ordered_json());
      replyMsg.setError(-1, "Empty type");
    }
    else
    {
      replyMsg.setType(type + std::string("Reply"));
      try
      {
        if (!mRequest->findRequestAndRun(type, msg, replyMsg))
        {
          std::ostringstream ss;
          ss << "Error: Request " << type << " not Found";
          mLogger->logError(ss.str());
          replyMsg.setData(nlohmann::ordered_json());
          replyMsg.setStatus(SvtKafka::msgStatus
                                 [SvtKafka::SvtKafkaMsgStatus::BadRequest]);
          replyMsg.setError(-1, ss.str());
        }
      }
      catch (const std::exception &e)
      {
        mLogger->logError("Error: requesting " + type + ". " +
                          std::string(e.what()));
        replyMsg.setData(nlohmann::ordered_json());
        replyMsg.setStatus(
            SvtKafka::msgStatus[SvtKafka::SvtKafkaMsgStatus::BadRequest]);
        replyMsg.setError(-1, e.what());
      }
    }  //!<! request type is not empty
  }
  replyMsg.parsePayload();

  if (log_messages)
  {
    mLogger->logInfo("Request messages: \n" + std::string("Header = ") +
                     msg.getHeaders().dump() + std::string("\nPayload = ") +
                     msg.getPayload().dump());
    mLogger->logInfo("Reply messages: \n" + std::string("Header = ") +
                     replyMsg.getHeaders().dump() + std::string("\nPayload = ") +
                     replyMsg.getPayload().dump());
  }

  mProducer->send(topicNames[SvtDbAgentTopicEnum::RequestReply], replyMsg);
}
