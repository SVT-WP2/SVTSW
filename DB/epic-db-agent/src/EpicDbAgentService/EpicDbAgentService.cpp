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
#include <vector>

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
  EpicDbAgentMsgStatus status = EpicDbAgentMsgStatus::Success;
  switch (message->err())
  {
  case RdKafka::ERR__TIMED_OUT:
    logger.logError("KafkaError: ERR__TIMED_OUT");
    status = EpicDbAgentMsgStatus::UnexpectedError;
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
    status = EpicDbAgentMsgStatus::Success;
    break;

  case RdKafka::ERR__PARTITION_EOF:
    /* Last message */
    logger.logError("KafkaError: ERR__PARTITION_EOF");
    *(static_cast<bool *>(opaque)) = false;
    status = EpicDbAgentMsgStatus::UnexpectedError;
    break;

  case RdKafka::ERR__UNKNOWN_TOPIC:
  case RdKafka::ERR__UNKNOWN_PARTITION:
    logger.logError("KafkaError: Consume failed, " + message->errstr());
    *(static_cast<bool *>(opaque)) = false;
    status = EpicDbAgentMsgStatus::UnexpectedError;
    break;

  default:
    /* Errors */
    logger.logError("KafkaError: Consume failed, " + message->errstr());
    *(static_cast<bool *>(opaque)) = false;
    status = EpicDbAgentMsgStatus::UnexpectedError;
  }
  parseMsg(svtMsg, status);
}

//========================================================================+
void EpicDbAgentService::getEnumReplyMsg(
    const EpicDbAgent::RequestType &reqType,
    nlohmann::ordered_json &replyData)
{
  std::string enum_name(EpicDbAgent::db_schema);
  switch (reqType)
  {
  case EpicDbAgent::RequestType::GetAllWaferTypes:
    enum_name += "enum_waferType";
    break;
  case EpicDbAgent::RequestType::GetAllEngineeringRuns:
    enum_name += "enum_engineeringRun";
    break;
  case EpicDbAgent::RequestType::GetAllFoundry:
    enum_name += "enum_foundry";
    break;
  case EpicDbAgent::RequestType::GetAllWaferTechnologies:
    enum_name += "enum_waferTech";
    break;
  case EpicDbAgent::RequestType::GetFamilyType:
    enum_name += "enum_familyType";
    break;
  default:
    break;
  }
  try
  {
    std::vector<std::string> enum_values;
    EpicDbInterface::getAllEnumValues(enum_name, enum_values);
    nlohmann::ordered_json items = nlohmann::json::array();
    for (const auto &enum_val : enum_values)
    {
      items.push_back(enum_val);
    }
    replyData["data"]["items"] = items;
    replyData["status"] = msgStatus[EpicDbAgentMsgStatus::Success];
  }
  catch (const std::exception &e)
  {
    throw e;
  }
  return;
}

//========================================================================+
void EpicDbAgentService::getWaferReplyMsg(
    nlohmann::ordered_json &replyData,
    std::vector<EpicDbInterface::dbWaferRecords> &wafers)
{
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
  replyData["status"] = msgStatus[EpicDbAgentMsgStatus::Success];
}

//========================================================================+
void EpicDbAgentService::createWaferReplyMsg() {}

//========================================================================+
void EpicDbAgentService::parseMsg(EpicDbAgentMessage &msg,
                                  EpicDbAgentMsgStatus &status)
{
  //! fill headers for reply message
  nlohmann::json replyHeaders = nlohmann::json::object();
  replyHeaders["kafka_correlationId"] = msg.headers["kafka_correlationId"];
  replyHeaders["kafka_replyPartition"] = msg.headers["kafka_replyPartition"];
  replyHeaders["kafka_nest-is-disposed"] = std::string("00");

  //! reply message data field
  nlohmann::ordered_json replyData;

  if (status != EpicDbAgentMsgStatus::Success)
  {
    replyData["status"] = msgStatus[EpicDbAgentMsgStatus::NotFound];
    replyData["data"] = std::string();
  }
  else
  {
    auto type = msg.payload["type"].get<std::string>();
    replyData["type"] = msg.payload["type"];
    if (type.empty())
    {
      logger.logError("Request have not type information. Skipping");
      replyData["status"] = msgStatus[EpicDbAgentMsgStatus::NotFound];
    }
    else
    {
      EpicDbAgent::RequestType reqType =
          EpicDbAgent::GetRequestType(std::string_view(type.c_str()));
      try
      {
        switch (reqType)
        {
        case EpicDbAgent::RequestType::GetAllWaferTypes:
        case EpicDbAgent::RequestType::GetAllEngineeringRuns:
        case EpicDbAgent::RequestType::GetAllFoundry:
        case EpicDbAgent::RequestType::GetAllWaferTechnologies:
        {
          getEnumReplyMsg(reqType, replyData);
        }
        break;
        case EpicDbAgent::RequestType::GetAllWafers:
        {
          std::vector<int> id_filters;
          if (msg.payload.contains(std::string("filter")))
          {
            id_filters = msg.payload["filter"].get<std::vector<int>>();
          }
          std::vector<EpicDbInterface::dbWaferRecords> wafers;
          EpicDbInterface::getAllWafers(wafers, id_filters);
          getWaferReplyMsg(replyData, wafers);
        }
        break;
        case EpicDbAgent::RequestType::CreateWafer:
        {
          const auto &msgData = msg.payload["data"];
          if (!msgData.contains(std::string("create")))
          {
            throw std::runtime_error(
                "DbAgentService: Non object create was found");
          }
          createWaferReplyMsg();
        }
        break;
        case EpicDbAgent::RequestType::NotFound:
        default:
          logger.logError("");
          replyData["status"] = msgStatus[EpicDbAgentMsgStatus::NotFound];
        }
      }
      catch (const std::exception &e)
      {
        logger.logError("Error requesting " +
                        std::string(EpicDbAgent::a_requestType[reqType]) +
                        std::string(e.what()));
        replyData["data"]["items"] = std::string();
        replyData["status"] = msgStatus[EpicDbAgentMsgStatus::BadRequest];
      }
      //   try
      //   {
      //
      //     std::vector<int> id_filters;
      //     const auto &msgItem = msgData["items"];
      //     for (const auto &[_dummy, epicWafer_json] : msgItem.items())
      //     {
      //       EpicDbInterface::dbWaferRecords wafer;
      //       //! wafer.serialNumber
      //       if (!epicWafer_json.contains(std::string("serialNumber")))
      //       {
      //         throw std::runtime_error(
      //             "DbAgentService:Missing serialNumber in wafer keys");
      //       }
      //       wafer.serialNumber =
      //           epicWafer_json["serialNumber"].get<std::string>();
      //       //! wafer.batchNumber
      //       if (!epicWafer_json.contains(std::string("batchNumber")))
      //       {
      //         throw std::runtime_error(
      //             "DbAgentService:Missing batchNumber in item keys");
      //       }
      //       wafer.batchNumber = epicWafer_json["batchNumber"].get<int>();
      //       //! wafer.engineeringRun
      //       if (!epicWafer_json.contains(std::string("engineeringRun")))
      //       {
      //         throw std::runtime_error(
      //             "DbAgentService:Missing engineeringRun in item keys");
      //       }
      //       wafer.engineeringRun =
      //           epicWafer_json["engineeringRun"].get<std::string>();
      //
      //       //! wafer.foundry
      //       if (!epicWafer_json.contains(std::string("foundry")))
      //       {
      //         throw std::runtime_error(
      //             "DbAgentService:Missing foundry in item keys");
      //       }
      //       wafer.foundry = epicWafer_json["foundry"].get<std::string>();
      //       //! wafer.technology
      //       if (!epicWafer_json.contains(std::string("technology")))
      //       {
      //         throw std::runtime_error(
      //             "DbAgentService:Missing technology in item keys");
      //       }
      //       wafer.technology =
      //       epicWafer_json["technology"].get<std::string>();
      //       //! wafer.thinningDate
      //       if (!epicWafer_json.contains(std::string("thinningDate")))
      //       {
      //         throw std::runtime_error(
      //             "DbAgentService:Missing thinningDate in item keys");
      //       }
      //       wafer.thinningDate =
      //           epicWafer_json["thinningDate"].get<std::string>();
      //       //! wafer.dicingDate
      //       if (!epicWafer_json.contains(std::string("dicingDate")))
      //       {
      //         throw std::runtime_error(
      //             "DbAgentService:Missing dicingDate in item keys");
      //       }
      //       wafer.dicingDate =
      //       epicWafer_json["dicingDate"].get<std::string>();
      //       //! wafer.waferType
      //       if (!epicWafer_json.contains(std::string("waferType")))
      //       {
      //         throw std::runtime_error(
      //             "DbAgentService:Missing waferType in item keys");
      //       }
      //       wafer.waferType =
      //       epicWafer_json["waferType"].get<std::string>();
      //
      //       EpicDbInterface::insertWaferRecords(wafer);
      //       const auto maxWaferId = EpicDbInterface::getMaxWaferId();
      //       id_filters.push_back(maxWaferId);
      //     }
      //     std::vector<EpicDbInterface::dbWaferRecords> wafers;
      //     EpicDbInterface::getAllWafers(wafers, id_filters);
      //     fillWaferMsgReply(replyData, wafers);
      //   }
    }  //!<! request type is not empty
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
