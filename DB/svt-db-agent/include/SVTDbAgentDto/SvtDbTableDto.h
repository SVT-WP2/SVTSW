/*!
 * @file SvtDbTableDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Global table Dto
 */

#include <map>
#include <string>

namespace SvtDbAgent
{
  using colMap = std::map<std::string, bool>;
  class SvtDbTableDto
  {
   public:
    SvtDbTableDto() = default;
    ~SvtDbTableDto() = default;

    //! Setter
    void addColName(const std::string &name, const bool _isReq = true)
    {
      mColNames[name] = _isReq;
    }
    void setTableName(const std::string &tName) { mTableName = tName; }

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
};  // namespace SvtDbAgent
