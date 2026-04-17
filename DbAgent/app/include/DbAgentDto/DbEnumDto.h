#pragma once

/*!
 * @file DbEnumDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief  Db enum DTO
 * */

#include <map>
#include <string>
#include <vector>

#include "DbBaseDto.h"

namespace dbagent
{
  extern std::map<std::string, std::vector<std::string>> enum_type_value_map;

  class DbEnumDto : public DbBaseDto
  {
   public:
    DbEnumDto()
    {
      init();
      createAllRequest();
    }
    ~DbEnumDto() = default;

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

    bool getIsInitialized() { return isInitialized; }
    std::vector<std::string> getTypeNames();
    std::vector<std::string> getEnumValues(const std::string &enum_type);

    void print();

   private:
    bool isInitialized = false;

    virtual void init() final;
    virtual void createAllRequest() final;
  };

};  // namespace dbagent
