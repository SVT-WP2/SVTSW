#ifndef SVT_DB_WAFER_TYPE_DTO_H
#define SVT_DB_WAFER_TYPE_DTO_H

/*!
 * @file SvtDbWaferTypeDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db enum DTO
 * */

#include <vector>

#include <nlohmann/json.hpp>

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;
};  // namespace SvtDbAgent

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

namespace SvtDbWaferTypeDto
{
  //! Wafers Type
  size_t getAllWaferTypesInDB(std::vector<dbWaferTypeRecords> &wafersTypes,
                              const std::vector<int> &id_filters);
  bool createWaferTypeInDB(const dbWaferTypeRecords &wafer);

  void getAllWaferTypes(const SvtDbAgent::SvtDbAgentMessage &msg,
                        SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void createWaferType(const SvtDbAgent::SvtDbAgentMessage &msg,
                       SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void getAllWaferTypesReplyMsg(const std::vector<dbWaferTypeRecords> &waferTypes,
                                SvtDbAgent::SvtDbAgentReplyMsg &msgReply);

  void createWaferTypeReplyMsg(const dbWaferTypeRecords &waferType,
                               SvtDbAgent::SvtDbAgentReplyMsg &msgReply);

};  // namespace SvtDbWaferTypeDto

#endif  //! SVT_DB_WAFER_TYPE_DTO_H
