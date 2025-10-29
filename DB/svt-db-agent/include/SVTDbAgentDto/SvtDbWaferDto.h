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
    virtual void createEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg) final;
    virtual void updateEntry(const SvtKafka::SvtKafkaMessage &msg,
                             SvtKafka::SvtKafkaReplyMsg &replyMsg) final;
    virtual void
    updateWaferLocation(const SvtKafka::SvtKafkaMessage &msg,
                        SvtKafka::SvtKafkaReplyMsg &replyMsg) final;
    virtual void getWaferLocationHistory(const SvtKafka::SvtKafkaMessage &,
                                         SvtKafka::SvtKafkaReplyMsg &) final;

    virtual void createAllRequest() final;

    //! Create asics for wafer
    void createAllAsics(const SvtDbAgent::SvtDbEntry &wafer);

    SvtDbWaferLocationDto *waferLocDto =
        Singleton<SvtDbWaferLocationDto>::instance();
  };
};  // namespace SvtDbAgent
#endif  //! SVT_DB_WAFER_DTO_H
