#ifndef SVT_DB_WAFER_TYPE_DTO_H
#define SVT_DB_WAFER_TYPE_DTO_H

/*!
 * @file SvtDbWaferTypeDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db Wafer type DTO
 * */

#include <string_view>

#include "nlohmann/json_fwd.hpp"

#include "SvtDbAsicDto.h"
#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbWaferTypeMapDto : public SvtDbBaseDto
  {
   public:
    SvtDbWaferTypeMapDto()
    {
      setTableName("WaferTypeMap");

      addColName("waferTypeId");
      addColName("waferMap");
    }
    ~SvtDbWaferTypeMapDto() = default;

   private:
    void createAllRequest() final {}
  };

  class SvtDbWaferTypeImageDto : public SvtDbBaseDto
  {
   public:
    SvtDbWaferTypeImageDto()
    {
      setTableName("WaferTypeImage");

      addColName("waferTypeId");
      addColName("imageBase64String");
    }
    ~SvtDbWaferTypeImageDto() = default;

   private:
    void createAllRequest() final {}
  };

  class SvtDbWaferTypeDto : public SvtDbBaseDto
  {
   public:
    SvtDbWaferTypeDto();
    ~SvtDbWaferTypeDto() = default;

    friend class SvtDbWaferDto;
    friend class SvtDbAsicDto;

   private:
    SvtDbWaferTypeMapDto *waferTypeMapDto = Singleton<SvtDbWaferTypeMapDto>::instance();
    SvtDbWaferTypeImageDto *waferTypeimageDto = Singleton<SvtDbWaferTypeImageDto>::instance();

    virtual void createAllRequest() final;
    // virtual void parseJsonData(const nlohmann::json &j_data,
    //                            SvtDbEntry &entry) final;
    virtual void createEntry(const SvtKafka::SvtKafkaMessage &, SvtKafka::SvtKafkaReplyMsg &);
    virtual void getWaferMap(const SvtKafka::SvtKafkaMessage &, SvtKafka::SvtKafkaReplyMsg &);
    virtual void getWaferMapEntry(const int waferTypeId, SvtDbEntry &entry);
    virtual const std::string getWaferMap(const int waferTypeId);

    bool createWaferMap(const int waferTypeId, const std::string &);
    bool extractRange(const int g_size, const nlohmann::json &array_j,
                      std::vector<int> &range);
    bool checkWaferMap(const std::string_view &waferMap, std::string &err_msg);
  };

};  // namespace SvtDbAgent
#endif  //! SVT_DB_WAFER_TYPE_DTO_H
