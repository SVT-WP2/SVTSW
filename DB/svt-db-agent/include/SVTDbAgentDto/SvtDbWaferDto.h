#ifndef SVT_DB_WAFER_DTO_H
#define SVT_DB_WAFER_DTO_H

/*!
 * @file SvtDbWafer.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db wafer DTO
 * */

#include "SvtDbBaseDto.h"

namespace SvtDbAgent
{
  class SvtDbAgentMessage;
  class SvtDbAgentReplyMsg;

  class SvtDbWaferLocationDto : public SvtDbBaseDto
  {
   public:
    SvtDbWaferLocationDto()
    {
      setTableName("WaferLocation");

      addColName("waferId");
      addColName("generalLocation");
      addColName("date");
      addColName("username");
      addColName("note");
    };
    ~SvtDbWaferLocationDto() = default;

    virtual void parseJsonData(const nlohmann::json &j_data,
                               SvtDbEntry &entry) final
    {
      this->SvtDbBaseDto::parseJsonData(j_data, entry);
    };

   private:
    virtual void createAllRequest() final {};
  };

  class SvtDbWaferDto : public SvtDbBaseDto
  {
   public:
    SvtDbWaferDto();
    ~SvtDbWaferDto() = default;

   private:
    //! request DTO funcions
    virtual void createEntry(const SvtDbAgent::SvtDbAgentMessage &msg,
                             SvtDbAgent::SvtDbAgentReplyMsg &replyMsg) final;
    virtual void updateEntry(const SvtDbAgentMessage &msg,
                             SvtDbAgentReplyMsg &replyMsg) final;
    virtual void
    updateWaferLocation(const SvtDbAgent::SvtDbAgentMessage &msg,
                        SvtDbAgent::SvtDbAgentReplyMsg &replyMsg) final;
    virtual void getWaferLocationHistory(const SvtDbAgentMessage &,
                                         SvtDbAgentReplyMsg &) final;

    virtual void createAllRequest() final;

    //! Create asics for wafer
    void createAllAsics(const SvtDbAgent::SvtDbEntry &wafer);

    SvtDbWaferLocationDto *waferLocDto =
        Singleton<SvtDbWaferLocationDto>::instance();
  };
};  // namespace SvtDbAgent
#endif  //! SVT_DB_WAFER_DTO_H
