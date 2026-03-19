#ifndef SVT_DB_WAFER_TYPE_DTO_H
#define SVT_DB_WAFER_TYPE_DTO_H

/*!
 * @file SvtDbWaferTypeDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db Wafer type DTO
 * */

#include <memory>
#include <string_view>

#include "nlohmann/json_fwd.hpp"

#include "SvtDbBaseDto.h"
#include "SvtDbBaseListDto.h"

namespace SvtDbAgent
{
  class SvtDbWaferTypeDto : public SvtDbBaseDto
  {
   public:
    SvtDbWaferTypeDto();
    ~SvtDbWaferTypeDto() = default;

    friend class SvtDbWaferDto;

   private:
    std::shared_ptr<SvtDbBaseListDto> waferTypeMapDto;
    std::shared_ptr<SvtDbBaseListDto> waferTypeImageDto;
    // SvtDbWaferTypeMapDto *waferTypeMapDto = SvtUtils::Singleton<SvtDbWaferTypeMapDto>::instance();
    // SvtDbWaferTypeImageDto *waferTypeimageDto = SvtUtils::Singleton<SvtDbWaferTypeImageDto>::instance();

    virtual void createAllRequest() final;
    // virtual void parseJsonData(const nlohmann::json &j_data,
    //                            SvtDbEntry &entry) final;
    virtual void createEntry(const SvtKafka::SvtKafkaMessage &, SvtKafka::SvtKafkaReplyMsg &);
    virtual void getWaferTypeMap(const SvtKafka::SvtKafkaMessage &, SvtKafka::SvtKafkaReplyMsg &);
    virtual void getWaferTypeMapEntry(const int waferTypeId, SvtDbEntry &entry);
    virtual const std::string getWaferTypeMap(const int waferTypeId);

    bool createWaferTypeMap(const int waferTypeId, const std::string &);

   public:
    static bool extractRange(const int g_size, const nlohmann::json &array_j,
                             std::vector<int> &range);
    static bool checkWaferTypeMap(const std::string_view &waferMap, std::string &err_msg);
  };

};  // namespace SvtDbAgent
#endif  //! SVT_DB_WAFER_TYPE_DTO_H
