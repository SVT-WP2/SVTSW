#pragma once

/*!
 * @file DbTableDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Global table Dto
 */

#include <map>
#include <string_view>

namespace dbagent
{
  using colMap = std::map<std::string, bool>;
  class DbTableDto
  {
   public:
    DbTableDto() = default;
    ~DbTableDto() = default;

    //! Setter
    void addColName(const std::string &name, const bool _isReq = true)
    {
      mColNames[name] = _isReq;
    }
    void setTableName(const std::string_view &tName) { mTableName = tName; }

    //! Getters
    const std::string &getTableName() { return mTableName; }

    const colMap &getColNames() { return mColNames; }

    void clear()
    {
      mColNames.clear();
    }

   private:
    colMap mColNames;
    std::string mTableName;
  };
};  // namespace dbagent
