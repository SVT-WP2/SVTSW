#ifndef SVT_DB_WAFER_TYPE_DTO_H
#define SVT_DB_WAFER_TYPE_DTO_H

/*!
 * @file SvtDbWaferTypeDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db Wafer type DTO
 * */

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;

  // class SvtDbWaferTypeImageDto : public SvtDbBaseDto
  // {
  //   SvtDbWaferTypeImageDto()
  //   {
  //     addColName("waferTypeId");
  //     addColName("imageBase64String");
  //   }
  //   ~SvtDbWaferTypeImageDto() = default;
  // };

  class SvtDbWaferTypeDto : public SvtDbBaseDto
  {
   public:
    SvtDbWaferTypeDto();
    ~SvtDbWaferTypeDto() = default;

    friend class SvtDbWaferDto;

   private:
    virtual void createAllRequest() final;
    virtual void parseJsonData(const nlohmann::json &j_data,
                               SvtDbEntry &entry) final;

    bool extractRange(const int g_size, const nlohmann::json &array_j,
                      std::vector<int> &range);
    bool checkWaferMap(const std::string_view waferMap, std::string &err_msg);
  };

};  // namespace SvtDbAgent
#endif  //! SVT_DB_WAFER_TYPE_DTO_H
