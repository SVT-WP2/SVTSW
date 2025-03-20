#ifndef EPIC_DB_IF_H
#define EPIC_DB_IF_H

/*!
 * @file EpicDbOnterface.h
 * @author Y. Corrales <ycmorales@bnl.gov>
 * @date Mar 2024
 * @brief Database interface for SVT test
 */

#include <string>
#include <vector>

namespace EpicDbInterface
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
    int id = -1;
    std::string serialNumber;
    int batchNumber = -1;
    std::string engineeringRun;
    std::string foundry;
    std::string technology;
    std::string thinningDate;
    std::string dicingDate;
    std::string productionDate;
    std::string waferType;
  };

  //!
  //! Function declarations
  //!
  int getAllEnumValues(std::string enum_name,
                       std::vector<std::string> &enum_values);
  bool addEnumValue(std::string type_name, std::string value);

  int getAllVersions(std::vector<dbVersion> &versions);
  int getAllWafers(std::vector<dbWaferRecords> &wafers,
                   std::vector<int> &id_filters);
  int getMaxWaferId();

  bool insertWaferRecords(const dbWaferRecords &waferRecords);

}  // namespace EpicDbInterface

#endif
