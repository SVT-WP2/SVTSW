#ifndef SVT_DB_IF_H
#define SVT_DB_IF_H

/*!
 * @file SvtDbOnterface.h
 * @author Y. Corrales <ycmorales@bnl.gov>
 * @date Mar 2024
 * @brief Database interface for SVT test
 */

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

  //! Wafer
  using dbWaferRecords = struct dbWaferRecords
  {
    int id = -1;
    std::string serialNumber;
    int batchNumber = -1;
    std::string foundry;
    std::string technology;
    std::string engineeringRun;
    std::string waferType;
    std::string thinningDate;
    std::string dicingDate;
    std::string productionDate;
  };

  //! Asic
  using dbAsicRecords = struct dbAsicRecords
  {
    int id = -1;
    int waferId = -1;
    std::string serialNumber;
    std::string familyType;
    std::string waferMapPosition;
  };

  //! Wafer topography
  using dbWaferTopoRecords = struct dbWaferTopoRecords
  {
    int id = -1;
    std::string name;  //!<! TODO change to waferType
    std::string imageBase64String;
    std::string waferMap;
  };

  //!
  //! Function declarations
  //!
  int getAllEnumValues(std::string enum_name,
                       std::vector<std::string> &enum_values);
  bool addEnumValue(std::string type_name, std::string value);

  int getMaxId(const std::string &tableName);

  int getAllVersions(std::vector<dbVersion> &versions);

  //! Wafers
  int getAllWafers(std::vector<dbWaferRecords> &wafers,
                   const std::vector<int> &id_filters);
  bool insertWafer(const dbWaferRecords &wafer);
  //! Asics
  int getAllAsics(std::vector<dbAsicRecords> &asics,
                  const std::vector<int> &id_filters);
  bool insertAsic(const dbAsicRecords &asic);
  //! WaferTopography
  int getAllTopography(std::vector<dbWaferTopoRecords> &WaferTopography,
                       const std::vector<int> &id_filters);
  bool insertTopography(const dbWaferTopoRecords &waferTopography);

}  // namespace SvtDbInterface

#endif
