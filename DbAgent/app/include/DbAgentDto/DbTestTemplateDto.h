#pragma once

/*!
 * @file DbTestTemplateDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief  Test Template Dto
 */

#include <string>

#include "DbBaseDto.h"

namespace dbagent
{
  class DbTestTemplateDto : public DbBaseDto
  {
   public:
    DbTestTemplateDto();
    ~DbTestTemplateDto() = default;

   private:
    virtual bool getAllEntriesFromDB(std::vector<DbEntry> &entries,
                                     const std::string &queryString,
                                     const DbEntry &filters,
                                     const std::string &orderBy, const bool orderDec) final;

    virtual void createAllRequest() final;
  };
};  // namespace dbagent
