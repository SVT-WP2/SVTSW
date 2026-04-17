#pragma once

/*!
 * @file DbWaferTypeDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief  Db Wafer type DTO
 * */

#include <memory>
#include <string_view>

#include "nlohmann/json_fwd.hpp"

#include "DbBaseDto.h"
#include "DbBaseListDto.h"

namespace dbagent
{
  class DbWaferTypeDto : public DbBaseDto
  {
   public:
    DbWaferTypeDto();
    ~DbWaferTypeDto() = default;

    friend class DbWaferDto;

   private:
    std::shared_ptr<DbBaseListDto> waferTypeMapDto;
    std::shared_ptr<DbBaseListDto> waferTypeImageDto;
    // DbWaferTypeMapDto *waferTypeMapDto = Utils::Singleton<DbWaferTypeMapDto>::instance();
    // DbWaferTypeImageDto *waferTypeimageDto = Utils::Singleton<DbWaferTypeImageDto>::instance();

    virtual void createAllRequest() final;
    // virtual void parseJsonData(const nlohmann::json &j_data,
    //                            DbEntry &entry) final;
    virtual void createEntry(const SvtKafka::SvtKafkaMessage &, SvtKafka::SvtKafkaReplyMsg &);
    virtual void getWaferTypeMap(const SvtKafka::SvtKafkaMessage &, SvtKafka::SvtKafkaReplyMsg &);
    virtual void getWaferTypeMapEntry(const int waferTypeId, DbEntry &entry);
    virtual const std::string getWaferTypeMap(const int waferTypeId);

    bool createWaferTypeMap(const int waferTypeId, const std::string &);

   public:
    static bool extractRange(const int g_size, const nlohmann::json &array_j,
                             std::vector<int> &range);
    static bool checkWaferTypeMap(const std::string_view &waferMap, std::string &err_msg);
  };

};  // namespace dbagent
