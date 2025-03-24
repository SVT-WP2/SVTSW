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
#include "SVTUtilities/SvtLogger.h"

#include "librdkafka/rdkafkacpp.h"

#include <cstring>
#include <exception>
#include <memory>
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
  SvtDbAgentMsgStatus status = SvtDbAgentMsgStatus::Success;
  switch (message->err())
  {
  case RdKafka::ERR__TIMED_OUT:
    logger.logError("KafkaError: ERR__TIMED_OUT");
    status = SvtDbAgentMsgStatus::UnexpectedError;
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
    status = SvtDbAgentMsgStatus::Success;
    break;

  case RdKafka::ERR__PARTITION_EOF:
    /* Last message */
    logger.logError("KafkaError: ERR__PARTITION_EOF");
    *(static_cast<bool *>(opaque)) = false;
    status = SvtDbAgentMsgStatus::UnexpectedError;
    break;

  case RdKafka::ERR__UNKNOWN_TOPIC:
  case RdKafka::ERR__UNKNOWN_PARTITION:
    logger.logError("KafkaError: Consume failed, " + message->errstr());
    *(static_cast<bool *>(opaque)) = false;
    status = SvtDbAgentMsgStatus::UnexpectedError;
    break;

  default:
    /* Errors */
    logger.logError("KafkaError: Consume failed, " + message->errstr());
    *(static_cast<bool *>(opaque)) = false;
    status = SvtDbAgentMsgStatus::UnexpectedError;
  }
  parseMsg(svtMsg, status);
}

//========================================================================+
void SvtDbAgentService::getEnumReplyMsg(const SvtDbAgent::RequestType &reqType,
                                        nlohmann::ordered_json &replyData)
{
  std::string enum_name(SvtDbAgent::db_schema);
  switch (reqType)
  {
  case SvtDbAgent::RequestType::GetAllWaferTypes:
    enum_name += "enum_waferType";
    break;
  case SvtDbAgent::RequestType::GetAllEngineeringRuns:
    enum_name += "enum_engineeringRun";
    break;
  case SvtDbAgent::RequestType::GetAllFoundries:
    enum_name += "enum_foundry";
    break;
  case SvtDbAgent::RequestType::GetAllWaferTechnologies:
    enum_name += "enum_waferTech";
    break;
  case SvtDbAgent::RequestType::GetAllAsicFamilyTypes:
    enum_name += "enum_familyType";
    break;
  default:
    break;
  }
  try
  {
    std::vector<std::string> enum_values;
    SvtDbInterface::getAllEnumValues(enum_name, enum_values);
    nlohmann::ordered_json items = nlohmann::json::array();
    for (const auto &enum_val : enum_values)
    {
      items.push_back(enum_val);
    }
    replyData["data"]["items"] = items;
    replyData["status"] = msgStatus[SvtDbAgentMsgStatus::Success];
  }
  catch (const std::exception &e)
  {
    throw e;
  }
  return;
}

//========================================================================+
void SvtDbAgentService::getWaferReplyMsg(const std::vector<int> &id_filters,
                                         nlohmann::ordered_json &replyData)
{
  std::vector<SvtDbInterface::dbWaferRecords> wafers;
  SvtDbInterface::getAllWafers(wafers, id_filters);

  nlohmann::ordered_json items = nlohmann::json::array();
  for (const auto &wafer : wafers)
  {
    nlohmann::ordered_json json_wafer;
    json_wafer["id"] = wafer.id;
    json_wafer["serialNumber"] = wafer.serialNumber;
    json_wafer["batchNumber"] = wafer.batchNumber;
    json_wafer["waferType"] = wafer.waferType;
    json_wafer["engineeringRun"] = wafer.engineeringRun;
    json_wafer["foundry"] = wafer.foundry;
    json_wafer["technology"] = wafer.technology;
    json_wafer["thinningDate"] = wafer.thinningDate;
    json_wafer["dicingDate"] = wafer.dicingDate;
    json_wafer["productionDate"] = wafer.productionDate;

    items.push_back(json_wafer);
  }
  replyData["data"]["items"] = items;
  replyData["status"] = msgStatus[SvtDbAgentMsgStatus::Success];
}

//========================================================================+
void SvtDbAgentService::createWaferReplyMsg(const nlohmann::json &json_wafer,
                                            nlohmann::ordered_json &replyData)
{
  SvtDbInterface::dbWaferRecords wafer;
  //! wafer.serialNumber
  wafer.serialNumber = json_wafer.value("serialNumber", "");
  //! wafer.batchNumber
  wafer.batchNumber = json_wafer.value("batchNumber", -1);
  //! wafer.engineeringRun
  wafer.engineeringRun = json_wafer.value("engineeringRun", "");
  //! wafer.foundry
  wafer.foundry = json_wafer.value("foundry", "");
  //! wafer.technology
  wafer.technology = json_wafer.value("technology", "");
  //! wafer.waferType
  wafer.waferType = json_wafer.value("waferType", "");
  //! wafer.thinningDate
  SvtDbAgent::get_v(json_wafer, "thinningDate", wafer.thinningDate);
  //! wafer.dicingDate
  SvtDbAgent::get_v(json_wafer, "dicingDate", wafer.dicingDate);
  //! wafer.productionDate
  SvtDbAgent::get_v(json_wafer, "productionDate", wafer.productionDate);

  try
  {
    SvtDbInterface::insertWafer(wafer);
    const auto maxWaferId = SvtDbInterface::getMaxId("Wafer");
    std::vector<int> id_filters = {maxWaferId};
    getWaferReplyMsg(id_filters, replyData);
  }
  catch (const std::exception &e)
  {
    throw e;
  }
}

//========================================================================+
void SvtDbAgentService::parseMsg(SvtDbAgentMessage &msg,
                                 SvtDbAgentMsgStatus &status)
{
  //! fill headers for reply message
  nlohmann::json replyHeaders = nlohmann::json::object();
  replyHeaders["kafka_correlationId"] = msg.headers["kafka_correlationId"];
  replyHeaders["kafka_replyPartition"] = msg.headers["kafka_replyPartition"];
  replyHeaders["kafka_nest-is-disposed"] = std::string("00");

  //! reply message data field
  nlohmann::ordered_json replyData;

  if (status != SvtDbAgentMsgStatus::Success)
  {
    replyData["status"] = msgStatus[SvtDbAgentMsgStatus::NotFound];
    replyData["data"] = std::string();
  }
  else
  {
    auto type = msg.payload["type"].get<std::string>();
    replyData["type"] = type + std::string("Reply");
    if (type.empty())
    {
      logger.logError("Request have not type information. Skipping");
      replyData["status"] = msgStatus[SvtDbAgentMsgStatus::NotFound];
    }
    else
    {
      SvtDbAgent::RequestType reqType =
          SvtDbAgent::GetRequestType(std::string_view(type.c_str()));
      try
      {
        switch (reqType)
        {
        case SvtDbAgent::RequestType::GetAllWaferTypes:
        case SvtDbAgent::RequestType::GetAllEngineeringRuns:
        case SvtDbAgent::RequestType::GetAllFoundries:
        case SvtDbAgent::RequestType::GetAllWaferTechnologies:
        case SvtDbAgent::RequestType::GetAllAsicFamilyTypes:
        {
          getEnumReplyMsg(reqType, replyData);
        }
        break;
        case SvtDbAgent::RequestType::GetAllWafers:
        {
          std::vector<int> id_filters;
          if (msg.payload.contains(std::string("filter")))
          {
            id_filters = msg.payload["filter"].get<std::vector<int>>();
          }
          getWaferReplyMsg(id_filters, replyData);
        }
        break;
        case SvtDbAgent::RequestType::CreateWafer:
        {
          const auto &msgData = msg.payload["data"];
          if (!msgData.contains(std::string("create")))
          {
            throw std::runtime_error(
                "DbAgentService: Non object create was found");
          }
          createWaferReplyMsg(msgData["create"], replyData);
        }
        break;
        case SvtDbAgent::RequestType::NotFound:
        default:
          logger.logError("");
          replyData["status"] = msgStatus[SvtDbAgentMsgStatus::NotFound];
        }
      }
      catch (const std::exception &e)
      {
        logger.logError("Error requesting " +
                        std::string(SvtDbAgent::a_requestType[reqType]) +
                        std::string(e.what()));
        replyData["data"]["items"] = std::string();
        replyData["status"] = msgStatus[SvtDbAgentMsgStatus::BadRequest];
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
