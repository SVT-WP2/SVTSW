/*!
 * @file SvtDbAgentRequest.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Apr-2025
 * @brief implementation of request
 */

#include "SVTDbAgentService/SvtDbAgentRequest.h"

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
