#ifndef SVT_DB_AGENT_REQUEST_H
#define SVT_DB_AGENT_REQUEST_H

#include <array>
#include <string_view>

namespace SvtDbAgent
{
  enum RequestType
  {
    GetAllWaferTypes = 0,
    GetAllEngineeringRuns,
    GetAllFoundry,
    GetAllWaferTechnologies,
    GetFamilyType,
    GetAllWafers,
    CreateWafer,
    NotFound,
    kNumRequest
  };

  static std::array<std::string_view, kNumRequest> a_requestType = {
      {"GetAllWaferTypes", "GetAllEngineeringRuns", "GetAllFoundry",
       "GetAllWaferTechnologies", "GetFamilyType", "GetAllWafers",
       "CreateWafer"}};

  inline RequestType GetRequestType(std::string_view type_req)
  {
    for (uint8_t iReq{0}; iReq < kNumRequest; ++iReq)
    {
      if (!type_req.compare(a_requestType[iReq]))
      {
        return (RequestType) iReq;
      }
    }
    return RequestType::NotFound;
  }
};  // namespace SvtDbAgent

#endif  //! SVT_DB_AGENT_REQUEST_H
