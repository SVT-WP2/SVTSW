#ifndef SVT_DB_ENUM_DTO_H
#define SVT_DB_ENUM_DTO_H

/*!
 * @file SvtDbEnumDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db enum DTO
 * */

#include <map>
#include <string>
#include <vector>

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;
};  // namespace SvtDbAgent

namespace SvtDbEnumDto
{

  extern std::map<std::string, std::vector<std::string>> enum_type_value_map;

  bool getAllEnumTypesInDB(const std::string &schema,
                           std::vector<std::string> &enum_types);
  bool getAllEnumValuesInDB(std::string enum_name,
                            std::vector<std::string> &enum_values);
  bool addEnumValueInDB(std::string type_name, std::string value);

  void addValue(const std::string &type, std::string &value);

  void getAllEnumValues(const SvtDbAgent::SvtDbAgentMessage &msg,
                        SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void getAllEnumValuesReplyMsg(const std::vector<std::string> &type_filters,
                                SvtDbAgent::SvtDbAgentReplyMsg &msgReply);

  std::vector<std::string> getTypeNames();

  std::vector<std::string> getEnumValues(const std::string &enum_type);

  void print();

};  // namespace SvtDbEnumDto

#endif  //! SVT_DB_AGENT_ENUM_H
