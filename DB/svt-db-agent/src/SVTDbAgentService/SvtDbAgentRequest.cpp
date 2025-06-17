/*!
 * @file SvtDbAgentRequest.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Apr-2025
 * @brief implementation of request
 */

#include "SVTDbAgentService/SvtDbAgentRequest.h"
#include "SVTDb/SvtDbInterface.h"
#include "SVTDbAgentService/SvtDbAgentMessage.h"
#include "SVTUtilities/SvtUtilities.h"

//========================================================================+
SvtDbAgent::RequestType SvtDbAgent::getRequestType(std::string_view type_req)
{
  for (const auto &[key, value] : m_requestType)
  {
    if (!value.compare(type_req))
    {
      return key;
    }
  }
  return RequestType::NotFound;
}

//========================================================================+
void SvtDbAgent::getAllEnumValuesReplyMsg(
    const std::vector<std::string> &type_filters,
    const SvtDbAgentEnum &enumList, SvtDbAgentReplyMsg &msgReply)
{
  std::string enum_name(SvtDbAgent::db_schema);
  try
  {
    nlohmann::ordered_json data;
    if (type_filters.size())
    {
      for (const auto &enum_type : type_filters)
      {
        data[enum_type] = nlohmann::ordered_json::array();
        for (const auto &enum_value : enumList.getEnumValues(enum_type))
        {
          data[enum_type].push_back(enum_value);
        }
      }
    }
    else
    {
      for (const auto &enum_type : enumList.getTypeNames())
      {
        data[enum_type] = nlohmann::ordered_json::array();
        for (const auto &enum_value : enumList.getEnumValues(enum_type))
        {
          data[enum_type].push_back(enum_value);
        }
      }
    }
    msgReply.setData(data);
    msgReply.setStatus(msgStatus[SvtDbAgentMsgStatus::Success]);
    msgReply.setError(0, "");
  }
  catch (const std::exception &e)
  {
    throw e;
  }
  return;
}

//========================================================================+
void SvtDbAgent::getAllWaferTypesReplyMsg(const std::vector<int> &id_filters,
                                          SvtDbAgentReplyMsg &msgReply)
{
  try
  {
    std::vector<SvtDbInterface::dbWaferTypeRecords> waferTypes;
    SvtDbInterface::getAllWaferTypes(waferTypes, id_filters);

    nlohmann::ordered_json data;
    nlohmann::ordered_json items = nlohmann::json::array();
    for (const auto &waferType : waferTypes)
    {
      nlohmann::ordered_json json_wafer_type;
      json_wafer_type["id"] = waferType.id;
      json_wafer_type["name"] = waferType.name;
      json_wafer_type["foundry"] = waferType.foundry;
      json_wafer_type["technology"] = waferType.technology;
      json_wafer_type["engineeringRun"] = waferType.engineeringRun;
      // json_wafer_type["imageBase64String"] = waferType.imageBase64String;
      json_wafer_type["waferMap"] = waferType.waferMap;

      items.push_back(json_wafer_type);
    }
    data["items"] = items;
    msgReply.setData(data);
    msgReply.setStatus(msgStatus[SvtDbAgentMsgStatus::Success]);
    msgReply.setError(0, "");
  }
  catch (const std::exception &e)
  {
    throw e;
  }
  return;
}

//========================================================================+
void SvtDbAgent::createWaferTypeReplyMsg(const nlohmann::json &json_wafer_type,
                                         SvtDbAgentReplyMsg &msgReply)
{
  //! remove id record
  if (json_wafer_type.size() <
      (SvtDbInterface::dbWaferTypeRecords::val_names.size() - 1))
  {
    throw std::invalid_argument("insufficient number of parameters");
  }
  SvtDbInterface::dbWaferTypeRecords waferType;
  //! waferType.name
  waferType.name = json_wafer_type.value("name", "");
  //! waferType.foundry
  waferType.foundry = json_wafer_type.value("foundry", "");
  //! waferType.technology
  waferType.technology = json_wafer_type.value("technology", "");
  //! waferType.engineeringRun
  waferType.engineeringRun = json_wafer_type.value("engineeringRun", "");
  // //! waferType.imageBase64String
  // waferType.imageBase64String = json_wafer_type.value("imageBase64String",
  // "");
  //! waferType.waferMap
  if (nlohmann::json::accept(json_wafer_type.value("waferMap", "")))
  {
    waferType.waferMap = json_wafer_type.value("waferMap", "");
  }
  else
  {
    msgReply.setStatus(msgStatus[SvtDbAgentMsgStatus::BadRequest]);
    msgReply.setError(-1, "ERROR: invvalid JSON format found for waferMap");
    return;
  }

  try
  {
    SvtDbInterface::insertWaferType(waferType);
    const auto maxWaferTypeId = SvtDbInterface::getMaxId("WaferType");
    std::vector<int> id_filters = {maxWaferTypeId};

    std::vector<SvtDbInterface::dbWaferTypeRecords> waferTypes;
    SvtDbInterface::getAllWaferTypes(waferTypes, id_filters);

    waferType = (waferTypes.size())
                    ? std::move(waferTypes.at(0))
                    : std::move(SvtDbInterface::dbWaferTypeRecords{});

    nlohmann::ordered_json data;
    nlohmann::json ret_json_waferType;
    ret_json_waferType["id"] = waferType.id;
    ret_json_waferType["name"] = waferType.name;
    ret_json_waferType["foundry"] = waferType.foundry;
    ret_json_waferType["technology"] = waferType.technology;
    ret_json_waferType["engineeringRun"] = waferType.engineeringRun;
    // ret_json_waferType["imageBase64String"] = waferType.imageBase64String;
    ret_json_waferType["waferMap"] = waferType.waferMap;

    data["entity"] = ret_json_waferType;
    msgReply.setData(data);
    msgReply.setStatus(msgStatus[SvtDbAgentMsgStatus::Success]);
    msgReply.setError(0, "");
  }
  catch (const std::exception &e)
  {
    throw e;
  }
}

// //========================================================================+
// void SvtDbAgent::getAllWafersReplyMsg(const std::vector<int> &id_filters,
//                                       nlohmann::ordered_json &replyData)
// {
//   std::vector<SvtDbInterface::dbWaferRecords> wafers;
//   SvtDbInterface::getAllWafers(wafers, id_filters);
//
//   nlohmann::ordered_json items = nlohmann::json::array();
//   for (const auto &wafer : wafers)
//   {
//     nlohmann::ordered_json json_wafer;
//     json_wafer["id"] = wafer.id;
//     json_wafer["serialNumber"] = wafer.serialNumber;
//     json_wafer["batchNumber"] = wafer.batchNumber;
//     json_wafer["waferTypeId"] = wafer.waferTypeId;
//     json_wafer["thinningDate"] = wafer.thinningDate;
//     json_wafer["dicingDate"] = wafer.dicingDate;
//     json_wafer["productionDate"] = wafer.productionDate;
//
//     items.push_back(json_wafer);
//   }
//   replyData["data"]["items"] = items;
//   replyData["status"] = msgStatus[SvtDbAgentMsgStatus::Success];
// }
//
// //========================================================================+
// void SvtDbAgent::createWaferReplyMsg(const nlohmann::json &json_wafer,
//                                      nlohmann::ordered_json &replyData)
// {
//   SvtDbInterface::dbWaferRecords wafer;
//   //! wafer.serialNumber
//   wafer.serialNumber = json_wafer.value("serialNumber", "");
//   //! wafer.batchNumber
//   wafer.batchNumber = json_wafer.value("batchNumber", -1);
//   //! wafer.waferTypeId
//   wafer.waferTypeId = json_wafer.value("waferTypeId", -1);
//   //! wafer.thinningDate
//   SvtDbAgent::get_v(json_wafer, "thinningDate", wafer.thinningDate);
//   //! wafer.dicingDate
//   SvtDbAgent::get_v(json_wafer, "dicingDate", wafer.dicingDate);
//   //! wafer.productionDate
//   SvtDbAgent::get_v(json_wafer, "productionDate", wafer.productionDate);
//
//   try
//   {
//     SvtDbInterface::insertWafer(wafer);
//     const auto maxWaferId = SvtDbInterface::getMaxId("Wafer");
//     std::vector<int> id_filters = {maxWaferId};
//
//     std::vector<SvtDbInterface::dbWaferRecords> wafers;
//     SvtDbInterface::getAllWafers(wafers, id_filters);
//
//     wafer = (wafers.size()) ? std::move(wafers.at(0))
//                             : std::move(SvtDbInterface::dbWaferRecords{});
//
//     nlohmann::json ret_json_wafer;
//     ret_json_wafer["id"] = wafer.id;
//     ret_json_wafer["serialNumber"] = wafer.serialNumber;
//     ret_json_wafer["batchNumber"] = wafer.batchNumber;
//     ret_json_wafer["waferTypeId"] = wafer.waferTypeId;
//     ret_json_wafer["thinningDate"] = wafer.thinningDate;
//     ret_json_wafer["dicingDate"] = wafer.dicingDate;
//     ret_json_wafer["productionDate"] = wafer.productionDate;
//
//     replyData["data"]["entity"] = ret_json_wafer;
//     replyData["status"] = msgStatus[SvtDbAgentMsgStatus::Success];
//   }
//   catch (const std::exception &e)
//   {
//     throw e;
//   }
// }
