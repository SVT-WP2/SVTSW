#ifndef SVT_DB_PROBE_CARD_DTO_H
#define SVT_DB_PROBE_CARD_DTO_H

/*!
 * @file SvtDbProbeCard.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Aug-2025
 * @brief Svt Db Probe Card DTO
 * */

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;

  class SvtDbProbeCardDto : public SvtDbBaseDto
  {
   public:
    SvtDbProbeCardDto();
    ~SvtDbProbeCardDto() = default;
  };
};  // namespace SvtDbAgent

#endif  //! SVT_DB_PROBE_CARD_DTO_H
