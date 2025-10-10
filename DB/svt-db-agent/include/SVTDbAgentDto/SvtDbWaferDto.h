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

   private:
    virtual void createEntry(const SvtDbAgent::SvtDbAgentMessage &msg,
                             SvtDbAgent::SvtDbAgentReplyMsg &replyMsg) final;
    virtual void createAllRequest() final;
  };

  class SvtDbWaferLocationDto : public SvtDbBaseDto
  {
   public:
    SvtDbWaferLocationDto();
    ~SvtDbWaferLocationDto() = default;

   private:
    virtual void createAllRequest() final;
    virtual void getAllEntries(const SvtDbAgentMessage &,
                               SvtDbAgentReplyMsg &) final;
  };
};  // namespace SvtDbAgent
#endif  //! SVT_DB_WAFER_DTO_H
