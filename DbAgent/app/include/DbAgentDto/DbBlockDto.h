#pragma once

/*!
 * @file DbBlockDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief  Db chip DTO
 * */

#include "DbBaseDto.h"

namespace dbagent
{
  class DbAsicFamilyTypeBlockList : public DbBaseDto
  {
   public:
    DbAsicFamilyTypeBlockList()
    {
      setTableName("AsicFamilyTypeBlockList");

      addColName("asicFamilyType");
      addColName("blockType");
    }

    ~DbAsicFamilyTypeBlockList() = default;

   private:
    void createAllRequest() final {};
  };

  class DbBlockDto : public DbBaseDto
  {
   public:
    DbBlockDto();
    ~DbBlockDto() = default;

   private:
    void createAllRequest() final {};
  };

};  // namespace dbagent
