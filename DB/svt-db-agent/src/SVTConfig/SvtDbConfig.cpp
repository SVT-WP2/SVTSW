/*!
 * @file SvtDbConfig.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Db config
 */

#include "SVTConfig/SvtDbConfig.h"
#include "SVTUtilities/SvtJsonUtils.h"

SvtDbConfig::SvtDbConfig(_svtdbconfig_ctor_tag)
  : SvtConfig()
{
}

std::shared_ptr<SvtDbConfig> SvtDbConfig::factory(json &config)
{
  std::shared_ptr<SvtDbConfig> ptr =
      std::make_shared<SvtDbConfig>(_svtdbconfig_ctor_tag{});
  ptr->decodeJson(config);
  return ptr;
}

bool SvtDbConfig::decodeJson(json &config)
{
  bool result = SvtDbAgent::readStringVariable(config, "psqlHost", mHost);
  result &= SvtDbAgent::readStringVariable(config, "psqlPort", mPort);
  result &= SvtDbAgent::readStringVariable(config, "psqlUser", mUser);
  result &= SvtDbAgent::readStringVariable(config, "psqlPass", mPass);
  result &= SvtDbAgent::readStringVariable(config, "psqlDbName", mDbName);
  result &= SvtDbAgent::readStringVariable(config, "psqlDbSchema", mDbSchema);

  mInitialized = result;
  return result;
}
