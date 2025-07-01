#ifndef SVT_DB_WAFERPROBEMACHINE_DTO_H
#define SVT_DB_WAFERPROBEMACHINE_DTO_H

/*!
 * @file SvtDbWafer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db wafer probe machine DTO
 * */

#include <vector>

#include <nlohmann/json.hpp>

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;
};  // namespace SvtDbAgent

//! Wafer
using dbWPMachineRecords = struct dbWPMachineRecords
{
  int id = -1;
  std::string serialNumber;
  std::string name;
  std::string hostName;
  std::string connectionType;
  int connectionPort = -1;
  std::string generalLocation;
  std::string software;
  std::string swVersion;
  std::string vendor;

  static constexpr std::initializer_list<const char *> val_names = {
      "id",
      "serialNumber",
      "name",
      "hostName",
      "connectionType",
      "connectionPort",
      "generalLocation",
      "software",
      "swVersion",
      "vendor",
  };
};

//! WaferLocation
using dbWaferLoadedInMachine = struct dbWaferLoadedInMachine
{
  int machineId = -1;
  int waferId = -1;
  std::string date;
  std::string username;
  std::string status;

  static constexpr std::initializer_list<const char *> val_names = {
      "machineId",
      "waferId",
      "date",
      "username",
      "status",
  };
};

namespace SvtDbWPMachineDto
{
  //! WaferProbeMachine in DB
  size_t getAllWPMachinesInDB(std::vector<dbWPMachineRecords> &wpmachine,
                              const std::vector<int> &id_filters);
  bool createWPMachineInDB(const dbWPMachineRecords &wafer);
  bool updateWPMachineInDB(const dbWPMachineRecords &wafer);

  //! WaferProbeMachine request/reply
  void getAllWPMachines(const SvtDbAgent::SvtDbAgentMessage &msg,
                        SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void createWPMachine(const SvtDbAgent::SvtDbAgentMessage &msg,
                       SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void updateWPMachine(const SvtDbAgent::SvtDbAgentMessage &msg,
                       SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  // void updateWaferLocation(const SvtDbAgent::SvtDbAgentMessage &msg,
  //                          SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void getAllWPMachinesReplyMsg(const std::vector<dbWPMachineRecords> &wpMachines,
                                SvtDbAgent::SvtDbAgentReplyMsg &msgReply);

  void createWPMachineReplyMsg(const dbWPMachineRecords &wpm,
                               SvtDbAgent::SvtDbAgentReplyMsg &msgReply);
};  // namespace SvtDbWPMachineDto

#endif  //! SVT_DB_WAFER_DTO_H
