#pragma once

/*!
 * @file DbWPMachineDto.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Jun-2025
 * @brief  Db wafer probe machine DTO
 * */

#include "DbBaseDto.h"
#include "SvtKafkaMessage.h"
#include "SvtUtilities.h"

namespace dbagent
{
  class DbWaferLoadedInMachineDto : public DbBaseDto
  {
   public:
    DbWaferLoadedInMachineDto()
    {
      setTableName("WaferLoadedInMachine");

      addColName("machineId");
      addColName("waferId");
      addColName("waferOrientation");
      addColName("date");
      addColName("username");
      addColName("status");
    };
    ~DbWaferLoadedInMachineDto() = default;

   private:
    void createAllRequest() final {};
  };

  class DbProbeCardInstalledInMachineDto : public DbBaseDto
  {
   public:
    DbProbeCardInstalledInMachineDto()
    {
      setTableName("ProbeCardInstalledInMachine");

      addColName("machineId");
      addColName("probeCardId");
      addColName("probeCardOrientation");
      addColName("date");
      addColName("username");
    };
    ~DbProbeCardInstalledInMachineDto() = default;

   private:
    void createAllRequest() final {};
  };

  class DbWPMachineDto : public DbBaseDto
  {
   public:
    DbWPMachineDto();
    ~DbWPMachineDto() = default;

    //! Request DTO functions
    void updateWaferLoadedInMachine(const SvtKafka::SvtKafkaMessage &msg,
                                    SvtKafka::SvtKafkaReplyMsg &);
    void updateProbeCardInstalledInMachine(const SvtKafka::SvtKafkaMessage &msg,
                                           SvtKafka::SvtKafkaReplyMsg &);

   private:
    void createAllRequest() final;

    DbWaferLoadedInMachineDto *waferLoaded =
        SvtUtils::Singleton<DbWaferLoadedInMachineDto>::instance();
    DbProbeCardInstalledInMachineDto *pcInstalled =
        SvtUtils::Singleton<DbProbeCardInstalledInMachineDto>::instance();
  };
};  // namespace dbagent
