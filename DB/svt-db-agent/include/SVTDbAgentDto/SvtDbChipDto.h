#ifndef SVT_DB_CHIP_DTO_H
#define SVT_DB_CHIP_DTO_H

/*!
 * @file SvtDbChipDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Svt Db chip DTO
 * */

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;

  class SvtDbChipDto : public SvtDbBaseDto
  {
   public:
    SvtDbChipDto();
    ~SvtDbChipDto() = default;

    void createEntry(const SvtDbAgent::SvtDbAgentMessage &msg,
                     SvtDbAgent::SvtDbAgentReplyMsg &replyMsg) final;
  };

  class SvtDbChipLocationDto : public SvtDbBaseDto
  {
   public:
    SvtDbChipLocationDto();
    ~SvtDbChipLocationDto() = default;
  };
};  // namespace SvtDbAgent
#endif  //! SVT_DB_CHIP_DTO_H
