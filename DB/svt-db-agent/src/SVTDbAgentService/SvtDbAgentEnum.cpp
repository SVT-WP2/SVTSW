/*!
 * @file SvtDbEnum.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief SvtDbEnum
 */

#include "SVTDbAgentService/SvtDbAgentEnum.h"
#include "SVTUtilities/SvtLogger.h"
#include "SVTUtilities/SvtUtilities.h"

void SvtDbAgentEnum::Print()
{
  SvtLogger &logger = Singleton<SvtLogger>::instance();
  logger.logInfo("Db Agent Enums");
  for (const auto &[enum_type, values] : enum_type_value_map)
  {
    logger.logInfo("type " + enum_type);
    for (const auto &value : values)
    {
      logger.logInfo("\t " + value);
    }
  }
}
