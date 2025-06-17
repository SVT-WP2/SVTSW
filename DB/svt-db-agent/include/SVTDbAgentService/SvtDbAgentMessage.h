#ifndef SVT_DB_AGENT_REPLY_H
#define SVT_DB_AGENT_REPLY_H

#include <librdkafka/rdkafkacpp.h>
#include <nlohmann/json.hpp>
#include <string>

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

  class SvtDbAgentMessage
  {
   public:
    virtual const nlohmann::json &getHeaders() const { return headers; }
    virtual const nlohmann::json &getPayload() const { return payload; }

    virtual void AddHeader(std::string_view _key, std::string_view _val)
    {
      headers[_key] = _val;
    }
    virtual void setPayload(const nlohmann::json &json) { payload = json; }

   protected:
    nlohmann::json headers = {};
    nlohmann::json payload = {};
  };

  class SvtDbAgentReplyMsg : public SvtDbAgentMessage
  {
   public:
    void setType(const std::string &_type) { type = _type; }
    void setStatus(const std::string_view &_status) { status = _status; }
    void setData(const nlohmann::ordered_json &val) { data = val; }
    void setError(const int _code, const std::string &_msg)
    {
      error_code = _code;
      error_msg = _msg;
    }

    void parsePayload()
    {
      payload["type"] = type;
      payload["status"] = status;
      payload["data"] = data;
      payload["error"]["code"] = error_code;
      payload["error"]["message"] = error_msg;
    }

   private:
    //! reply message data field
    std::string type;
    std::string_view status =
        SvtDbAgent::msgStatus[SvtDbAgent::SvtDbAgentMsgStatus::Success];
    nlohmann::ordered_json data;
    int error_code = 0;
    std::string error_msg = "";
  };

};  // namespace SvtDbAgent
#endif  //! SVT_DB_AGENT_REPLY_H
