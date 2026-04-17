#pragma once

/*!
 * @file ConfigDb.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief DbAgent DB config
 */

#include "SvtConfig.h"

namespace config
{
  class ConfigDb : public SvtConfig::SvtConfig
  {
   private:
    struct _config_db_ctor_tag
    {
      _config_db_ctor_tag() = default;
    };

   public:
    explicit ConfigDb(_config_db_ctor_tag);
    ~ConfigDb() override = default;

    static std::shared_ptr<ConfigDb> factory(nlohmann::json &config);

    const std::string &getHost() const { return mHost; }
    const std::string &getPort() const { return mPort; }
    const std::string &getUser() const { return mUser; }
    const std::string &getPass() const { return mPass; }
    const std::string &getDbName() const { return mDbName; }
    const std::string &getDbSchema() const { return mDbSchema; }

   protected:
    bool decodeJson(nlohmann::json &config) override;

   private:
    std::string mHost = "dbod-svt-sw-pgdb.cern.ch";
    std::string mPort = "6600";
    std::string mUser = "admin";
    std::string mPass = "svt-mosaix";
    std::string mDbName = "svt_sw_db_test";
    std::string mDbSchema = "main";
  };
}  // namespace config
