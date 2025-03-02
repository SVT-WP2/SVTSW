#ifndef SVTDB_IF_H
#define SVTDB_IF_H

/*!
 * @file svtdb_if.h
 * @author Y. Corrales <ycmorales@bnl.gov>
 * @date Mar 2024
 * @brief Database interface for SVT test
 */

#include <string>
#include <vector>

namespace SvtDb_IF
{
  //!
  //! Structure type definitions
  //!
  using dbVersion = struct dbVersion_s
  {
    int id;
    int baseVersion;
    std::string name;
    std::string description;
  };

  using dbWaferRecords = struct dbWaferRecords
  {
    int id;
    std::string_view serialNumber;
    int batchNumber = -1;
    std::string engineeringRun;
    std::string foundry;
    std::string technology;
    std::string thinningDate;
    std::string dicingdate;
    std::string waferType;
  };

  //!
  //! Function declarations
  //!
  std::vector<std::string> getAllEnumValues(std::string enum_name);
  bool addEnumValue(std::string type_name, std::string value);

  int getAllVersions(std::vector<dbVersion> &versions);
  int getAllWafers(std::vector<dbWaferRecords> &wafers);

  bool insertWaferRecords(const dbWaferRecords &waferRecords);

}  // namespace SvtDb_IF

#endif
