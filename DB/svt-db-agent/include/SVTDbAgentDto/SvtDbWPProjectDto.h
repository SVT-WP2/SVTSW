#ifndef SVT_DB_WAFER_PROBE_PROJECT_DTO_H
#define SVT_DB_WAFER_PROBE_PROJECT_DTO_H

/*!
 * @file SvtDbWPProject.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db Wafer Probe Project DTO
 * */

#include "SVTDbAgentDto/SvtDbBaseDto.h"

#include <nlohmann/json.hpp>

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;

  class SvtDbWPProjectDto : public SvtDbBaseDto
  {
   public:
    SvtDbWPProjectDto();
    ~SvtDbWPProjectDto() = default;
  };
};  // namespace SvtDbAgent

#endif  //! SVT_DB_WAFER_PROBE_PROJECT_DTO_H
