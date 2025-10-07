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

  class SvtDbWaferLoadedInMachineDto : public SvtDbBaseDto
  {
   public:
    SvtDbWaferLoadedInMachineDto();
    ~SvtDbWaferLoadedInMachineDto() = default;

   private:
    void createAllRequest() final;
  };

  class SvtDbWPMachineDto : public SvtDbBaseDto
  {
   public:
    SvtDbWPMachineDto();
    ~SvtDbWPMachineDto() = default;

   private:
    void createAllRequest() final;
  };
};  // namespace SvtDbAgent
#endif  //! SVT_DB_WAFER_DTO_H
