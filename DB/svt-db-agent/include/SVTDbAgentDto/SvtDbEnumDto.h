#ifndef SVT_DB_ENUM_DTO_H
#define SVT_DB_ENUM_DTO_H

/*!
 * @file SvtDbEnumDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db enum DTO
 * */

#include "SvtDbBaseDto.h"

#include <map>
#include <string>
#include <vector>

namespace SvtDbAgent
{
  extern std::map<std::string, std::vector<std::string>> enum_type_value_map;

  class SvtDbEnumDto : public SvtDbBaseDto
  {
   public:
    SvtDbEnumDto() { createAllRequest(); }
    ~SvtDbEnumDto() = default;

    virtual void getAllEntries(const SvtKafka::SvtKafkaMessage &msg,
                               SvtKafka::SvtKafkaReplyMsg &replyMsg) final;

    bool getAllEnumTypesInDB(const std::string &schema,
                             std::vector<std::string> &enum_types);
    bool getAllEnumValuesInDB(std::string enum_name,
                              std::vector<std::string> &enum_values);
    bool addEnumValueInDB(std::string type_name, std::string value);

    void addValue(const std::string &type, std::string &value);

    void getAllEnumValuesReplyMsg(const std::vector<std::string> &type_filters,
                                  SvtKafka::SvtKafkaReplyMsg &msgReply);

    std::vector<std::string> getTypeNames();

    std::vector<std::string> getEnumValues(const std::string &enum_type);

    void print();

   private:
    virtual void createAllRequest() final;
  };

};  // namespace SvtDbAgent

#endif  //! SVT_DB_AGENT_ENUM_H
