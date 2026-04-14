/*!
 * @file SvtDbConfig.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Db config
 */

#include "SVTConfig/SvtDbConfig.h"
#include "SvtJsonUtils.h"

SvtDbConfig::SvtDbConfig(_svtdbconfig_ctor_tag)
  : SvtConfig()
{
}

std::shared_ptr<SvtDbConfig> SvtDbConfig::factory(json &config)
{
  auto ptr =
      std::make_shared<SvtDbConfig>(_svtdbconfig_ctor_tag{});
  ptr->decodeJson(config);
  return ptr;
}

bool SvtDbConfig::decodeJson(json &config)
{
  bool result = SvtUtils::readStringVariable(config, "psqlHost", mHost);
  result &= SvtUtils::readStringVariable(config, "psqlPort", mPort);
  result &= SvtUtils::readStringVariable(config, "psqlUser", mUser);
  result &= SvtUtils::readStringVariable(config, "psqlPass", mPass);
  result &= SvtUtils::readStringVariable(config, "psqlDbName", mDbName);
  result &= SvtUtils::readStringVariable(config, "psqlDbSchema", mDbSchema);

  mInitialized = result;
  return result;
}
