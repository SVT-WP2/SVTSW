/*!
 * @file DbAgentRequest.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Apr-2025
 * @brief implementation of request
 */

#include <string_view>

#include "DbAgentService/DbAgentRequest.h"
#include "SvtUtilities.h"

#include "DbAgentDto/DbBaseDto.h"

#include "DbAgentDto/DbAsicDto.h"
#include "DbAgentDto/DbChipDto.h"
#include "DbAgentDto/DbEnumDto.h"
#include "DbAgentDto/DbEquipDto.h"
#include "DbAgentDto/DbEquipTypeDto.h"
#include "DbAgentDto/DbProbeCardDto.h"
#include "DbAgentDto/DbTestDto.h"
#include "DbAgentDto/DbTestSetupConfigDto.h"
#include "DbAgentDto/DbTestSetupDto.h"
#include "DbAgentDto/DbTestTemplateDto.h"
#include "DbAgentDto/DbTestTypeConfigDto.h"
#include "DbAgentDto/DbTestTypeDto.h"
#include "DbAgentDto/DbWPMachineDto.h"
#include "DbAgentDto/DbWPProjectDto.h"
#include "DbAgentDto/DbWaferDto.h"
#include "DbAgentDto/DbWaferTypeDto.h"

using SvtUtils::Singleton;
namespace dbagent
{
  //========================================================================+
  DbAgentRequest::DbAgentRequest() { createAllDtos(); }

  //========================================================================+
  void DbAgentRequest::createAllDtos()
  {
    dtoList["SvtDbEnumDto"] = Singleton<DbEnumDto>::instance();
    dtoList["SvtDbWaferTypeDto"] =
        Singleton<DbWaferTypeDto>::instance();
    dtoList["SvtDbWaferDto"] = Singleton<DbWaferDto>::instance();
    dtoList["SvtDbAsicDto"] = Singleton<DbAsicDto>::instance();
    dtoList["SvtDbChipDto"] = Singleton<DbChipDto>::instance();
    dtoList["SvtDbEquipTypeDto"] = Singleton<DbEquipTypeDto>::instance();
    dtoList["SvtDbEquipDto"] = Singleton<DbEquipDto>::instance();
    dtoList["SvtDbTestSetupDto"] = Singleton<DbTestSetupDto>::instance();
    dtoList["SvtDbTestSetupConfigDto"] = Singleton<DbTestSetupConfigDto>::instance();
    dtoList["SvtDbTestDto"] = Singleton<DbTestDto>::instance();
    dtoList["SvtDbTestTypeDto"] = Singleton<DbTestTypeDto>::instance();
    dtoList["SvtDbTestTypeConfigDto"] = Singleton<DbTestTypeConfigDto>::instance();
    dtoList["SvtDbTestTemplateDto"] = Singleton<DbTestTemplateDto>::instance();
    dtoList["SvtDbProbeCardDto"] =
        Singleton<DbProbeCardDto>::instance();
    dtoList["SvtDbWPMachineDto"] =
        Singleton<DbWPMachineDto>::instance();
    dtoList["SvtDbWPProjectDto"] =
        Singleton<DbWPProjectDto>::instance();
  }

  //===========================================================================+
  bool DbAgentRequest::findRequestAndRun(std::string_view reqName,
                                         const SvtKafka::SvtKafkaMessage &msg,
                                         SvtKafka::SvtKafkaReplyMsg &replyMsg)
  {
    bool requestFound = false;
    for (auto &[dtoName, dto] : dtoList)
    {
      if (dto->findRequestAndRun(reqName, msg, replyMsg))
      {
        requestFound = true;
        break;
      }
    }
    return requestFound;
  }
}  // namespace dbagent
