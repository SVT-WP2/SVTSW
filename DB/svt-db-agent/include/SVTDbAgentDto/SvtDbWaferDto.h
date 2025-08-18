#ifndef SVT_DB_WAFER_DTO_H
#define SVT_DB_WAFER_DTO_H

/*!
 * @file SvtDbWafer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db wafer DTO
 * */

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;

  class SvtDbWaferDto : public SvtDbBaseDto
  {
    //! Create asics for wafer
    void createAllAsics(const SvtDbAgent::SvtDbEntry &wafer);

   public:
    SvtDbWaferDto();
    ~SvtDbWaferDto() = default;

    void createEntry(const SvtDbAgent::SvtDbAgentMessage &msg,
                     SvtDbAgent::SvtDbAgentReplyMsg &replyMsg) final;
  };

  class SvtDbWaferLocationDto : public SvtDbBaseDto
  {
   public:
    SvtDbWaferLocationDto();
    ~SvtDbWaferLocationDto() = default;
  };
};  // namespace SvtDbAgent
#endif  //! SVT_DB_WAFER_DTO_H
