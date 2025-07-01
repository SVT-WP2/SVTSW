#ifndef SVT_DB_ASIC_DTO_H
#define SVT_DB_ASIC_DTO_H

/*!
 * @file SvtDbWafer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db asic DTO
 * */

#include <vector>

#include <nlohmann/json.hpp>

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;
};  // namespace SvtDbAgent

//! Asic
using dbAsicRecords = struct dbAsicRecords
{
  int id = -1;
  int waferId = -1;
  std::string serialNumber;
  std::string familyType;
  std::string waferMapPosition;
  std::string quality;

  static constexpr std::initializer_list<const char *> val_names = {
      "id",
      "waferId",
      "serialNumber",
      "familyType",
      "waferMapPosition",
      "quality",
  };
};

namespace SvtDbAsicDto
{
  //! Asics
  bool getAllAsicsFromDB(std::vector<dbAsicRecords> &asics,
                         const std::vector<int> &id_filters);
  bool getAsicFromDB(dbAsicRecords &asic, int id);
  bool createAsicInDB(const dbAsicRecords &asic);

  void getAllAsics(const SvtDbAgent::SvtDbAgentMessage &msg,
                   SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void createAsic(const SvtDbAgent::SvtDbAgentMessage &msg);

  void createAsic(const SvtDbAgent::SvtDbAgentMessage &msg,
                  SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void getAllAsicsReplyMsg(const std::vector<dbAsicRecords> &asics,
                           SvtDbAgent::SvtDbAgentReplyMsg &msgReply);

  void createAsicReplyMsg(const dbAsicRecords &asic,
                          SvtDbAgent::SvtDbAgentReplyMsg &msgReply);

};  // namespace SvtDbAsicDto

#endif  //! SVT_DB_ASIC_DTO_H
