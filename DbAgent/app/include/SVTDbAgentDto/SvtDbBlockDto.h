#pragma once

/*!
 * @file SvtDbBlockDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Svt Db chip DTO
 * */

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbAsicFamilyTypeBlockList : public SvtDbBaseDto
  {
   public:
    SvtDbAsicFamilyTypeBlockList()
    {
      setTableName("AsicFamilyTypeBlockList");

      addColName("asicFamilyType");
      addColName("blockType");
    }

    ~SvtDbAsicFamilyTypeBlockList() = default;

   private:
    void createAllRequest() final {};
  };

  class SvtDbBlockDto : public SvtDbBaseDto
  {
   public:
    SvtDbBlockDto();
    ~SvtDbBlockDto() = default;

   private:
    void createAllRequest() final {};
  };

};  // namespace SvtDbAgent
