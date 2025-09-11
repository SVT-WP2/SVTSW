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

  class SvtDbWaferTypeDto : public SvtDbBaseDto
  {
   public:
    SvtDbWaferTypeDto();
    ~SvtDbWaferTypeDto() = default;

    void parseData(const nlohmann::json &entry_j, SvtDbEntry &entry) override;

    bool parse_range(const int g_size, const nlohmann::json &array_j,
                     std::vector<int> &range);

    bool checkWaferMap(const std::string_view waferMap, std::string &err_msg);
  };

  class SvtDbWaferTypeImageDto : public SvtDbBaseDto
  {
    SvtDbWaferTypeImageDto()
    {
      addColName("\"waferTypeId\"");
      addColName("\"imageBase64String\"");
    }
    ~SvtDbWaferTypeImageDto() = default;
    // void parseEntry(const nlohmann::json &entry_j, SvtDbEntry &entry) override;
  };
};  // namespace SvtDbAgent
#endif  //! SVT_DB_WAFER_TYPE_DTO_H
