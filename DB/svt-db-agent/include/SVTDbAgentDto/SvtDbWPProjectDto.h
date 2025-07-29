#ifndef SVT_DB_WAFER_PROBE_PROJECT_DTO_H
#define SVT_DB_WAFER_PROBE_PROJECT_DTO_H

/*!
 * @file SvtDbWPProject.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db Wafer Probe Project DTO
 * */

#include <vector>

#include <nlohmann/json.hpp>

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;
};  // namespace SvtDbAgent

//! WaferProbeProject
using dbWPProjRecords = struct dbWPProjRecords
{
  int id = -1;
  int wpMachineId = -1;
  int waferTypeId = -1;
  std::string asicFamilyType;
  std::string orientation;
  std::string name;
  std::string alignmentDie;
  std::string homeDie;
  std::string local2GlobalMap;

  static constexpr std::initializer_list<const char *> val_names = {
      "id",
      "wpMachineId",
      "waferTypeId",
      "asicFamilyType",
      "orientation",
      "name",
      "alignmentDie",
      "homeDie",
      "local2GlobalMap",
  };
};

namespace SvtDbWPProjectDto
{
  //! Wafers Probe Project
  bool getAllWPProjsFromDB(std::vector<dbWPProjRecords> &wpProjects,
                           const std::vector<int> &id_filters);
  bool getWPProjFromDB(dbWPProjRecords &wpProject, int id);

  bool createWPProjInDB(const dbWPProjRecords &wpProject);

  void getAllWPProjects(const SvtDbAgent::SvtDbAgentMessage &msg,
                        SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void createWPProject(const SvtDbAgent::SvtDbAgentMessage &msg,
                       SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);

  void getAllWPProjReplyMsg(const std::vector<dbWPProjRecords> &wpProjects,
                            SvtDbAgent::SvtDbAgentReplyMsg &msgReply);

  void createWPProjReplyMsg(const dbWPProjRecords &wpProject,
                            SvtDbAgent::SvtDbAgentReplyMsg &msgReply);
};  // namespace SvtDbWPProjectDto

#endif  //! SVT_DB_WAFER_PROBE_PROJECT_DTO_H
