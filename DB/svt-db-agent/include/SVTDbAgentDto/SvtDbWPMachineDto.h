#ifndef SVT_DB_WAFERPROBEMACHINE_DTO_H
#define SVT_DB_WAFERPROBEMACHINE_DTO_H

/*!
 * @file SvtDbWPMachineDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief Svt Db wafer probe machine DTO
 * */

#include "SvtDbBaseDto.h"
#include "SvtKafkaMessage.h"
#include "SvtUtilities.h"

namespace SvtDbAgent
{
  class SvtDbWaferLoadedInMachineDto : public SvtDbBaseDto
  {
   public:
    SvtDbWaferLoadedInMachineDto()
    {
      setTableName("WaferLoadedInMachine");

      addColName("machineId");
      addColName("waferId");
      addColName("waferOrientation");
      addColName("date");
      addColName("username");
      addColName("status");
    };
    ~SvtDbWaferLoadedInMachineDto() = default;

   private:
    void createAllRequest() final {};
  };

  class SvtDbProbeCardInstalledInMachineDto : public SvtDbBaseDto
  {
   public:
    SvtDbProbeCardInstalledInMachineDto()
    {
      setTableName("ProbeCardInstalledInMachine");

      addColName("machineId");
      addColName("probeCardId");
      addColName("probeCardOrientation");
      addColName("date");
      addColName("username");
    };
    ~SvtDbProbeCardInstalledInMachineDto() = default;

   private:
    void createAllRequest() final {};
  };

  class SvtDbWPMachineDto : public SvtDbBaseDto
  {
   public:
    SvtDbWPMachineDto();
    ~SvtDbWPMachineDto() = default;

    //! Request DTO functions
    void updateWaferLoadedInMachine(const SvtKafka::SvtKafkaMessage &msg,
                                    SvtKafka::SvtKafkaReplyMsg &);
    void updateProbeCardInstalledInMachine(const SvtKafka::SvtKafkaMessage &msg,
                                           SvtKafka::SvtKafkaReplyMsg &);

   private:
    void createAllRequest() final;

    SvtDbWaferLoadedInMachineDto *waferLoaded =
        SvtUtils::Singleton<SvtDbWaferLoadedInMachineDto>::instance();
    SvtDbProbeCardInstalledInMachineDto *pcInstalled =
        SvtUtils::Singleton<SvtDbProbeCardInstalledInMachineDto>::instance();
  };
};  // namespace SvtDbAgent
#endif  //! SVT_DB_WAFER_DTO_H
