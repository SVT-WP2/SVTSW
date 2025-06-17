#ifndef SVT_DB_AGENT_REQUEST_H
#define SVT_DB_AGENT_REQUEST_H

#include "SvtDbAgentEnum.h"

#include <map>
#include <string_view>
#include <vector>

#include <nlohmann/json.hpp>

namespace SvtDbAgent
{
  class SvtDbAgentReplyMsg;

  enum RequestType
  {
    GetAllEnums = 0,
    GetAllWaferTypes,
    CreateWaferType,
    GetAllWafers,
    CreateWafer,
    UpdateWafer,
    UpdateWaferLocation,
    NotFound,
  };

  static std::map<RequestType, std::string_view> m_requestType = {
      {GetAllEnums, "GetAllEnums"},
      {GetAllWaferTypes, "GetAllWaferTypes"},
      {CreateWaferType, "CreateWaferType"},
      {GetAllWafers, "GetAllWafers"},
      {CreateWafer, "CreateWafer"},
      {UpdateWafer, "UpdateWafer"},
      {UpdateWaferLocation, "UpdateWaferLocation"},
      {NotFound, "NotFound"}};

  RequestType getRequestType(std::string_view type_req);

  //! Actions
  void getAllEnumValuesReplyMsg(const std::vector<std::string> &type_filters,
                                const SvtDbAgentEnum &enumList,
                                SvtDbAgentReplyMsg &msgReply);
  void getAllWaferTypesReplyMsg(const std::vector<int> &id_filters,
                                SvtDbAgentReplyMsg &msgReply);
  void createWaferTypeReplyMsg(const nlohmann::json &json_wafer,
                               SvtDbAgentReplyMsg &msgReply);
  // void getAllWafersReplyMsg(const std::vector<int> &id_filters,
  //                           SvtDbAgentReplyMsg &msgReply);
  // void createWaferReplyMsg(const nlohmann::json &json_wafer,
  //                          SvtDbAgentReplyMsg &msgReply);
};  // namespace SvtDbAgent

#endif  //! SVT_DB_AGENT_REQUEST_H
