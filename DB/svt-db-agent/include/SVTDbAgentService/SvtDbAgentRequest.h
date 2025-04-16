#ifndef SVT_DB_AGENT_REQUEST_H
#define SVT_DB_AGENT_REQUEST_H

#include "nlohmann/json.hpp"

#include <map>
#include <string_view>

namespace SvtDbAgent
{
  enum SvtDbAgentMsgStatus : uint8_t
  {
    // sucess
    Success = 0,
    // message data has invalid format
    BadRequest,
    // // requested entity does not exist
    // NotFound,
    // is not able to process the request, some unexpected error
    UnexpectedError,
    // Num of message status
    NumStatus
  };

  const std::array<std::string_view, SvtDbAgentMsgStatus::NumStatus> msgStatus = {
      {"Success", "BadRequest", /*"NotFound",*/ "UnexpectedError"}};
  enum RequestType
  {
    GetAllWaferFoundries = 0,
    GetAllEngineeringRuns,
    GetAllWaferTechnologies,
    GetAllWaferSubMapOrientations,
    GetAllAsicFamilyTypes,
    GetAllWaferTypes,
    CreateWaferType,
    GetAllWafers,
    CreateWafer,
    NotFound,
  };

  static std::map<RequestType, std::string_view> m_requestType = {
      {GetAllWaferFoundries, "GetAllWaferFoundries"},
      {GetAllEngineeringRuns, "GetAllEngineeringRuns"},
      {GetAllWaferTechnologies, "GetAllWaferTechnologies"},
      {GetAllWaferSubMapOrientations, "GetAllWaferSubMapOrientations"},
      {GetAllAsicFamilyTypes, "GetAllAsicFamilyTypes"},
      {GetAllWaferTypes, "GetAllWaferTypes"},
      {CreateWaferType, "CreateWaferType"},
      {GetAllWafers, "GetAllWafers"},
      {CreateWafer, "CreateWafer"},
      {NotFound, "NotFound"}};

  static std::map<RequestType, std::string_view> m_EnumType = {
      {GetAllWaferFoundries, "enum_foundry"},
      {GetAllEngineeringRuns, "enum_engineeringRun"},
      {GetAllWaferTechnologies, "enum_waferTech"},
      {GetAllWaferSubMapOrientations, "enum_waferSubMapOrientations"},
      {GetAllAsicFamilyTypes, "enum_asicFamilyType"},
  };

  RequestType GetRequestType(std::string_view type_req);

  //! Actions
  void getAllEnumValuesReplyMsg(const SvtDbAgent::RequestType &reqType,
                                nlohmann::ordered_json &replyData);
  void getAllWaferTypesReplyMsg(const std::vector<int> &id_filters,
                                nlohmann::ordered_json &replyData);
  void createWaferTypeReplyMsg(const nlohmann::json &json_wafer,
                               nlohmann::ordered_json &replyData);
  void getAllWafersReplyMsg(const std::vector<int> &id_filters,
                            nlohmann::ordered_json &replyData);
  void createWaferReplyMsg(const nlohmann::json &json_wafer,
                           nlohmann::ordered_json &replyData);
};  // namespace SvtDbAgent

#endif  //! SVT_DB_AGENT_REQUEST_H
