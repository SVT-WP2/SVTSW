#pragma once

/*!
 * @file SvtDbTestTemplateDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2026
 * @brief Svt Test Template Dto
 */

#include <string>
#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbTestTemplateDto : public SvtDbBaseDto
  {
   public:
    SvtDbTestTemplateDto();
    ~SvtDbTestTemplateDto() = default;

   private:
    virtual bool getAllEntriesFromDB(std::vector<SvtDbEntry> &entries,
                                     const std::string &queryString,
                                     const SvtDbFilters &filters,
                                     const std::string &orderBy, const bool orderDec) final;

    // virtual void createEntry(const SvtKafka::SvtKafkaMessage &,
    //                          SvtKafka::SvtKafkaReplyMsg &) final;

    virtual void updateEntry(const SvtKafka::SvtKafkaMessage &,
                             SvtKafka::SvtKafkaReplyMsg &) final;

    virtual void createAllRequest() final;
  };
};  // namespace SvtDbAgent
