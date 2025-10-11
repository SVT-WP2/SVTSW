#ifndef SVT_DB_CHIP_DTO_H
#define SVT_DB_CHIP_DTO_H

/*!
 * @file SvtDbChipDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Oct-2025
 * @brief Svt Db chip DTO
 * */

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;

  class SvtDbChipLocationDto : public SvtDbBaseDto
  {
   public:
    SvtDbChipLocationDto()
    {
      setTableName("ChipLocation");

      addColName("chipId");
      addColName("generalLocation");
      addColName("creationTime");
      addColName("username");
      addColName("note");
    };
    ~SvtDbChipLocationDto() = default;

   private:
    virtual void createAllRequest() final {};
  };

  class SvtDbChipDto : public SvtDbBaseDto
  {
   public:
    SvtDbChipDto();
    ~SvtDbChipDto() = default;

   private:
    //! request DTO funcions
    void createEntry(const SvtDbAgent::SvtDbAgentMessage &msg,
                     SvtDbAgent::SvtDbAgentReplyMsg &replyMsg) final;
    virtual void
    updateChipLocation(const SvtDbAgent::SvtDbAgentMessage &msg,
                       SvtDbAgent::SvtDbAgentReplyMsg &replyMsg) final;
    virtual void getChipLocationHistory(const SvtDbAgentMessage &,
                                        SvtDbAgentReplyMsg &) final;

    void createAllRequest() final;

    SvtDbChipLocationDto *chipLocDto =
        Singleton<SvtDbChipLocationDto>::instance();
  };

};  // namespace SvtDbAgent
#endif  //! SVT_DB_CHIP_DTO_H
