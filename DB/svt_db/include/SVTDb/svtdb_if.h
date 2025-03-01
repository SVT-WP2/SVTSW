#ifndef SVTDB_IF_H
#define SVTDB_IF_H

#include <string>
#include <vector>

namespace SvtDb_IF
{
  // v1 of data model
  /**************************************************************
    Structure type definitions
  **************************************************************/

  using dbVersion = struct dbVersion_s
  {
    int id;
    int baseVersion;
    std::string name;
    std::string description;
  };

  /**************************************************************
    Function declarations
  **************************************************************/
  int getAllVersions(std::vector<dbVersion> &versions);
}  // namespace SvtDb_IF

#endif
