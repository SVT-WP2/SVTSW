#pragma once

/*!
 * @file SvtDbConfig.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief DB config
 */

#include "SvtConfig.h"

class SvtDbConfig : public SvtConfig
{
 private:
  struct _svtdbconfig_ctor_tag
  {
    _svtdbconfig_ctor_tag() = default;
  };

  std::string mHost = "dbod-svt-sw-pgdb.cern.ch";
  std::string mPort = "6600";
  std::string mUser = "admin";
  std::string mPass = "svt-mosaix";
  std::string mDbName = "svt_sw_db_test";
  std::string mDbSchema = "main";

 protected:
  bool decodeJson(nlohmann::json &config) override;

 public:
  explicit SvtDbConfig(_svtdbconfig_ctor_tag);
  ~SvtDbConfig() override = default;

  static std::shared_ptr<SvtDbConfig> factory(nlohmann::json &config);

  std::string &getHost() { return mHost; }
  std::string &getPort() { return mPort; }
  std::string &getUser() { return mUser; }
  std::string &getPass() { return mPass; }
  std::string &getDbName() { return mDbName; }
  std::string &getDbSchema() { return mDbSchema; }
};
