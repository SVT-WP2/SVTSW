#ifndef SVT_DB_WAFER_DTO_H
#define SVT_DB_WAFER_DTO_H

/*!
 * @file SvtDbWafer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db wafer DTO
 * */

#include <vector>

#include <nlohmann/json.hpp>

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;
};  // namespace SvtDbAgent

//! Wafer
using dbWaferRecords = struct dbWaferRecords
{
  int id = -1;
  std::string serialNumber;
  int batchNumber = -1;
  std::string generalLocation;
  std::string thinningDate;
  std::string dicingDate;
  std::string productionDate;
  int waferTypeId = -1;

  static constexpr std::initializer_list<const char *> val_names = {
      "id",
      "serialNumber",
      "batchNumber",
      "generalLocation",
      "waferTypeId",
      "thinningDate",
      "dicingDate",
      "productionDate",
  };
};

//! WaferLocation
using dbWaferLocationRecords = struct dbWaferLocationRecords
{
  int waferId = -1;
  std::string generalLocation;
  std::string creationTime;
  std::string username;
  std::string description;

  static constexpr std::initializer_list<const char *> val_names = {
      "waferId",
      "generalLocation",
      "creationTime",
      "username",
      "description",
  };
};

namespace SvtDbWaferDto
{
  //! Wafers
  bool getAllWafersFromDB(std::vector<dbWaferRecords> &wafers,
                          const std::vector<int> &id_filters);
  bool getWaferFromDB(dbWaferRecords &wafer, int id);
  bool createWaferInDB(const dbWaferRecords &wafer);
  bool updateWaferInDB(const dbWaferRecords &wafer);
  //! WaferLocation
  bool getAllWaferLocationsFromDB(
      std::vector<dbWaferLocationRecords> &waferLocations, const int &waferId);
  bool createWaferLocationInDB(const dbWaferLocationRecords &waferLocation);

  void getAllWafers(const SvtDbAgent::SvtDbAgentMessage &msg,
                    SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void createWafer(const SvtDbAgent::SvtDbAgentMessage &msg,
                   SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void updateWafer(const SvtDbAgent::SvtDbAgentMessage &msg,
                   SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void updateWaferLocation(const SvtDbAgent::SvtDbAgentMessage &msg,
                           SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void getAllWafersReplyMsg(const std::vector<dbWaferRecords> &wafers,
                            SvtDbAgent::SvtDbAgentReplyMsg &msgReply);

  void createWaferReplyMsg(const dbWaferRecords &wafer,
                           SvtDbAgent::SvtDbAgentReplyMsg &msgReply);

  //! Create asics for wafer
  void createAllAsics(const dbWaferRecords &wafer);
};  // namespace SvtDbWaferDto

#endif  //! SVT_DB_WAFER_DTO_H
