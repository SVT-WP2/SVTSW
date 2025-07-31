#ifndef SVT_DB_WAFER_TYPE_DTO_H
#define SVT_DB_WAFER_TYPE_DTO_H

/*!
 * @file SvtDbWaferTypeDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db Wafer type DTO
 * */

#include <vector>

#include <nlohmann/json.hpp>

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;
};  // namespace SvtDbAgent

namespace SvtDbWaferTypeDto
{
  //! WaferType
  using dbWaferTypeRecords = struct dbWaferTypeRecords
  {
    int id = -1;
    std::string name;
    std::string engineeringRun;
    std::string foundry;
    std::string technology;
    std::string waferMap;

    static constexpr std::initializer_list<const char *> val_names = {
        "id",
        "name",
        "engineeringRun",
        "foundry",
        "technology",
        "waferMap",
    };
  };

  //! WaferTypeImage
  using dbWaferTypeImagesRecords = struct dbWaferTypeImagesRecords
  {
    int waferTypeId = -1;
    std::string imageBase64String;

    static constexpr std::initializer_list<const char *> val_names = {
        "waferTypeId",
        "imageBase64String",
    };
  };

  //! Wafers Type
  bool getAllWaferTypesFromDB(std::vector<dbWaferTypeRecords> &wafersTypes,
                              const std::vector<int> &id_filters);
  bool getWaferTypeFromDB(dbWaferTypeRecords &waferType, int id);

  bool createWaferTypeInDB(const dbWaferTypeRecords &wafer);

  void getAllWaferTypes(const SvtDbAgent::SvtDbAgentMessage &msg,
                        SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void createWaferType(const SvtDbAgent::SvtDbAgentMessage &msg,
                       SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void getAllWaferTypesReplyMsg(const std::vector<dbWaferTypeRecords> &waferTypes,
                                SvtDbAgent::SvtDbAgentReplyMsg &msgReply);

  void createWaferTypeReplyMsg(const dbWaferTypeRecords &waferType,
                               SvtDbAgent::SvtDbAgentReplyMsg &msgReply);

  bool parse_range(const int g_size, const nlohmann::json &array_j,
                   std::vector<int> &range);

  bool checkWaferMap(const std::string_view waferMap, std::string &err_msg);

};  // namespace SvtDbWaferTypeDto

#endif  //! SVT_DB_WAFER_TYPE_DTO_H
