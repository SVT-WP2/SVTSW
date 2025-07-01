#ifndef SVT_DB_IF_H
#define SVT_DB_IF_H

/*!
 * @file SvtDbOnterface.h
 * @author Y. Corrales <ycmorales@bnl.gov>
 * @date Mar 2024
 * @brief Database interface for SVT test
 */

#include <cstddef>
#include <string>
#include <vector>

namespace SvtDbInterface
{
  //!
  //! Structure type definitions
  //!

  //! Version
  using dbVersion = struct dbVersion_s
  {
    int id;
    int baseVersion;
    std::string name;
    std::string description;
  };

  //!
  //! Function declarations
  //!
  size_t getMaxId(const std::string &tableName);

  bool checkIdExist(const std::string &tableName, int id);

  size_t getAllVersions(std::vector<dbVersion> &versions);
}  // namespace SvtDbInterface

#endif
