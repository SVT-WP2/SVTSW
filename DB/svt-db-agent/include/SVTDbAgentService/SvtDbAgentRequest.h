#ifndef SVT_DB_AGENT_REQUEST_H
#define SVT_DB_AGENT_REQUEST_H

#include <map>
#include <string_view>

namespace SvtDbAgent
{
  enum RequestType
  {
    GetAllEnums = 0,
    GetAllWaferTypes,
    CreateWaferType,
    GetAllWafers,
    CreateWafer,
    UpdateWafer,
    UpdateWaferLocation,
    GetAllAsics,
    CreateAsic,
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
      {GetAllAsics, "GetAllAsics"},
      {CreateAsic, "CreateAsic"},
      {NotFound, "NotFound"},
  };

  RequestType getRequestType(std::string_view type_req);

};  // namespace SvtDbAgent

#endif  //! SVT_DB_AGENT_REQUEST_H
