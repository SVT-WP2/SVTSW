#ifndef SVT_DB_WAFERPROBEMACHINE_DTO_H
#define SVT_DB_WAFERPROBEMACHINE_DTO_H

/*!
 * @file SvtDbWPMachineDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db wafer probe machine DTO
 * */

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;

  class SvtDbWaferLoadedInMachine : public SvtDbBaseDto
  {
   public:
    SvtDbWaferLoadedInMachine();
    ~SvtDbWaferLoadedInMachine() = default;
  };

  class SvtDbWPMachineDto : public SvtDbBaseDto
  {
   public:
    SvtDbWPMachineDto();
    ~SvtDbWPMachineDto() = default;

   private:
  };

  // namespace SvtDbWPMachineDto
  // {
  //   //! WaferProbeMachine in DB
  //   bool getAllWPMachinesFromDB(std::vector<dbWPMachineRecords> &wpmachine,
  //                               const std::vector<int> &id_filters);
  //   bool getWPMachineFromDB(dbWPMachineRecords &wpm, int id);
  //   bool createWPMachineInDB(const dbWPMachineRecords &wpm);
  //   bool updateWPMachineInDB(const dbWPMachineRecords &wpm);
  //
  //   //! WaferProbeMachine request/reply
  //   void getAllWPMachines(const SvtDbAgent::SvtDbAgentMessage &msg,
  //                         SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);
  //
  //   void createWPMachine(const SvtDbAgent::SvtDbAgentMessage &msg,
  //                        SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);
  //
  //   void updateWPMachine(const SvtDbAgent::SvtDbAgentMessage &msg,
  //                        SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);
  //
  //   // void updateWaferLocation(const SvtDbAgent::SvtDbAgentMessage &msg,
  //   //                          SvtDbAgent::SvtDbAgentReplyMsg &replyMsg);
  //
  //   void getAllWPMachinesReplyMsg(const std::vector<dbWPMachineRecords>
  //   &wpMachines,
  //                                 SvtDbAgent::SvtDbAgentReplyMsg &msgReply);
  //
  //   void createWPMachineReplyMsg(const dbWPMachineRecords &wpm,
  //                                SvtDbAgent::SvtDbAgentReplyMsg &msgReply);
  // };  // namespace SvtDbWPMachineDto
};  // namespace SvtDbAgent
#endif  //! SVT_DB_WAFER_DTO_H
